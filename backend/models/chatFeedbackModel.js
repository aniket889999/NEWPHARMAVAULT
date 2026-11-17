const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiptHash: { type: String, required: true }, answerHash: { type: String, required: true },
  sourceIds: [{ type: String }], sourceVersions: [{ type: String }], topicIds: [{ type: String }],
  rating: { type: String, enum: ['HELPFUL', 'NOT_HELPFUL'], required: true },
  status: { type: String, enum: ['PENDING_EXPERT_REVIEW'], default: 'PENDING_EXPERT_REVIEW' },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });
schema.index({ user: 1, receiptHash: 1 }, { unique: true });
module.exports = mongoose.model('ChatFeedback', schema);
