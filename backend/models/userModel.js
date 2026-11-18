const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true },
    // Atomically incremented on logout/password changes. Missing legacy values
    // are version zero; rotating JWT_SECRET is still required at rollout.
    sessionVersion: { type: Number, default: 0, min: 0, select: false },
    role: { 
      type: String, 
      required: true, 
      enum: ['patient', 'pharmacy', 'admin', 'doctor', 'agent', 'super_admin', 'org_admin', 'branch_manager', 'pharmacist', 'auditor', 'claims_reviewer', 'research_evaluator', 'payer_reviewer', 'payer_admin'],
      default: 'patient',
      index: true
    },
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
    // TOTP MFA. Secrets are AES-256-GCM encrypted (utils/totp.js) and never selected by default.
    mfa: {
      enabled: { type: Boolean, default: false },
      secretEnc: { type: String, default: null, select: false },
      pendingSecretEnc: { type: String, default: null, select: false },
      lastUsedCounter: { type: Number, default: -1, select: false },
      enabledAt: { type: Date, default: null },
      // SHA-256 hashes of one-time recovery codes (services/platform/accountSecurity.js).
      recoveryCodeHashes: { type: [String], default: [], select: false }
    },
    // Deactivated accounts cannot sign in; existing sessions are revoked via sessionVersion.
    active: { type: Boolean, default: true, index: true },
    deactivatedAt: { type: Date, default: null },
    deactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Per-account lockout after repeated failed sign-ins.
    login: {
      failedCount: { type: Number, default: 0, min: 0 },
      lockedUntil: { type: Date, default: null },
      lastFailedAt: { type: Date, default: null }
    },
    // Professional registration of reviewers, confirmed by an organization admin.
    professional: {
      registrationNumber: { type: String, default: null, trim: true, maxlength: 40 },
      council: { type: String, default: null, trim: true, maxlength: 120 },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      verifiedAt: { type: Date, default: null }
    },
    // Future-ready metadata for GraphRAG & Agents
    metadata: {
      type: Map,
      of: String,
      default: {}
    }
  },
  { timestamps: true }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  if (!this.isNew) {
    const updated = await this.constructor.findByIdAndUpdate(this._id, { $inc: { sessionVersion: 1 } }, { new: true }).select('+sessionVersion');
    this.sessionVersion = updated.sessionVersion;
    // The increment is already durable. Never overwrite a concurrent logout's
    // newer version when this password save completes.
    this.unmarkModified('sessionVersion');
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);
