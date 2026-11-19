'use strict';
// Offline configuration inventory only. No .env loading, network, model or DB
// calls; no secret values. This cannot attest deployment or human approvals.
const { references } = require('../services/chatReferenceRegistry');
const { sourceSummary } = require('../services/chatSourceGovernanceService');
const { receiptPersistence } = require('../services/chatFeedbackService');
const { limits } = require('../services/chatRuntimeControlService');
function buildLaunchReport(environment = process.env) {
  const governance = sourceSummary(references, { environment });
  let httpsOriginConfigured = false;
  try {
    const values = String(environment.CORS_ALLOWED_ORIGINS || '').split(',').filter(Boolean);
    httpsOriginConfigured = values.length > 0 && values.every(value => { const url = new URL(value.trim()); return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash && !url.hostname.includes('*'); });
  } catch { /* Invalid configuration is a blocker, never a displayed value. */ }
  const checks = {
    productionMode: environment.NODE_ENV === 'production',
    reviewedSourcePolicy: governance.mode === 'REVIEWED_ONLY',
    currentMedicalReviewRecords: governance.currentReviewRecords > 0,
    durablePublicReceipts: receiptPersistence(environment) === 'mongo',
    sharedIngressLimitsConfigured: environment.RATE_LIMIT_STORE === 'mongo',
    sharedCaseLocksConfigured: environment.CASE_LOCK_BACKEND === 'mongo',
    httpsOriginConfigured,
    signingSecretConfigured: String(environment.JWT_SECRET || '').length >= 32
  };
  return { schemaVersion: 'chat-launch-inventory/1.0.0', scope: 'OFFLINE_CONFIGURATION_NOT_DEPLOYMENT_PROOF',
    technicalConfigurationReady: Object.values(checks).every(Boolean), publicMedicalLaunchApproved: false,
    checks, sourceGovernance: governance, toolLimits: limits(environment),
    externalAcceptance: { clinicalEvaluation: 'PENDING', privacySecurityReview: 'PENDING', actualHttpsAndRestoreDrill: 'PENDING', supervisedPilotSignoff: 'PENDING' },
    limitations: ['No network/provider/database was probed.', 'Tool budgets/metrics are per-process, not global cost accounting.', 'Frozen case-answer receipts still need a separately versioned durability migration.'] };
}
if (require.main === module) {
  const report = buildLaunchReport(); console.log(JSON.stringify(report, null, 2));
  if (process.argv.includes('--strict')) process.exitCode = report.publicMedicalLaunchApproved ? 0 : 2;
}
module.exports = { buildLaunchReport };
