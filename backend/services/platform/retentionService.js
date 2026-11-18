'use strict';

/**
 * Data retention: removes document content and derived evidence for old,
 * finished cases, and deletes old notifications.
 *
 * What is removed for an eligible case: stored files and previews, Document,
 * ExtractedField, ConsistencyCheck, RiskSignal and EvidenceItem records.
 * What is kept: the VerificationCase (as a tombstone with purgedAt),
 * ReviewDecision, Claim, CaseShareGrant and AuditEvent records, because they
 * are the accountability trail and contain no document content.
 *
 * A case is eligible only when ALL hold:
 *  - status is VERIFIED, REJECTED, CLOSED or FAILED;
 *  - it was last updated before the case cutoff;
 *  - it has no claim that is still open (SUBMITTED, UNDER_PAYER_REVIEW,
 *    QUERY_RAISED, APPROVED, PARTIALLY_APPROVED) and no claim updated after the cutoff.
 */

const fs = require('node:fs');
const path = require('node:path');

const FINISHED_CASE_STATUSES = Object.freeze(['VERIFIED', 'REJECTED', 'CLOSED', 'FAILED']);
const OPEN_CLAIM_STATUSES = Object.freeze(['SUBMITTED', 'UNDER_PAYER_REVIEW', 'QUERY_RAISED', 'APPROVED', 'PARTIALLY_APPROVED', 'APPEALED']);
const DAY_MS = 86_400_000;

function readPolicy(env = process.env) {
  const days = (name, fallback, min) => {
    const value = Number(env[name]);
    if (env[name] === undefined || env[name] === '') return fallback;
    if (!Number.isInteger(value) || value < min) throw new Error(`${name} must be an integer of at least ${min}.`);
    return value;
  };
  return {
    caseDays: days('RETENTION_CASE_DAYS', 365, 30),
    notificationDays: days('RETENTION_NOTIFICATION_DAYS', 180, 7),
    batchSize: days('RETENTION_BATCH_SIZE', 200, 1)
  };
}

function cutoffs(policy, now = Date.now()) {
  return {
    caseCutoff: new Date(now - policy.caseDays * DAY_MS),
    notificationCutoff: new Date(now - policy.notificationDays * DAY_MS)
  };
}

/** Pure eligibility rule, used by the DB query and by tests. */
function isCaseEligible(vCase, claims, caseCutoff) {
  if (!FINISHED_CASE_STATUSES.includes(vCase.status)) return false;
  if (vCase.purgedAt) return false;
  if (!(new Date(vCase.updatedAt) < caseCutoff)) return false;
  return !claims.some((c) => OPEN_CLAIM_STATUSES.includes(c.status) || new Date(c.updatedAt) >= caseCutoff);
}

function removeCaseFiles(storageRoot, caseId) {
  const dir = path.join(storageRoot, String(caseId));
  // Defence in depth: never delete outside the storage root.
  if (!/^[a-f\d]{24}$/i.test(String(caseId)) || path.dirname(dir) !== path.resolve(storageRoot)) return false;
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

/**
 * Removes stored files and derived evidence of one case and marks it purged.
 * Shared by the retention pass and patient erasure requests.
 */
async function purgeCaseContent(caseId, { now = Date.now(), env = process.env } = {}) {
  const VerificationCase = require('../../models/verificationCaseModel');
  const Document = require('../../models/documentModel');
  const ExtractedField = require('../../models/extractedFieldModel');
  const ConsistencyCheck = require('../../models/consistencyCheckModel');
  const RiskSignal = require('../../models/riskSignalModel');
  const EvidenceItem = require('../../models/evidenceItemModel');
  const { getDocumentStorageRoot } = require('../../config/documentStorage');
  const filter = { caseId };
  await Promise.all([
    Document.deleteMany(filter), ExtractedField.deleteMany(filter), ConsistencyCheck.deleteMany(filter),
    RiskSignal.deleteMany(filter), EvidenceItem.deleteMany(filter)
  ]);
  const fileRemoved = removeCaseFiles(getDocumentStorageRoot(env), caseId);
  // updateOne with timestamps:false keeps updatedAt, so the case is not "fresh" again.
  await VerificationCase.updateOne({ _id: caseId }, { $set: { purgedAt: new Date(now) } }, { timestamps: false });
  return { fileRemoved };
}

/**
 * Runs one retention pass. dryRun=true only counts.
 */
async function runRetention({ dryRun = true, now = Date.now(), env = process.env, logger = console } = {}) {
  const VerificationCase = require('../../models/verificationCaseModel');
  const Claim = require('../../models/claimModel');
  const Notification = require('../../models/notificationModel');
  const auditLoggerService = require('../trustRag/auditLoggerService');

  const policy = readPolicy(env);
  const { caseCutoff, notificationCutoff } = cutoffs(policy, now);
  const report = { dryRun, policy, caseCutoff, notificationCutoff, casesConsidered: 0, casesPurged: 0, filesRemoved: 0, notificationsDeleted: 0 };

  const candidates = await VerificationCase.find({
    status: { $in: FINISHED_CASE_STATUSES },
    updatedAt: { $lt: caseCutoff },
    purgedAt: null
  }).select('_id status updatedAt purgedAt createdBy').limit(policy.batchSize).lean();
  report.casesConsidered = candidates.length;

  for (const vCase of candidates) {
    const claims = await Claim.find({ caseId: vCase._id }).select('status updatedAt').lean();
    if (!isCaseEligible(vCase, claims, caseCutoff)) continue;
    if (dryRun) { report.casesPurged += 1; continue; }

    if ((await purgeCaseContent(vCase._id, { now, env })).fileRemoved) report.filesRemoved += 1;
    await auditLoggerService.logEvent({
      caseId: vCase._id, actorId: vCase.createdBy, actorRole: 'system_retention', action: 'RETENTION_CASE_CONTENT_PURGED',
      targetType: 'VerificationCase', targetId: vCase._id, metadata: { caseDays: policy.caseDays }
    });
    report.casesPurged += 1;
  }

  if (dryRun) {
    report.notificationsDeleted = await Notification.countDocuments({ createdAt: { $lt: notificationCutoff } });
  } else {
    report.notificationsDeleted = (await Notification.deleteMany({ createdAt: { $lt: notificationCutoff } })).deletedCount;
  }

  logger.info?.(`[retention] ${dryRun ? 'dry run' : 'applied'}: ${report.casesPurged} case(s), ${report.notificationsDeleted} notification(s).`);
  return report;
}

/**
 * Optional in-process daily schedule (RETENTION_JOB_ENABLED=true). With several
 * API instances it runs under a MongoDB lease so only one instance purges.
 */
function startRetentionSchedule({ env = process.env } = {}) {
  if (env.RETENTION_JOB_ENABLED !== 'true') return null;
  readPolicy(env);
  const intervalMs = 24 * 60 * 60 * 1000;
  const tick = async () => {
    try {
      const { mongoCaseLock } = require('./distributedLock');
      await mongoCaseLock().withLock('retention:daily', () => runRetention({ dryRun: env.RETENTION_DRY_RUN === 'true' }));
    } catch (error) {
      if (error.code !== 'CASE_BUSY') console.error('[retention] run failed:', error.message);
    }
  };
  const first = setTimeout(tick, 5 * 60 * 1000);
  const timer = setInterval(tick, intervalMs);
  first.unref?.();
  timer.unref?.();
  return { stop: () => { clearTimeout(first); clearInterval(timer); } };
}

module.exports = { FINISHED_CASE_STATUSES, OPEN_CLAIM_STATUSES, readPolicy, cutoffs, isCaseEligible, removeCaseFiles, purgeCaseContent, runRetention, startRetentionSchedule };
