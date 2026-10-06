const express = require('express');
const router = express.Router();
const { Vehicle, RiwayatLegalitas } = require('../../models');
const { Op } = require('sequelize');

// GET /api/v1/analytics/budget-proyeksi
router.get('/budget-proyeksi', async (req, res) => {
  try {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);

    // Cari kendaraan yang pajaknya jatuh tempo bulan depan
    const vehiclesDue = await Vehicle.findAll({
      where: {
        tgl_jatuh_tempo_pajak: {
          [Op.gte]: nextMonth,
          [Op.lte]: endOfNextMonth
        }
      }
    });

    let totalBudget = 0;
    const details = [];

    for (const v of vehiclesDue) {
      // Cari biaya pengurusan tahun sebelumnya
      const lastPayment = await RiwayatLegalitas.findOne({
        where: { vehicleId: v.id },
        order: [['tanggal_pembayaran', 'DESC']]
      });

      const estimatedCost = lastPayment ? lastPayment.biaya_pengurusan : 0;
      totalBudget += estimatedCost;
      
      details.push({
        vehicleId: v.id,
        nomor_polisi: v.nomor_polisi,
        merek_type: v.merek_type,
        tgl_jatuh_tempo_pajak: v.tgl_jatuh_tempo_pajak,
        estimatedCost
      });
    }

    res.json({
      totalBudget,
      vehicleCount: vehiclesDue.length,
      details
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
