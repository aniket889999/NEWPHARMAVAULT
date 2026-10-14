const TesseractOcrProvider = require('./tesseractOcrProvider');
const identityResolutionService = require('./identityResolutionService');

/**
 * Local OCR Service
 * Coordinates image OCR recognition and conservative candidate field extraction.
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
   * Conservative, rule-based field extraction from OCR lines & words.
   * Never invents missing fields or falls back to synthetic templates.
   *
   * @param {Object} ocrResult - Result from OCR provider
   * @param {string} documentType - 'PRESCRIPTION' | 'PHARMACY_INVOICE' | 'CLAIM_FORM'
   * @returns {Promise<Array<Object>>} Extracted field candidates
   */
  async extractConservativeFields(ocrResult, documentType, options = {}) {
    if (!ocrResult || !Array.isArray(ocrResult.lines) || ocrResult.lines.length === 0) {
      return [];
    }

    const targetPageNumber = options.pageNumber || 1;
    const defaultExtractionMethod = options.extractionMethod || 'LOCAL_TESSERACT_IMAGE_OCR';

    const fields = [];
    const lines = ocrResult.lines.filter(l => l.text && l.text.trim().length > 0);

    // Track extracted field types to prevent duplicate candidates
    const extractedTypes = new Set();

    // 1. Medicine Name Candidate Extraction
    // Check lines for known brand/generic medicines or prescription line patterns
    for (const line of lines) {
      if (extractedTypes.has('medicine_name')) break;

      const lineText = line.text;

      // Check known medicine terms from seed & canonical models
      const knownNames = [
        'Crocin', 'Paracetamol', 'Dolo', 'Augmentin', 'Amoxicillin',
        'Glycomet', 'Metformin', 'Okacet', 'Cetirizine', 'Azee',
        'Azithromycin', 'Lipitor', 'Atorvastatin', 'Losartan', 'Omeprazole'
      ];

      let matchedName = null;
      for (const name of knownNames) {
        const regex = new RegExp(`\\b${name}\\b`, 'i');
        if (regex.test(lineText)) {
          matchedName = name;
          break;
        }
      }

      // Check generic prescription line pattern: e.g. "Tab. BrandName 500mg" or "Medicine 10mg"
      if (!matchedName) {
        const drugLineMatch = lineText.match(
          /(?:tab(?:let)?|cap(?:sule)?|syp(?:rup)?|inj)?\.?\s*([A-Za-z0-9\-+ ]{3,25})\s+(?:(\d+(?:\.\d+)?\s*(?:mg|ml|mcg|g|gm|iu)))/i
        );
        if (drugLineMatch && drugLineMatch[1].trim().length >= 3) {
          matchedName = drugLineMatch[1].trim();
        }
      }

      if (matchedName) {
        extractedTypes.add('medicine_name');

        // Attempt identity resolution against canonical database
        const resolution = await identityResolutionService.resolveMedicine(matchedName);
        const isResolved = Boolean(resolution && resolution.resolved && resolution.canonical);
        const isLowConfidence = line.confidence < 0.75 || !isResolved;
        const genericName = isResolved ? resolution.canonical.genericName : (matchedName || lineText);

        fields.push({
          fieldType: 'medicine_name',
          rawValue: lineText,
          normalizedValue: genericName,
          pageNumber: targetPageNumber,
          boundingBox: line.bbox || [0, 0, 0, 0],
          extractionMethod: defaultExtractionMethod,
          extractionConfidence: line.confidence,
          needsCorrection: isLowConfidence,
          resolution: resolution
        });
      }
    }

    // 2. Dosage Strength Extraction
    for (const line of lines) {
      if (extractedTypes.has('dosage_strength')) break;

      const strengthMatch = line.text.match(/\b(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|gm|iu))\b/i);
      if (strengthMatch) {
        extractedTypes.add('dosage_strength');
        const rawStrength = strengthMatch[1];
        const normalizedStrength = rawStrength.replace(/\s+/g, '').toLowerCase();

        fields.push({
          fieldType: 'dosage_strength',
          rawValue: rawStrength,
          normalizedValue: normalizedStrength,
          pageNumber: targetPageNumber,
          boundingBox: line.bbox || [0, 0, 0, 0],
          extractionMethod: defaultExtractionMethod,
          extractionConfidence: line.confidence,
          needsCorrection: line.confidence < 0.75
        });
      }
    }

    // 2b. Dosage Form Extraction
    for (const line of lines) {
      if (extractedTypes.has('dosage_form')) break;

      const formMatch = line.text.match(/\b(tablets?|capsules?|syrups?|suspensions?|injections?|drops?|syp|tab|cap|inj)\b/i);
      if (formMatch) {
        extractedTypes.add('dosage_form');
        const rawForm = formMatch[1];
        let normalizedForm = 'Tablet';
        const lower = rawForm.toLowerCase();
        if (lower.startsWith('tab')) normalizedForm = 'Tablet';
        else if (lower.startsWith('cap')) normalizedForm = 'Capsule';
        else if (lower.startsWith('syp') || lower.includes('syrup')) normalizedForm = 'Syrup';
        else if (lower.includes('susp')) normalizedForm = 'Suspension';
        else if (lower.includes('inj')) normalizedForm = 'Injection';
        else if (lower.includes('drop')) normalizedForm = 'Drops';

        fields.push({
          fieldType: 'dosage_form',
          rawValue: rawForm,
          normalizedValue: normalizedForm,
          pageNumber: targetPageNumber,
          boundingBox: line.bbox || [0, 0, 0, 0],
          extractionMethod: defaultExtractionMethod,
          extractionConfidence: line.confidence,
          needsCorrection: line.confidence < 0.75
        });
      }
    }

    // 3. Quantity Extraction
    for (const line of lines) {
      if (extractedTypes.has('quantity')) break;

      // Matches "Qty: 10", "Quantity: 20", "10 tablets", "10 tabs"
      const qtyMatch =
        line.text.match(/(?:qty|quantity|count|nos|units?)[:\s]*(\d+)\b/i) ||
        line.text.match(/\b(\d+)\s*(?:tabs?|tablets?|caps?|capsules?|bottles?|strips?|units?)\b/i);

      if (qtyMatch) {
        extractedTypes.add('quantity');
        const rawQty = qtyMatch[1];
        const normalizedQty = String(parseInt(rawQty, 10));

        fields.push({
          fieldType: 'quantity',
          rawValue: rawQty,
          normalizedValue: normalizedQty,
          pageNumber: targetPageNumber,
          boundingBox: line.bbox || [0, 0, 0, 0],
          extractionMethod: defaultExtractionMethod,
          extractionConfidence: line.confidence,
          needsCorrection: line.confidence < 0.75
        });
      }
    }

    // 4. Date Extraction (Prescription / Invoice / Claim date)
    const dateFieldType =
      documentType === 'PRESCRIPTION'
        ? 'prescription_date'
        : documentType === 'PHARMACY_INVOICE'
        ? 'invoice_date'
        : 'claim_date';

    for (const line of lines) {
      if (extractedTypes.has(dateFieldType)) break;

      // Matches YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
      const dateMatch =
        line.text.match(/\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\b/) ||
        line.text.match(/\b(\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})\b/);

      if (dateMatch) {
        extractedTypes.add(dateFieldType);
        const rawDate = dateMatch[1];
        let normalizedDate = rawDate;

        // Deterministic ISO normalization if DD/MM/YYYY
        const dmyMatch = rawDate.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})$/);
        if (dmyMatch) {
          const day = dmyMatch[1].padStart(2, '0');
          const month = dmyMatch[2].padStart(2, '0');
          const year = dmyMatch[3];
          normalizedDate = `${year}-${month}-${day}`;
        }

        fields.push({
          fieldType: dateFieldType,
          rawValue: rawDate,
          normalizedValue: normalizedDate,
          pageNumber: targetPageNumber,
          boundingBox: line.bbox || [0, 0, 0, 0],
          extractionMethod: defaultExtractionMethod,
          extractionConfidence: line.confidence,
          needsCorrection: line.confidence < 0.75
        });
      }
    }

    // 5. Amount Extraction (total_amount / claimed_amount)
    if (documentType === 'PHARMACY_INVOICE' || documentType === 'CLAIM_FORM') {
      const amountFieldType = documentType === 'PHARMACY_INVOICE' ? 'total_amount' : 'claimed_amount';

      for (const line of lines) {
        if (extractedTypes.has(amountFieldType)) break;

        // Matches "Total: 150.00", "Amount: Rs. 150", "Claimed: 150"
        const amountMatch =
          line.text.match(/(?:total|net|amount|amt|claimed)[:\s]*(?:rs\.?|inr|\$)?\s*(\d+(?:\.\d{2})?)\b/i) ||
          line.text.match(/(?:rs\.?|inr|\$)\s*(\d+(?:\.\d{2})?)\b/i);

        if (amountMatch) {
          extractedTypes.add(amountFieldType);
          const rawAmount = amountMatch[1];
          const normalizedAmount = parseFloat(rawAmount).toFixed(2);

          fields.push({
            fieldType: amountFieldType,
            rawValue: rawAmount,
            normalizedValue: normalizedAmount,
            pageNumber: targetPageNumber,
            boundingBox: line.bbox || [0, 0, 0, 0],
            extractionMethod: defaultExtractionMethod,
            extractionConfidence: line.confidence,
            needsCorrection: line.confidence < 0.75
          });
        }
      }
    }

    // 6. Party Name Candidates (prescriber_name / pharmacy_name)
    if (documentType === 'PRESCRIPTION') {
      for (const line of lines) {
        if (extractedTypes.has('prescriber_name')) break;

        const docMatch = line.text.match(/(?:dr\.?|doctor)\s+([A-Za-z. ]{3,30})/i);
        if (docMatch) {
          extractedTypes.add('prescriber_name');
          fields.push({
            fieldType: 'prescriber_name',
            rawValue: line.text,
            normalizedValue: docMatch[0].trim(),
            pageNumber: targetPageNumber,
            boundingBox: line.bbox || [0, 0, 0, 0],
            extractionMethod: defaultExtractionMethod,
            extractionConfidence: line.confidence,
            needsCorrection: line.confidence < 0.75
          });
        }
      }
    } else if (documentType === 'PHARMACY_INVOICE') {
      for (const line of lines) {
        if (extractedTypes.has('pharmacy_name')) break;

        if (/pharmacy|chemist|druggist|medical store/i.test(line.text)) {
          extractedTypes.add('pharmacy_name');
          fields.push({
            fieldType: 'pharmacy_name',
            rawValue: line.text,
            normalizedValue: line.text.trim(),
            pageNumber: targetPageNumber,
            boundingBox: line.bbox || [0, 0, 0, 0],
            extractionMethod: defaultExtractionMethod,
            extractionConfidence: line.confidence,
            needsCorrection: line.confidence < 0.75
          });
        }
      }
    }

    return fields;
  }
}

module.exports = new LocalOcrService();
