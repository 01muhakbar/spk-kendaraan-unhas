const express = require('express');
const router = express.Router();
const SPK = require('../../models/SPK');
const Vehicle = require('../../models/Vehicle');
const VendorMaster = require('../../models/VendorMaster');
const sequelize = require('../../config/database');
const { Op } = require('sequelize');
const { z } = require('zod');

if (!SPK || !Vehicle || !VendorMaster) {
  console.error('CRITICAL: One or more models are undefined upon import in spk.js');
}

/**
 * Generate nomor SPK dengan format: {urut}/RT/P-Kend/2026
 * Nomor urut di-reset setiap tahun dan di-pad menjadi 3 digit.
 */
const generateSPKNumber = async () => {
  const tahun = new Date().getFullYear();

  const lastSPK = await SPK.findOne({
    where: {
      nomorSPK: {
        [Op.like]: `%/RT/P-Kend/${tahun}`
      }
    },
    order: [['nomorUrut', 'DESC']]
  });

  const nextUrut = lastSPK ? lastSPK.nomorUrut + 1 : 1;
  const paddedUrut = nextUrut.toString().padStart(3, '0');
  const nomorSPK = `${paddedUrut}/RT/P-Kend/${tahun}`;

  return { nomorSPK, nomorUrut: nextUrut };
};

// GET next SPK number
router.get('/next-number', async (req, res) => {
  try {
    const { nomorUrut } = await generateSPKNumber();
    res.json({ nextUrut: nomorUrut.toString().padStart(3, '0') });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET semua SPK
router.get('/', async (req, res) => {
  try {
    const data = await SPK.findAll({
      include: [
        { model: Vehicle, as: 'vehicle' },
        { model: VendorMaster, as: 'vendor' }
      ],
      order: [
        ['tahun', 'DESC'],
        ['nomorUrut', 'DESC']
      ]
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET satu SPK by id
router.get('/:id', async (req, res) => {
  try {
    const data = await SPK.findByPk(req.params.id, {
      include: [
        { model: Vehicle, as: 'vehicle' },
        { model: VendorMaster, as: 'vendor' }
      ]
    });
    if (!data) return res.status(404).json({ error: 'SPK tidak ditemukan' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — buat SPK baru
router.post('/', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const tahun = new Date().getFullYear();
    let { nomorUrutInput, isManualEdit, ...dataLainnya } = req.body;
    let finalNomorSPK, finalNomorUrut;

    if (isManualEdit && nomorUrutInput) {
      finalNomorUrut = parseInt(nomorUrutInput, 10);
      const paddedUrut = finalNomorUrut.toString().padStart(3, '0');
      finalNomorSPK = `${paddedUrut}/RT/P-Kend/${tahun}`;
    } else {
      // Locking row level untuk mencegah race condition
      const maxSpk = await SPK.findOne({
        attributes: [[sequelize.fn('MAX', sequelize.col('nomorUrut')), 'max_nomor']],
        where: { tahun: tahun },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      const maxNumber = maxSpk.getDataValue('max_nomor') || 0;
      finalNomorUrut = maxNumber + 1;
      const paddedUrut = finalNomorUrut.toString().padStart(3, '0');
      finalNomorSPK = `${paddedUrut}/RT/P-Kend/${tahun}`;
    }

    const newSPK = await SPK.create({
      ...dataLainnya,
      nomorSPK: finalNomorSPK,
      nomorUrut: finalNomorUrut,
      tahun: tahun
    }, { transaction: t });

    await t.commit();
    res.status(201).json(newSPK);
  } catch (error) {
    await t.rollback();
    
    // Tangkap error jika terjadi konflik unique index (Race Condition)
    if (error.name === 'SequelizeUniqueConstraintError') {
      const currentMax = await SPK.max('nomorUrut', { where: { tahun: new Date().getFullYear() } });
      const rekomendasi_nomor = (currentMax || 0) + 1;
      return res.status(409).json({ 
        error: `Nomor SPK sudah digunakan oleh pengguna lain.`, 
        rekomendasi_nomor: rekomendasi_nomor 
      });
    }

    res.status(400).json({ error: error.message });
  }
});

// POST - import SPK
router.post('/import', async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const rawDataArray = req.body;
    if (!Array.isArray(rawDataArray)) {
      return res.status(400).json({ error: "Format data tidak valid, harus berupa array" });
    }

    const importSchema = z.array(z.object({
      Nomor_SPK: z.string().min(1).optional(),
      nomorSPK: z.string().min(1).optional(),
      Tanggal_Laporan: z.string().min(1).optional(),
      tanggalLaporan: z.string().min(1).optional(),
      Nomor_Polisi: z.string().min(1).optional(),
      Nama_Bengkel: z.string().min(1).optional(),
      Daftar_Kerusakan: z.string().min(1).optional(),
      Rekomendasi: z.string().optional(),
      vehicleId: z.string().uuid().optional(),
      vendorId: z.string().uuid().optional(),
    }).passthrough().refine(data => data.Nomor_SPK || data.nomorSPK, { message: "Nomor SPK wajib diisi" })
      .refine(data => data.Tanggal_Laporan || data.tanggalLaporan, { message: "Tanggal Laporan wajib diisi" })
      .refine(data => data.Nomor_Polisi || data.vehicleId, { message: "Nomor Polisi / Vehicle ID wajib diisi" })
      .refine(data => data.Nama_Bengkel || data.vendorId, { message: "Nama Bengkel / Vendor ID wajib diisi" }));

    // Validasi skema
    importSchema.parse(rawDataArray);

    const processedDataArray = [];
    const skippedRows = [];

    // Lakukan iterasi satu per satu karena ada async lookup ke database
    for (let i = 0; i < rawDataArray.length; i++) {
      const item = rawDataArray[i];
      const rowNumber = i + 1; // Untuk pesan error agar user friendly (bila baris di CSV)

      try {
        // 1. Dukungan untuk format Human-Readable vs Machine-Readable
        const nomorSPK = item.Nomor_SPK || item.nomorSPK;
        const tanggalLaporan = item.Tanggal_Laporan || item.tanggalLaporan;
        
        if (!nomorSPK) throw new Error(`Nomor SPK wajib diisi.`);
        if (!tanggalLaporan) throw new Error(`Tanggal Laporan wajib diisi.`);

        // 2. Lookup Relasi Data (Vehicle dan Vendor)
        let vehicleId = item.vehicleId;
        if (item.Nomor_Polisi) {
          const vehicle = await Vehicle.findOne({ where: { nomor_polisi: item.Nomor_Polisi } });
          if (!vehicle) {
            throw new Error(`Nomor Polisi '${item.Nomor_Polisi}' tidak terdaftar.`);
          }
          vehicleId = vehicle.id;
        }

        let vendorId = item.vendorId;
        if (item.Nama_Bengkel) {
          const vendor = await VendorMaster.findOne({ where: { nama_bengkel: item.Nama_Bengkel } });
          if (!vendor) {
            throw new Error(`Nama Bengkel '${item.Nama_Bengkel}' tidak terdaftar.`);
          }
          vendorId = vendor.id;
        }

        if (!vehicleId) throw new Error(`Nomor Polisi wajib diisi.`);
        if (!vendorId) throw new Error(`Nama Bengkel wajib diisi.`);

        // 3. Flattening dan Transformasi JSON (Daftar_Kerusakan)
        let daftarKerusakan = item.daftarKerusakan || [];
        let tabelPekerjaan = item.tabelPekerjaan || [];
        let tabelPengecekan = item.tabelPengecekan || [];

        if (item.Daftar_Kerusakan && typeof item.Daftar_Kerusakan === 'string') {
          // Dukungan pemisahan dengan koma atau newline, serta membersihkan penomoran (cth: "1. ")
          const kerusakanArrayStr = item.Daftar_Kerusakan.split(/[\n,]+/).map(k => k.trim().replace(/^[0-9]+\.\s*/, '')).filter(Boolean);
          
          daftarKerusakan = kerusakanArrayStr;
          
          tabelPekerjaan = kerusakanArrayStr.map(k => ({
            jenisPekerjaan: k,
            satuan: "",
            kuantitas: ""
          }));

          tabelPengecekan = kerusakanArrayStr.map(k => ({
            komponenRusak: k,
            rekomendasi: item.Rekomendasi || "Perbaikan",
            keterangan: ""
          }));
        }

        processedDataArray.push({
          ...item,
          nomorSPK,
          tanggalLaporan,
          vehicleId,
          vendorId,
          daftarKerusakan,
          tabelPekerjaan,
          tabelPengecekan
        });
      } catch (err) {
        skippedRows.push(`Baris ${rowNumber}: ${err.message}`);
      }
    }

    if (processedDataArray.length === 0) {
      throw new Error(`Semua baris gagal divalidasi. Tidak ada data yang diimpor.\n\nDetail:\n${skippedRows.slice(0, 5).join('\n')}${skippedRows.length > 5 ? '\n...' : ''}`);
    }

    // 4. Logika Upsert
    await SPK.bulkCreate(processedDataArray, {
      updateOnDuplicate: [
        "nomorUrut",
        "tanggalLaporan", 
        "daftarKerusakan",
        "tabelPengecekan",
        "tanggalPengecekan", 
        "tanggalPersetujuan", 
        "tabelPekerjaan",
        "masaGaransi",
        "tanggalMasukBengkel", 
        "status", 
        "penerimaType",
        "pelaporType",
        "tabelPekerjaanType",
        "vehicleId", 
        "vendorId", 
        "updatedAt"
      ],
      transaction
    });
    
    await transaction.commit();

    let finalMessage = `Berhasil mengimpor ${processedDataArray.length} data.`;
    if (skippedRows.length > 0) {
      finalMessage += ` Terdapat ${skippedRows.length} baris gagal diabaikan (karena Nomor Polisi / Bengkel tidak terdaftar).`;
    }

    res.status(200).json({ message: finalMessage, skipped: skippedRows });
  } catch (error) {
    if (transaction) await transaction.rollback();
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validasi gagal: Kolom wajib tidak boleh kosong.', details: error.errors });
    }
    res.status(400).json({ error: error.message });
  }
});

// PUT — update SPK
router.put('/:id', async (req, res) => {
  try {
    const updated = await sequelize.transaction(async (transaction) => {
      const data = await SPK.findByPk(req.params.id, {
        include: [
          { model: Vehicle, as: 'vehicle' },
          { model: VendorMaster, as: 'vendor' }
        ],
        transaction
      });
      if (!data) return null;
      await data.update(req.body, { transaction });
      return data.reload({ transaction });
    });
    if (!updated) return res.status(404).json({ error: 'SPK tidak ditemukan' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE — hapus SPK secara permanen (hard delete) agar nomor SPK bisa digunakan kembali
router.delete('/:id', async (req, res) => {
  try {
    await SPK.destroy({ where: { id: req.params.id }, force: true });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ROUTE DARURAT: Membersihkan SPK yang terlanjur di-soft-delete sebelumnya
router.get('/force-cleanup/now', async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const count = await SPK.destroy({ 
      where: { deletedAt: { [Op.ne]: null } }, 
      force: true,
      paranoid: false
    });
    res.json({ message: `Berhasil membersihkan ${count} SPK yang menyangkut di database!` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
