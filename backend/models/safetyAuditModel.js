const mongoose = require('mongoose');

const safetyAuditSchema = mongoose.Schema(
  {
    userRole: {
      type: String,
      required: true
    },
    query: {
      type: String,
      required: true
    },
    answer: {
      type: String,
      required: true
    },
    riskLevel: {
      type: String,
      default: 'Low'
    },
    hallucinationRisk: {
      type: String,
      default: 'Low'
    },
    confidence: {
      type: Number,
      default: 0
    },
    unsupportedClaims: {
      type: [String],
      default: []
    },
    contradictionFlags: {
      type: [String],
      default: []
    },
    reviewRequired: {
      type: Boolean,
      default: false
    },
    reviewReason: {
      type: String
    },
    agentTrace: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const SafetyAudit = mongoose.model('SafetyAudit', safetyAuditSchema);

module.exports = SafetyAudit;
