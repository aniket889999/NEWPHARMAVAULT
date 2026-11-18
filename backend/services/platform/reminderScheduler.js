'use strict';

/**
 * Delivers Smart Reminders. Every minute, active reminders whose time has come today get
 * an in-app notification (and email/SMS through the normal notification channels when
 * those are configured). Each reminder is claimed atomically for the current due time,
 * so several API instances never send the same reminder twice.
 *
 * Times are interpreted in REMINDER_UTC_OFFSET_MINUTES (default 330 = India, IST).
 * Notification text is generic: no medicine name or dosage leaves the reminder record.
 */
const DEFAULT_OFFSET_MIN = 330;
const LATE_WINDOW_MIN = 120; // a reminder missed by more than 2 h (server down) is skipped until tomorrow

/** "08:00", "8:00 AM", "09:30 pm" -> minutes after midnight, or null. */
function parseReminderTime(value) {
  const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (minutes > 59) return null;
  if (m[3]) {
    if (hours < 1 || hours > 12) return null;
    const pm = m[3].toLowerCase() === 'pm';
    hours = (hours % 12) + (pm ? 12 : 0);
  } else if (hours > 23) return null;
  return hours * 60 + minutes;
}

/** The most recent due instant (UTC Date) for this reminder at or before `now`, or null. */
function latestDueAt(reminder, now = new Date(), offsetMin = DEFAULT_OFFSET_MIN) {
  const minuteOfDay = parseReminderTime(reminder.reminderTime);
  if (minuteOfDay === null) return null;
  const local = new Date(now.getTime() + offsetMin * 60_000);
  const startLocalDayUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offsetMin * 60_000;
  let due = new Date(startLocalDayUtc + minuteOfDay * 60_000);
  if (due > now) due = new Date(due.getTime() - 86_400_000);
  if (reminder.frequency === 'weekly' && reminder.createdAt) {
    const created = new Date(new Date(reminder.createdAt).getTime() + offsetMin * 60_000).getUTCDay();
    for (let i = 0; i < 7 && new Date(due.getTime() + offsetMin * 60_000).getUTCDay() !== created; i += 1) {
      due = new Date(due.getTime() - 86_400_000);
    }
  }
  return due;
}

function isDue(reminder, now = new Date(), offsetMin = DEFAULT_OFFSET_MIN) {
  // A dose marked 'taken' becomes due again at the next scheduled time.
  if (!['active', 'taken'].includes(reminder.status)) return null;
  const due = latestDueAt(reminder, now, offsetMin);
  if (!due) return null;
  if (now.getTime() - due.getTime() > LATE_WINDOW_MIN * 60_000) return null;
  if (reminder.lastSentAt && new Date(reminder.lastSentAt) >= due) return null;
  return due;
}

async function runOnce(now = new Date(), env = process.env) {
  const Reminder = require('../../models/reminderModel');
  const { notifyUsers } = require('../claims/notificationService');
  const offset = Number.isInteger(Number(env.REMINDER_UTC_OFFSET_MINUTES)) ? Number(env.REMINDER_UTC_OFFSET_MINUTES) : DEFAULT_OFFSET_MIN;
  const candidates = await Reminder.find({ status: { $in: ['active', 'taken'] } }).select('user reminderTime frequency lastSentAt createdAt status').limit(5000).lean();
  let sent = 0;
  for (const reminder of candidates) {
    const due = isDue(reminder, now, offset);
    if (!due) continue;
    const claimed = await Reminder.updateOne(
      { _id: reminder._id, status: { $in: ['active', 'taken'] }, $or: [{ lastSentAt: null }, { lastSentAt: { $exists: false } }, { lastSentAt: { $lt: due } }] },
      { $set: { lastSentAt: now, status: 'active' } }
    );
    if (claimed.modifiedCount !== 1) continue;
    await notifyUsers([reminder.user], {
      type: 'MEDICINE_REMINDER',
      title: 'Medicine reminder',
      body: 'It is time for one of your scheduled medicines. Open Smart Reminders to mark it taken.',
      link: '/patient/reminders'
    });
    sent += 1;
  }
  return { checked: candidates.length, sent };
}

function startReminderSchedule(env = process.env) {
  if (env.NODE_ENV === 'test' || env.REMINDER_SCHEDULER_ENABLED === 'false') return null;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runOnce(new Date(), env); } catch (error) { console.error(JSON.stringify({ level: 'error', msg: 'reminder_scheduler_failed', error: String(error.message).slice(0, 200) })); } finally { running = false; }
  };
  const timer = setInterval(tick, 60_000);
  timer.unref?.();
  setTimeout(tick, 5_000).unref?.();
  return { stop: () => clearInterval(timer) };
}

module.exports = { parseReminderTime, latestDueAt, isDue, runOnce, startReminderSchedule };
