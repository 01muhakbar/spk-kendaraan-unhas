const express = require('express');
const router = express.Router();
const vehicleController = require('../../controllers/vehicleController');

// GET all vehicles with search filter
router.get('/', vehicleController.getVehicles);

// POST bulk import vehicles
router.post('/bulk', vehicleController.bulkImportVehicles);

// POST new vehicle
router.post('/', vehicleController.createVehicle);

// PUT update vehicle
router.put('/:id', vehicleController.updateVehicle);

// DELETE vehicle
router.delete('/:id', vehicleController.deleteVehicle);

module.exports = router;
