const ExtractedField = require('../../models/extractedFieldModel');
const EvidenceItem = require('../../models/evidenceItemModel');
const storageService = require('./storageService');
const localOcrService = require('./localOcrService');
const pdfRenderingService = require('./pdfRenderingService');

/**
 * Document Extractor Service (Local Image & PDF OCR Engine)
 *
 * Implements real server-side local OCR extraction for:
 * 1. Image uploads (PNG, JPEG, WEBP) via Tesseract OCR
 * 2. PDF documents via local sequential PDF page rendering (up to 3 pages) and Tesseract OCR
 *
 * Academic & Safety Constraints:
 * - All PDF rendering and OCR run 100% locally on the backend.
 * - Zero PDF bytes, page images, OCR text, or patient data are sent to external LLMs/APIs.
 * - No fake template fields are created when OCR produces no text or fails.
 * - Preserves actual pageNumber for every OCR candidate and grounded evidence citation.
 * - Single-medicine-per-case MVP boundary: multi-medicine documents trigger human review.
 * - Conflicting multi-page field values mark fields for correction and trigger explainable risk signals.
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

      // Extract conservative candidates via transparent rule & regex patterns
      const candidates = await localOcrService.extractConservativeFields(ocrResult, type, {
        pageNumber: 1,
        extractionMethod: 'LOCAL_TESSERACT_IMAGE_OCR'
      });

      // Persist real extracted fields and grounded evidence citations
      const savedFields = await this._saveCandidateFields(document, candidates, 'LOCAL_TESSERACT_IMAGE_OCR');

      document.pageCount = 1;
      document.processedPageCount = 1;
      document.omittedPageCount = 0;
      document.pageCoverage = {
        total: 1,
        processed: 1,
        omitted: 0,
        status: 'COMPLETE'
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
      const allCandidates = [];
      for (const page of renderResult.pages) {
        const ocrResult = await localOcrService.processImage(page.buffer);
        const pageCandidates = await localOcrService.extractConservativeFields(ocrResult, type, {
          pageNumber: page.pageNumber,
          extractionMethod: 'LOCAL_TESSERACT_PDF_OCR'
        });
        allCandidates.push(...pageCandidates);
      }

      // Detect conflicting field values across distinct pages (e.g. Page 1 vs Page 2)
      this._detectMultiPageConflicts(allCandidates, document);

      // Academic boundary: If no legible text was extracted, create NO fake template fields;
      // mark document for human correction.
      if (allCandidates.length === 0) {
        document.processingStatus = 'PROCESSED';
        document.metadata = {
          ...(document.metadata || {}),
          needsCorrection: true,
          needsHumanCorrection: true,
          processingMessage: 'No legible text detected during local PDF OCR; human reviewer validation required.'
        };
        await document.save();
        return [];
      }

      // Persist real extracted fields and grounded evidence citations with true page numbers
      const savedFields = await this._saveCandidateFields(document, allCandidates, 'LOCAL_TESSERACT_PDF_OCR');

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
   * Flags all conflicting candidates with needsCorrection: true and records metadata.
   *
   * @private
   * @param {Array<Object>} candidates
   * @param {Object} document
   */
  _detectMultiPageConflicts(candidates, document) {
    const byType = new Map();
    for (const c of candidates) {
      if (!byType.has(c.fieldType)) {
        byType.set(c.fieldType, []);
      }
      byType.get(c.fieldType).push(c);
    }

    let hasConflict = false;
    for (const [fieldType, typeCandidates] of byType.entries()) {
      const pageValues = new Map();
      for (const c of typeCandidates) {
        const val = (c.normalizedValue !== undefined && c.normalizedValue !== '' ? c.normalizedValue : c.rawValue || '').trim().toLowerCase();
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
            // Mark all candidates of this field type as needing correction
            for (const c of typeCandidates) {
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
      const field = new ExtractedField({
        caseId,
        documentId,
        fieldType: c.fieldType,
        rawValue: c.rawValue,
        normalizedValue: c.normalizedValue !== undefined ? c.normalizedValue : c.rawValue,
        pageNumber: c.pageNumber || 1,
        boundingBox: c.boundingBox || [0, 0, 0, 0],
        extractionMethod: c.extractionMethod || extractionMethod || 'LOCAL_TESSERACT_IMAGE_OCR',
        extractionConfidence: typeof c.extractionConfidence === 'number' ? c.extractionConfidence : 0.9,
        needsCorrection: c.needsCorrection !== undefined ? c.needsCorrection : (typeof c.extractionConfidence === 'number' && c.extractionConfidence < 0.75),
        resolution: c.resolution || null
      });

      const savedField = await field.save();
      savedFields.push(savedField);

      // Create an initial EvidenceItem representing the document citation
      const evidence = new EvidenceItem({
        caseId,
        sourceId: savedField._id,
        documentId,
        claimSupported: `Extracted ${c.fieldType}: "${c.rawValue}" (Local OCR)`,
        evidenceText: `Document page ${c.pageNumber || 1} at bounding box [${(c.boundingBox || [0, 0, 0, 0]).join(
          ', '
        )}] contains "${c.rawValue}" (Method: ${field.extractionMethod}, Confidence: ${Math.round(
          field.extractionConfidence * 100
        )}%)`,
        pageNumber: c.pageNumber || 1,
        boundingBox: c.boundingBox || [0, 0, 0, 0],
        trustTier: 4
      });
      await evidence.save();
    }

    return savedFields;
  }
}

module.exports = new DocumentExtractorService();
