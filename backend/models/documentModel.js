const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VerificationCase',
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: ['PRESCRIPTION', 'PHARMACY_INVOICE', 'CLAIM_FORM'],
      index: true
    },
    objectStorageKey: {
      type: String,
      required: true,
      trim: true
    },
    originalFilename: {
      type: String,
      default: ''
    },
    mimeType: {
      type: String,
      required: true,
      default: 'application/pdf'
    },
    sizeBytes: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    sha256: {
      type: String,
      default: '',
      index: true
    },
    pageCount: {
      type: Number,
      default: 1,
      min: 1
    },
    processedPageCount: {
      type: Number,
      default: 0,
      min: 0
    },
    omittedPageCount: {
      type: Number,
      default: 0,
      min: 0
    },
    pageCoverage: {
      total: { type: Number, default: 1, min: 1 },
      processed: { type: Number, default: 0, min: 0 },
      omitted: { type: Number, default: 0, min: 0 },
      status: {
        type: String,
        enum: ['COMPLETE', 'INCOMPLETE'],
        default: 'COMPLETE'
      }
    },
    uploadStatus: {
      type: String,
      required: true,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'COMPLETED'
    },
    processingStatus: {
      type: String,
      required: true,
      enum: ['PENDING', 'EXTRACTING', 'PROCESSED', 'FAILED', 'PDF_OCR_PENDING_RASTERIZATION'],
      default: 'PENDING'
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
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
        // Academic honesty & security constraint: Never expose internal storage identifiers, paths, or raw metadata
        delete ret.objectStorageKey;
        delete ret.localPath;
        delete ret.storageRoot;
        delete ret.storagePath;
        delete ret.metadata;

        const total = ret.pageCount || 1;
        const processed = ret.processedPageCount !== undefined ? ret.processedPageCount : total;
        const omitted = ret.omittedPageCount !== undefined ? ret.omittedPageCount : Math.max(0, total - processed);
        ret.processedPageCount = processed;
        ret.omittedPageCount = omitted;
        if (!ret.pageCoverage) {
          ret.pageCoverage = {
            total,
            processed,
            omitted,
            status: omitted > 0 ? 'INCOMPLETE' : 'COMPLETE'
          };
        }
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : undefined;
        delete ret.__v;
        delete ret.objectStorageKey;
        delete ret.localPath;
        delete ret.storageRoot;
        delete ret.storagePath;
        delete ret.metadata;

        const total = ret.pageCount || 1;
        const processed = ret.processedPageCount !== undefined ? ret.processedPageCount : total;
        const omitted = ret.omittedPageCount !== undefined ? ret.omittedPageCount : Math.max(0, total - processed);
        ret.processedPageCount = processed;
        ret.omittedPageCount = omitted;
        if (!ret.pageCoverage) {
          ret.pageCoverage = {
            total,
            processed,
            omitted,
            status: omitted > 0 ? 'INCOMPLETE' : 'COMPLETE'
          };
        }
        return ret;
      }
    }
  }
);

module.exports = mongoose.model('Document', documentSchema);
