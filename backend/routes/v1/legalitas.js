const express = require('express');
const router = express.Router();
const { Vehicle, RiwayatLegalitas } = require('../../models');
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

module.exports = router;
