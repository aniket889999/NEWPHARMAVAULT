const mongoose = require('mongoose');

const reviewDecisionSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VerificationCase',
      required: true,
      index: true
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    decision: {
      type: String,
      required: true,
      enum: ['APPROVE', 'REJECT', 'REQUEST_CLARIFICATION', 'ESCALATE'],
      index: true
    },
    reasonCode: {
      type: String,
      required: true,
      trim: true
    },
    notes: {
      type: String,
      default: ''
    },
    evidenceItemIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EvidenceItem'
      }
    ],
    createdAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    timestamps: false,
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

// Prevent modifications to ensure decision immutability
reviewDecisionSchema.pre('updateOne', function () {
  throw new Error('Review decisions are immutable and cannot be updated.');
});
reviewDecisionSchema.pre('findOneAndUpdate', function () {
  throw new Error('Review decisions are immutable and cannot be updated.');
});

module.exports = mongoose.model('ReviewDecision', reviewDecisionSchema);
