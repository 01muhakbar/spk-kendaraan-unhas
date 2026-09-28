const express = require('express');
const router = express.Router();
const Vehicle = require('../../models/Vehicle');
const { Op } = require('sequelize');

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
