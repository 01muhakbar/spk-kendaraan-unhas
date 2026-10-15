const Vehicle = require('../models/Vehicle');
const { Op } = require('sequelize');
const { z } = require('zod');

// Helper to sanitize payload
const sanitizeVehiclePayload = (body) => {
  const {
    nomor_polisi,
    merek_type,
    jenis_kendaraan,
    nama_sopir,
    model,
    warna,
    isi_silinder,
    no_rangka,
    no_mesin,
    tgl_jatuh_tempo_pajak,
    tgl_jatuh_tempo_stnk,
    status_legalitas
  } = body;

  const sanitized = {
    nomor_polisi: nomor_polisi ? String(nomor_polisi).trim().toUpperCase() : '',
    merek_type: merek_type ? String(merek_type).trim() : '',
    jenis_kendaraan: jenis_kendaraan ? String(jenis_kendaraan).trim() : '',
    nama_sopir: nama_sopir && String(nama_sopir).trim() !== '' ? String(nama_sopir).trim() : null,
    model: model && String(model).trim() !== '' ? String(model).trim() : null,
    warna: warna && String(warna).trim() !== '' ? String(warna).trim() : null,
    isi_silinder: isi_silinder !== undefined && isi_silinder !== null && String(isi_silinder).trim() !== ''
      ? parseInt(isi_silinder, 10)
      : null,
    // Nomor Rangka & Nomor Mesin harus uppercase dan jika kosong disimpan sebagai null agar tidak melanggar unique constraint
    no_rangka: no_rangka && String(no_rangka).trim() !== '' ? String(no_rangka).trim().toUpperCase() : null,
    no_mesin: no_mesin && String(no_mesin).trim() !== '' ? String(no_mesin).trim().toUpperCase() : null
  };

  if (tgl_jatuh_tempo_pajak !== undefined) sanitized.tgl_jatuh_tempo_pajak = tgl_jatuh_tempo_pajak || null;
  if (tgl_jatuh_tempo_stnk !== undefined) sanitized.tgl_jatuh_tempo_stnk = tgl_jatuh_tempo_stnk || null;
  if (status_legalitas !== undefined) sanitized.status_legalitas = status_legalitas || 'AKTIF';

  return sanitized;
};

// GET all vehicles with expanded global search
const getVehicles = async (req, res) => {
  try {
    const { search } = req.query;
    let whereClause = {};

    if (search && String(search).trim() !== '') {
      const q = String(search).trim();
      whereClause = {
        [Op.or]: [
          { nomor_polisi: { [Op.like]: `%${q}%` } },
          { merek_type: { [Op.like]: `%${q}%` } },
          { jenis_kendaraan: { [Op.like]: `%${q}%` } },
          { nama_sopir: { [Op.like]: `%${q}%` } },
          { model: { [Op.like]: `%${q}%` } },
          { warna: { [Op.like]: `%${q}%` } },
          { no_rangka: { [Op.like]: `%${q}%` } },
          { no_mesin: { [Op.like]: `%${q}%` } }
        ]
      };
    }

    const vehicles = await Vehicle.findAll({ where: whereClause });

    // Sorting di level server (Numerik Plat Nomor)
    const sortedVehicles = vehicles.sort((a, b) => {
      const numA = parseInt((a.nomor_polisi || '').match(/\d+/)?.[0] || 0, 10);
      const numB = parseInt((b.nomor_polisi || '').match(/\d+/)?.[0] || 0, 10);
      return numA - numB;
    });

    res.json(sortedVehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST create vehicle
const createVehicle = async (req, res) => {
  try {
    const payload = sanitizeVehiclePayload(req.body);

    if (!payload.nomor_polisi) {
      return res.status(400).json({ error: 'Nomor Polisi wajib diisi' });
    }
    if (!payload.merek_type) {
      return res.status(400).json({ error: 'Merek / Type wajib diisi' });
    }
    if (!payload.jenis_kendaraan) {
      return res.status(400).json({ error: 'Jenis Kendaraan wajib diisi' });
    }

    const newVehicle = await Vehicle.create(payload);
    res.status(201).json(newVehicle);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: "Gagal menyimpan: Nomor Rangka/Mesin sudah terdaftar pada kendaraan lain."
      });
    }
    res.status(400).json({ error: error.message });
  }
};

// PUT update vehicle
const updateVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const payload = sanitizeVehiclePayload(req.body);

    if (!payload.nomor_polisi) {
      return res.status(400).json({ error: 'Nomor Polisi wajib diisi' });
    }
    if (!payload.merek_type) {
      return res.status(400).json({ error: 'Merek / Type wajib diisi' });
    }
    if (!payload.jenis_kendaraan) {
      return res.status(400).json({ error: 'Jenis Kendaraan wajib diisi' });
    }

    await vehicle.update(payload);
    const updatedVehicle = await Vehicle.findByPk(req.params.id);
    return res.json(updatedVehicle);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: "Gagal menyimpan: Nomor Rangka/Mesin sudah terdaftar pada kendaraan lain."
      });
    }
    res.status(400).json({ error: error.message });
  }
};

// DELETE vehicle
const deleteVehicle = async (req, res) => {
  try {
    const deleted = await Vehicle.destroy({ where: { id: req.params.id } });
    if (deleted) {
      return res.status(204).send();
    }
    return res.status(404).json({ error: 'Vehicle not found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST bulk import vehicles
const bulkImportVehicles = async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Data impor tidak boleh kosong.' });
    }

    const parsedData = req.body.map(item => {
      const nomor_polisi = item.Nomor_Polisi || item.nomor_polisi;
      const merek_type = item.Merek_Type || item.merek_type;
      const jenis_kendaraan = item.Jenis_Kendaraan || item.jenis_kendaraan;
      const nama_sopir = item.Pengguna_Sopir || item.nama_sopir || item.pengguna;
      const model = item.Model || item.model;
      const warna = item.Warna || item.warna;
      const isi_silinder = item.Isi_Silinder || item.isi_silinder;
      const no_rangka = item.No_Rangka || item.no_rangka;
      const no_mesin = item.No_Mesin || item.no_mesin;

      return sanitizeVehiclePayload({
        nomor_polisi,
        merek_type,
        jenis_kendaraan,
        nama_sopir,
        model,
        warna,
        isi_silinder,
        no_rangka,
        no_mesin
      });
    });

    // Validasi No. Polisi
    for (const row of parsedData) {
      if (!row.nomor_polisi) {
        return res.status(400).json({ error: 'Validasi gagal: Nomor Polisi wajib diisi pada setiap baris.' });
      }
    }

    await Vehicle.bulkCreate(parsedData, {
      updateOnDuplicate: [
        "merek_type",
        "jenis_kendaraan",
        "nama_sopir",
        "model",
        "warna",
        "isi_silinder",
        "no_rangka",
        "no_mesin",
        "updatedAt"
      ]
    });

    res.status(200).json({ message: "Data Kendaraan berhasil diimpor" });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: "Gagal menyimpan: Nomor Rangka/Mesin sudah terdaftar pada kendaraan lain."
      });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validasi gagal: Data CSV tidak sesuai format', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  bulkImportVehicles
};
