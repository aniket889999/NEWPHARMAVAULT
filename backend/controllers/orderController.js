const Order = require('../models/orderModel');
const Medicine = require('../models/medicineModel');
const Prescription = require('../models/prescriptionModel');
const asyncHandler = require('../middleware/asyncHandler');

const PHARMACY_STATUSES = ['Approved', 'Processing', 'Ready', 'Delivered', 'Needs Clarification', 'Rejected', 'Cancelled'];
const RETURNS_STOCK = new Set(['Rejected', 'Cancelled']);

const fail = (res, status, message, code) => {
  res.status(status);
  const error = new Error(message);
  if (code) error.code = code;
  throw error;
};

const ownOrg = (req) => req.tenantContext?.organizationId || req.user.organizationId;

async function notifyPatient(userId, title, body) {
  try {
    const { notifyUsers } = require('../services/claims/notificationService');
    await notifyUsers([userId], { type: 'ORDER_UPDATE', title, body, link: '/patient/orders' });
  } catch { /* notifications are best effort */ }
}

/** Give back stock reserved by an order (once). */
async function returnStock(order) {
  if (order.stockReturned) return;
  for (const item of order.orderItems) {
    await Medicine.updateOne({ _id: item.medicine }, { $inc: { stock: item.qty } });
  }
  order.stockReturned = true;
}

// @desc    Place order(s). Prices and stock come from the server; one order per pharmacy.
// @route   POST /api/orders   { orderItems: [{ medicine, qty }], prescriptionId? }
// @access  Private/Patient
const createOrder = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.orderItems) ? req.body.orderItems : [];
  if (!items.length) fail(res, 400, 'No order items');
  const wanted = new Map();
  for (const item of items) {
    const id = String(item.medicine || item.id || '');
    const qty = Number.parseInt(item.qty, 10);
    if (!/^[a-f\d]{24}$/i.test(id) || !Number.isInteger(qty) || qty < 1 || qty > 100) fail(res, 400, 'Each item needs a valid medicine and a quantity between 1 and 100.');
    wanted.set(id, (wanted.get(id) || 0) + qty);
  }
  const medicines = await Medicine.find({ _id: { $in: [...wanted.keys()] } }).lean();
  if (medicines.length !== wanted.size) fail(res, 400, 'Some medicines in your cart are no longer available. Please refresh the cart.');

  const needsRx = medicines.filter((m) => m.prescriptionRequired);
  let prescription = null;
  if (needsRx.length) {
    const rxId = req.body.prescriptionId;
    prescription = rxId && /^[a-f\d]{24}$/i.test(String(rxId))
      ? await Prescription.findOne({ _id: rxId, user: req.user._id })
      : null;
    if (!prescription) {
      fail(res, 400, `A prescription is required for: ${needsRx.map((m) => m.name).join(', ')}. Upload your prescription first and select it in the cart.`, 'PRESCRIPTION_REQUIRED');
    }
  }

  // Reserve stock atomically; undo everything if one item is short.
  const reserved = [];
  for (const m of medicines) {
    const qty = wanted.get(String(m._id));
    const ok = await Medicine.updateOne({ _id: m._id, stock: { $gte: qty } }, { $inc: { stock: -qty } });
    if (ok.modifiedCount !== 1) {
      for (const r of reserved) await Medicine.updateOne({ _id: r.id }, { $inc: { stock: r.qty } });
      fail(res, 409, `Only ${m.stock} unit(s) of ${m.name} are in stock.`, 'OUT_OF_STOCK');
    }
    reserved.push({ id: m._id, qty });
  }

  // One order per pharmacy.
  const groups = new Map();
  for (const m of medicines) {
    const key = String(m.organizationId || 'none');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  const created = [];
  for (const [, meds] of groups) {
    const orderItems = meds.map((m) => ({ name: m.name, qty: wanted.get(String(m._id)), price: m.price, medicine: m._id, prescriptionRequired: Boolean(m.prescriptionRequired) }));
    const requiresPrescription = orderItems.some((i) => i.prescriptionRequired);
    const order = await Order.create({
      user: req.user._id,
      orderItems,
      totalPrice: Math.round(orderItems.reduce((sum, i) => sum + i.price * i.qty, 0) * 100) / 100,
      pharmacyOrganizationId: meds[0].organizationId,
      branchId: meds[0].branchId,
      requiresPrescription,
      prescription: requiresPrescription ? prescription._id : undefined,
      status: requiresPrescription ? 'Awaiting Pharmacist' : 'Pending'
    });
    if (requiresPrescription) {
      // The prescription now waits in this pharmacy's Pending Prescriptions queue.
      await Prescription.updateOne({ _id: prescription._id }, { $set: { organizationId: meds[0].organizationId, orderId: order._id, status: 'Pending Review' } });
    }
    created.push(order);
  }
  res.status(201).json({ orders: created });
});

// @desc    Logged-in patient's orders, with pharmacy and prescription status
// @route   GET /api/orders/myorders
// @access  Private/Patient
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate('pharmacyOrganizationId', 'name')
    .populate('branchId', 'name location')
    .populate('prescription', 'doctorName status pharmacistNotes')
    .sort('-createdAt');
  res.status(200).json(orders);
});

// @desc    Orders for this pharmacy only
// @route   GET /api/orders
// @access  Private/Pharmacy
const getOrders = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'super_admin' ? {} : { pharmacyOrganizationId: ownOrg(req) };
  const orders = await Order.find(filter)
    .populate('user', 'name email')
    .populate('prescription', 'doctorName patientName status')
    .sort('-createdAt');
  res.status(200).json(orders);
});

// @desc    Update an order of this pharmacy
// @route   PUT /api/orders/:id/status   { status, note? }
// @access  Private/Pharmacy
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  if (!PHARMACY_STATUSES.includes(status)) fail(res, 400, `Status must be one of: ${PHARMACY_STATUSES.join(', ')}.`);
  if (!/^[a-f\d]{24}$/i.test(String(req.params.id))) fail(res, 404, 'Order not found');
  const filter = { _id: req.params.id };
  if (req.user.role !== 'super_admin') filter.pharmacyOrganizationId = ownOrg(req);
  const order = await Order.findOne(filter);
  if (!order) fail(res, 404, 'Order not found');
  if (RETURNS_STOCK.has(order.status)) fail(res, 409, `This order is already ${order.status.toLowerCase()}.`);
  if (RETURNS_STOCK.has(status)) await returnStock(order);
  order.status = status;
  if (typeof note === 'string') order.pharmacistNote = note.trim().slice(0, 1000);
  const updated = await order.save();
  await notifyPatient(order.user, `Order ${status.toLowerCase()}`, `Your pharmacy order is now: ${status}.`);
  res.status(200).json(updated);
});

module.exports = { createOrder, getMyOrders, getOrders, updateOrderStatus, returnStock, notifyPatient };
