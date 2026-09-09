const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { SystemSetting } = require('../../models');

// Pastikan folder upload ada
const uploadDir = path.join(__dirname, '../../public/uploads/logos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, 'logo-' + Date.now() + ext);
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diizinkan'));
    }
  }
});

// GET /api/v1/settings/logo
router.get('/logo', async (req, res) => {
  try {
    const setting = await SystemSetting.findOne({ where: { setting_key: 'LOGO_KOP_SURAT' } });
    if (!setting) {
      return res.json({ logo_url: null });
    }
    res.json({ logo_url: setting.setting_value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/settings/logo
router.post('/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file gambar yang diunggah' });
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;
    
    // Cek apakah logo sudah ada, jika ada ambil setting lamanya
    const existing = await SystemSetting.findOne({ where: { setting_key: 'LOGO_KOP_SURAT' } });
    
    // Hapus file fisik logo lama jika ada
    if (existing && existing.setting_value) {
      const oldPath = path.join(__dirname, '../../public', existing.setting_value);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Upsert
    if (existing) {
      await existing.update({ setting_value: logoUrl });
    } else {
      await SystemSetting.create({
        setting_key: 'LOGO_KOP_SURAT',
        setting_value: logoUrl
      });
    }

    res.json({ message: 'Logo berhasil disimpan', logo_url: logoUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/settings/kop
router.get('/kop', async (req, res) => {
  try {
    const keys = [
      'APP_TITLE',
      'KOP_KIRI_1', 'KOP_KIRI_2', 'KOP_KIRI_3', 'KOP_KIRI_4',
      'KOP_KANAN_1', 'KOP_KANAN_2', 'KOP_KANAN_3', 'KOP_KANAN_4', 'KOP_KANAN_5'
    ];
    const settings = await SystemSetting.findAll({
      where: { setting_key: keys }
    });
    
    // Default values matching the image
    const config = {
      APP_TITLE: 'SPK Kendaraan UNHAS',
      KOP_KIRI_1: 'KEMENTERIAN PENDIDIKAN TINGGI, SAINS,',
      KOP_KIRI_2: 'DAN TEKNOLOGI',
      KOP_KIRI_3: 'UNIVERSITAS HASANUDDIN',
      KOP_KIRI_4: '',
      KOP_KANAN_1: 'Jalan Perintis Kemerdekaan Km. 10',
      KOP_KANAN_2: 'Tamalanrea, Makassar 90245',
      KOP_KANAN_3: 'Telepon (0411) 586200',
      KOP_KANAN_4: 'e-mail: office@unhas.ac.id',
      KOP_KANAN_5: 'Laman: www.unhas.ac.id'
    };

    settings.forEach(s => {
      config[s.setting_key] = s.setting_value;
    });

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/settings/kop
router.post('/kop', async (req, res) => {
  try {
    const keys = [
      'APP_TITLE',
      'KOP_KIRI_1', 'KOP_KIRI_2', 'KOP_KIRI_3', 'KOP_KIRI_4',
      'KOP_KANAN_1', 'KOP_KANAN_2', 'KOP_KANAN_3', 'KOP_KANAN_4', 'KOP_KANAN_5'
    ];
    
    for (const key of keys) {
      if (req.body[key] !== undefined) {
        const existing = await SystemSetting.findOne({ where: { setting_key: key } });
        if (existing) {
          await existing.update({ setting_value: req.body[key] });
        } else {
          await SystemSetting.create({
            setting_key: key,
            setting_value: req.body[key]
          });
        }
      }
    }
    
    res.json({ message: 'Pengaturan Kop Surat berhasil disimpan' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
