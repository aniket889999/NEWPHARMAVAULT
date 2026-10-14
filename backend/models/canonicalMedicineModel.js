const mongoose = require('mongoose');

const canonicalMedicineSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      default: '',
      trim: true,
      index: true
    },
    genericName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    strength: {
      type: String,
      default: '',
      trim: true
    },
    strengthUnit: {
      type: String,
      default: 'mg',
      trim: true
    },
    dosageForm: {
      type: String,
      required: true,
      trim: true
    },
    manufacturer: {
      type: String,
      default: '',
      trim: true
    },
    regulatoryIdentifiers: {
      type: [String],
      default: []
    },
    sourceVersion: {
      type: String,
      default: '2026.1-academic'
    },
    catalogueVersion: {
      type: String,
      default: '2026.1-academic'
    },
    sourceNote: {
      type: String,
      default: 'Curated academic reference catalogue — not live regulatory verification.'
    },
    aliases: {
      type: [String],
      default: [],
      index: true
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

module.exports = mongoose.model('CanonicalMedicine', canonicalMedicineSchema);
