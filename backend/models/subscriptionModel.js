const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true
  },
  planName: {
    type: String,
    enum: ['Starter', 'Professional', 'Enterprise'],
    default: 'Starter'
  },
  maxBranches: {
    type: Number,
    default: 1
  },
  maxUsers: {
    type: Number,
    default: 5
  },
  aiUsageLimit: {
    type: Number, // requests per month
    default: 1000
  },
  aiUsageCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'past_due'],
    default: 'active'
  },
  renewalDate: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
