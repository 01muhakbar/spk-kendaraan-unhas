const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Vehicle = require('./Vehicle');
const VendorMaster = require('./VendorMaster');

const SPK = sequelize.define('SPK', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nomorUrut: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  nomorSPK: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  tanggalLaporan: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  daftarKerusakan: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  tabelPengecekan: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  tanggalPengecekan: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  tanggalPersetujuan: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  tabelPekerjaan: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  masaGaransi: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tanggalMasukBengkel: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('DRAFT', 'CHECKED', 'APPROVED', 'COMPLETED'),
    defaultValue: 'DRAFT'
  },
  penerimaType: {
    type: DataTypes.ENUM('Otomatis', 'Manual'),
    defaultValue: 'Otomatis'
  },
  tabelPekerjaanType: {
    type: DataTypes.ENUM('Otomatis', 'Manual'),
    defaultValue: 'Otomatis'
  },
  // Foreign Keys
  vehicleId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'master_vehicles',
      key: 'id'
    }
  },
  vendorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'master_vendors',
      key: 'id'
    }
  }
}, {
  tableName: 'spk_perbaikan',
  timestamps: true,
  paranoid: true
});

// Relationships
SPK.belongsTo(Vehicle, { as: 'vehicle', foreignKey: 'vehicleId' });
SPK.belongsTo(VendorMaster, { as: 'vendor', foreignKey: 'vendorId' });

module.exports = SPK;
