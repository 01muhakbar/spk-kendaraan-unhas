const express = require('express');
const router = express.Router();
const models = require('../../models');
const { Op } = require('sequelize');

/**
 * Generate nomor SPK dengan format: {urut}/RT/P-Kend/2026
 * Nomor urut di-reset setiap tahun dan di-pad menjadi 3 digit.
 */
const generateSPKNumber = async () => {
  const tahun = new Date().getFullYear();

  const lastSPK = await models.SPK.findOne({
    where: {
      nomorSPK: {
        [Op.like]: `%/RT/P-Kend/${tahun}`
      }
    },
    order: [['nomorUrut', 'DESC']]
  });

  const nextUrut = lastSPK ? lastSPK.nomorUrut + 1 : 1;
  const paddedUrut = nextUrut.toString().padStart(3, '0');
  const nomorSPK = `${paddedUrut}/RT/P-Kend/${tahun}`;

  return { nomorSPK, nomorUrut: nextUrut };
};

// GET next SPK number
router.get('/next-number', async (req, res) => {
  try {
    const { nomorUrut } = await generateSPKNumber();
    res.json({ nextUrut: nomorUrut.toString().padStart(3, '0') });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET semua SPK
router.get('/', async (req, res) => {
  try {
    const data = await models.SPK.findAll({
      include: [
        { model: Vehicle, as: 'vehicle' },
        { model: VendorMaster, as: 'vendor' }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET satu SPK by id
router.get('/:id', async (req, res) => {
  try {
    const data = await models.SPK.findByPk(req.params.id, {
      include: [
        { model: Vehicle, as: 'vehicle' },
        { model: VendorMaster, as: 'vendor' }
      ]
    });
    if (!data) return res.status(404).json({ error: 'SPK tidak ditemukan' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — buat SPK baru
router.post('/', async (req, res) => {
  try {
    const tahun = new Date().getFullYear();
    let { nomorUrutInput } = req.body;
    let finalNomorSPK, finalNomorUrut;

    if (nomorUrutInput) {
      finalNomorUrut = parseInt(nomorUrutInput, 10);
      const paddedUrut = finalNomorUrut.toString().padStart(3, '0');
      finalNomorSPK = `${paddedUrut}/RT/P-Kend/${tahun}`;

      // Validasi duplikasi
      const existing = await models.SPK.findOne({ where: { nomorSPK: finalNomorSPK } });
      if (existing) {
        return res.status(409).json({ error: `Nomor SPK ${finalNomorSPK} sudah digunakan. Silakan gunakan angka lain.` });
      }
    } else {
      const generated = await generateSPKNumber();
      finalNomorSPK = generated.nomorSPK;
      finalNomorUrut = generated.nomorUrut;
    }

    const newSPK = await models.SPK.create({
      ...req.body,
      nomorSPK: finalNomorSPK,
      nomorUrut: finalNomorUrut
    });
    res.status(201).json(newSPK);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT — update SPK
router.put('/:id', async (req, res) => {
  try {
    await models.SPK.update(req.body, { where: { id: req.params.id } });
    const updated = await models.SPK.findByPk(req.params.id, {
      include: [
        { model: Vehicle, as: 'vehicle' },
        { model: VendorMaster, as: 'vendor' }
      ]
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE — hapus SPK
router.delete('/:id', async (req, res) => {
  try {
    await models.SPK.destroy({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
