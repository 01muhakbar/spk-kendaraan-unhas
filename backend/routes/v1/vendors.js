const express = require('express');
const router = express.Router();
const models = require('../../models');

// GET all vendors
router.get('/', async (req, res) => {
  try {
    const vendors = await models.VendorMaster.findAll();
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new vendor
router.post('/', async (req, res) => {
  try {
    const newVendor = await models.VendorMaster.create(req.body);
    res.status(201).json(newVendor);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update vendor
router.put('/:id', async (req, res) => {
  try {
    const [updated] = await models.VendorMaster.update(req.body, { where: { id: req.params.id } });
    if (updated) {
      const updatedVendor = await models.VendorMaster.findByPk(req.params.id);
      return res.json(updatedVendor);
    }
    throw new Error('Vendor not found');
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE vendor
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await models.VendorMaster.destroy({ where: { id: req.params.id } });
    if (deleted) {
      return res.status(204).send();
    }
    throw new Error('Vendor not found');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
