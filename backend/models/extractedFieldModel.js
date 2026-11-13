const mongoose = require('mongoose');

const extractedFieldSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VerificationCase',
      required: true,
      index: true
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true
    },
    fieldType: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    rawValue: {
      type: String,
      required: true
    },
    normalizedValue: {
      type: String,
      default: ''
    },
    pageNumber: {
      type: Number,
      default: 1,
      min: 1
    },
    boundingBox: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      validate: {
        validator: (arr) =>
          arr === null ||
          arr === undefined ||
          (Array.isArray(arr) &&
            arr.length === 4 &&
            arr.every((n) => typeof n === 'number' && Number.isFinite(n))),
        message: 'boundingBox must be null or have exactly 4 numbers [x_min, y_min, x_max, y_max]'
      }
    },
    extractionMethod: {
      type: String,
      default: 'DETERMINISTIC_PROTOTYPE'
    },
    extractionConfidence: {
      type: Number,
      required: false,
      min: 0,
      max: 1,
      default: null
    },
    candidateRowKey: {
      type: String,
      default: null,
      index: true
    },
    needsCorrection: {
      type: Boolean,
      default: false,
      index: true
    },
    correctedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    correctedAt: {
      type: Date,
      default: null
    },
    resolution: {
      type: mongoose.Schema.Types.Mixed,
      default: null
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

module.exports = mongoose.model('ExtractedField', extractedFieldSchema);
