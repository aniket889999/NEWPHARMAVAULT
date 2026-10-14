const PdfRendererProvider = require('./pdfRendererProvider');

const MAX_PAGE_DIMENSION = 2048;
const MAX_PAGE_PIXELS = 6_000_000;

/**
 * Creates a valid minimal PNG buffer with specific width and height in the IHDR chunk.
 * @param {number} width
 * @param {number} height
 * @returns {Buffer}
 */
function createMockPngBuffer(width = 300, height = 150) {
  // Minimal 1x1 valid PNG base with adjustable IHDR width and height
  const basePng = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // signature
    0x00, 0x00, 0x00, 0x0D,                         // IHDR length = 13
    0x49, 0x48, 0x44, 0x52,                         // "IHDR"
    0x00, 0x00, 0x01, 0x2C,                         // width (will overwrite)
    0x00, 0x00, 0x00, 0x96,                         // height (will overwrite)
    0x08, 0x06, 0x00, 0x00, 0x00,                   // 8-bit, RGBA, deflate, filter, non-interlaced
    0x1F, 0x15, 0xC4, 0x89,                         // CRC (dummy for testing)
    0x00, 0x00, 0x00, 0x0A,                         // IDAT length
    0x49, 0x44, 0x41, 0x54,                         // "IDAT"
    0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
    0x0D, 0x0A, 0x2D, 0xB4,                         // CRC
    0x00, 0x00, 0x00, 0x00,                         // IEND length
    0x49, 0x45, 0x4E, 0x44,                         // "IEND"
    0xAE, 0x42, 0x60, 0x82                          // CRC
  ]);

  const buf = Buffer.from(basePng);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

/**
 * Mock PDF Renderer Provider
 * For isolated, reproducible unit testing of PDF rendering, sequential execution,
 * page limits, pre-allocation dimension limits, timeout/cancellation, and controlled error handling.
 */
class MockPdfRendererProvider extends PdfRendererProvider {
  constructor(options = {}) {
    super();
    this.pageCount = options.pageCount !== undefined ? options.pageCount : 1;
    this.pages = options.pages || {};
    this.pageDimensions = options.pageDimensions || {};
    this.simulatePasswordProtected = options.simulatePasswordProtected || false;
    this.simulateMalformed = options.simulateMalformed || false;
    this.simulateOversized = options.simulateOversized || false;
    this.simulateTimeout = options.simulateTimeout || false;
    this.simulateError = options.simulateError || null;
    this.renderDelayMs = options.renderDelayMs || 0;
    this.renderCalls = [];
    this.wasCancelled = false;
    this.activeWaiters = new Set();
  }

  setPageCount(count) {
    this.pageCount = count;
  }

  setPageBuffer(pageNumber, buffer) {
    this.pages[pageNumber] = buffer;
  }

  setPageDimensions(pageNumber, dims) {
    this.pageDimensions[pageNumber] = dims;
  }

  setSimulatePasswordProtected(value) {
    this.simulatePasswordProtected = value;
  }

  setSimulateMalformed(value) {
    this.simulateMalformed = value;
  }

  setSimulateOversized(value) {
    this.simulateOversized = value;
  }

  setSimulateTimeout(value) {
    this.simulateTimeout = value;
  }

  setSimulateError(err) {
    this.simulateError = err;
  }

  setRenderDelayMs(ms) {
    this.renderDelayMs = ms;
  }

  async getPageCount(pdfBuffer) {
    if (this.simulatePasswordProtected) {
      const err = new Error('Password-protected PDF documents are not supported.');
      err.statusCode = 422;
      throw err;
    }

    if (this.simulateMalformed) {
      const err = new Error('Malformed or corrupted PDF document.');
      err.statusCode = 422;
      throw err;
    }

    if (this.simulateError) {
      throw this.simulateError;
    }

    return this.pageCount;
  }

  /**
   * Inspect page dimensions BEFORE canvas allocation
   */
  async getPageDimensions(pdfBuffer, pageNumber, options = {}) {
    if (this.simulatePasswordProtected) {
      const err = new Error('Password-protected PDF documents are not supported.');
      err.statusCode = 422;
      throw err;
    }

    if (this.simulateMalformed) {
      const err = new Error('Malformed or corrupted PDF document.');
      err.statusCode = 422;
      throw err;
    }

    if (this.simulateError) {
      throw this.simulateError;
    }

    if (pageNumber < 1 || pageNumber > this.pageCount) {
      const err = new Error('Document page not found.');
      err.statusCode = 404;
      throw err;
    }

    if (this.simulateOversized) {
      return { width: 2500, height: 1200 };
    }

    if (this.pageDimensions[pageNumber]) {
      return this.pageDimensions[pageNumber];
    }

    return { width: 800, height: 600 };
  }

  async renderPage(pdfBuffer, pageNumber, options = {}) {
    this.renderCalls.push({ pageNumber, timestamp: Date.now() });

    if (this.simulatePasswordProtected) {
      const err = new Error('Password-protected PDF documents are not supported.');
      err.statusCode = 422;
      throw err;
    }

    if (this.simulateMalformed) {
      const err = new Error('Malformed or corrupted PDF document.');
      err.statusCode = 422;
      throw err;
    }

    if (this.simulateError) {
      throw this.simulateError;
    }

    if (pageNumber < 1 || pageNumber > this.pageCount) {
      const err = new Error('Document page not found.');
      err.statusCode = 404;
      throw err;
    }

    // Dimension check BEFORE canvas allocation
    const dims = await this.getPageDimensions(pdfBuffer, pageNumber, options);
    if (
      dims.width > MAX_PAGE_DIMENSION ||
      dims.height > MAX_PAGE_DIMENSION ||
      (dims.width * dims.height) > MAX_PAGE_PIXELS
    ) {
      const err = new Error('Rendered PDF page exceeds safe dimensions.');
      err.statusCode = 422;
      throw err;
    }

    // Delay or timeout simulation
    if (this.simulateTimeout) {
      await new Promise((resolve, reject) => {
        const waiter = { resolve, reject };
        this.activeWaiters.add(waiter);
      });
    } else if (this.renderDelayMs > 0) {
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          this.activeWaiters.delete(waiter);
          resolve();
        }, this.renderDelayMs);
        const waiter = {
          resolve: () => {
            clearTimeout(timer);
            resolve();
          },
          reject: () => {
            clearTimeout(timer);
            resolve();
          }
        };
        this.activeWaiters.add(waiter);
      });
    }

    if (this.pages[pageNumber]) {
      return this.pages[pageNumber];
    }

    // Default mock page
    return createMockPngBuffer(dims.width, dims.height);
  }

  async cancel() {
    this.wasCancelled = true;
    for (const waiter of this.activeWaiters) {
      try {
        waiter.reject(new Error('Operation cancelled'));
      } catch (_) {}
    }
    this.activeWaiters.clear();
  }
}

module.exports = { MockPdfRendererProvider, createMockPngBuffer };
