const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RiwayatLegalitas = sequelize.define('RiwayatLegalitas', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  vehicleId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  jenis_pengurusan: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tanggal_pembayaran: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  biaya_pengurusan: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  bukti_dokumen_url: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'riwayat_legalitas',
  timestamps: true
});

const Vehicle = require('./Vehicle');
RiwayatLegalitas.belongsTo(Vehicle, { as: 'vehicle', foreignKey: 'vehicleId' });
Vehicle.hasMany(RiwayatLegalitas, { as: 'riwayat_legalitas', foreignKey: 'vehicleId' });

module.exports = RiwayatLegalitas;
