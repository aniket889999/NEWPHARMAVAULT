const mongoose = require('mongoose');

/**
 * Data-principal requests (DPDP Act 2023 style): export of own data and erasure.
 * Erasure is processed by a platform administrator; the request, its outcome and
 * every step are audited.
 */
const DATA_REQUEST_TYPES = ['EXPORT', 'ERASURE'];
const DATA_REQUEST_STATUSES = ['OPEN', 'COMPLETED', 'BLOCKED', 'CANCELLED'];

const dataRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: DATA_REQUEST_TYPES, required: true },
    status: { type: String, enum: DATA_REQUEST_STATUSES, default: 'OPEN', index: true },
    reason: { type: String, trim: true, maxlength: 1000, default: null },
    dueBy: { type: Date, default: null },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: null },
    outcome: {
      note: { type: String, trim: true, maxlength: 2000, default: null },
      casesPurged: { type: Number, default: 0 },
      grantsRevoked: { type: Number, default: 0 },
      notificationsDeleted: { type: Number, default: 0 },
      openClaims: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

// At most one open erasure request per person.
dataRequestSchema.index({ userId: 1, type: 1 }, { unique: true, partialFilterExpression: { status: 'OPEN', type: 'ERASURE' } });

module.exports = mongoose.model('DataRequest', dataRequestSchema);
module.exports.DATA_REQUEST_TYPES = DATA_REQUEST_TYPES;
module.exports.DATA_REQUEST_STATUSES = DATA_REQUEST_STATUSES;
