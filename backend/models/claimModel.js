const mongoose = require('mongoose');
const { CLAIM_STATUSES, DECISION_STATUSES } = require('../services/claims/claimStateMachine');

const querySchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 2000 },
    askedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    askedAt: { type: Date, default: Date.now },
    answer: { type: String, trim: true, maxlength: 2000, default: null },
    answeredAt: { type: Date, default: null }
  },
  { _id: true }
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: CLAIM_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    byRole: { type: String, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { _id: false }
);

const claimSchema = new mongoose.Schema(
  {
    claimReference: {
      type: String,
      unique: true,
      index: true,
      default: () => `CLM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'VerificationCase', required: true, index: true },
    claimantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pharmacyOrganizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    payerOrganizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    shareGrantId: { type: mongoose.Schema.Types.ObjectId, ref: 'CaseShareGrant', required: true },
    status: { type: String, enum: CLAIM_STATUSES, default: 'SUBMITTED', index: true },
    // Synthetic policy identifier only (demo). Never a real policy number.
    policyNumber: { type: String, required: true, trim: true, maxlength: 64 },
    claimedAmount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'INR', enum: ['INR'] },
    queries: { type: [querySchema], default: [] },
    decision: {
      decision: { type: String, enum: [...DECISION_STATUSES, null], default: null },
      approvedAmount: { type: Number, default: null },
      reasonCode: { type: String, default: null },
      note: { type: String, default: null, maxlength: 2000 },
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      decidedAt: { type: Date, default: null }
    },
    // Set when the claimant accepts a partial approval (gives up the appeal) so it can be settled.
    decisionAcceptedAt: { type: Date, default: null },
    settlement: {
      reference: { type: String, default: null },
      // Amount marked as settled: the approved amount of the decision (simulated, no payment).
      amount: { type: Number, default: null },
      settledAt: { type: Date, default: null },
      simulated: { type: Boolean, default: true }
    },
    history: { type: [historySchema], default: [] },
    appeal: {
      count: { type: Number, default: 0, min: 0 },
      reason: { type: String, default: null, maxlength: 2000 },
      appealedAt: { type: Date, default: null },
      // The decision being appealed; a different insurer reviewer must decide the appeal.
      previousDecision: {
        decision: { type: String, default: null },
        approvedAmount: { type: Number, default: null },
        reasonCode: { type: String, default: null },
        note: { type: String, default: null },
        decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        decidedAt: { type: Date, default: null }
      }
    },
    reviewStartedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// One open claim per case per payer.
claimSchema.index(
  { caseId: 1, payerOrganizationId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['SUBMITTED', 'UNDER_PAYER_REVIEW', 'QUERY_RAISED', 'APPEALED'] } } }
);

module.exports = mongoose.models.Claim || mongoose.model('Claim', claimSchema);
