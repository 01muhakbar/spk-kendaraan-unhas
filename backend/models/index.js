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

module.exports.sequelize = sequelize;
module.exports.syncDatabase = syncDatabase;
module.exports.Vehicle = Vehicle;
module.exports.Signatory = Signatory;
module.exports.VendorMaster = VendorMaster;
module.exports.SPK = SPK;
module.exports.SystemSetting = SystemSetting;
