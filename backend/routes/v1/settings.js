const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const models = require('../../models');

// (Local file system folder creation removed for Vercel Serverless compatibility)

const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Konfigurasi Cloudinary akan otomatis membaca CLOUDINARY_URL dari environment
// format CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'spk_unhas', // Folder di dalam Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif']
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
});

// GET /api/v1/settings/logo
router.get('/logo', async (req, res) => {
  try {
    const setting = await models.SystemSetting.findOne({ where: { setting_key: 'LOGO_KOP_SURAT' } });
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

    const logoUrl = req.file.path; // Cloudinary returns the full URL in path
    
    // Cek apakah logo sudah ada, jika ada ambil setting lamanya
    const existing = await models.SystemSetting.findOne({ where: { setting_key: 'LOGO_KOP_SURAT' } });
    
    // (Opsional) Hapus file di Cloudinary jika perlu, 
    // tapi untuk sementara kita biarkan saja agar aman.

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
    const settings = await models.SystemSetting.findAll({
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
        const existing = await models.SystemSetting.findOne({ where: { setting_key: key } });
        if (existing) {
          await existing.update({ setting_value: req.body[key] });
        } else {
          await models.SystemSetting.create({
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
