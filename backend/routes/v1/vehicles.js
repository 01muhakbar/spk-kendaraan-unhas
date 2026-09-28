const express = require('express');
const router = express.Router();
const Vehicle = require('../../models/Vehicle');
const { Op } = require('sequelize');
const { z } = require('zod');

// GET all vehicles
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let whereClause = {};

    if (search) {
      whereClause = {
        [Op.or]: [
          { nomor_polisi: { [Op.like]: `%${search}%` } },
          { merek_type: { [Op.like]: `%${search}%` } },
          { nama_sopir: { [Op.like]: `%${search}%` } }
        ]
      };
    }

    const vehicles = await Vehicle.findAll({ where: whereClause });

    // Lakukan sorting di level server Node.js (Numerik Plat Nomor)
    const sortedVehicles = vehicles.sort((a, b) => {
      const numA = parseInt((a.nomor_polisi || '').match(/\d+/)?.[0] || 0, 10);
      const numB = parseInt((b.nomor_polisi || '').match(/\d+/)?.[0] || 0, 10);
      return numA - numB;
    });

    res.json(sortedVehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST bulk import vehicles
router.post('/bulk', async (req, res) => {
  try {
    const importSchema = z.array(z.object({
      nomor_polisi: z.string().min(1, "No. Polisi wajib diisi"),
      merek_type: z.string().optional().nullable().catch(null),
      jenis_kendaraan: z.string().optional().nullable().catch(null),
      nama_sopir: z.string().optional().nullable().catch(null),
    }).passthrough());

    const validDataArray = importSchema.parse(req.body);

    await Vehicle.bulkCreate(validDataArray, {
      updateOnDuplicate: ["merek_type", "jenis_kendaraan", "nama_sopir", "updatedAt"]
    });

    res.status(200).json({ message: "Data Kendaraan berhasil diimpor" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validasi gagal: Data CSV tidak sesuai format', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST new vehicle
router.post('/', async (req, res) => {
  try {
    const newVehicle = await Vehicle.create(req.body);
    res.status(201).json(newVehicle);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update vehicle
router.put('/:id', async (req, res) => {
  try {
    const [updated] = await Vehicle.update(req.body, { where: { id: req.params.id } });
    if (updated) {
      const updatedVehicle = await Vehicle.findByPk(req.params.id);
      return res.json(updatedVehicle);
    }
    throw new Error('Vehicle not found');
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE vehicle
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Vehicle.destroy({ where: { id: req.params.id } });
    if (deleted) {
      return res.status(204).send();
    }
    throw new Error('Vehicle not found');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
