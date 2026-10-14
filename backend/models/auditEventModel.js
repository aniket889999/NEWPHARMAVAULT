const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VerificationCase',
      default: null,
      index: true
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    actorRole: {
      type: String,
      required: true,
      trim: true
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    targetType: {
      type: String,
      required: true,
      trim: true
    },
    targetId: {
      type: String,
      required: true,
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true
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

// Prevent modifications to ensure append-only audit trail
auditEventSchema.pre('updateOne', function () {
  throw new Error('Audit events are immutable and cannot be updated.');
});
auditEventSchema.pre('findOneAndUpdate', function () {
  throw new Error('Audit events are immutable and cannot be updated.');
});
auditEventSchema.pre('deleteMany', function () {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Audit events cannot be deleted.');
  }
});
auditEventSchema.pre('deleteOne', function () {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Audit events cannot be deleted.');
  }
});

module.exports = mongoose.model('AuditEvent', auditEventSchema);
