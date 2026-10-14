const mongoose = require('mongoose');

const workflowAuditSchema = new mongoose.Schema({
  workflowId: {
    type: String,
    required: true,
    index: true
  },
  workflowName: {
    type: String,
    required: true
  },
  trigger: {
    type: String,
    required: true
  },
  actionsExecuted: [{
    action: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'escalated'],
      default: 'pending'
    },
    timestamp: { type: Date, default: Date.now },
    details: mongoose.Schema.Types.Mixed
  }],
  escalationEvents: [{
    reason: String,
    targetRole: String,
    timestamp: { type: Date, default: Date.now }
  }],
  approvalRequired: {
    type: Boolean,
    default: false
  },
  approverRole: {
    type: String
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'not_required'],
    default: 'not_required'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  riskLevel: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Low'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'failed', 'cancelled'],
    default: 'active'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pharmacy'
  },
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

module.exports = mongoose.model('WorkflowAudit', workflowAuditSchema);
