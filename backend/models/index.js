const sequelize = require('../config/database');

const Vehicle = require('./Vehicle');
const Signatory = require('./Signatory');
const VendorMaster = require('./VendorMaster');
const SPK = require('./SPK');
const SystemSetting = require('./SystemSetting');

const syncDatabase = async () => {
  try {
    // Gunakan alter: true agar tabel baru terbuat tanpa menghapus data yang sudah ada
    await sequelize.sync({ alter: true });
    console.log('Database synchronized (alter: true).');
  } catch (error) {
    console.error('Failed to sync database:', error);
  }
};

module.exports = {
  sequelize,
  syncDatabase,
  Vehicle,
  Signatory,
  VendorMaster,
  SPK,
  SystemSetting
};
