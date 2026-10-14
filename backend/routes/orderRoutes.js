const express = require('express');
const router = express.Router();
const { createOrder, getMyOrders, getOrders, updateOrderStatus } = require('../controllers/orderController');
const { protect, patient, pharmacy } = require('../middleware/authMiddleware');

router.route('/').post(protect, patient, createOrder).get(protect, pharmacy, getOrders);
router.route('/myorders').get(protect, patient, getMyOrders);
router.route('/:id/status').put(protect, pharmacy, updateOrderStatus);

module.exports = router;
