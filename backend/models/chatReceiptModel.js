'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: { type: String, match: /^[a-f0-9]{64}$/ },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId },
  answerHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  sourceIds: [{ type: String, maxlength: 256 }],
  sourceVersions: [{ type: String, maxlength: 256 }],
  topicIds: [{ type: String, maxlength: 100 }],
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true, strict: 'throw' });
module.exports = mongoose.model('ChatReceipt', schema);
