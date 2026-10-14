const BlockchainLedger = require('../models/blockchainModel');
const asyncHandler = require('../middleware/asyncHandler');
const crypto = require('crypto');

// Utility function to calculate SHA-256 hash
const calculateHash = (data) => {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
};

// @desc    Register a new medicine batch on the blockchain
// @route   POST /api/blockchain/register-batch
// @access  Private/Pharmacy
const registerBatch = asyncHandler(async (req, res) => {
  const { medicineName, genericName, batchNumber, manufacturer, manufacturingDate, expiryDate, distributor, pharmacyName, pharmacyLocation, supplyChainStage } = req.body;

  if (!medicineName || !batchNumber || !manufacturer || !expiryDate) {
    res.status(400); throw new Error('Required fields missing');
  }

  // Find previous block to link
  const previousBlock = await BlockchainLedger.findOne().sort({ timestamp: -1 });
  const previousHash = previousBlock ? previousBlock.blockchainHash : '0'.repeat(64);

  const blockData = {
    medicineName,
    genericName,
    batchNumber,
    manufacturer,
    manufacturingDate,
    expiryDate,
    distributor,
    pharmacyName,
    pharmacyLocation,
    supplyChainStage,
    previousHash,
    timestamp: new Date().toISOString()
  };

  const blockchainHash = calculateHash(blockData);

  const newBlock = new BlockchainLedger({
    ...blockData,
    blockchainHash,
    registeredBy: req.user ? req.user._id : null
  });

  const savedBlock = await newBlock.save();
  res.status(201).json(savedBlock);
});

// @desc    Get entire blockchain ledger
// @route   GET /api/blockchain/ledger
// @access  Private/Pharmacy
const getLedger = asyncHandler(async (req, res) => {
  const ledger = await BlockchainLedger.find({}).sort({ timestamp: -1 });
  res.status(200).json(ledger);
});

// @desc    Check integrity of the entire blockchain
// @route   GET /api/blockchain/integrity-check
// @access  Private/Pharmacy
const checkIntegrity = asyncHandler(async (req, res) => {
  const ledger = await BlockchainLedger.find({}).sort({ timestamp: 1 });
  
  let isValid = true;
  let tamperedBlocks = [];

  for (let i = 1; i < ledger.length; i++) {
    const currentBlock = ledger[i];
    const previousBlock = ledger[i - 1];

    // Check if previous hash matches
    if (currentBlock.previousHash !== previousBlock.blockchainHash) {
      isValid = false;
      tamperedBlocks.push(currentBlock.batchNumber);
    }
  }

  res.status(200).json({
    status: isValid ? 'Valid' : 'Tampered',
    isValid,
    tamperedBlocks
  });
});

// @desc    Verify specific batch (Used by Patient Authenticity Checker)
// @route   POST /api/blockchain/verify
// @access  Public/Patient
const verifyBatch = asyncHandler(async (req, res) => {
  const { batch, manufacturer } = req.body;
  
  if (!batch || !manufacturer) {
    res.status(400); throw new Error('Batch and Manufacturer required for verification');
  }

  const block = await BlockchainLedger.findOne({ batchNumber: batch, manufacturer });

  if (block) {
    // Check expiry
    const isExpired = new Date(block.expiryDate) < new Date();
    
    // Update metrics
    block.verificationAttempts += 1;
    await block.save();

    // Verify hash integrity mathematically
    const blockData = {
      medicineName: block.medicineName,
      genericName: block.genericName,
      batchNumber: block.batchNumber,
      manufacturer: block.manufacturer,
      manufacturingDate: block.manufacturingDate ? block.manufacturingDate.toISOString() : undefined,
      expiryDate: block.expiryDate.toISOString(),
      distributor: block.distributor,
      pharmacyName: block.pharmacyName,
      pharmacyLocation: block.pharmacyLocation,
      supplyChainStage: block.supplyChainStage,
      previousHash: block.previousHash,
      timestamp: block.timestamp.toISOString()
    };
    
    const recalculatedHash = calculateHash(blockData);
    const hashIntact = recalculatedHash === block.blockchainHash;

    const timeline = [
      { stage: 'Manufacturer', detail: block.manufacturer, date: block.manufacturingDate || 'N/A' },
      { stage: 'Distributor', detail: block.distributor || 'N/A', date: 'In Transit' },
      { stage: 'Pharmacy', detail: block.pharmacyName || 'N/A', date: block.timestamp }
    ];

    if (!hashIntact) {
      return res.status(200).json({
        status: 'tampered', title: 'Blockchain Integrity Failed',
        message: 'This batch exists in the ledger but its data hash has been tampered with! Do not consume.',
        score: 0,
        data: { name: block.medicineName, batch: block.batchNumber, hash: block.blockchainHash, integrity: 'TAMPERED' },
        timeline,
        riskAnalysis: {
          suspicionScore: 100,
          riskLevel: 'High',
          reasons: ['Data hash mismatch with ledger', 'Potential supply chain interception']
        }
      });
    }

    if (isExpired) {
      return res.status(200).json({
        status: 'expired', title: 'Product Expired',
        message: 'This product is Blockchain Verified but has EXPIRED. Do not consume.',
        score: 60,
        data: { name: block.medicineName, batch: block.batchNumber, manufacturer: block.manufacturer, expiry: block.expiryDate.toISOString().split('T')[0], blockchainHash: block.blockchainHash },
        timeline,
        riskAnalysis: {
          suspicionScore: 70,
          riskLevel: 'Medium',
          reasons: ['Product is past its safe consumption date']
        }
      });
    }

    return res.status(200).json({
      status: 'verified', title: 'Blockchain Verified Authentic',
      message: 'This product is 100% verified against our immutable ledger and safe to use.',
      score: 100,
      data: { 
        name: block.medicineName, 
        batch: block.batchNumber, 
        manufacturer: block.manufacturer, 
        expiry: block.expiryDate.toISOString().split('T')[0],
        blockchainHash: block.blockchainHash
      },
      timeline,
      riskAnalysis: {
        suspicionScore: 0,
        riskLevel: 'Low',
        reasons: ['Blockchain signature verified', 'Expiry date valid']
      }
    });
  }

  // Not found in Blockchain. We can track suspicious attempts on the last block just for metrics, but usually we just return suspicious.
  res.status(200).json({
    status: 'suspicious', title: 'Suspicious Product Detected',
    message: 'Could not verify manufacturer or batch in the Blockchain Ledger. High risk of counterfeit.',
    score: 0,
    data: { manufacturer, batch, source: 'Blockchain Verification Failed' },
    timeline: [],
    riskAnalysis: {
      suspicionScore: 90,
      riskLevel: 'High',
      reasons: ['Batch not found in blockchain', 'Manufacturer missing from ledger']
    }
  });
});

module.exports = {
  registerBatch, getLedger, checkIntegrity, verifyBatch
};
