const express = require('express');
const router = express.Router();
const multer = require('multer');
const SystemSetting = require('../../models/SystemSetting');
const sequelize = require('../../config/database');

if (!SystemSetting) {
  console.error('CRITICAL: SystemSetting model is undefined upon import in settings.js');
}

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
  // Leave room for multipart overhead below Vercel's 4.5 MB payload limit.
  limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0 },
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.mimetype)) {
      const error = new Error('Format logo harus JPG, PNG, atau GIF.');
      error.code = 'INVALID_LOGO_FORMAT';
      return callback(error);
    }
    callback(null, true);
  }
});

const uploadLogo = upload.single('logo');

const settingsError = (res, error, message) => {
  console.error('Settings operation failed:', error.name, error.original?.code || error.code || 'UNKNOWN');
  return res.status(500).json({ error: message });
};

// GET /api/v1/settings/logo
router.get('/logo', async (req, res) => {
  try {
    if (!SystemSetting) throw new Error('SystemSetting model is not loaded');
    const setting = await SystemSetting.findOne({ where: { setting_key: 'LOGO_KOP_SURAT' } });
    if (!setting) {
      return res.json({ logo_url: null });
    }
    res.json({ logo_url: setting.setting_value });
  } catch (error) {
    settingsError(res, error, 'Gagal memuat logo institusi. Silakan coba lagi.');
  }
});

// POST /api/v1/settings/logo
router.post('/logo', async (req, res, next) => {
  // Check the settings table before creating an asset in Cloudinary.
  try {
    if (!SystemSetting) throw new Error('SystemSetting model is not loaded');
    await SystemSetting.findOne({ where: { setting_key: 'LOGO_KOP_SURAT' } });
  } catch (error) {
    return settingsError(res, error, 'Penyimpanan pengaturan belum tersedia. Silakan coba lagi.');
  }
  uploadLogo(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Ukuran logo maksimal 4 MB.' });
    }
    if (error.code === 'INVALID_LOGO_FORMAT') {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: 'Unggah satu file gambar melalui kolom logo.' });
    }
    console.error('Logo upload failed:', error.name, error.http_code || error.code || 'UNKNOWN');
    const status = error.http_code === 400 ? 400 : 502;
    return res.status(status).json({ error: status === 400
      ? 'File logo tidak dapat dibaca. Gunakan gambar JPG, PNG, atau GIF yang valid.'
      : 'Layanan unggah logo tidak tersedia. Silakan coba lagi.' });
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file gambar yang diunggah' });
    }

    const logoUrl = req.file.path; // Cloudinary returns the full URL in path
    
    await SystemSetting.upsert({
      setting_key: 'LOGO_KOP_SURAT',
      setting_value: logoUrl
    });

    res.json({ message: 'Logo berhasil disimpan', logo_url: logoUrl });
  } catch (error) {
    // Only remove the asset created by this request, and only when a read
    // confirms it was not saved (a connection failure can hide a committed write).
    if (req.file?.filename) {
      try {
        const saved = await SystemSetting.findOne({ where: { setting_key: 'LOGO_KOP_SURAT' } });
        if (saved?.setting_value !== req.file.path) {
          await cloudinary.uploader.destroy(req.file.filename);
        }
      } catch (cleanupError) {
        console.error('Logo cleanup deferred:', cleanupError.name);
      }
    }
    settingsError(res, error, 'Gagal menyimpan logo institusi. Muat ulang pengaturan sebelum mencoba lagi.');
  }
});

// GET /api/v1/settings/kop
router.get('/kop', async (req, res) => {
  try {
    if (!SystemSetting) throw new Error('SystemSetting model is not loaded');
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
    settingsError(res, error, 'Gagal memuat kop surat. Silakan coba lagi.');
  }
});

// POST /api/v1/settings/kop
router.post('/kop', async (req, res) => {
  try {
    if (!SystemSetting) throw new Error('SystemSetting model is not loaded');
    const keys = [
      'APP_TITLE',
      'KOP_KIRI_1', 'KOP_KIRI_2', 'KOP_KIRI_3', 'KOP_KIRI_4',
      'KOP_KANAN_1', 'KOP_KANAN_2', 'KOP_KANAN_3', 'KOP_KANAN_4', 'KOP_KANAN_5'
    ];
    
    const entries = keys.filter(key => req.body?.[key] !== undefined);
    if (!entries.length || entries.some(key => typeof req.body[key] !== 'string')) {
      return res.status(400).json({ error: 'Pengaturan harus berisi teks yang valid.' });
    }
    await sequelize.transaction(async (transaction) => {
      for (const key of entries) {
        await SystemSetting.upsert({
          setting_key: key,
          setting_value: req.body[key]
        }, { transaction });
      }
    });
    
    res.json({ message: 'Pengaturan Kop Surat berhasil disimpan' });
  } catch (error) {
    settingsError(res, error, 'Gagal menyimpan kop surat. Silakan coba lagi.');
  }
});

// GET /api/v1/settings/lembar
router.get('/lembar', async (req, res) => {
  try {
    if (!SystemSetting) throw new Error('SystemSetting model is not loaded');
    const keys = [
      'LEMBAR1_PENGANTAR', 'LEMBAR1_DUGAAN', 'LEMBAR1_PENUTUP',
      'LEMBAR2_JUDUL', 'LEMBAR2_PENGANTAR', 'LEMBAR2_PENUTUP',
      'LEMBAR3_JUDUL', 'LEMBAR3_PENUTUP',
      'LEMBAR4_JUDUL', 'LEMBAR4_PENGANTAR', 'LEMBAR4_PEKERJAAN', 'LEMBAR4_PENUTUP',
      'LEMBAR5_JUDUL', 'LEMBAR5_PENGANTAR'
    ];
    const settings = await SystemSetting.findAll({
      where: { setting_key: keys }
    });
    
    // Default values matching the current text in PrintSPK.jsx
    const config = {
      LEMBAR1_PENGANTAR: 'Dengan hormat dilaporkan bahwa kendaraan dinas operasional Universitas Hasanuddin:',
      LEMBAR1_DUGAAN: 'Adapun dugaan kerusakan sebagai berikut:',
      LEMBAR1_PENUTUP: 'Demikian laporan ini dibuat dengan sebenar-benarnya untuk dapat ditindaklanjuti sebagaimana mestinya.',
      LEMBAR2_JUDUL: 'Surat Pengantar Pemeriksaan Kendaraan Dinas',
      LEMBAR2_PENGANTAR: 'Bersama ini kami sampaikan bahwa berdasarkan bukti pengecekan fisik terlampir pada tanggal {{tanggal_laporan}}, mohon bantuan Tim Teknisi Kendaraan Dinas Universitas Hasanuddin untuk melakukan pemeriksaan/pengecekan fisik terhadap kendaraan dinas dengan data sebagai berikut:',
      LEMBAR2_PENUTUP: 'Demikian surat pengantar ini dibuat untuk dapat ditindaklanjuti sebagaimana mestinya.',
      LEMBAR3_JUDUL: 'Bukti Pengecekan / Pemeriksaan Fisik Kendaraan Dinas',
      LEMBAR3_PENUTUP: 'Demikian hasil pengecekan ini kami laporkan untuk dapat ditindaklanjuti.',
      LEMBAR4_JUDUL: 'PERMINTAAN PEMERIKSAAN / PERBAIKAN KENDARAAN',
      LEMBAR4_PENGANTAR: 'Mohon diperiksa/ diperbaiki Kendaraan Dinas Universitas Hasanuddin:',
      LEMBAR4_PEKERJAAN: 'Adapun pekerjaan yang dimohonkan:',
      LEMBAR4_PENUTUP: 'Demikian surat permintaan ini disampaikan, atas perhatian dan kerja samanya diucapkan terima kasih.',
      LEMBAR5_JUDUL: 'Tanda Terima Pekerjaan Perbaikan Kendaraan Dinas',
      LEMBAR5_PENGANTAR: 'Pada hari ini, {{tanggal_masuk_bengkel}} atau {{tanggal_masuk_terbilang}}, telah diserahterimakan kendaraan dinas sebagai berikut:'
    };

    settings.forEach(s => {
      config[s.setting_key] = s.setting_value;
    });

    res.json(config);
  } catch (error) {
    settingsError(res, error, 'Gagal memuat pengaturan teks lembar. Silakan coba lagi.');
  }
});

// POST /api/v1/settings/lembar
router.post('/lembar', async (req, res) => {
  try {
    if (!SystemSetting) throw new Error('SystemSetting model is not loaded');
    const keys = [
      'LEMBAR1_PENGANTAR', 'LEMBAR1_DUGAAN', 'LEMBAR1_PENUTUP',
      'LEMBAR2_JUDUL', 'LEMBAR2_PENGANTAR', 'LEMBAR2_PENUTUP',
      'LEMBAR3_JUDUL', 'LEMBAR3_PENUTUP',
      'LEMBAR4_JUDUL', 'LEMBAR4_PENGANTAR', 'LEMBAR4_PEKERJAAN', 'LEMBAR4_PENUTUP',
      'LEMBAR5_JUDUL', 'LEMBAR5_PENGANTAR'
    ];
    
    const entries = keys.filter(key => req.body?.[key] !== undefined);
    if (!entries.length || entries.some(key => typeof req.body[key] !== 'string')) {
      return res.status(400).json({ error: 'Pengaturan harus berisi teks yang valid.' });
    }
    await sequelize.transaction(async (transaction) => {
      for (const key of entries) {
        await SystemSetting.upsert({
          setting_key: key,
          setting_value: req.body[key]
        }, { transaction });
      }
    });
    
    res.json({ message: 'Pengaturan teks lembar berhasil disimpan' });
  } catch (error) {
    settingsError(res, error, 'Gagal menyimpan pengaturan teks lembar. Silakan coba lagi.');
  }
});

module.exports = router;
