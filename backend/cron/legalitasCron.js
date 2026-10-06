const cron = require('node-cron');
const { Vehicle } = require('../models');
const { Op } = require('sequelize');

// Jalankan setiap tengah malam (0 0 * * *)
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Menjalankan pengecekan status legalitas kendaraan...');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Cari semua kendaraan
    const vehicles = await Vehicle.findAll();

    let updatedCount = 0;

    for (const vehicle of vehicles) {
      if (!vehicle.tgl_jatuh_tempo_pajak && !vehicle.tgl_jatuh_tempo_stnk) continue;
      
      let newStatus = 'AKTIF';
      const tglPajak = vehicle.tgl_jatuh_tempo_pajak ? new Date(vehicle.tgl_jatuh_tempo_pajak) : null;
      const tglStnk = vehicle.tgl_jatuh_tempo_stnk ? new Date(vehicle.tgl_jatuh_tempo_stnk) : null;

      // Cek mana yang lebih dulu jatuh tempo
      let terdekat = null;
      if (tglPajak && tglStnk) {
        terdekat = tglPajak < tglStnk ? tglPajak : tglStnk;
      } else {
        terdekat = tglPajak || tglStnk;
      }

      if (terdekat) {
        if (terdekat < today) {
          newStatus = 'EXPIRED';
        } else if (terdekat <= thirtyDaysFromNow) {
          newStatus = 'WARNING';
        }
      }

      if (vehicle.status_legalitas !== newStatus) {
        await vehicle.update({ status_legalitas: newStatus });
        updatedCount++;
        console.log(`[CRON] Kendaraan ${vehicle.nomor_polisi} diupdate menjadi ${newStatus}`);
      }
    }

    console.log(`[CRON] Selesai pengecekan. Total diupdate: ${updatedCount}`);
  } catch (error) {
    console.error('[CRON] Gagal menjalankan pengecekan legalitas:', error);
  }
});
