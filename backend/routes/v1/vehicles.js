const express = require('express');
const router = express.Router();
const models = require('../../models');

// GET all vehicles
router.get('/', async (req, res) => {
  try {
    const vehicles = await models.Vehicle.findAll();
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new vehicle
router.post('/', async (req, res) => {
  try {
    const newVehicle = await models.Vehicle.create(req.body);
    res.status(201).json(newVehicle);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update vehicle
router.put('/:id', async (req, res) => {
  try {
    const [updated] = await models.Vehicle.update(req.body, { where: { id: req.params.id } });
    if (updated) {
      const updatedVehicle = await models.Vehicle.findByPk(req.params.id);
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
    const deleted = await models.Vehicle.destroy({ where: { id: req.params.id } });
    if (deleted) {
      return res.status(204).send();
    }
    throw new Error('Vehicle not found');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
