const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, trim: true, maxlength: 64 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    // Plain status text only. Never include medicine names, amounts or document text.
    body: { type: String, required: true, trim: true, maxlength: 500 },
    link: { type: String, trim: true, maxlength: 300, default: null },
    readAt: { type: Date, default: null },
    delivery: {
      inApp: { type: String, enum: ['DELIVERED'], default: 'DELIVERED' },
      email: { type: String, enum: ['NOT_CONFIGURED', 'QUEUED', 'SENT', 'FAILED'], default: 'NOT_CONFIGURED' },
      emailAttempts: { type: Number, default: 0 },
      emailLastError: { type: String, default: null, maxlength: 200 },
      text: { type: String, enum: ['NOT_SENT', 'SENT', 'FAILED'], default: 'NOT_SENT' },
      textAttempts: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
