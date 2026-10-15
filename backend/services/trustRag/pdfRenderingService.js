const fs = require('fs');
const path = require('path');
const NodePdfRendererProvider = require('./nodePdfRendererProvider');
const { getDocumentStorageRoot, ensureDocumentStorageRoot } = require('../../config/documentStorage');

const MAX_PAGES = 3;
const MAX_PAGE_DIMENSION = 2048;
const MAX_PAGE_PIXELS = 6_000_000;

/**
 * TrustRAG PDF Rendering Service
 *
 * Dedicated local rendering engine converting validated PDF documents into
 * sequential PNG page images for local OCR and secure reviewer inspection.
 *
 * Academic & Safety Constraints:
 * - 100% server-side local execution without external APIs or outbound web requests.
 * - Maximum 3 pages per document in MVP; documents above this limit remain incomplete.
 * - Safe image limits: max 2048 px on longest side, max 6,000,000 px per page.
 * - Dimensions validated BEFORE canvas allocation.
 * - Bounded rendering time with active cancellation / termination on timeout.
 * - Global concurrency limiter with bounded queue length.
 * - Bounded memory & disk preview cache with LRU eviction without deleting original documents.
 * - Controlled errors without leaking internal storage keys, paths, or file contents.
 */
class PdfRenderingService {
  constructor(provider = null, options = {}) {
    this.provider = provider || new NodePdfRendererProvider();
    if (options.storageRoot) {
      this._customStorageRoot = options.storageRoot;
    }
    
    // Concurrency & queue bounds
    this.maxConcurrency = options.maxConcurrency || parseInt(process.env.PDF_MAX_CONCURRENCY, 10) || 2;
    this.maxQueueLength = options.maxQueueLength || parseInt(process.env.PDF_MAX_QUEUE_LENGTH, 10) || 10;
    this.timeoutMs = options.timeoutMs || parseInt(process.env.PDF_RENDER_TIMEOUT_MS, 10) || 15000;
    this.activeWorkers = 0;
    this.renderQueue = [];

    // Memory cache bounds (LRU)
    this.maxCachePages = options.maxCachePages || parseInt(process.env.PDF_CACHE_MAX_PAGES, 10) || 50;
    this.maxCacheBytes = options.maxCacheBytes || parseInt(process.env.PDF_CACHE_MAX_BYTES, 10) || (20 * 1024 * 1024);
    this._memoryPreviewCache = new Map();
    this._currentCacheBytes = 0;

    // Disk cache bounds
    this.maxDiskPreviews = options.maxDiskPreviews || parseInt(process.env.PDF_DISK_CACHE_MAX_FILES, 10) || 200;
    this._trackedDiskPreviews = []; // array of { filePath, timestamp }
  }

  get storageRoot() {
    return this._customStorageRoot || getDocumentStorageRoot();
  }

  set storageRoot(val) {
    this._customStorageRoot = val;
  }

  /**
   * Set custom or mock renderer provider
   * @param {import('./pdfRendererProvider')} provider
   */
  setProvider(provider) {
    this.provider = provider;
  }

  /**
   * Get active renderer provider
   */
  getProvider() {
    return this.provider;
  }

  /**
   * Reset caches and queues (useful for isolated tests)
   */
  resetCache() {
    this._memoryPreviewCache.clear();
    this._currentCacheBytes = 0;
    this.renderQueue = [];
    this.activeWorkers = 0;
    this._trackedDiskPreviews = [];
  }

  /**
   * Verify buffer begins with standard PDF magic bytes (%PDF-)
   * @param {Buffer} buffer
   */
  validatePdfMagicBytes(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 5) {
      const err = new Error('Malformed or corrupted PDF document.');
      err.statusCode = 422;
      throw err;
    }
    const header = buffer.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      const err = new Error('Invalid document format: expected PDF.');
      err.statusCode = 422;
      throw err;
    }
  }

  /**
   * Validate dimensions before or after rendering against safe bounds
   * @param {{width: number, height: number} | Buffer} input
   * @returns {{width: number, height: number}}
   */
  validateDimensions(input) {
    let width, height;

    if (Buffer.isBuffer(input)) {
      if (input.length < 24) {
        const err = new Error('Invalid rendered image output.');
        err.statusCode = 422;
        throw err;
      }

      // Verify PNG signature (89 50 4E 47 0D 0A 1A 0A)
      if (
        input.readUInt32BE(0) !== 0x89504e47 ||
        input.readUInt32BE(4) !== 0x0d0a1a0a
      ) {
        const err = new Error('Rendered image is not a valid PNG.');
        err.statusCode = 422;
        throw err;
      }

      width = input.readUInt32BE(16);
      height = input.readUInt32BE(20);
    } else if (input && typeof input.width === 'number' && typeof input.height === 'number') {
      width = input.width;
      height = input.height;
    } else {
      const err = new Error('Invalid image dimension parameters.');
      err.statusCode = 422;
      throw err;
    }

    if (
      width > MAX_PAGE_DIMENSION ||
      height > MAX_PAGE_DIMENSION ||
      (width * height) > MAX_PAGE_PIXELS
    ) {
      const err = new Error('Rendered PDF page exceeds safe dimensions.');
      err.statusCode = 422;
      throw err;
    }

    return { width, height };
  }

  /**
   * Enqueue a render operation through the bounded concurrency and queue limiter.
   * If queue limit is exceeded, rejects immediately with 503.
   * Bounded execution time will actively cancel/terminate work on timeout.
   *
   * @private
   * @param {Function} taskFn - Async function performing rendering
   * @param {Object} [options]
   * @returns {Promise<any>}
   */
  async _enqueueRender(taskFn, options = {}) {
    const timeoutMs = options.timeoutMs || this.timeoutMs;

    // Check queue limit if all workers are busy
    if (this.activeWorkers >= this.maxConcurrency) {
      if (this.renderQueue.length >= this.maxQueueLength) {
        const err = new Error('PDF rendering queue limit exceeded. Server is busy.');
        err.statusCode = 503;
        throw err;
      }
    }

    return new Promise((resolve, reject) => {
      this.renderQueue.push({
        taskFn,
        timeoutMs,
        resolve,
        reject
      });
      this._processNextInQueue();
    });
  }

  /**
   * Process next item in the render queue
   * @private
   */
  async _processNextInQueue() {
    if (this.activeWorkers >= this.maxConcurrency || this.renderQueue.length === 0) {
      return;
    }

    this.activeWorkers++;
    const { taskFn, timeoutMs, resolve, reject } = this.renderQueue.shift();

    let timer = null;
    let isSettled = false;

    const timeoutPromise = new Promise((_, timeoutReject) => {
      timer = setTimeout(async () => {
        if (isSettled) return;
        isSettled = true;

        // Active cancellation: terminate the work, not leave it consuming resources
        try {
          if (typeof this.provider.cancel === 'function') {
            await this.provider.cancel();
          }
        } catch (_) {}

        const err = new Error(`PDF rendering operation timed out after ${timeoutMs}ms.`);
        err.statusCode = 504;
        err.code = 'PDF_RENDER_TIMEOUT';
        timeoutReject(err);
      }, timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
    });

    try {
      const result = await Promise.race([taskFn(), timeoutPromise]);
      isSettled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    } catch (err) {
      isSettled = true;
      if (timer) clearTimeout(timer);
      reject(this._sanitizeError(err));
    } finally {
      this.activeWorkers--;
      setImmediate(() => this._processNextInQueue());
    }
  }

  /**
   * Render document pages sequentially up to MAX_PAGES (3)
   *
   * @param {string} caseId
   * @param {string} documentId
   * @param {Buffer} pdfBuffer
   * @param {Object} [options]
   * @returns {Promise<{pageCount: number, pagesRendered: number, pages: Array<{pageNumber: number, buffer: Buffer, width: number, height: number}>}>}
   */
  async renderDocumentPages(caseId, documentId, pdfBuffer, options = {}) {
    this.validatePdfMagicBytes(pdfBuffer);

    return this._enqueueRender(async () => {
      const totalPages = await this.provider.getPageCount(pdfBuffer);
      const pagesToRender = Math.min(totalPages, MAX_PAGES);
      const renderedPages = [];

      // Strictly sequential page rendering (never Promise.all to prevent resource exhaustion)
      for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
        // 1. Validate page dimensions BEFORE canvas allocation if provider supports inspection
        if (typeof this.provider.getPageDimensions === 'function') {
          const dims = await this.provider.getPageDimensions(pdfBuffer, pageNum, options);
          this.validateDimensions(dims);
        }

        // 2. Render page buffer
        const pageBuffer = await this.provider.renderPage(pdfBuffer, pageNum, options);
        const { width, height } = this.validateDimensions(pageBuffer);

        renderedPages.push({
          pageNumber: pageNum,
          buffer: pageBuffer,
          width,
          height
        });

        // 3. Persist preview on disk & bounded cache
        await this.storePagePreview(caseId, documentId, pageNum, pageBuffer);
      }

      return {
        pageCount: totalPages,
        pagesRendered: renderedPages.length,
        pages: renderedPages
      };
    }, options);
  }

  /**
   * Persist rendered page preview PNG to sandboxed disk storage and memory cache
   * Respects memory cache byte limits and LRU eviction.
   *
   * @param {string} caseId
   * @param {string} documentId
   * @param {number} pageNumber
   * @param {Buffer} pngBuffer
   */
  async storePagePreview(caseId, documentId, pageNumber, pngBuffer) {
    const cacheKey = `${String(caseId)}:${String(documentId)}:${pageNumber}`;
    this._setMemoryCache(cacheKey, pngBuffer);

    try {
      this.storageRoot = getDocumentStorageRoot();
      ensureDocumentStorageRoot(this.storageRoot);

      const previewDir = path.join(this.storageRoot, String(caseId), 'previews', String(documentId));
      if (!fs.existsSync(previewDir)) {
        fs.mkdirSync(previewDir, { recursive: true, mode: 0o700 });
      }
      const previewFile = path.join(previewDir, `page_${pageNumber}.png`);
      fs.writeFileSync(previewFile, pngBuffer, { mode: 0o600 });

      // Track disk preview for bounded eviction
      this._trackDiskPreview(previewFile);
    } catch (_) {
      // Safe fallback: in-memory cache remains active if filesystem is restricted
    }
  }

  /**
   * Get preview buffer for a given page, checking memory cache, disk storage,
   * or rendering on demand via supplier.
   *
   * @param {string} caseId
   * @param {string} documentId
   * @param {number} pageNumber
   * @param {Function} [pdfBufferSupplier] - Async function returning PDF buffer if not yet cached
   * @param {Object} [options]
   * @returns {Promise<Buffer>}
   */
  async getPagePreview(caseId, documentId, pageNumber, pdfBufferSupplier = null, options = {}) {
    if (pageNumber < 1 || pageNumber > MAX_PAGES) {
      const err = new Error('Document page not found.');
      err.statusCode = 404;
      throw err;
    }

    const cacheKey = `${String(caseId)}:${String(documentId)}:${pageNumber}`;

    // 1. Check memory cache (LRU hit)
    const cached = this._getMemoryCache(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Check disk preview cache
    try {
      this.storageRoot = getDocumentStorageRoot();
      const previewFile = path.join(
        this.storageRoot,
        String(caseId),
        'previews',
        String(documentId),
        `page_${pageNumber}.png`
      );

      if (fs.existsSync(previewFile)) {
        const buf = fs.readFileSync(previewFile);
        this._setMemoryCache(cacheKey, buf);
        return buf;
      }
    } catch (_) {}

    // 3. Render on demand if supplier is available (routed through bounded queue)
    if (typeof pdfBufferSupplier === 'function') {
      return this._enqueueRender(async () => {
        const pdfBuffer = await pdfBufferSupplier();
        if (!pdfBuffer) {
          const err = new Error('Document page not found.');
          err.statusCode = 404;
          throw err;
        }

        this.validatePdfMagicBytes(pdfBuffer);

        // Pre-allocation dimension inspection
        if (typeof this.provider.getPageDimensions === 'function') {
          const dims = await this.provider.getPageDimensions(pdfBuffer, pageNumber, options);
          this.validateDimensions(dims);
        }

        const pageBuffer = await this.provider.renderPage(pdfBuffer, pageNumber, options);
        this.validateDimensions(pageBuffer);

        await this.storePagePreview(caseId, documentId, pageNumber, pageBuffer);
        return pageBuffer;
      }, options);
    }

    const err = new Error('Document page not found.');
    err.statusCode = 404;
    throw err;
  }

  /**
   * Retrieve from memory cache and update lastAccessed
   * @private
   */
  _getMemoryCache(key) {
    const entry = this._memoryPreviewCache.get(key);
    if (!entry) return null;
    entry.lastAccessed = Date.now();
    return entry.buffer;
  }

  /**
   * Set item in memory cache with strict page count and byte limit LRU eviction
   * @private
   */
  _setMemoryCache(key, buffer) {
    if (!Buffer.isBuffer(buffer)) return;

    if (this._memoryPreviewCache.has(key)) {
      const existing = this._memoryPreviewCache.get(key);
      this._currentCacheBytes -= existing.buffer.length;
    }

    this._memoryPreviewCache.set(key, {
      buffer,
      lastAccessed: Date.now()
    });
    this._currentCacheBytes += buffer.length;

    // Evict oldest until under limits
    while (
      this._memoryPreviewCache.size > this.maxCachePages ||
      this._currentCacheBytes > this.maxCacheBytes
    ) {
      let oldestKey = null;
      let oldestTime = Infinity;

      for (const [k, v] of this._memoryPreviewCache.entries()) {
        if (v.lastAccessed < oldestTime) {
          oldestTime = v.lastAccessed;
          oldestKey = k;
        }
      }

      if (!oldestKey) break;
      const evicted = this._memoryPreviewCache.get(oldestKey);
      this._currentCacheBytes -= evicted.buffer.length;
      this._memoryPreviewCache.delete(oldestKey);
    }
  }

  /**
   * Track disk preview files and evict older previews when exceeding maxDiskPreviews.
   * STRICT SAFETY: ONLY files in `previews/` directories are ever evicted.
   * Original documents are NEVER touched or deleted.
   *
   * @private
   */
  _trackDiskPreview(filePath) {
    this._trackedDiskPreviews.push({ filePath, timestamp: Date.now() });

    // Evict oldest preview files if threshold exceeded
    if (this._trackedDiskPreviews.length > this.maxDiskPreviews) {
      const oldest = this._trackedDiskPreviews.shift();
      if (oldest && oldest.filePath) {
        // Enforce safety: must explicitly contain '/previews/'
        if (oldest.filePath.includes(`${path.sep}previews${path.sep}`)) {
          try {
            if (fs.existsSync(oldest.filePath)) {
              fs.unlinkSync(oldest.filePath);
            }
          } catch (_) {}
        }
      }
    }
  }

  /**
   * Controlled error handler to guarantee zero leakage of internal storage paths or keys
   * @private
   */
  _sanitizeError(err) {
    if (err.statusCode && !err.message.includes(this.storageRoot)) {
      return err;
    }

    const controlled = new Error(
      err.code === 'PDF_RENDER_TIMEOUT'
        ? err.message
        : err.message.replace(new RegExp(this.storageRoot.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '[storage]')
    );
    controlled.statusCode = err.statusCode || 422;
    controlled.code = err.code;
    return controlled;
  }
}

module.exports = new PdfRenderingService();
