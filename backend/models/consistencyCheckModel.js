const mongoose = require('mongoose');

const consistencyCheckSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VerificationCase',
      required: true,
      index: true
    },
    checkType: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    status: {
      type: String,
      required: true,
      enum: ['PASS', 'FAIL', 'INCONCLUSIVE', 'NOT_APPLICABLE'],
      index: true
    },
    severity: {
      type: String,
      required: true,
      enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM'
    },
    message: {
      type: String,
      required: true
    },
    evidenceItemIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EvidenceItem'
      }
    ],
    rulesetVersion: {
      type: String,
      required: true,
      default: '1.0'
    },
    reviewRequired: {
      type: Boolean,
      required: true,
      default: false
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

module.exports = mongoose.model('ConsistencyCheck', consistencyCheckSchema);
