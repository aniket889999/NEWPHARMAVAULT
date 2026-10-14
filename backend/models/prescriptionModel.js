const mongoose = require('mongoose');

const prescriptionSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  imageUrl: {
    type: String, // Could be base64 string or image path
    required: false,
  },
  extractedText: {
    type: String,
    required: false,
  },
  doctorName: { type: String, default: "" },
  patientName: { type: String, default: "" },
  prescriptionDate: { type: String, default: "" },
  overallConfidence: { type: Number, default: 0 },
  detectedMedicines: [{
    medicineName: String,
    genericName: String,
    dosage: String,
    frequency: String,
    duration: String,
    instructions: String,
    confidence: Number,
    matchedInventoryId: String,
    needsReview: Boolean,
    graphEvidence: [String],
    warnings: [String],
    price: Number,
    stock: Number
  }],
  notes: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    enum: ['Pending Review', 'Approved', 'Rejected', 'Needs Clarification', 'Dispensed'],
    default: 'Pending Review'
  },
  pharmacistNotes: {
    type: String,
    default: ""
  }
}, {
  timestamps: true,
});

const Prescription = mongoose.model('Prescription', prescriptionSchema);

module.exports = Prescription;
