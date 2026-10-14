const Order = require('../models/orderModel');
const Medicine = require('../models/medicineModel');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private/Patient
const createOrder = asyncHandler(async (req, res) => {
  const { orderItems, totalPrice, prescriptionUrl } = req.body;

  if (orderItems && orderItems.length === 0) {
    res.status(400);
    throw new Error('No order items');
  } else {
    const order = new Order({
      orderItems,
      user: req.user._id,
      totalPrice,
      prescriptionUrl,
    });

    const createdOrder = await order.save();
    
    // Deduct stock
    for (const item of orderItems) {
      const medicine = await Medicine.findById(item.medicine);
      if (medicine) {
        medicine.stock -= item.qty;
        await medicine.save();
      }
    }

    res.status(201).json(createdOrder);
  }
});

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private/Patient
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id });
  res.status(200).json(orders);
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Pharmacy
const getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({}).populate('user', 'id name email');
  res.status(200).json(orders);
});

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Pharmacy
const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (order) {
    order.status = req.body.status || order.status;
    const updatedOrder = await order.save();
    res.status(200).json(updatedOrder);
  } else {
    res.status(404);
    throw new Error('Order not found');
  }
});

module.exports = { createOrder, getMyOrders, getOrders, updateOrderStatus };
