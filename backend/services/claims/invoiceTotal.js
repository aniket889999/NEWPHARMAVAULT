'use strict';
const Document = require('../../models/documentModel');
const ExtractedField = require('../../models/extractedFieldModel');

/** Invoice total from a case's extracted fields (PHARMACY_INVOICE only), or null when unknown. */
async function invoiceTotalForCase(caseId) {
  const invoices = await Document.find({ caseId, type: 'PHARMACY_INVOICE' }).select('_id').lean();
  if (!invoices.length) return null;
  const fields = await ExtractedField.find({ caseId, documentId: { $in: invoices.map((d) => d._id) }, fieldType: 'total_amount' }).select('normalizedValue rawValue').lean();
  const values = fields.map((f) => Number(String(f.normalizedValue || f.rawValue || '').replace(/[^0-9.]/g, ''))).filter((n) => Number.isFinite(n) && n > 0);
  return values.length ? Math.round(Math.max(...values) * 100) / 100 : null;
}

module.exports = { invoiceTotalForCase };
