const express = require('express');
const router = express.Router();
const { 
  createReminder, 
  getMyReminders, 
  updateReminder, 
  deleteReminder, 
  sendTestEmail 
} = require('../controllers/reminderController');
const { protect } = require('../middleware/authMiddleware');

router.post('/create', protect, createReminder);
router.get('/my-reminders', protect, getMyReminders);
router.put('/:id', protect, updateReminder);
router.delete('/:id', protect, deleteReminder);
router.post('/send-test', protect, sendTestEmail);

module.exports = router;
