const express = require('express');
const cors = require('cors');
const path = require('path');
// (Hapus import awal syncDatabase yang rusak di Vercel)

// Import rute v1
const vehicleRoutes = require('./routes/v1/vehicles');
const signatoryRoutes = require('./routes/v1/signatories');
const vendorRoutes = require('./routes/v1/vendors');
const spkRoutes = require('./routes/v1/spk');
const settingsRoutes = require('./routes/v1/settings');
const legalitasRoutes = require('./routes/v1/legalitas');

// Setup Cron Jobs
require('./cron/legalitasCron');

const app = express();

app.use(cors());
app.use(express.json());

// Public folder untuk uploads
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// API Routes v1
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/signatories', signatoryRoutes);
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/spk', spkRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/legalitas', legalitasRoutes);
app.use('/api/v1/analytics', require('./routes/v1/analytics'));

// Endpoint khusus untuk Sinkronisasi Database di Production
// Membantu membuat tabel yang kurang tanpa perlu CLI
app.get('/api/v1/force-sync', async (req, res) => {
  try {
    // Muat langsung tanpa melalui models/index.js (Vercel workaround)
    require('./models/SystemSetting');
    require('./models/Vehicle');
    require('./models/VendorMaster');
    require('./models/Signatory');
    require('./models/SPK');
    require('./models/RiwayatLegalitas');
    const sequelize = require('./config/database');
    
    try {
      const [indexes] = await sequelize.query("SHOW INDEX FROM master_vehicles WHERE Column_name = 'nomor_polisi' AND Non_unique = 0");
      for (const idx of indexes) {
        if (idx.Key_name !== 'PRIMARY') {
          await sequelize.query(`ALTER TABLE master_vehicles DROP INDEX ${idx.Key_name}`);
        }
      }
    } catch (e) {
      console.log('Error dropping index dynamically:', e.message);
    }
    
    await sequelize.sync({ alter: true });
    res.json({ message: 'Database tables synchronized successfully! Unique constraints on vehicles removed.' });
  } catch (err) {
    res.status(500).json({ error: 'Database sync failed: ' + err.message, stack: err.stack });
  }
});

app.get('/api/v1/db-indexes', async (req, res) => {
  try {
    const sequelize = require('./config/database');
    const [results] = await sequelize.query('SHOW INDEX FROM master_vehicles');
    res.json({ indexes: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/debug', (req, res) => {
  try {
    const SystemSetting = require('./models/SystemSetting');
    res.json({
      SystemSettingLoaded: !!SystemSetting,
      env: {
        DB_HOST: !!process.env.DB_HOST,
        DB_DIALECT: process.env.DB_DIALECT,
        CLOUDINARY: !!process.env.CLOUDINARY_URL
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, async (err) => {
    if (err) {
      console.error(`Gagal memulai server di port ${PORT}:`, err.message);
      process.exit(1);
    }
    console.log(`Server is running on port ${PORT}`);
    // In development, we can automatically sync database (with force:false or true)
    // Warning: doing sync() in production can be dangerous
    // await syncDatabase(); // Dipanggil lewat seed.js saja
  });
}

// Export the Express API for Vercel Serverless
module.exports = app;
