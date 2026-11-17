const mongoose = require('mongoose');
const action = new mongoose.Schema({ actor: { type: mongoose.Schema.Types.ObjectId, required: true }, decision: { type: String, enum: ['APPROVE', 'REJECT', 'REVOKE'], required: true }, at: { type: Date, required: true }, reasonCode: { type: String, required: true } }, { _id: false });
const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  topicId: { type: String, required: true }, focus: { type: String, required: true }, sourceIds: [{ type: String }],
  corpusHash: { type: String, required: true }, createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'], default: 'PENDING' },
  revision: { type: Number, default: 1 }, approvalVersion: { type: Number, default: 0 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId }, reviewedAt: Date, actions: [action]
}, { timestamps: true });
schema.index({ organizationId: 1, topicId: 1, focus: 1, approvalVersion: -1 });
const counter = new mongoose.Schema({ _id: String, value: { type: Number, default: 0 } });
module.exports = { KnowledgeCuration: mongoose.model('KnowledgeCuration', schema), KnowledgeCurationCounter: mongoose.model('KnowledgeCurationCounter', counter) };
