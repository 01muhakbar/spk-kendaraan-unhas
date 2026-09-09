const express = require('express');
const router = express.Router();
const { Signatory } = require('../../models');

// GET all signatories, optionally filtered by ?role=
router.get('/', async (req, res) => {
  try {
    const whereClause = req.query.role ? { kategori_peran: req.query.role.toUpperCase() } : {};
    const signatories = await Signatory.findAll({ where: whereClause });
    res.json(signatories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new signatory
router.post('/', async (req, res) => {
  try {
    const newSignatory = await Signatory.create(req.body);
    res.status(201).json(newSignatory);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update signatory
router.put('/:id', async (req, res) => {
  try {
    const [updated] = await Signatory.update(req.body, { where: { id: req.params.id } });
    if (updated) {
      const updatedSignatory = await Signatory.findByPk(req.params.id);
      return res.json(updatedSignatory);
    }
    throw new Error('Signatory not found');
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE signatory
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Signatory.destroy({ where: { id: req.params.id } });
    if (deleted) {
      return res.status(204).send();
    }
    throw new Error('Signatory not found');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
