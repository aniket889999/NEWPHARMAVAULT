const asyncHandler = require('../middleware/asyncHandler');
const Reminder = require('../models/reminderModel');
const sendEmail = require('../utils/sendEmail');

// @desc    Create a new reminder
// @route   POST /api/reminders/create
// @access  Private
const createReminder = asyncHandler(async (req, res) => {
  const { medicineName, dosage, reminderTime, frequency, email, prescriptionId } = req.body;

  const reminder = new Reminder({
    user: req.user._id,
    medicineName,
    dosage,
    reminderTime,
    frequency,
    email,
    prescriptionId
  });

  const createdReminder = await reminder.save();

  // Send Test/Confirmation Email immediately upon creation
  try {
    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">PharmaVault Health Assistant</h2>
        <p>Hello,</p>
        <p>This is a confirmation that your medication reminder has been successfully created.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #4f46e5; margin: 20px 0;">
          <p><strong>Medicine:</strong> ${medicineName}</p>
          <p><strong>Dosage:</strong> ${dosage}</p>
          <p><strong>Time:</strong> ${reminderTime}</p>
          <p><strong>Frequency:</strong> ${frequency}</p>
        </div>
        <p>We will remind you at the scheduled time. Wishing you good health!</p>
        <p style="color: #64748b; font-size: 12px; margin-top: 30px; text-align: center;">This is a demo reminder system. Please follow your doctor's actual prescription.</p>
      </div>
    `;

    await sendEmail({
      email: email,
      subject: 'PharmaVault Reminder Setup Confirmation',
      html: htmlMessage,
    });
  } catch (error) {
    console.error('Email failed to send:', error);
    // Even if email fails, we still return success for the reminder creation
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
    await reminder.deleteOne();
    res.json({ message: 'Reminder removed' });
  } else {
    res.status(404);
    throw new Error('Reminder not found');
  }
});

// @desc    Send manual test reminder email
// @route   POST /api/reminders/send-test
// @access  Private
const sendTestEmail = asyncHandler(async (req, res) => {
  const { medicineName, dosage, email } = req.body;
  
  if (!email || !medicineName) {
    res.status(400);
    throw new Error('Missing required fields');
  }

  const htmlMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
      <h2 style="color: #4f46e5; text-align: center;">⏰ It's time for your medicine!</h2>
      <p>Hello,</p>
      <p>This is your PharmaVault Smart Reminder to take your medication right now.</p>
      <div style="background-color: #ecfdf5; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #065f46;">${medicineName}</h3>
        <p style="margin-bottom: 0;"><strong>Dosage:</strong> ${dosage || 'As prescribed'}</p>
      </div>
      <p>Please take your medication and mark it as taken in your PharmaVault dashboard.</p>
    </div>
  `;

  await sendEmail({
    email: email,
    subject: `Time to take your ${medicineName} - PharmaVault Reminder`,
    html: htmlMessage,
  });

  res.json({ message: 'Reminder email sent successfully' });
});

module.exports = {
  createReminder,
  getMyReminders,
  updateReminder,
  deleteReminder,
  sendTestEmail
};
