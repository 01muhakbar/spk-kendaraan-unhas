const sequelize = require('../config/database');
const Vehicle = require('./Vehicle');
const Signatory = require('./Signatory');
const VendorMaster = require('./VendorMaster');
const SPK = require('./SPK');
const SystemSetting = require('./SystemSetting');

// Register every model before schema preparation or request handling.
const syncDatabase = async () => {
  await sequelize.sync();
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
