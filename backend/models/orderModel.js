const mongoose = require('mongoose');

const orderSchema = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    orderItems: [
      {
        name: { type: String, required: true },
        qty: { type: Number, required: true },
        price: { type: Number, required: true },
        medicine: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Medicine' },
        prescriptionRequired: { type: Boolean, default: false },
      },
    ],
    totalPrice: { type: Number, required: true, default: 0.0 },
    status: {
      type: String,
      required: true,
      // Pending -> (Awaiting Pharmacist for prescription items) -> Approved -> Ready -> Delivered
      // or Needs Clarification / Rejected / Cancelled. Rejected and Cancelled return the stock.
      enum: ['Pending', 'Awaiting Pharmacist', 'Approved', 'Processing', 'Ready', 'Delivered', 'Needs Clarification', 'Rejected', 'Cancelled'],
      default: 'Pending'
    },
    prescriptionUrl: { type: String },
    // The pharmacy that fulfils this order (one order per pharmacy).
    pharmacyOrganizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },
    requiresPrescription: { type: Boolean, default: false },
    pharmacistNote: { type: String, default: '', maxlength: 1000 },
    stockReturned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
