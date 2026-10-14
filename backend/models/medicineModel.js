const mongoose = require('mongoose');

const medicineSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true, default: 0 },
    manufacturer: { type: String, required: true },
    prescriptionRequired: { type: Boolean, required: true, default: false },
    expiryDate: { type: Date, required: true },
    batchNumber: { type: String, default: 'UNKNOWN' },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      index: true
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Medicine', medicineSchema);
