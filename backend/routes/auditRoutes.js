'use strict';

/**
 * Audit log integrity (read-only). There is deliberately no route that edits or deletes audit events.
 *   GET /api/v1/audit/chain/verify?fromSeq=1  — super_admin or auditor
 */
const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const AuditEvent = require('../models/auditEventModel');
const { verifyChain } = require('../services/platform/auditChain');
const auditLoggerService = require('../services/trustRag/auditLoggerService');

const router = express.Router();
const AUDIT_ROLES = ['super_admin', 'auditor'];

router.get('/audit/chain/verify', asyncHandler(async (req, res) => {
  if (!AUDIT_ROLES.includes(req.user?.role)) {
    res.status(403);
    throw new Error('Access denied: audit verification is limited to platform administrators and auditors.');
  }
  const fromSeq = Number(req.query.fromSeq || 1);
  if (!Number.isInteger(fromSeq) || fromSeq < 1) {
    res.status(400);
    throw new Error('fromSeq must be a positive integer.');
  }
  const result = await verifyChain(AuditEvent, { fromSeq });
  await auditLoggerService.logEvent({ actorId: req.user._id, actorRole: req.user.role, action: 'AUDIT_CHAIN_VERIFIED', targetType: 'AuditChain', targetId: 'audit', metadata: { ok: result.ok, checked: result.checked, problem: result.problem || null } });
  res.setHeader('Cache-Control', 'no-store');
  res.json(result);
}));

module.exports = router;
