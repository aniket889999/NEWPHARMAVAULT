'use strict';

const Notification = require('../../models/notificationModel');
const User = require('../../models/userModel');

const EMAIL_ENABLED = () => process.env.NOTIFY_EMAIL_ENABLED === 'true' && Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
const MAX_EMAIL_ATTEMPTS = 3;

async function deliverEmail(notification, email) {
  // Lazy require keeps tests and email-free deployments independent of SMTP.
  const sendEmail = require('../../utils/sendEmail');
  for (let attempt = 1; attempt <= MAX_EMAIL_ATTEMPTS; attempt += 1) {
    try {
      await sendEmail({
        email,
        subject: `PharmaVault: ${notification.title}`,
        // Status text only; recipients sign in to see details.
        html: `<p>${notification.body.replace(/[<>&]/g, '')}</p><p>Sign in to PharmaVault to view the update.</p>`
      });
      await Notification.updateOne({ _id: notification._id }, { $set: { 'delivery.email': 'SENT', 'delivery.emailAttempts': attempt, 'delivery.emailLastError': null } });
      return;
    } catch (error) {
      await Notification.updateOne({ _id: notification._id }, {
        $set: { 'delivery.email': attempt === MAX_EMAIL_ATTEMPTS ? 'FAILED' : 'QUEUED', 'delivery.emailAttempts': attempt, 'delivery.emailLastError': String(error.code || 'SEND_FAILED').slice(0, 200) }
      });
      if (attempt < MAX_EMAIL_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}

/**
 * Creates in-app notifications (always) and optionally emails them.
 * Email delivery runs in the background and never blocks the API response.
 */
async function notifyUsers(userIds, { type, title, body, link }) {
  const unique = [...new Set(userIds.filter(Boolean).map(String))];
  if (!unique.length) return [];
  const docs = await Notification.insertMany(unique.map((userId) => ({
    userId, type, title, body, link, delivery: { email: EMAIL_ENABLED() ? 'QUEUED' : 'NOT_CONFIGURED' }
  })));
  if (EMAIL_ENABLED()) {
    const users = await User.find({ _id: { $in: unique } }).select('email');
    const emailById = new Map(users.map((u) => [String(u._id), u.email]));
    for (const doc of docs) {
      const email = emailById.get(String(doc.userId));
      if (email) deliverEmail(doc, email).catch(() => {});
    }
  }
  return docs;
}

async function notifyOrganizationRoles(organizationId, roles, message) {
  const users = await User.find({ organizationId, role: { $in: roles } }).select('_id');
  return notifyUsers(users.map((u) => u._id), message);
}

module.exports = { notifyUsers, notifyOrganizationRoles };
