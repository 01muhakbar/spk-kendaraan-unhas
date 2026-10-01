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
      order: [['createdAt', 'DESC']]
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
  try {
    const importSchema = z.array(z.object({
      nomorSPK: z.string().min(1, "Nomor SPK wajib diisi"),
      vehicleId: z.string().uuid("Vehicle ID harus UUID valid"),
      vendorId: z.string().uuid("Vendor ID harus UUID valid"),
      tanggalLaporan: z.string().min(1, "Tanggal Laporan wajib diisi"),
    }).passthrough());
    
    // Validasi data masuk dengan Zod
    const validDataArray = importSchema.parse(req.body);
    
    // Logika Upsert
    await SPK.bulkCreate(validDataArray, {
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
      ] 
    });
    
    res.status(200).json({ message: "Data berhasil diimpor" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validasi gagal: Data tidak sesuai format', details: error.errors });
    }
    res.status(500).json({ error: error.message });
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

// DELETE — hapus SPK
router.delete('/:id', async (req, res) => {
  try {
    await SPK.destroy({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
