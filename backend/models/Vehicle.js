const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Vehicle = sequelize.define('Vehicle', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nomor_polisi: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  merek_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  jenis_kendaraan: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nama_sopir: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'master_vehicles',
  timestamps: true
});

module.exports = Vehicle;
