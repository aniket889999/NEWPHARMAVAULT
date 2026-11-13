const TesseractOcrProvider = require('./tesseractOcrProvider');
const { extractMedicineRows } = require('./localMedicineRowExtractor');

/**
 * Local OCR Service
 * Coordinates image OCR recognition and conservative candidate field extraction
 * for printed English prescription, invoice, and claim form documents.
 * No raw document content, OCR text, or patient data is ever sent to external LLMs.
 */
class LocalOcrService {
  constructor() {
    this.provider = new TesseractOcrProvider();
  }

  /**
   * Set custom or mock OCR provider
   * @param {import('./ocrProvider')} provider
   */
  setProvider(provider) {
    this.provider = provider;
  }

  /**
   * Get current OCR provider
   */
  getProvider() {
    return this.provider;
  }

  /**
   * Run OCR on image buffer
   * @param {Buffer} imageBuffer
   * @param {Object} [options]
   */
  async processImage(imageBuffer, options = {}) {
    return this.provider.recognize(imageBuffer, options);
  }

  /**
   * Extract structured medicine rows and document-level fields across one or more OCR pages.
   *
   * @param {Object|Array} ocrInput
   * @param {string} documentType
   * @param {Object} [options]
   */
  extractDocumentRows(ocrInput, documentType, options = {}) {
    const normalizedOptions =
      typeof options === 'number'
        ? { pageNumber: options }
        : options && typeof options === 'object'
        ? options
        : {};
    return extractMedicineRows(ocrInput, {
      ...normalizedOptions,
      documentType
    });
  }

  /**
   * Conservative, rule-based field extraction from OCR lines & words.
   * Delegates to localMedicineRowExtractor so up to 3 medicine rows per document
   * are preserved without resolving brand names to generics inside the extractor.
   *
   * @param {Object} ocrResult - Result from OCR provider
   * @param {string} documentType - 'PRESCRIPTION' | 'PHARMACY_INVOICE' | 'CLAIM_FORM'
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>} Extracted field candidates
   */
  async extractConservativeFields(ocrResult, documentType, options = {}) {
    if (!ocrResult || !Array.isArray(ocrResult.lines) || ocrResult.lines.length === 0) {
      return [];
    }

    const rowExtraction = extractMedicineRows(ocrResult, {
      ...options,
      documentType,
      pageNumber: options.pageNumber || 1,
      extractionMethod: options.extractionMethod || 'LOCAL_TESSERACT_IMAGE_OCR'
    });

    const candidates = rowExtraction.candidates;
    Object.defineProperty(candidates, '_rowExtraction', {
      value: rowExtraction,
      enumerable: false,
      configurable: true
    });
    return candidates;
  }
}

module.exports = new LocalOcrService();
