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
