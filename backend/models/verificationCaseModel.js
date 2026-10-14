const mongoose = require('mongoose');

const verificationCaseSchema = new mongoose.Schema(
  {
    caseReference: {
      type: String,
      unique: true,
      index: true,
      default: () => `CASE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    subjectReference: {
      type: String,
      default: 'patient-pseudonymous',
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: [
        'DRAFT',
        'DOCUMENTS_PENDING',
        'READY_FOR_PROCESSING',
        'PROCESSING',
        'NEEDS_CORRECTION',
        'NEEDS_REVIEW',
        'VERIFIED',
        'REJECTED',
        'CLOSED',
        'FAILED'
      ],
      default: 'DRAFT',
      index: true
    },
    documentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document'
      }
    ],
    reviewRequired: {
      type: Boolean,
      default: false
    },
    schemaVersion: {
      type: String,
      default: '1.0'
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : undefined;
        delete ret.__v;
        return ret;
      }
    }
  }
);

module.exports = mongoose.model('VerificationCase', verificationCaseSchema);
