const mongoose = require('mongoose');

const riskSignalSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VerificationCase',
      required: true,
      index: true
    },
    signalType: {
      type: String,
      required: true,
      enum: [
        'LOW_OCR_CONFIDENCE',
        'MISSING_REQUIRED_FIELD',
        'MEDICINE_STRENGTH_MISMATCH',
        'MEDICINE_NAME_MISMATCH',
        'QUANTITY_MISMATCH',
        'DATE_INCONSISTENCY',
        'DUPLICATE_DOCUMENT_SIGNAL',
        'AMBIGUOUS_MEDICINE_IDENTITY',
        'UNRESOLVED_MEDICINE_IDENTITY',
        'DOSAGE_FORM_DISCREPANCY',
        'INSUFFICIENT_EVIDENCE',
        'CONFLICTING_MULTI_PAGE_DATA'
      ],
      index: true
    },
    severity: {
      type: String,
      required: true,
      enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'HIGH'
    },
    description: {
      type: String,
      required: true
    },
    evidenceItemIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EvidenceItem'
      }
    ],
    detectedBy: {
      type: String,
      required: true,
      default: 'TRUST_RAG_ENGINE'
    },
    rulesetVersion: {
      type: String,
      required: true,
      default: '1.0'
    },
    reviewRequired: {
      type: Boolean,
      required: true,
      default: true
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

module.exports = mongoose.model('RiskSignal', riskSignalSchema);
