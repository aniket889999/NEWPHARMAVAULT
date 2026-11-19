const crypto = require('node:crypto');
const Feedback = require('../models/chatFeedbackModel');
const Receipt = require('../models/chatReceiptModel');
const receipts = new Map();
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function issueReceipt(userId, result, { organizationId } = {}) {
  if (!userId || !result.sources?.length || result.sources.some(source => source.kind === 'CASE_RECORD' || source.documentId)) return result;
  const now = Date.now();
  for (const [key, value] of receipts) if (value.until <= now) receipts.delete(key);
  const receipt = crypto.randomUUID();
  receipts.set(receipt, { userId: String(userId), organizationId, until: now + 3600000, answerHash: digest(result.reply), sourceIds: result.sources.map(source => source.sourceId).slice(0, 8), sourceVersions: result.sources.map(source => source.version).slice(0, 8), topicIds: (result.context?.topics || []).map(topic => topic.id).slice(0, 2) });
  if (receipts.size > 500) receipts.delete(receipts.keys().next().value);
  return { ...result, feedbackReceipt: receipt };
}
function receiptPersistence(environment = process.env) {
  if (environment.NODE_ENV === 'production') return 'mongo';
  if (environment.CHAT_RECEIPT_STORE) return environment.CHAT_RECEIPT_STORE === 'memory' ? 'memory' : 'mongo';
  return environment.NODE_ENV === 'test' ? 'memory' : 'mongo';
}
async function issueReceiptDurably(userId, result, { organizationId, saveReceipt = value => Receipt.create(value) } = {}) {
  if (receiptPersistence() === 'memory') return issueReceipt(userId, result, { organizationId });
  if (!userId || !result.sources?.length || result.sources.some(source => source.kind === 'CASE_RECORD' || source.documentId)) return result;
  const receipt = crypto.randomUUID();
  try {
    await saveReceipt({ _id: digest(receipt), user: userId, ...(organizationId ? { organizationId } : {}),
      answerHash: digest(result.reply), sourceIds: result.sources.slice(0, 8).map(source => String(source.sourceId).slice(0, 256)),
      sourceVersions: result.sources.slice(0, 8).map(source => String(source.version).slice(0, 256)),
      topicIds: (result.context?.topics || []).slice(0, 2).map(topic => String(topic.id).slice(0, 100)), expiresAt: new Date(Date.now() + 3600000) });
    return { ...result, feedbackReceipt: receipt };
  } catch {
    // Preserve the evidence answer, but never pretend feedback was persisted.
    return { ...result, warnings: [...(result.warnings || []), 'Feedback is temporarily unavailable; this answer has no feedback receipt.'] };
  }
}
async function submitFeedback(userId, body, { save = value => Feedback.findOneAndUpdate({ user: value.user, receiptHash: value.receiptHash }, { $set: value }, { upsert: true, new: true, runValidators: true }) } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['receipt', 'rating'].includes(key)) || typeof body.receipt !== 'string' || !/^[a-f0-9-]{36}$/.test(body.receipt) || !['HELPFUL', 'NOT_HELPFUL'].includes(body.rating)) throw Object.assign(new Error('Submit an answer receipt and supported rating only. Do not submit patient information.'), { statusCode: 400 });
  let value = process.env.NODE_ENV === 'production' ? null : receipts.get(body.receipt);
  if (!value && receiptPersistence() === 'mongo' && Receipt.db.readyState === 1) {
    const stored = await Receipt.findOne({ _id: digest(body.receipt), user: userId, expiresAt: { $gt: new Date() } }).lean();
    if (stored) value = { ...stored, userId: String(stored.user), until: new Date(stored.expiresAt).getTime() };
  }
  if (!value || value.userId !== String(userId) || value.until <= Date.now()) throw Object.assign(new Error('Feedback receipt unavailable or expired.'), { statusCode: 404 });
  // No raw questions, answers, history or correction text are stored. Feedback
  // remains an untrusted curation signal, never an automatic knowledge update.
  await save({ user: userId, ...(value.organizationId ? { organizationId: value.organizationId } : {}), receiptHash: digest(body.receipt), answerHash: value.answerHash, sourceIds: value.sourceIds, sourceVersions: value.sourceVersions, topicIds: value.topicIds, rating: body.rating, status: 'PENDING_EXPERT_REVIEW', expiresAt: new Date(Date.now() + 30 * 86400000) });
  return { accepted: true, status: 'PENDING_EXPERT_REVIEW', learningApplied: false };
}
module.exports = { issueReceipt, issueReceiptDurably, submitFeedback, receiptPersistence };
