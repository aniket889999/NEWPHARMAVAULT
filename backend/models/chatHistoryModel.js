const mongoose = require('mongoose');
const message = new mongoose.Schema({
  id: { type: String, required: true }, role: { type: String, enum: ['user','assistant'], required: true },
  content: { type: String, required: true, maxlength: 12000 }, timestamp: { type: Date, required: true },
  rag: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });
const conversation = new mongoose.Schema({
  id: { type: String, required: true }, title: { type: String, required: true, maxlength: 80 },
  messages: { type: [message], default: [] },
  memory: { type: new mongoose.Schema({ version: String, topicIds: { type: [String], validate: value => value.length <= 4 }, intent: String, focus: String, style: String,
    personalContext: Boolean, privateReference: Boolean, unresolvedDetail: Boolean,
    questionPlan: { version: String, attribute: String, anchors: { type: [String], validate: value => value.length <= 7 }, requestedAttributes: { type: [String], validate: value => value.length <= 4 },
      multipleAttributes: Boolean, language: String, exactTemperature: Boolean, inherited: Boolean }
  }, { _id: false, strict: 'throw' }), default: null },
  createdAt: { type: Date, required: true }, updatedAt: { type: Date, required: true }
}, { _id: false });
const schema = new mongoose.Schema({
  _id: String, user: { type: mongoose.Schema.Types.ObjectId, required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, default: null },
  enabled: { type: Boolean, default: false }, consentVersion: String,
  conversations: { type: [conversation], default: [] }, leaseToken: String, activeUntil: Date,
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });
module.exports = mongoose.model('ChatHistory', schema);
