const express = require('express');
const cors = require('cors');
const path = require('path');
const { syncDatabase } = require('./models');

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

const PORT = process.env.PORT || 5000;

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
