const sequelize = require('../config/database');

module.exports = {
  sequelize,
  get syncDatabase() {
    return async () => {
      try {
        await sequelize.sync({ alter: true });
        console.log('Database synchronized (alter: true).');
      } catch (error) {
        console.error('Failed to sync database:', error);
      }
    };
  },
  get Vehicle() { return require('./Vehicle'); },
  get Signatory() { return require('./Signatory'); },
  get VendorMaster() { return require('./VendorMaster'); },
  get SPK() { return require('./SPK'); },
  get SystemSetting() { return require('./SystemSetting'); }
};
