/**
 * OCR Provider Interface
 * Base contract for local image OCR providers in TrustRAG.
 */
class OcrProvider {
  /**
   * Run OCR on an image buffer and return structured words, lines, and bounding boxes.
   *
   * @param {Buffer} imageBuffer - Valid image buffer (PNG, JPEG, WEBP)
   * @param {Object} [options]
   * @param {string} [options.language='eng'] - OCR recognition language
   * @param {number} [options.timeoutMs] - Execution timeout in milliseconds
   * @returns {Promise<{
   *   rawText: string,
   *   confidence: number,
   *   lines: Array<{ text: string, confidence: number, bbox: number[] }>,
   *   words: Array<{ text: string, confidence: number, bbox: number[] }>,
   *   imageDimensions: { width: number, height: number }
   * }>}
   */
  async recognize(imageBuffer, options = {}) {
    throw new Error('recognize() must be implemented by concrete OCR provider');
  }
}

module.exports = OcrProvider;
