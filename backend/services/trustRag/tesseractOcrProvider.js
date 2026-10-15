const path = require('path');
const fs = require('fs');
const Tesseract = require('tesseract.js');
const OcrProvider = require('./ocrProvider');

/**
 * Mutex for one-document-at-a-time OCR processing.
 * Prevents multiple heavy Tesseract native workers from starving server resources.
 */
class OcrMutex {
  constructor() {
    this._queue = [];
    this._locked = false;
  }

  async acquire() {
    if (!this._locked) {
      this._locked = true;
      return () => this.release();
    }
    return new Promise((resolve) => {
      this._queue.push(() => {
        this._locked = true;
        resolve(() => this.release());
      });
    });
  }

  release() {
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      next();
    } else {
      this._locked = false;
    }
  }

  isLocked() {
    return this._locked;
  }
}

/**
 * Inspect image headers to determine binary pixel dimensions.
 */
function getImageDimensions(buffer) {
  try {
    // PNG
    if (
      buffer.length >= 24 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47
    ) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    // JPEG
    if (buffer.length >= 4 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xFF) break;
        const marker = buffer[offset + 1];
        if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        const len = buffer.readUInt16BE(offset + 2);
        offset += 2 + len;
      }
    }
    // WEBP
    if (buffer.length >= 30 && buffer.subarray(0, 4).toString('ascii') === 'RIFF') {
      if (buffer.subarray(12, 16).toString('ascii') === 'VP8 ') {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      }
      if (buffer.subarray(12, 16).toString('ascii') === 'VP8L') {
        const b1 = buffer[21], b2 = buffer[22], b3 = buffer[23], b4 = buffer[24];
        const width = 1 + (((b2 & 0x3f) << 8) | b1);
        const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
        return { width, height };
      }
    }
  } catch (e) {
    // Fallback if metadata parse fails
  }
  return null;
}

function normalizeBbox(bbox, width, height) {
  if (!bbox || !width || !height || width <= 0 || height <= 0) {
    return [0, 0, 0, 0];
  }
  const x_min = Math.max(0, Math.min(1, Math.round((bbox.x0 / width) * 1000) / 1000));
  const y_min = Math.max(0, Math.min(1, Math.round((bbox.y0 / height) * 1000) / 1000));
  const x_max = Math.max(0, Math.min(1, Math.round((bbox.x1 / width) * 1000) / 1000));
  const y_max = Math.max(0, Math.min(1, Math.round((bbox.y1 / height) * 1000) / 1000));
  return [x_min, y_min, x_max, y_max];
}

/**
 * Local Tesseract OCR Provider
 * Executes English image OCR with worker lifecycle management, timeout,
 * mutex locking through termination, and coordinate normalization.
 */
class TesseractOcrProvider extends OcrProvider {
  constructor() {
    super();
    this.mutex = new OcrMutex();
    this.defaultTimeoutMs = parseInt(process.env.TRUSTRAG_OCR_TIMEOUT_MS, 10) || 15000;
    this.defaultLang = process.env.TRUSTRAG_OCR_LANG || 'eng';
  }

  getTessdataPath() {
    return process.env.TRUSTRAG_TESSDATA_PATH || path.resolve(__dirname, '../../tessdata');
  }

  validateLocalLanguageData(lang) {
    const tessdataPath = this.getTessdataPath();

    // Reject remote URLs completely
    if (/^https?:\/\//i.test(tessdataPath)) {
      const err = new Error(
        `Remote language-data URLs are prohibited ('${tessdataPath}'). TRUSTRAG_TESSDATA_PATH must be a local filesystem directory.`
      );
      err.statusCode = 400;
      err.code = 'OCR_REMOTE_URL_PROHIBITED';
      throw err;
    }

    const langFile = path.join(tessdataPath, `${lang}.traineddata`);
    const langFileGz = path.join(tessdataPath, `${lang}.traineddata.gz`);
    const exists = fs.existsSync(langFile) || fs.existsSync(langFileGz);

    if (!exists) {
      const err = new Error(
        `Local OCR language data for '${lang}' is unavailable at '${tessdataPath}'. Language data must be provisioned locally.`
      );
      err.statusCode = 503;
      err.code = 'OCR_LANGUAGE_DATA_UNAVAILABLE';
      throw err;
    }

    return {
      tessdataPath,
      isGzip: !fs.existsSync(langFile) && fs.existsSync(langFileGz)
    };
  }

  /**
   * Run OCR on an image buffer with timeout, worker termination, and single-concurrency lock.
   *
   * @param {Buffer} imageBuffer
   * @param {Object} [options]
   * @returns {Promise<{rawText: string, confidence: number, lines: Array, words: Array, imageDimensions: Object}>}
   */
  async recognize(imageBuffer, options = {}) {
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      const err = new Error('Invalid image buffer provided for OCR recognition');
      err.statusCode = 400;
      throw err;
    }

    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    const lang = options.language || this.defaultLang;

    // Acquire single-document processing mutex
    const releaseMutex = await this.mutex.acquire();
    const startTime = Date.now();
    let worker = null;
    let timeoutTimer = null;

    try {
      const { tessdataPath, isGzip } = this.validateLocalLanguageData(lang);

      // Create dedicated Tesseract worker pinned strictly to local filesystem language data
      worker = await Tesseract.createWorker(lang, 1, {
        langPath: tessdataPath,
        cachePath: tessdataPath,
        gzip: isGzip,
        errorHandler: () => {},
        logger: () => {}
      });

      const timeoutPromise = new Promise((_, reject) => {
        timeoutTimer = setTimeout(() => {
          const timeoutErr = new Error(`OCR processing timed out after ${timeoutMs}ms`);
          timeoutErr.statusCode = 504;
          timeoutErr.code = 'OCR_TIMEOUT';
          reject(timeoutErr);
        }, timeoutMs);
        if (typeof timeoutTimer.unref === 'function') timeoutTimer.unref();
      });

      const recognitionPromise = worker.recognize(imageBuffer, {}, { text: true, blocks: true });
      const result = await Promise.race([recognitionPromise, timeoutPromise]);
      if (timeoutTimer) clearTimeout(timeoutTimer);

      const durationMs = Date.now() - startTime;

      // Extract image dimensions
      let dimensions = getImageDimensions(imageBuffer);

      const rawText = (result.data.text || '').trim();
      const rawConfidence = typeof result.data.confidence === 'number' ? result.data.confidence : 0;
      const normalizedConfidence = Math.max(0, Math.min(1, Math.round((rawConfidence / 100) * 100) / 100));

      const lines = [];
      const words = [];

      let max_x1 = 0;
      let max_y1 = 0;

      // Collect lines & words from hierarchical blocks
      if (Array.isArray(result.data.blocks)) {
        for (const block of result.data.blocks) {
          if (block.bbox) {
            max_x1 = Math.max(max_x1, block.bbox.x1);
            max_y1 = Math.max(max_y1, block.bbox.y1);
          }
          for (const para of block.paragraphs || []) {
            for (const line of para.lines || []) {
              if (line.bbox) {
                max_x1 = Math.max(max_x1, line.bbox.x1);
                max_y1 = Math.max(max_y1, line.bbox.y1);
              }
              const lineConf = typeof line.confidence === 'number' ? line.confidence / 100 : normalizedConfidence;
              lines.push({
                text: (line.text || '').trim(),
                confidence: Math.max(0, Math.min(1, Math.round(lineConf * 100) / 100)),
                rawBbox: line.bbox
              });

              for (const word of line.words || []) {
                const wordConf = typeof word.confidence === 'number' ? word.confidence / 100 : lineConf;
                words.push({
                  text: (word.text || '').trim(),
                  confidence: Math.max(0, Math.min(1, Math.round(wordConf * 100) / 100)),
                  rawBbox: word.bbox
                });
              }
            }
          }
        }
      }

      // If dimensions were not detected from file header, use max OCR coordinate bounds
      if (!dimensions || dimensions.width === 0 || dimensions.height === 0) {
        dimensions = {
          width: Math.max(1, max_x1),
          height: Math.max(1, max_y1)
        };
      }

      // Normalize bounding boxes to 0..1 format
      const normalizedLines = lines.map(l => ({
        text: l.text,
        confidence: l.confidence,
        bbox: normalizeBbox(l.rawBbox, dimensions.width, dimensions.height)
      }));

      const normalizedWords = words.map(w => ({
        text: w.text,
        confidence: w.confidence,
        bbox: normalizeBbox(w.rawBbox, dimensions.width, dimensions.height)
      }));

      // Controlled sanitized operational logging: NEVER log raw OCR text, image buffers, or PHI
      if (process.env.NODE_ENV !== 'test') {
        console.log(
          `[TesseractOcrProvider] Recognition completed in ${durationMs}ms (confidence: ${Math.round(
            normalizedConfidence * 100
          )}%, lines: ${normalizedLines.length})`
        );
      }

      return {
        rawText,
        confidence: normalizedConfidence,
        lines: normalizedLines,
        words: normalizedWords,
        imageDimensions: dimensions
      };
    } catch (err) {
      if (!err.statusCode) {
        err.statusCode = 422;
      }
      err.message = err.message.startsWith('Local OCR') || err.message.startsWith('Remote')
        ? err.message
        : `Local OCR processing failed: ${err.message}`;
      throw err;
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (worker) {
        try {
          await worker.terminate();
        } catch (termErr) {
          // Ignored if already terminated
        }
        worker = null;
      }
      // Mutex is strictly released AFTER the worker has terminated
      releaseMutex();
    }
  }
}

module.exports = TesseractOcrProvider;
