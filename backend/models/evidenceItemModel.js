const mongoose = require('mongoose');

const evidenceItemSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VerificationCase',
      required: true,
      index: true
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
      index: true
    },
    claimSupported: {
      type: String,
      required: true,
      trim: true
    },
    evidenceText: {
      type: String,
      required: true
    },
    pageNumber: {
      type: Number,
      default: 1,
      min: 1
    },
    boundingBox: {
      type: [Number],
      default: [0, 0, 0, 0]
    },
    sourceUrl: {
      type: String,
      default: ''
    },
    retrievedAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    contentHash: {
      type: String,
      default: ''
    },
    sourceVersion: {
      type: String,
      default: '1.0'
    },
    trustTier: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
      required: true
    },
    sourceType: {
      type: String,
      enum: ['CASE_DOCUMENT', 'CANONICAL_CATALOG', 'OFFICIAL_REGISTRY'],
      default: 'CASE_DOCUMENT',
      index: true
    },
    sourceLabel: {
      type: String,
      default: ''
    },
    relevanceReason: {
      type: String,
      default: ''
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

module.exports = mongoose.model('EvidenceItem', evidenceItemSchema);
