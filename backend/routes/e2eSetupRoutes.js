'use strict';

/**
 * TEST-ONLY setup routes for Playwright E2E. Mounted only when
 * E2E_SETUP_ENABLED=true and NODE_ENV is not production (see app.js),
 * and every call needs X-E2E-Key === E2E_SETUP_KEY.
 * They let E2E tests create an eligible (VERIFIED) case without running OCR.
 */
const crypto = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');
const VerificationCase = require('../models/verificationCaseModel');
const auditLoggerService = require('../services/trustRag/auditLoggerService');

const router = express.Router();

router.use((req, res, next) => {
  const expected = Buffer.from(process.env.E2E_SETUP_KEY || '');
  const given = Buffer.from(String(req.get('X-E2E-Key') || ''));
  if (!expected.length || expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return res.status(404).json({ message: 'Not found' });
  }
  return next();
});

router.post('/cases/:caseId/mark-verified', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.caseId)) return res.status(404).json({ message: 'Not found' });
    const vCase = await VerificationCase.findByIdAndUpdate(req.params.caseId, { $set: { status: 'VERIFIED', reviewRequired: false } }, { new: true });
    if (!vCase) return res.status(404).json({ message: 'Not found' });
    await auditLoggerService.logEvent({
      caseId: vCase._id, actorId: vCase.createdBy, actorRole: 'e2e_setup', action: 'E2E_TEST_MARKED_VERIFIED',
      targetType: 'VerificationCase', targetId: vCase._id, metadata: { note: 'Synthetic E2E setup, not a real review.' }
    });
    return res.json({ id: String(vCase._id), status: vCase.status });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
