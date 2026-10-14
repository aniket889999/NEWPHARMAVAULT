const express = require('express');
const router = express.Router();
const {
  getMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  verifyMedicine
} = require('../controllers/medicineController');
const { protect, pharmacy } = require('../middleware/authMiddleware');

router.route('/')
  .get(getMedicines)
  .post(protect, pharmacy, createMedicine);

router.post('/verify', verifyMedicine);

router.route('/:id')
  .get(getMedicineById)
  .put(protect, pharmacy, updateMedicine)
  .delete(protect, pharmacy, deleteMedicine);

module.exports = router;
