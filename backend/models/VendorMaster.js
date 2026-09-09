const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VendorMaster = sequelize.define('VendorMaster', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nama_bengkel: {
    type: DataTypes.STRING,
    allowNull: false
  },
  alamat_kontak: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'master_vendors',
  timestamps: true
});

module.exports = VendorMaster;
