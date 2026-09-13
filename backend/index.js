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
    const sequelize = require('./config/database');
    
    await sequelize.sync();
    res.json({ message: 'Database tables synchronized successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Database sync failed: ' + err.message, stack: err.stack });
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
