'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseReminderTime, isDue } = require('../services/platform/reminderScheduler');

test('reminder times parse in 24 h and 12 h formats', () => {
  assert.equal(parseReminderTime('08:00'), 480);
  assert.equal(parseReminderTime('9:30 PM'), 21 * 60 + 30);
  assert.equal(parseReminderTime('12:05 am'), 5);
  for (const bad of ['25:00', '7:60', 'noon', '13:00 PM']) assert.equal(parseReminderTime(bad), null, bad);
});

test('a daily reminder is due once per day in IST and not twice', () => {
  const r = { status: 'active', reminderTime: '08:00', frequency: 'daily', lastSentAt: null };
  const at = (iso) => new Date(iso);
  assert.equal(isDue(r, at('2026-11-18T02:29:00Z')), null, '07:59 IST is too early');
  const due = isDue(r, at('2026-11-18T02:31:00Z'));
  assert.equal(due.toISOString(), '2026-11-18T02:30:00.000Z', '08:00 IST = 02:30 UTC');
  assert.equal(isDue({ ...r, lastSentAt: at('2026-11-18T02:31:00Z') }, at('2026-11-18T02:40:00Z')), null, 'already sent today');
  assert.equal(isDue(r, at('2026-11-18T05:00:00Z')), null, 'more than 2 h late is skipped');
  assert.equal(isDue({ ...r, status: 'taken' }, at('2026-11-18T02:31:00Z')), null);
  assert.ok(isDue({ ...r, lastSentAt: at('2026-11-17T02:31:00Z') }, at('2026-11-18T02:35:00Z')), 'due again the next day');
});
