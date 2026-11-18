const asyncHandler = require('../middleware/asyncHandler');
const Medicine = require('../models/medicineModel');
const Prescription = require('../models/prescriptionModel');

// Each pharmacy's dashboards use only its own stock and prescriptions.
const scopeFor = (req) => (req.user?.role === 'super_admin' ? {} : { organizationId: req.tenantContext?.organizationId || req.user?.organizationId });
const BlockchainLedger = require('../models/blockchainModel');
const graphService = require('../graph/graphService');

// @desc    Get Pharmacy Dashboard Intelligence (Metrics & Insights)
// @route   GET /api/pharmacy/intelligence
// @access  Private/Pharmacy
const getIntelligenceDashboard = asyncHandler(async (req, res) => {
  const medicines = await Medicine.find(scopeFor(req));
  const prescriptions = await Prescription.find(scopeFor(req));
  const blockchainBatches = await BlockchainLedger.countDocuments();

  const totalMedicines = medicines.length;
  let totalValue = 0;
  let lowStockCount = 0;
  let expiringSoonCount = 0;
  
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  medicines.forEach(m => {
    totalValue += (m.price * m.stock);
    if (m.stock <= 30) lowStockCount++;
    if (new Date(m.expiryDate) <= thirtyDaysFromNow) expiringSoonCount++;
  });

  const pendingPrescriptions = prescriptions.filter(p => p.status === 'Pending Review').length;

  // Simple Rule-based AI Insights
  const insights = [];
  if (expiringSoonCount > 0) insights.push(`⚠️ ${expiringSoonCount} medicines are at high expiry risk (<30 days).`);
  if (lowStockCount > 0) insights.push(`📉 ${lowStockCount} medicines are below safe stock levels.`);
  if (pendingPrescriptions > 0) insights.push(`📝 ${pendingPrescriptions} prescriptions need manual review.`);
  if (totalValue > 50000) insights.push(`💰 High inventory value detected: ₹${totalValue.toFixed(2)}. Optimize stock rotation.`);
  
  // Calculate Inventory Health Score (0-100)
  const penalty = (lowStockCount * 2) + (expiringSoonCount * 3) + (pendingPrescriptions * 1);
  const healthScore = Math.max(0, 100 - penalty);

  res.status(200).json({
    metrics: {
      totalMedicines,
      lowStockCount,
      expiringSoonCount,
      totalValue,
      pendingPrescriptions,
      blockchainBatches,
      healthScore
    },
    insights
  });
});

// @desc    Get Expiry Risk List
// @route   GET /api/pharmacy/expiry-risk
// @access  Private/Pharmacy
const getExpiryRisk = asyncHandler(async (req, res) => {
  const medicines = await Medicine.find(scopeFor(req)).sort('expiryDate');
  const today = new Date();

  const riskData = medicines.map(m => {
    const expDate = new Date(m.expiryDate);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let riskLevel = 'Safe';
    let suggestedAction = 'Monitor normally';
    
    if (diffDays < 0) {
      riskLevel = 'Expired';
      suggestedAction = 'Remove stock immediately';
    } else if (diffDays <= 30) {
      riskLevel = 'High Risk';
      suggestedAction = 'Prioritize sale / Return to distributor';
    } else if (diffDays <= 90) {
      riskLevel = 'Watch';
      suggestedAction = 'Promote sales';
    }

    return {
      _id: m._id,
      recalled: Boolean(m.recalled), markdownPercent: m.markdownPercent || 0, reorderRequestedQty: m.reorderRequestedQty || 0,
      name: m.name,
      batchNumber: m.batchNumber,
      stock: m.stock,
      expiryDate: m.expiryDate,
      daysRemaining: diffDays,
      riskLevel,
      suggestedAction
    };
  });

  res.status(200).json(riskData);
});

// @desc    Get Stock Risk List
// @route   GET /api/pharmacy/stock-risk
// @access  Private/Pharmacy
const getStockRisk = asyncHandler(async (req, res) => {
  const medicines = await Medicine.find(scopeFor(req)).sort('stock');

  const riskData = medicines.map(m => {
    let riskLevel = 'Good';
    let suggestedReorder = 0;
    
    if (m.stock === 0) {
      riskLevel = 'Out of Stock';
      suggestedReorder = 100; // default restock size
    } else if (m.stock <= 30) {
      riskLevel = 'Low';
      suggestedReorder = 100 - m.stock;
    } else if (m.stock <= 100) {
      riskLevel = 'Watch';
    }

    return {
      _id: m._id,
      recalled: Boolean(m.recalled), markdownPercent: m.markdownPercent || 0, reorderRequestedQty: m.reorderRequestedQty || 0,
      name: m.name,
      stock: m.stock,
      riskLevel,
      suggestedReorder,
      priority: riskLevel === 'Out of Stock' ? 'High' : (riskLevel === 'Low' ? 'Medium' : 'Low')
    };
  });

  res.status(200).json(riskData);
});

// @desc    Get Substitutes for a given medicine
// @route   GET /api/pharmacy/substitutes/:medicineName
// @access  Private/Pharmacy
const getSubstitutes = asyncHandler(async (req, res) => {
  const { medicineName } = req.params;
  
  // 1. Get GraphRAG node to find identical generics/alternatives
  const node = graphService.findMedicineNode(medicineName);
  
  if (!node) {
    return res.status(200).json({ alternatives: [], reason: "Not found in Knowledge Graph" });
  }

  const altNames = node.relations.alternative_to || [];
  
  // 2. Fetch those alternatives from MongoDB inventory
  const alternatives = await Medicine.find({
    name: { $regex: new RegExp(altNames.join('|'), 'i') },
    stock: { $gt: 0 }
  });

  res.status(200).json({
    original: medicineName,
    genericClass: node.genericName,
    symptomsTreated: node.relations.treats,
    inventoryAlternatives: alternatives
  });
});

// @desc    Get Prescription Queue
// @route   GET /api/pharmacy/prescription-queue
// @access  Private/Pharmacy
const getPrescriptionQueue = asyncHandler(async (req, res) => {
  // Each pharmacy sees only prescriptions sent to it with an order.
  const filter = req.user.role === 'super_admin' ? {} : { organizationId: req.tenantContext?.organizationId || req.user.organizationId };
  const prescriptions = await Prescription.find(filter)
    .populate('user', 'name email')
    .populate('orderId', 'status totalPrice orderItems')
    .sort('-createdAt');
  res.status(200).json(prescriptions);
});

// Prescription decision -> order status shown to the patient.
const ORDER_STATUS_FOR = { Approved: 'Approved', 'Needs Clarification': 'Needs Clarification', Rejected: 'Rejected', Dispensed: 'Ready' };
const PHARMACY_ROLES = ['pharmacy', 'pharmacist', 'org_admin', 'branch_manager', 'admin', 'super_admin'];

// @desc    Approve / clarify with doctor / reject / dispense a prescription of this pharmacy
// @route   PUT /api/pharmacy/prescription/:id/status
// @access  Private/Pharmacy
const updatePrescriptionStatus = asyncHandler(async (req, res) => {
  const { status, pharmacistNotes } = req.body;
  if (!PHARMACY_ROLES.includes(req.user.role)) { res.status(403); throw new Error('Only pharmacy staff can decide prescriptions.'); }
  if (!Object.keys(ORDER_STATUS_FOR).includes(status)) { res.status(400); throw new Error(`Status must be one of: ${Object.keys(ORDER_STATUS_FOR).join(', ')}.`); }
  if (['Needs Clarification', 'Rejected'].includes(status) && !(typeof pharmacistNotes === 'string' && pharmacistNotes.trim().length >= 5)) {
    res.status(400); throw new Error('Add a short note for the patient (at least 5 characters).');
  }
  const filter = { _id: req.params.id };
  if (req.user.role !== 'super_admin') filter.organizationId = req.tenantContext?.organizationId || req.user.organizationId;
  const prescription = /^[a-f\d]{24}$/i.test(String(req.params.id)) ? await Prescription.findOne(filter) : null;
  if (!prescription) { res.status(404); throw new Error('Prescription not found'); }

  prescription.status = status;
  if (pharmacistNotes !== undefined) prescription.pharmacistNotes = String(pharmacistNotes).slice(0, 1000);
  const updated = await prescription.save();

  if (prescription.orderId) {
    const Order = require('../models/orderModel');
    const { returnStock, notifyPatient } = require('./orderController');
    const order = await Order.findById(prescription.orderId);
    if (order && !['Rejected', 'Cancelled', 'Delivered'].includes(order.status)) {
      if (status === 'Rejected') await returnStock(order);
      order.status = ORDER_STATUS_FOR[status];
      order.pharmacistNote = prescription.pharmacistNotes || '';
      await order.save();
      const text = { Approved: 'The pharmacist approved your prescription order.', 'Needs Clarification': 'The pharmacist needs a clarification from your doctor before dispensing.', Rejected: 'The pharmacist could not fulfil your prescription order.', Dispensed: 'Your medicines are ready for pickup.' }[status];
      await notifyPatient(order.user, `Prescription ${status.toLowerCase()}`, text);
    }
  }
  res.status(200).json(updated);
});

// Stock actions on one of this pharmacy's own medicine batches.
async function ownMedicine(req, res) {
  if (!PHARMACY_ROLES.includes(req.user.role)) { res.status(403); throw new Error('Only pharmacy staff can change stock.'); }
  const filter = { _id: req.params.id };
  if (req.user.role !== 'super_admin') filter.organizationId = req.tenantContext?.organizationId || req.user.organizationId;
  const med = /^[a-f\d]{24}$/i.test(String(req.params.id)) ? await Medicine.findOne(filter) : null;
  if (!med) { res.status(404); throw new Error('Medicine batch not found in your inventory.'); }
  return med;
}

// @route POST /api/pharmacy/medicines/:id/markdown  { percent }  (10-50%, from the original price)
const markdownMedicine = asyncHandler(async (req, res) => {
  const med = await ownMedicine(req, res);
  const percent = Number.parseInt(req.body?.percent ?? 30, 10);
  if (!Number.isInteger(percent) || percent < 10 || percent > 50) { res.status(400); throw new Error('Markdown must be between 10% and 50%.'); }
  if (!med.originalPrice) med.originalPrice = med.price;
  med.markdownPercent = percent;
  med.price = Math.round(med.originalPrice * (100 - percent)) / 100;
  await med.save();
  res.json({ _id: med._id, name: med.name, batchNumber: med.batchNumber, price: med.price, originalPrice: med.originalPrice, markdownPercent: percent });
});

// @route POST /api/pharmacy/medicines/:id/recall  — batch removed from sale (stock 0)
const recallMedicine = asyncHandler(async (req, res) => {
  const med = await ownMedicine(req, res);
  const units = med.stock;
  med.recalled = true;
  med.recalledAt = new Date();
  med.stock = 0;
  await med.save();
  res.json({ _id: med._id, name: med.name, batchNumber: med.batchNumber, recalled: true, unitsRemoved: units });
});

// @route POST /api/pharmacy/medicines/:id/reorder  { qty }  — records a purchase request
const requestReorder = asyncHandler(async (req, res) => {
  const med = await ownMedicine(req, res);
  const qty = Number.parseInt(req.body?.qty, 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > 10000) { res.status(400); throw new Error('Reorder quantity must be between 1 and 10000.'); }
  med.reorderRequestedQty = qty;
  med.reorderRequestedAt = new Date();
  await med.save();
  res.json({ _id: med._id, name: med.name, reorderRequestedQty: qty, reorderRequestedAt: med.reorderRequestedAt });
});

module.exports = {
  getIntelligenceDashboard,
  getExpiryRisk,
  getStockRisk,
  getSubstitutes,
  getPrescriptionQueue,
  updatePrescriptionStatus,
  markdownMedicine,
  recallMedicine,
  requestReorder
};
