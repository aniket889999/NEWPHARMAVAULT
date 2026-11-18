const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 'payer' = insurer / TPA tenant. Payers never own verification cases.
  kind: {
    type: String,
    enum: ['pharmacy', 'payer'],
    default: 'pharmacy',
    index: true
  },
  plan: {
    type: String,
    enum: ['Starter', 'Professional', 'Enterprise'],
    default: 'Starter'
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'onboarding'],
    default: 'active'
  },
  // Review policy chosen by the organization admin (Team & Access).
  reviewPolicy: {
    // Single-pharmacist stores: the person who uploaded documents may VERIFY after an
    // explicit confirmation; every such decision is flagged in the audit log.
    allowSingleReviewerVerify: { type: Boolean, default: false }
  },
  contactEmail: String,
  contactPhone: String,
  address: {
    street: String,
    city: String,
    state: String,
    zip: String,
    country: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Organization', organizationSchema);
