const mongoose = require('mongoose');

const reminderSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    required: false
  },
  medicineName: {
    type: String,
    required: true,
  },
  dosage: {
    type: String,
    required: true,
  },
  reminderTime: {
    type: String, // HH:MM AM/PM format
    required: true,
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'custom'],
    default: 'daily'
  },
  email: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'taken', 'skipped', 'inactive'],
    default: 'active'
  },
  lastSentAt: {
    type: Date,
  }
}, {
  timestamps: true,
});

const Reminder = mongoose.model('Reminder', reminderSchema);

module.exports = Reminder;
