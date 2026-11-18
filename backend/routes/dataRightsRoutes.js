'use strict';

/**
 * Data-principal rights (mounted under /api/v1 with protect + tenantMiddleware).
 *   GET  /me/data-export                         own data as JSON (any signed-in user)
 *   GET  /me/data-requests                       own requests
 *   POST /me/erasure-request      { reason? }    patient asks for deletion
 *   POST /me/data-requests/:id/cancel            patient cancels an open request
 *   GET  /privacy/data-requests?status=OPEN      super_admin queue
 *   POST /privacy/data-requests/:id/complete { note }  super_admin performs the erasure
 */
const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const DataRequest = require('../models/dataRequestModel');
const service = require('../services/platform/dataRightsService');
const auditLoggerService = require('../services/trustRag/auditLoggerService');
const { isWebClient, verifyBrowserMutation } = require('../config/browserSession');

const router = express.Router();
const csrf = (req) => { if (isWebClient(req)) verifyBrowserMutation(req); };
const audit = (req, action, targetId, metadata = {}) => auditLoggerService.logEvent({ actorId: req.user._id, actorRole: req.user.role, action, targetType: 'DataRequest', targetId, metadata });
const send = (res, error) => res.status(error.statusCode || 500).json({ code: error.code, message: error.message });
const validId = (id) => /^[a-f\d]{24}$/i.test(String(id));
const view = (r) => ({ id: String(r._id), type: r.type, status: r.status, reason: r.reason, dueBy: r.dueBy, createdAt: r.createdAt, processedAt: r.processedAt, outcome: r.outcome });

router.get('/me/data-export', asyncHandler(async (req, res) => {
  const data = await service.buildExport(req.user._id);
  const record = await DataRequest.create({ userId: req.user._id, type: 'EXPORT', status: 'COMPLETED', processedAt: new Date() });
  await audit(req, 'PERSONAL_DATA_EXPORTED', record._id, { cases: data.cases.length });
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `attachment; filename="pharmavault-my-data-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
}));

router.get('/me/data-requests', asyncHandler(async (req, res) => {
  const list = await DataRequest.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  res.json(list.map(view));
}));

router.post('/me/erasure-request', asyncHandler(async (req, res) => {
  csrf(req);
  try {
    const created = await service.requestErasure(req.user, req.body?.reason);
    await audit(req, 'ERASURE_REQUESTED', created._id);
    res.status(201).json(view(created));
  } catch (error) {
    if (error.statusCode) return send(res, error);
    throw error;
  }
}));

router.post('/me/data-requests/:id/cancel', asyncHandler(async (req, res) => {
  csrf(req);
  if (!validId(req.params.id)) return send(res, { statusCode: 404, code: 'DATA_REQUEST_NOT_FOUND', message: 'Request not found.' });
  const updated = await DataRequest.findOneAndUpdate({ _id: req.params.id, userId: req.user._id, status: 'OPEN' }, { $set: { status: 'CANCELLED', processedAt: new Date() } }, { new: true });
  if (!updated) return send(res, { statusCode: 404, code: 'DATA_REQUEST_NOT_FOUND', message: 'No open request with that id.' });
  await audit(req, 'ERASURE_REQUEST_CANCELLED', updated._id);
  res.json(view(updated));
}));

const superAdminOnly = (req, res, next) => (req.user?.role === 'super_admin'
  ? next()
  : send(res, { statusCode: 403, code: 'FORBIDDEN', message: 'Access denied: data requests are processed by platform administrators.' }));

router.get('/privacy/data-requests', superAdminOnly, asyncHandler(async (req, res) => {
  const status = ['OPEN', 'COMPLETED', 'BLOCKED', 'CANCELLED'].includes(req.query.status) ? req.query.status : 'OPEN';
  const list = await DataRequest.find({ type: 'ERASURE', status }).sort({ createdAt: 1 }).limit(100).lean();
  res.json(list.map((r) => ({ ...view(r), userId: String(r.userId) })));
}));

router.post('/privacy/data-requests/:id/complete', superAdminOnly, asyncHandler(async (req, res) => {
  csrf(req);
  if (!validId(req.params.id)) return send(res, { statusCode: 404, code: 'DATA_REQUEST_NOT_FOUND', message: 'Deletion request not found.' });
  try {
    const result = await service.completeErasure(req.params.id, req.user, req.body?.note);
    await audit(req, 'ERASURE_COMPLETED', req.params.id, { casesPurged: result.outcome.casesPurged, grantsRevoked: result.outcome.grantsRevoked });
    res.json(result);
  } catch (error) {
    if (error.code === 'ERASURE_BLOCKED_OPEN_CLAIMS') await audit(req, 'ERASURE_BLOCKED', req.params.id, {});
    if (error.statusCode) return send(res, error);
    throw error;
  }
}));

module.exports = router;
