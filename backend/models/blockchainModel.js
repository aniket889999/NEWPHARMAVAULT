const mongoose = require('mongoose');

const blockchainSchema = mongoose.Schema({
  medicineName: { type: String, required: true },
  genericName: { type: String },
  batchNumber: { type: String, required: true, unique: true },
  manufacturer: { type: String, required: true },
  manufacturingDate: { type: Date },
  expiryDate: { type: Date, required: true },
  distributor: { type: String, default: 'Default Distributor' },
  pharmacyName: { type: String, default: 'PharmaVault Hub' },
  pharmacyLocation: { type: String, default: 'Central Hub' },
  supplyChainStage: { type: String, default: 'Pharmacy' },
  
  // Blockchain specific fields
  blockchainHash: { type: String, required: true },
  previousHash: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verificationStatus: { type: String, default: 'Verified' },
  
  // Metrics
  verificationAttempts: { type: Number, default: 0 },
  suspiciousAttempts: { type: Number, default: 0 }
}, {
  timestamps: true,
});

const BlockchainLedger = mongoose.model('BlockchainLedger', blockchainSchema);

module.exports = BlockchainLedger;
