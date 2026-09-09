const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Signatory = sequelize.define('Signatory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nama_lengkap: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nip_nik: {
    type: DataTypes.STRING,
    allowNull: false
  },
  jabatan: {
    type: DataTypes.STRING,
    allowNull: false
  },
  kategori_peran: {
    type: DataTypes.ENUM('DIREKTUR', 'KASUBDIT', 'KASI_TU', 'TEKNISI'),
    allowNull: false
  }
}, {
  tableName: 'master_signatories',
  timestamps: true
});

module.exports = Signatory;
