const asyncHandler = require('../middleware/asyncHandler');
const Medicine = require('../models/medicineModel');
const Prescription = require('../models/prescriptionModel');
const BlockchainLedger = require('../models/blockchainModel');
const graphService = require('../graph/graphService');

// @desc    Get Pharmacy Dashboard Intelligence (Metrics & Insights)
// @route   GET /api/pharmacy/intelligence
// @access  Private/Pharmacy
const getIntelligenceDashboard = asyncHandler(async (req, res) => {
  const medicines = await Medicine.find({});
  const prescriptions = await Prescription.find({});
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
  const medicines = await Medicine.find({}).sort('expiryDate');
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
  const medicines = await Medicine.find({}).sort('stock');

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
  const prescriptions = await Prescription.find({})
    .populate('user', 'name email')
    .sort('-createdAt');
    
  res.status(200).json(prescriptions);
});

// @desc    Update Prescription Status
// @route   PUT /api/pharmacy/prescription/:id/status
// @access  Private/Pharmacy
const updatePrescriptionStatus = asyncHandler(async (req, res) => {
  const { status, pharmacistNotes } = req.body;
  
  const prescription = await Prescription.findById(req.params.id);
  if (!prescription) {
    res.status(404); throw new Error("Prescription not found");
  }

  prescription.status = status || prescription.status;
  if (pharmacistNotes !== undefined) {
    prescription.pharmacistNotes = pharmacistNotes;
  }

  const updated = await prescription.save();
  res.status(200).json(updated);
});

module.exports = {
  getIntelligenceDashboard,
  getExpiryRisk,
  getStockRisk,
  getSubstitutes,
  getPrescriptionQueue,
  updatePrescriptionStatus
};
