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
      },
    ],
    totalPrice: { type: Number, required: true, default: 0.0 },
    status: { type: String, required: true, enum: ['Pending', 'Processing', 'Ready', 'Delivered'], default: 'Pending' },
    prescriptionUrl: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
