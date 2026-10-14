/**
 * PDF Renderer Provider Base Class
 *
 * Defines the contract for local PDF page rendering providers.
 * All implementations must run locally without outbound network access or external APIs.
 */
class PdfRendererProvider {
  /**
   * Determine total page count of the PDF document
   * @param {Buffer} pdfBuffer - Valid PDF binary buffer
   * @returns {Promise<number>} Total pages in document
   */
  async getPageCount(pdfBuffer) {
    throw new Error('Not implemented: getPageCount()');
  }

  /**
   * Inspect page dimensions (width, height in pixels) BEFORE canvas allocation
   * @param {Buffer} pdfBuffer - Valid PDF binary buffer
   * @param {number} pageNumber - 1-indexed page number
   * @param {Object} [options] - Optional render options (scale, etc.)
   * @returns {Promise<{width: number, height: number}>}
   */
  async getPageDimensions(pdfBuffer, pageNumber, options = {}) {
    throw new Error('Not implemented: getPageDimensions()');
  }

  /**
   * Render a single 1-indexed page of the PDF into a PNG buffer
   * @param {Buffer} pdfBuffer - Valid PDF binary buffer
   * @param {number} pageNumber - 1-indexed page number
   * @param {Object} [options] - Optional render options (scale, etc.)
   * @returns {Promise<Buffer>} Rendered PNG image buffer
   */
  async renderPage(pdfBuffer, pageNumber, options = {}) {
    throw new Error('Not implemented: renderPage()');
  }

  /**
   * Optional cleanup hook
   */
  async destroy() {}
}

module.exports = PdfRendererProvider;
