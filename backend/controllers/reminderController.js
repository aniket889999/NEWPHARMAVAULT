const asyncHandler = require('../middleware/asyncHandler');
const Reminder = require('../models/reminderModel');
const sendEmail = require('../utils/sendEmail');
const mongoose = require('mongoose');

// @desc    Create a new reminder
// @route   POST /api/reminders/create
// @access  Private
const createReminder = asyncHandler(async (req, res) => {
  const { medicineName, dosage, reminderTime, frequency, email, prescriptionId } = req.body;

  if (!medicineName || !dosage || !reminderTime) {
    res.status(400);
    throw new Error('Medicine name, dosage, and reminder time are required.');
  }

  const userEmail = (email && email.trim()) || (req.user && req.user.email) || 'patient@test.com';

  const reminder = new Reminder({
    user: req.user._id,
    medicineName: medicineName.trim(),
    dosage: dosage.trim(),
    reminderTime: reminderTime.trim(),
    frequency: frequency || 'daily',
    email: userEmail,
    prescriptionId: (prescriptionId && mongoose.isValidObjectId(prescriptionId)) ? prescriptionId : undefined
  });

  const createdReminder = await reminder.save();

  // Try sending confirmation email without crashing if SMTP fails
  try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #2563eb; text-align: center;">PharmaVault Health Reminder</h2>
          <p>Hello,</p>
          <p>Your medication reminder has been scheduled:</p>
          <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
            <p><strong>Medicine:</strong> ${medicineName}</p>
            <p><strong>Dosage:</strong> ${dosage}</p>
            <p><strong>Time:</strong> ${reminderTime}</p>
            <p><strong>Frequency:</strong> ${frequency || 'daily'}</p>
          </div>
          <p>We will remind you at the scheduled time. Stay healthy!</p>
        </div>
      `;

      await sendEmail({
        email: userEmail,
        subject: `PharmaVault Reminder: ${medicineName}`,
        html: htmlMessage,
      });
    }
  } catch (error) {
    console.warn('Reminder email notification skipped:', error.message);
  }

  res.status(201).json(createdReminder);
});

// @desc    Get user reminders
// @route   GET /api/reminders/my-reminders
// @access  Private
const getMyReminders = asyncHandler(async (req, res) => {
  const reminders = await Reminder.find({ user: req.user._id }).sort('-createdAt');
  res.json(reminders);
});

// @desc    Update reminder
// @route   PUT /api/reminders/:id
// @access  Private
const updateReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findById(req.params.id);

  if (reminder) {
    if (reminder.user.toString() !== req.user._id.toString()) {
      res.status(401);
      throw new Error('Not authorized to update this reminder');
    }

    reminder.status = req.body.status || reminder.status;
    reminder.medicineName = req.body.medicineName || reminder.medicineName;
    reminder.dosage = req.body.dosage || reminder.dosage;
    reminder.reminderTime = req.body.reminderTime || reminder.reminderTime;
    reminder.frequency = req.body.frequency || reminder.frequency;

    const updatedReminder = await reminder.save();
    res.json(updatedReminder);
  } else {
    res.status(404);
    throw new Error('Reminder not found');
  }
});

// @desc    Delete reminder
// @route   DELETE /api/reminders/:id
// @access  Private
const deleteReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findById(req.params.id);

  if (reminder) {
    if (reminder.user.toString() !== req.user._id.toString()) {
      res.status(401);
      throw new Error('Not authorized to delete this reminder');
    }

    await Reminder.deleteOne({ _id: req.params.id });
    res.json({ message: 'Reminder deleted successfully' });
  } else {
    res.status(404);
    throw new Error('Reminder not found');
  }
});

// @desc    Send test reminder email
// @route   POST /api/reminders/send-test
// @access  Private
const sendTestEmail = asyncHandler(async (req, res) => {
  const { medicineName, dosage, email } = req.body;
  const targetEmail = email || (req.user && req.user.email) || 'patient@test.com';

  try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await sendEmail({
        email: targetEmail,
        subject: `[Test Dose Alert] Time for ${medicineName}`,
        html: `<h3>Dose Reminder</h3><p>Please take <strong>${dosage}</strong> of <strong>${medicineName}</strong> now.</p>`,
      });
      res.json({ message: 'Email sent successfully' });
    } else {
      res.json({ message: 'Test notification simulated (email credentials not configured).' });
    }
  } catch (error) {
    res.json({ message: 'Email simulation completed: ' + error.message });
  }
});

module.exports = {
  createReminder,
  getMyReminders,
  updateReminder,
  deleteReminder,
  sendTestEmail
};
