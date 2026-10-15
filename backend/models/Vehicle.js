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
    allowNull: false
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
  },
  model: {
    type: DataTypes.STRING,
    allowNull: true
  },
  warna: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isi_silinder: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  no_rangka: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  no_mesin: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  tgl_jatuh_tempo_pajak: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  tgl_jatuh_tempo_stnk: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  status_legalitas: {
    type: DataTypes.ENUM('AKTIF', 'WARNING', 'EXPIRED'),
    defaultValue: 'AKTIF'
  }
}, {
  tableName: 'master_vehicles',
  timestamps: true
});

module.exports = Vehicle;
