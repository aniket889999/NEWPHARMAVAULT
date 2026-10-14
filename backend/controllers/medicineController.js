const Medicine = require('../models/medicineModel');
const asyncHandler = require('../middleware/asyncHandler');
const axios = require('axios');

// @desc    Get all medicines
// @route   GET /api/medicines
const getMedicines = asyncHandler(async (req, res) => {
  const query = {};
  
  // Pharmacy staff only see their organization's inventory
  // Patients and Super Admins see the global directory (or all tenants)
  if (req.user && req.user.role !== 'super_admin' && req.user.role !== 'patient') {
    if (req.tenantContext?.organizationId) {
      query.organizationId = req.tenantContext.organizationId;
    }
  }
  
  const medicines = await Medicine.find(query);
  res.status(200).json(medicines);
});

// @desc    Get single medicine by ID
// @route   GET /api/medicines/:id
const getMedicineById = asyncHandler(async (req, res) => {
  const medicine = await Medicine.findById(req.params.id);

  if (medicine) {
    res.status(200).json(medicine);
  } else {
    res.status(404);
    throw new Error('Medicine not found');
  }
});

// @desc    Create a medicine
// @route   POST /api/medicines
const createMedicine = asyncHandler(async (req, res) => {
  const { name, category, description, price, stock, manufacturer, prescriptionRequired, expiryDate, batchNumber } = req.body;

  if (!name || !category || !description || price === undefined || !manufacturer || !expiryDate) {
    res.status(400);
    throw new Error('Please provide all required fields');
  }

  if (price < 0) {
    res.status(400);
    throw new Error('Price cannot be negative');
  }
  if (stock !== undefined && stock < 0) {
    res.status(400);
    throw new Error('Stock cannot be negative');
  }

  const medicine = new Medicine({
    name, category, description, price,
    stock: stock || 0,
    manufacturer,
    prescriptionRequired: prescriptionRequired || false,
    expiryDate,
    batchNumber: batchNumber || 'UNKNOWN',
    organizationId: req.tenantContext?.organizationId,
    branchId: req.tenantContext?.branchId
  });

  const createdMedicine = await medicine.save();
  res.status(201).json(createdMedicine);
});

// @desc    Update a medicine
// @route   PUT /api/medicines/:id
const updateMedicine = asyncHandler(async (req, res) => {
  const { name, category, description, price, stock, manufacturer, prescriptionRequired, expiryDate, batchNumber } = req.body;

  const medicine = await Medicine.findById(req.params.id);

  if (!medicine) {
    res.status(404);
    throw new Error('Medicine not found');
  }

  if (price !== undefined && price < 0) {
    res.status(400);
    throw new Error('Price cannot be negative');
  }
  if (stock !== undefined && stock < 0) {
    res.status(400);
    throw new Error('Stock cannot be negative');
  }

  medicine.name = name || medicine.name;
  medicine.category = category || medicine.category;
  medicine.description = description || medicine.description;
  medicine.price = price !== undefined ? price : medicine.price;
  medicine.stock = stock !== undefined ? stock : medicine.stock;
  medicine.manufacturer = manufacturer || medicine.manufacturer;
  medicine.prescriptionRequired = prescriptionRequired !== undefined ? prescriptionRequired : medicine.prescriptionRequired;
  medicine.expiryDate = expiryDate || medicine.expiryDate;
  medicine.batchNumber = batchNumber || medicine.batchNumber;

  const updatedMedicine = await medicine.save();
  res.status(200).json(updatedMedicine);
});

// @desc    Delete a medicine
// @route   DELETE /api/medicines/:id
const deleteMedicine = asyncHandler(async (req, res) => {
  const medicine = await Medicine.findById(req.params.id);

  if (!medicine) {
    res.status(404);
    throw new Error('Medicine not found');
  }

  await medicine.deleteOne();
  res.status(200).json({ message: 'Medicine deleted successfully' });
});

// @desc    Verify authenticity of medicine against FDA / local batch DB
// @route   POST /api/medicines/verify
const verifyMedicine = asyncHandler(async (req, res) => {
  const { batch, manufacturer, expiry } = req.body;
  if (!batch || !manufacturer) {
    res.status(400); throw new Error('Batch and Manufacturer required');
  }

  // Check if we have an exact match in our local trusted pharmacy inventory
  const localMatch = await Medicine.findOne({ batchNumber: batch, manufacturer: manufacturer });
  
  if (localMatch) {
    // Check expiry if dates exist
    if (localMatch.expiryDate) {
      const isExpired = new Date(localMatch.expiryDate) < new Date();
      if (isExpired) {
        return res.status(200).json({
          status: 'expired', title: 'Product Expired',
          message: 'This product is authentic but has EXPIRED. Do not consume.',
          score: 60,
          data: { name: localMatch.name, batch: localMatch.batchNumber, manufacturer: localMatch.manufacturer, expiry: localMatch.expiryDate.toISOString().split('T')[0], source: 'PharmaVault Internal DB' }
        });
      }
    }

    return res.status(200).json({
      status: 'verified', title: 'Authentic Medicine Verified',
      message: 'This product batch is officially registered, verified, and safe to use.',
      score: 100,
      data: { name: localMatch.name, batch: localMatch.batchNumber, manufacturer: localMatch.manufacturer, expiry: localMatch.expiryDate?.toISOString().split('T')[0], source: 'PharmaVault Internal DB' }
    });
  }

  // Fallback to openFDA API to check if Manufacturer exists
  try {
    const fdaUrl = `https://api.fda.gov/drug/ndc.json?search=labeler_name:"${manufacturer}"&limit=1`;
    const fdaRes = await axios.get(fdaUrl);

    if (fdaRes.data.results && fdaRes.data.results.length > 0) {
      return res.status(200).json({
        status: 'partial', title: 'Partial Verification',
        message: 'Manufacturer exists in official FDA database, but this specific batch number is not registered locally. Exercise caution.',
        score: 50,
        data: { manufacturer: manufacturer, batch: batch, source: 'openFDA API (Partial Match)' }
      });
    }
  } catch (error) {
    // Suppress error if FDA doesn't find it (404)
  }

  // Not found anywhere
  res.status(200).json({
    status: 'suspicious', title: 'Suspicious Product Detected',
    message: 'Could not verify manufacturer or batch in any official database. High risk of counterfeit.',
    score: 0,
    data: { manufacturer, batch, source: 'Verification Failed' }
  });
});

module.exports = {
  getMedicines, getMedicineById, createMedicine, updateMedicine, deleteMedicine, verifyMedicine
};
