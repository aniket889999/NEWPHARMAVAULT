const ExtractedField = require('../../models/extractedFieldModel');
const EvidenceItem = require('../../models/evidenceItemModel');
const storageService = require('./storageService');
const localOcrService = require('./localOcrService');
const pdfRenderingService = require('./pdfRenderingService');
const { buildProposedGroupsFromPersistedFields } = require('./localMedicineRowExtractor');
const { RECOGNIZED_MEDICINE_SLOTS } = require('./medicineItemContract');

/**
 * Document Extractor Service (Local Image & PDF OCR Engine)
 *
 * Implements server-side local OCR extraction for:
 * 1. Image uploads (PNG, JPEG, WEBP) via Tesseract OCR
 * 2. PDF documents via local sequential PDF page rendering (up to 3 pages) and Tesseract OCR
 *
 * Academic & Safety Constraints:
 * - All PDF rendering and OCR run 100% locally on the backend.
 * - Zero PDF bytes, page images, OCR text, or patient data are sent to external LLMs/APIs.
 * - No fake template fields are created when OCR produces no text or fails.
 * - Preserves actual pageNumber, boundingBox, and extractionConfidence for every candidate.
 * - Supports up to 3 candidate medicine rows per prescription/invoice with conservative blockers.
 */
class DocumentExtractorService {
  /**
   * Extract fields from a document
   * @param {Object} document
   * @returns {Promise<Array<Object>>}
   */
  async extractFields(document) {
    const { caseId, _id: documentId, type, mimeType, originalFilename } = document;

    // Check if fields already extracted
    const existingFields = await ExtractedField.find({ documentId });
    if (existingFields.length > 0) {
      return existingFields;
    }

    // 1. PDF Handling: Real local rendering + local Tesseract OCR
    const isPdf =
      mimeType === 'application/pdf' ||
      (originalFilename && originalFilename.toLowerCase().endsWith('.pdf'));

    if (isPdf) {
      return this._extractPdfFields(document);
    }

    // 2. Real Server-side Image OCR for PNG, JPEG, WEBP
    const isImage =
      mimeType === 'image/png' ||
      mimeType === 'image/jpeg' ||
      mimeType === 'image/webp' ||
      /\.(png|jpe?g|webp)$/i.test(originalFilename || '');

    if (!isImage) {
      document.processingStatus = 'FAILED';
      document.metadata = {
        ...(document.metadata || {}),
        processingMessage: `Unsupported document format for local OCR: ${mimeType || 'unknown'}`
      };
      await document.save();
      return [];
    }

    try {
      document.processingStatus = 'EXTRACTING';
      await document.save();

      // Retrieve validated binary file bytes from secure disk storage
      const imageBuffer = await storageService.getDocumentBuffer(caseId, document.objectStorageKey);

      // Run server-side OCR via LocalOcrService (Tesseract English image OCR)
      const ocrResult = await localOcrService.processImage(imageBuffer);

      // Extract conservative row and document candidates
      const rowExtraction = localOcrService.extractDocumentRows(ocrResult, type, {
        pageNumber: 1,
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR'
      });
      const candidates = rowExtraction.candidates;

      // Persist real extracted fields and grounded evidence citations
      const savedFields = await this._saveCandidateFields(document, candidates, 'LOCAL_TESSERACT_IMAGE_OCR');
      const proposedGroups = buildProposedGroupsFromPersistedFields(savedFields, {
        blockerCodes: rowExtraction.blockerCodes
      });

      document.pageCount = 1;
      document.processedPageCount = 1;
      document.omittedPageCount = 0;
      document.pageCoverage = {
        total: 1,
        processed: 1,
        omitted: 0,
        status: 'COMPLETE'
      };
      document.metadata = {
        ...(document.metadata || {}),
        detectedRowCount: rowExtraction.detectedRowCount,
        extractionBlockers: rowExtraction.blockerCodes,
        extractionIssues: rowExtraction.issues.map((i) => ({
          code: i.code,
          reason: i.reason,
          pageNumber: i.pageNumber,
          message: i.message
        })),
        proposedMedicineGrouping:
          proposedGroups.length > 0
            ? {
                mode: 'AUTO_PROPOSED',
                groups: proposedGroups
              }
            : null,
        needsCorrection: rowExtraction.needsReview
      };
      document.processingStatus = 'PROCESSED';
      await document.save();

      return savedFields;
    } catch (ocrErr) {
      document.processingStatus = 'FAILED';
      document.metadata = {
        ...(document.metadata || {}),
        processingError: ocrErr.message
      };
      await document.save();

      const controlledErr = new Error(`Local OCR extraction failed: ${ocrErr.message}`);
      controlledErr.statusCode = ocrErr.statusCode || 422;
      throw controlledErr;
    }
  }

  /**
   * Extract fields from PDF document using local sequential rendering and OCR
   * @private
   * @param {Object} document
   * @returns {Promise<Array<Object>>}
   */
  async _extractPdfFields(document) {
    const { caseId, _id: documentId, type } = document;

    try {
      document.processingStatus = 'EXTRACTING';
      await document.save();

      // Retrieve validated binary file bytes from secure disk storage
      const pdfBuffer = await storageService.getDocumentBuffer(caseId, document.objectStorageKey);

      // Render pages sequentially up to MAX_PAGES (3) via local PdfRenderingService
      const renderResult = await pdfRenderingService.renderDocumentPages(caseId, documentId, pdfBuffer);

      // Update stored page coverage metrics from true PDF page count
      document.pageCount = renderResult.pageCount || 1;
      document.processedPageCount = renderResult.pagesRendered || (renderResult.pages ? renderResult.pages.length : 1);
      document.omittedPageCount = Math.max(0, document.pageCount - document.processedPageCount);
      document.pageCoverage = {
        total: document.pageCount,
        processed: document.processedPageCount,
        omitted: document.omittedPageCount,
        status: document.omittedPageCount > 0 ? 'INCOMPLETE' : 'COMPLETE'
      };

      if (document.omittedPageCount > 0) {
        document.metadata = {
          ...(document.metadata || {}),
          incompleteCoverage: true,
          coverageNotice: `Document contains ${document.pageCount} pages, exceeding the 3-page processing limit. Only ${document.processedPageCount} pages were analyzed; ${document.omittedPageCount} page(s) were omitted. Human reviewer inspection required.`
        };
      }

      // Sequentially execute local Tesseract OCR on each rendered page buffer
      const ocrPages = [];
      for (const page of renderResult.pages) {
        const ocrResult = await localOcrService.processImage(page.buffer);
        ocrPages.push({
          pageNumber: page.pageNumber,
          lines: Array.isArray(ocrResult?.lines) ? ocrResult.lines : [],
          rawText: typeof ocrResult?.rawText === 'string' ? ocrResult.rawText : '',
          confidence: ocrResult?.confidence
        });
      }

      const rowExtraction = localOcrService.extractDocumentRows(
        { pages: ocrPages },
        type,
        { extractionMethod: 'LOCAL_TESSERACT_PDF_OCR' }
      );
      const allCandidates = rowExtraction.candidates;

      // Detect conflicting field values across distinct pages (scoped by medicine/document)
      this._detectMultiPageConflicts(allCandidates, document);

      // Academic boundary: If no legible text was extracted, create NO fake template fields;
      // mark document for human correction.
      if (allCandidates.length === 0) {
        document.processingStatus = 'PROCESSED';
        document.metadata = {
          ...(document.metadata || {}),
          detectedRowCount: 0,
          extractionBlockers: ['EXTRACTION_INCOMPLETE'],
          proposedMedicineGrouping: null,
          needsCorrection: true,
          needsHumanCorrection: true,
          processingMessage: 'No legible text detected during local PDF OCR; human reviewer validation required.'
        };
        await document.save();
        return [];
      }

      // Persist real extracted fields and grounded evidence citations with true page numbers
      const savedFields = await this._saveCandidateFields(document, allCandidates, 'LOCAL_TESSERACT_PDF_OCR');
      const proposedGroups = buildProposedGroupsFromPersistedFields(savedFields, {
        blockerCodes: rowExtraction.blockerCodes
      });

      document.metadata = {
        ...(document.metadata || {}),
        detectedRowCount: rowExtraction.detectedRowCount,
        extractionBlockers: rowExtraction.blockerCodes,
        extractionIssues: rowExtraction.issues.map((i) => ({
          code: i.code,
          reason: i.reason,
          pageNumber: i.pageNumber,
          message: i.message
        })),
        proposedMedicineGrouping:
          proposedGroups.length > 0
            ? {
                mode: 'AUTO_PROPOSED',
                groups: proposedGroups
              }
            : null,
        needsCorrection: Boolean(document.metadata?.needsCorrection || rowExtraction.needsReview)
      };

      document.processingStatus = 'PROCESSED';
      await document.save();

      return savedFields;
    } catch (ocrErr) {
      document.processingStatus = 'FAILED';
      document.metadata = {
        ...(document.metadata || {}),
        processingError: ocrErr.message
      };
      await document.save();

      const controlledErr = new Error(`Local PDF OCR extraction failed: ${ocrErr.message}`);
      controlledErr.statusCode = ocrErr.statusCode || 422;
      throw controlledErr;
    }
  }

  /**
   * Detect conflicting values for the same fieldType across distinct pages.
   * Medicine fields are scoped by their row's medicine_name so distinct medicines on different
   * pages do not falsely collide, while duplicate medicine rows across pages with conflicting
   * attributes (e.g. Paracetamol 500mg on page 1 vs Paracetamol 650mg on page 2) are flagged.
   *
   * @private
   * @param {Array<Object>} candidates
   * @param {Object} document
   */
  _detectMultiPageConflicts(candidates, document) {
    // Map candidateRowKey -> normalized medicine_name
    const rowMedicineMap = new Map();
    for (const c of candidates) {
      if (c.fieldType === 'medicine_name' && c.candidateRowKey) {
        const medVal = (c.normalizedValue || c.rawValue || '').trim().toLowerCase();
        rowMedicineMap.set(c.candidateRowKey, medVal);
      }
    }

    const byScopeAndType = new Map();
    for (const c of candidates) {
      let scopeKey = 'doc';
      if (RECOGNIZED_MEDICINE_SLOTS.includes(c.fieldType)) {
        const medName = c.candidateRowKey ? rowMedicineMap.get(c.candidateRowKey) : null;
        scopeKey = medName ? `med:${medName}` : `row:${c.candidateRowKey || 'ungrouped'}`;
      }
      const key = `${scopeKey}::${c.fieldType}`;
      if (!byScopeAndType.has(key)) {
        byScopeAndType.set(key, []);
      }
      byScopeAndType.get(key).push(c);
    }

    let hasConflict = false;
    for (const [, scopedCandidates] of byScopeAndType.entries()) {
      const pageValues = new Map();
      for (const c of scopedCandidates) {
        const val = (
          c.normalizedValue !== undefined && c.normalizedValue !== '' ? c.normalizedValue : c.rawValue || ''
        )
          .trim()
          .toLowerCase();
        if (val) {
          const p = c.pageNumber || 1;
          if (!pageValues.has(p)) {
            pageValues.set(p, val);
          }
        }
      }

      const distinctPages = Array.from(pageValues.keys());
      if (distinctPages.length > 1) {
        const firstVal = pageValues.get(distinctPages[0]);
        for (let i = 1; i < distinctPages.length; i++) {
          if (pageValues.get(distinctPages[i]) !== firstVal) {
            hasConflict = true;
            for (const c of scopedCandidates) {
              c.needsCorrection = true;
            }
            break;
          }
        }
      }
    }

    if (hasConflict) {
      document.metadata = {
        ...(document.metadata || {}),
        hasMultiPageConflict: true,
        needsCorrection: true
      };
    }
  }

  /**
   * Helper to persist extracted field candidates and initial grounded EvidenceItems.
   *
   * @param {Object} document
   * @param {Array<Object>} candidates
   * @param {string} extractionMethod
   * @returns {Promise<Array<Object>>}
   */
  async _saveCandidateFields(document, candidates, extractionMethod) {
    const { caseId, _id: documentId } = document;
    const savedFields = [];

    for (const c of candidates) {
      const hasValidConfidence =
        typeof c.extractionConfidence === 'number' &&
        Number.isFinite(c.extractionConfidence) &&
        c.extractionConfidence >= 0 &&
        c.extractionConfidence <= 1;

      const field = new ExtractedField({
        caseId,
        documentId,
        fieldType: c.fieldType,
        rawValue: c.rawValue,
        normalizedValue: c.normalizedValue !== undefined ? c.normalizedValue : c.rawValue,
        pageNumber: c.pageNumber || 1,
        boundingBox: Array.isArray(c.boundingBox) && c.boundingBox.length === 4 ? c.boundingBox : null,
        extractionMethod: c.extractionMethod || extractionMethod || 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: hasValidConfidence ? c.extractionConfidence : null,
        candidateRowKey: c.candidateRowKey || null,
        needsCorrection:
          c.needsCorrection !== undefined
            ? Boolean(c.needsCorrection)
            : !hasValidConfidence || c.extractionConfidence < 0.75,
        resolution: c.resolution || null
      });

      const savedField = await field.save();
      savedFields.push(savedField);

      const evBox = Array.isArray(c.boundingBox) && c.boundingBox.length === 4 ? c.boundingBox : [0, 0, 0, 0];
      const confPct = hasValidConfidence ? `${Math.round(c.extractionConfidence * 100)}%` : 'unknown';

      // Create an initial EvidenceItem representing the document citation
      const evidence = new EvidenceItem({
        caseId,
        sourceId: savedField._id,
        documentId,
        claimSupported: `Extracted ${c.fieldType}: "${c.rawValue}" (Local OCR)`,
        evidenceText: `Document page ${c.pageNumber || 1} at bounding box [${evBox.join(
          ', '
        )}] contains "${c.rawValue}" (Method: ${field.extractionMethod}, Confidence: ${confPct})`,
        pageNumber: c.pageNumber || 1,
        boundingBox: evBox,
        trustTier: 4
      });
      await evidence.save();
    }

    return savedFields;
  }
}

module.exports = new DocumentExtractorService();
