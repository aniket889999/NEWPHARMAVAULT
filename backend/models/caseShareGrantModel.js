const mongoose = require('mongoose');

const SHARE_SCOPES = Object.freeze(['case_summary', 'documents', 'extracted_fields', 'consistency_checks', 'risk_signals', 'review_decisions']);

/**
 * Explicit, revocable consent: the claimant lets ONE payer organization read
 * a verification case. Payer access is denied whenever no active grant exists.
 */
const caseShareGrantSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'VerificationCase', required: true, index: true },
    granteeOrganizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: ['INSURANCE_CLAIM_REVIEW'], default: 'INSURANCE_CLAIM_REVIEW' },
    scope: { type: [{ type: String, enum: SHARE_SCOPES }], required: true },
    consentText: { type: String, required: true, maxlength: 2000 },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

caseShareGrantSchema.methods.isActive = function isActive(now = new Date()) {
  return !this.revokedAt && this.expiresAt > now;
};

module.exports = mongoose.models.CaseShareGrant || mongoose.model('CaseShareGrant', caseShareGrantSchema);
module.exports.SHARE_SCOPES = SHARE_SCOPES;
