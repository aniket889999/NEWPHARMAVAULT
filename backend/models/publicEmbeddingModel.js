'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: { type: String, match: /^[a-f0-9]{64}$/ }, model: { type: String, required: true },
  task: { type: String, enum: ['RETRIEVAL_DOCUMENT', 'RETRIEVAL_QUERY'], required: true },
  dimension: { type: Number, enum: [768], required: true }, vector: { type: [Number], required: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { strict: 'throw' });
// Public reference / canonical public-task vectors only. No user, chat, case,
// document identifiers, raw questions, text or patient fields are stored.
module.exports = mongoose.model('PublicEmbedding', schema);
