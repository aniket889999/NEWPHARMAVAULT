const PdfRendererProvider = require('./pdfRendererProvider');

const MAX_PAGE_DIMENSION = 2048;
const MAX_PAGE_PIXELS = 6_000_000;

/**
 * Node PDF Renderer Provider
 *
 * Implements local, server-side PDF page rendering into PNG buffers using
 * project-managed 'pdf-to-img' (pdfjs-dist under Node).
 *
 * Boundaries:
 * - Runs 100% locally on the backend Node runtime.
 * - Disables PDF JavaScript (isEvalSupported: false), links, and external resource loading.
 * - Never transmits PDF bytes, page images, or metadata to external APIs.
 * - Validates PDF page dimensions and pixel limits BEFORE canvas allocation.
 * - Sanitizes errors to prevent leaking server paths, storage keys, or document content.
 */
class NodePdfRendererProvider extends PdfRendererProvider {
  constructor(config = {}) {
    super();
    this.scale = config.scale || 1.5;
    this.activeTasks = new Set();
  }

  /**
   * Helper to load pdf-to-img dynamically in CommonJS
   * @private
   */
  async _getPdfConverter() {
    const { pdf } = await import('pdf-to-img');
    return pdf;
  }

  /**
   * Helper to load pdfjs-dist dynamically in CommonJS
   * @private
   */
  async _getPdfJs() {
    return await import('pdfjs-dist/legacy/build/pdf.mjs');
  }

  /**
   * Determine total page count of PDF document
   * @param {Buffer} pdfBuffer
   * @returns {Promise<number>}
   */
  async getPageCount(pdfBuffer) {
    let doc = null;
    try {
      const pdfConverter = await this._getPdfConverter();
      doc = await pdfConverter(pdfBuffer, {
        scale: 1,
        docInitParams: {
          isEvalSupported: false,
          disableRange: true,
          stopAtErrors: true
        }
      });
      const count = doc.length;
      return count;
    } catch (err) {
      this._handlePdfError(err);
    } finally {
      if (doc && typeof doc.destroy === 'function') {
        try {
          await doc.destroy();
        } catch (_) {}
      }
    }
  }

  /**
   * Inspect page dimensions (width, height in pixels) BEFORE canvas allocation
   * @param {Buffer} pdfBuffer
   * @param {number} pageNumber - 1-indexed
   * @param {Object} [options]
   * @returns {Promise<{width: number, height: number}>}
   */
  async getPageDimensions(pdfBuffer, pageNumber, options = {}) {
    let loadingTask = null;
    try {
      const pdfjs = await this._getPdfJs();
      const scale = options.scale || this.scale;

      loadingTask = pdfjs.getDocument({
        data: new Uint8Array(pdfBuffer),
        isEvalSupported: false,
        disableRange: true,
        stopAtErrors: true,
        ...(options.docInitParams || {})
      });
      this.activeTasks.add(loadingTask);

      const pdfDoc = await loadingTask.promise;
      if (pageNumber < 1 || pageNumber > pdfDoc.numPages) {
        const err = new Error('Document page not found.');
        err.statusCode = 404;
        throw err;
      }

      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const width = Math.round(viewport.width);
      const height = Math.round(viewport.height);

      return { width, height };
    } catch (err) {
      this._handlePdfError(err);
    } finally {
      if (loadingTask) {
        this.activeTasks.delete(loadingTask);
        try {
          await loadingTask.destroy();
        } catch (_) {}
      }
    }
  }

  /**
   * Render a single 1-indexed page into a PNG Buffer
   * Validates dimensions BEFORE canvas allocation.
   *
   * @param {Buffer} pdfBuffer
   * @param {number} pageNumber - 1-indexed
   * @param {Object} [options]
   * @returns {Promise<Buffer>}
   */
  async renderPage(pdfBuffer, pageNumber, options = {}) {
    // 1. Validate page dimensions BEFORE canvas allocation
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

    let doc = null;
    try {
      const pdfConverter = await this._getPdfConverter();
      const scale = options.scale || this.scale;

      doc = await pdfConverter(pdfBuffer, {
        scale,
        docInitParams: {
          isEvalSupported: false,
          disableRange: true,
          stopAtErrors: true,
          ...(options.docInitParams || {})
        }
      });
      this.activeTasks.add(doc);

      if (pageNumber < 1 || pageNumber > doc.length) {
        const err = new Error('Document page not found.');
        err.statusCode = 404;
        throw err;
      }

      // 2. Allocate canvas and render page
      const pageBuffer = await doc.getPage(pageNumber);
      return pageBuffer;
    } catch (err) {
      this._handlePdfError(err);
    } finally {
      if (doc) {
        this.activeTasks.delete(doc);
        if (typeof doc.destroy === 'function') {
          try {
            await doc.destroy();
          } catch (_) {}
        }
      }
    }
  }

  /**
   * Cancel/terminate any ongoing PDF rendering operations
   */
  async cancel() {
    for (const task of this.activeTasks) {
      try {
        if (typeof task.destroy === 'function') {
          await task.destroy();
        }
      } catch (_) {}
    }
    this.activeTasks.clear();
  }

  /**
   * Controlled error handler to guarantee zero exposure of storage keys, paths, or internals
   * @private
   */
  _handlePdfError(err) {
    if (err.statusCode) {
      throw err;
    }

    const errName = err.name || '';
    const errMsg = (err.message || '').toLowerCase();

    // Password / encryption detection
    if (
      errName === 'PasswordException' ||
      errMsg.includes('password') ||
      errMsg.includes('encrypt')
    ) {
      const controlled = new Error('Password-protected PDF documents are not supported.');
      controlled.statusCode = 422;
      throw controlled;
    }

    // Malformed / corrupted PDF structure
    if (
      errName === 'InvalidPDFException' ||
      errMsg.includes('invalid pdf') ||
      errMsg.includes('corrupted') ||
      errMsg.includes('bad xref') ||
      errMsg.includes('trailer') ||
      errMsg.includes('startxref')
    ) {
      const controlled = new Error('Malformed or corrupted PDF document.');
      controlled.statusCode = 422;
      throw controlled;
    }

    // General controlled rendering failure
    const controlled = new Error('Failed to render PDF document.');
    controlled.statusCode = 422;
    throw controlled;
  }
}

module.exports = NodePdfRendererProvider;
