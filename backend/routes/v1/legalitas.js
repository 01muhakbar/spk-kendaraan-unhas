const express = require('express');
const router = express.Router();
const { Vehicle, RiwayatLegalitas, Signatory, SystemSetting } = require('../../models');
const { generateSamsatLetterPDF } = require('../../services/samsatPdfGenerator');
const sequelize = require('../../config/database');
const moment = require('moment');

// POST /api/v1/legalitas - Proses transaksi pembayaran pajak
router.post('/', async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { vehicleId, jenisPengurusan, tanggalPembayaran, biayaPengurusan, dokumenBuktiUrl, nomorPolisiBaru } = req.body;

    if (!vehicleId || !jenisPengurusan || !tanggalPembayaran || biayaPengurusan == null) {
      throw new Error("Lengkapi data yang diwajibkan");
    }

    if (['PLAT_5_TAHUN', 'PAJAK_1_TAHUN_DAN_PLAT_5_TAHUN'].includes(jenisPengurusan)) {
      if (!nomorPolisiBaru || nomorPolisiBaru.trim() === '') {
        throw new Error("Nomor Polisi baru wajib diisi untuk pergantian plat");
      }
    }

    // 1. Ambil data kendaraan saat ini
    const vehicle = await Vehicle.findByPk(vehicleId, { transaction: t });
    if (!vehicle) {
      throw new Error("Kendaraan tidak ditemukan");
    }

    // 2. Catat histori pembayaran ke tabel Riwayat_Legalitas
    const riwayatBaru = await RiwayatLegalitas.create({
      vehicleId,
      jenis_pengurusan: jenisPengurusan,
      tanggal_pembayaran: tanggalPembayaran,
      biaya_pengurusan: biayaPengurusan,
      bukti_dokumen_url: dokumenBuktiUrl || null
    }, { transaction: t });

    // 3. Kalkulasi perpanjangan tanggal jatuh tempo
    let perpanjanganPajak = moment(vehicle.tgl_jatuh_tempo_pajak || new Date());
    let perpanjanganStnk = moment(vehicle.tgl_jatuh_tempo_stnk || new Date());

    if (jenisPengurusan === 'PAJAK_1_TAHUN') {
      perpanjanganPajak.add(1, 'years');
    } else if (jenisPengurusan === 'PLAT_5_TAHUN') {
      perpanjanganStnk.add(5, 'years');
    } else if (jenisPengurusan === 'PAJAK_1_TAHUN_DAN_PLAT_5_TAHUN') {
      perpanjanganPajak.add(1, 'years');
      perpanjanganStnk.add(5, 'years');
    }

    // 4. Update tabel Master Kendaraan (Reset status menjadi AKTIF dan update nomor polisi jika ada)
    const updateData = {
      tgl_jatuh_tempo_pajak: perpanjanganPajak.format('YYYY-MM-DD'),
      tgl_jatuh_tempo_stnk: perpanjanganStnk.format('YYYY-MM-DD'),
      status_legalitas: 'AKTIF'
    };

    if (['PLAT_5_TAHUN', 'PAJAK_1_TAHUN_DAN_PLAT_5_TAHUN'].includes(jenisPengurusan) && nomorPolisiBaru) {
      updateData.nomor_polisi = nomorPolisiBaru.toUpperCase();
    }

    await vehicle.update(updateData, { transaction: t });

    // 5. Commit transaksi jika semua langkah berhasil
    await t.commit();

    res.status(201).json({
      message: "Pembayaran pajak berhasil dicatat. Status legalitas kendaraan telah kembali AKTIF.",
      data: riwayatBaru
    });

  } catch (error) {
    // 6. Rollback (batalkan) jika terjadi kegagalan di tengah jalan
    await t.rollback();
    console.error("Gagal mencatat legalitas:", error);
    res.status(500).json({ error: error.message || "Terjadi kesalahan server" });
  }
});

// GET /api/v1/legalitas/riwayat - Mendapatkan riwayat pembayaran
router.get('/riwayat', async (req, res) => {
  try {
    const riwayat = await RiwayatLegalitas.findAll({
      include: [{ model: Vehicle, as: 'vehicle' }],
      order: [['tanggal_pembayaran', 'DESC']]
    });
    res.json(riwayat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/v1/legalitas/:id - Update riwayat pembayaran
router.put('/:id', async (req, res) => {
  try {
    const record = await RiwayatLegalitas.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: "Data tidak ditemukan" });

    const { jenisPengurusan, tanggalPembayaran, biayaPengurusan, dokumenBuktiUrl, nomorPolisiBaru } = req.body;
    
    await record.update({
      jenis_pengurusan: jenisPengurusan,
      tanggal_pembayaran: tanggalPembayaran,
      biaya_pengurusan: biayaPengurusan,
      bukti_dokumen_url: dokumenBuktiUrl || null
    });

    // Update vehicle's nomor polisi if applicable
    if (['PLAT_5_TAHUN', 'PAJAK_1_TAHUN_DAN_PLAT_5_TAHUN'].includes(jenisPengurusan) && nomorPolisiBaru) {
      const vehicle = await Vehicle.findByPk(record.vehicleId);
      if (vehicle) {
        await vehicle.update({ nomor_polisi: nomorPolisiBaru.toUpperCase() });
      }
    }

    res.json({ message: "Riwayat pembayaran berhasil diperbarui", data: record });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v1/legalitas/:id - Hapus riwayat pembayaran
router.delete('/:id', async (req, res) => {
  try {
    const record = await RiwayatLegalitas.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: "Data tidak ditemukan" });
    await record.destroy();
    res.json({ message: "Riwayat pembayaran berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/legalitas/cetak-surat - Generate Surat Rekomendasi & Kuasa SAMSAT PDF
router.post('/cetak-surat', async (req, res) => {
  try {
    const { vehicleId, nomorSurat, perihalSurat, pemberiKuasaId, penerimaKuasaId } = req.body;

    if (!vehicleId || !pemberiKuasaId || !penerimaKuasaId) {
      return res.status(400).json({ error: "Parameter tidak lengkap: vehicleId, pemberiKuasaId, dan penerimaKuasaId wajib diisi." });
    }

    // Pembaruan Kueri Sequelize dengan atribut spesifikasi STNK eksplisit
    const vehicleData = await Vehicle.findOne({
      where: { id: vehicleId },
      attributes: [
        'id',
        'nomor_polisi',
        'merek_type',
        'jenis_kendaraan',
        'model',
        'no_rangka',
        'no_mesin',
        'warna',
        'isi_silinder'
      ]
    });

    if (!vehicleData) {
      return res.status(404).json({ error: "Data kendaraan tidak ditemukan." });
    }

    const pemberiKuasa = await Signatory.findByPk(pemberiKuasaId);
    if (!pemberiKuasa) {
      return res.status(404).json({ error: "Data pejabat pemberi kuasa tidak ditemukan." });
    }

    const penerimaKuasa = await Signatory.findByPk(penerimaKuasaId);
    if (!penerimaKuasa) {
      return res.status(404).json({ error: "Data staf penerima kuasa tidak ditemukan." });
    }

    // Penanganan Nilai Null (Fallback Data)
    const sanitizedVehicle = {
      id: vehicleData.id,
      nomor_polisi: vehicleData.nomor_polisi ? vehicleData.nomor_polisi.trim() : '-',
      merek_type: vehicleData.merek_type ? vehicleData.merek_type.trim() : '-',
      merek: vehicleData.merek_type ? vehicleData.merek_type.trim() : '-',
      jenis_kendaraan: vehicleData.jenis_kendaraan ? vehicleData.jenis_kendaraan.trim() : '-',
      jenis: vehicleData.jenis_kendaraan ? vehicleData.jenis_kendaraan.trim() : '-',
      model: vehicleData.model && vehicleData.model.trim() ? vehicleData.model.trim() : '-',
      no_rangka: vehicleData.no_rangka && vehicleData.no_rangka.trim() ? vehicleData.no_rangka.trim() : '-',
      no_mesin: vehicleData.no_mesin && vehicleData.no_mesin.trim() ? vehicleData.no_mesin.trim() : '-',
      warna: vehicleData.warna && vehicleData.warna.trim() ? vehicleData.warna.trim() : '-',
      isi_silinder: vehicleData.isi_silinder != null ? `${vehicleData.isi_silinder} cc` : '-'
    };

    const sanitizedPemberi = {
      nama: pemberiKuasa.nama_lengkap || '-',
      nama_lengkap: pemberiKuasa.nama_lengkap || '-',
      nip: pemberiKuasa.nip_nik || '-',
      nip_nik: pemberiKuasa.nip_nik || '-',
      jabatan: pemberiKuasa.jabatan || 'Kepala Subdirektorat Kerumahtanggaan dan Keprotokolan',
      alamat: 'Jl. P. Kemerdekaan Km. 10 Makassar'
    };

    const sanitizedPenerima = {
      nama: penerimaKuasa.nama_lengkap || '-',
      nama_lengkap: penerimaKuasa.nama_lengkap || '-',
      nip: penerimaKuasa.nip_nik || '-',
      nip_nik: penerimaKuasa.nip_nik || '-',
      jabatan: penerimaKuasa.jabatan || 'Staf Operasional',
      alamat: 'Jl. P. Kemerdekaan Km. 10 Makassar'
    };

    // Ambil Pengaturan Kop & Logo identik dengan Pratinjau Dokumen SPK
    const defaultKop = {
      KOP_KIRI_1: 'KEMENTERIAN PENDIDIKAN TINGGI, SAINS,',
      KOP_KIRI_2: 'DAN TEKNOLOGI',
      KOP_KIRI_3: 'UNIVERSITAS HASANUDDIN',
      KOP_KIRI_4: '',
      KOP_KANAN_1: 'Jalan Perintis Kemerdekaan Km. 10',
      KOP_KANAN_2: 'Tamalanrea, Makassar 90245',
      KOP_KANAN_3: '',
      KOP_KANAN_4: 'e-mail: office@unhas.ac.id',
      KOP_KANAN_5: 'Laman: www.unhas.ac.id'
    };

    const settings = await SystemSetting.findAll();
    const kopSettings = { ...defaultKop };
    let logoUrl = null;

    settings.forEach(s => {
      if (s.setting_key === 'LOGO_KOP_SURAT') {
        logoUrl = s.setting_value;
      } else {
        kopSettings[s.setting_key] = s.setting_value;
      }
    });

    const pdfBuffer = await generateSamsatLetterPDF({
      vehicle: sanitizedVehicle,
      pemberiKuasa: sanitizedPemberi,
      penerimaKuasa: sanitizedPenerima,
      nomorSurat: nomorSurat || '65969/UN4.1.6.1.3/PL.10.04/2026',
      perihalSurat: perihalSurat || 'Pembayaran Pajak Tahunan dan Pergantian STNK',
      kopSettings,
      logoUrl
    });

    const cleanPlat = (sanitizedVehicle.nomor_polisi || 'KENDARAAN').replace(/\s+/g, '_');
    const filename = `Surat_Kuasa_SAMSAT_${cleanPlat}_${new Date().getFullYear()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("Gagal membuat PDF Surat SAMSAT:", error);
    res.status(500).json({ error: "Gagal membuat PDF: " + error.message });
  }
});

module.exports = router;
