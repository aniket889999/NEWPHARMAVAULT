const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getDocumentStorageRoot, ensureDocumentStorageRoot } = require('../../config/documentStorage');

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MiB = 5,242,880 bytes

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp'
];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

/**
 * Storage Service
 * Handles secure document validation and persistence outside of MongoDB per ADR-002.
 * Strictly validates data URIs, base64 syntax, file size (<= 5 MiB), and magic byte signatures.
 */
class StorageService {
  constructor() {
    this.storageRoot = getDocumentStorageRoot();
  }

  /**
   * Validate, decode, verify binary magic bytes, and persist document.
   * Rejects non-data-URIs, raw text, malformed base64, MIME mismatches, and files > 5 MiB.
   *
   * @param {Object} params
   * @param {string} params.caseId
   * @param {string} [params.filename]
   * @param {string} params.content (base64 data URI string)
   * @param {string} [params.mimeType]
   * @returns {Promise<{objectStorageKey: string, sha256: string, sizeBytes: number, detectedMimeType: string, sanitizedFilename: string, localPath: string}>}
   */
  async storeDocument({ caseId, filename = 'document.bin', content, mimeType }) {
    if (!/^[a-f\d]{24}$/i.test(String(caseId))) {
      const error = new Error('Document case reference is invalid.');
      error.statusCode = 400;
      throw error;
    }
    if (content === undefined || content === null) {
      const err = new Error('Document file payload is required and cannot be absent or null.');
      err.statusCode = 400;
      throw err;
    }

    if (typeof content !== 'string') {
      const err = new Error('Invalid document payload format. Expected a base64 data URI string.');
      err.statusCode = 400;
      throw err;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      const err = new Error('Document file payload cannot be empty.');
      err.statusCode = 400;
      throw err;
    }

    // Must be a data URI: data:<mime>;base64,<payload>
    const dataUriRegex = /^data:([a-zA-Z0-9_\-\.\/]+);base64,(.+)$/s;
    const match = trimmed.match(dataUriRegex);
    if (!match) {
      if (trimmed.startsWith('data:')) {
        const err = new Error('Malformed base64 data URI document content.');
        err.statusCode = 400;
        throw err;
      }
      const err = new Error(
        'Raw text payloads are not accepted. Document must be uploaded as a valid base64 data URI (PDF, PNG, JPEG, or WEBP).'
      );
      err.statusCode = 400;
      throw err;
    }

    let claimedMime = match[1].toLowerCase();
    if (claimedMime === 'image/jpg') {
      claimedMime = 'image/jpeg';
    }

    if (!ALLOWED_MIME_TYPES.includes(claimedMime)) {
      const err = new Error(
        `Unsupported document MIME type: '${match[1]}'. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}.`
      );
      err.statusCode = 400;
      throw err;
    }

    const rawBase64 = match[2].trim();
    if (!rawBase64) {
      const err = new Error('Malformed or empty base64 data in document URI.');
      err.statusCode = 400;
      throw err;
    }

    // Validate base64 syntax before decoding:
    // Only standard base64 characters allowed; length must be multiple of 4; at most 2 '=' padding chars at end
    const sanitizedBase64 = rawBase64.replace(/[\r\n\s]/g, '');
    if (
      !sanitizedBase64 ||
      sanitizedBase64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(sanitizedBase64)
    ) {
      const err = new Error('Malformed base64 encoding in document payload.');
      err.statusCode = 400;
      throw err;
    }

    const buffer = Buffer.from(sanitizedBase64, 'base64');
    if (!buffer || buffer.length === 0) {
      const err = new Error('Decoded document content is empty (0 bytes).');
      err.statusCode = 400;
      throw err;
    }

    if (buffer.length > MAX_FILE_BYTES) {
      const err = new Error(
        `Document exceeds maximum allowed size of 5 MB (received ${(buffer.length / (1024 * 1024)).toFixed(2)} MB, limit is 5 MB).`
      );
      err.statusCode = 400;
      throw err;
    }

    // Validate decoded magic bytes against claimed MIME type:
    let detectedMime = null;

    // PDF: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
      detectedMime = 'application/pdf';
    }
    // PNG: standard 8-byte signature 89 50 4E 47 0D 0A 1A 0A
    else if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
      detectedMime = 'image/png';
    }
    // JPEG: begins with FF D8 FF
    else if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      detectedMime = 'image/jpeg';
    }
    // WEBP: RIFF at 0..3 and WEBP at 8..11
    else if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      detectedMime = 'image/webp';
    }

    if (!detectedMime) {
      const err = new Error(
        'Invalid document content: file signature does not match any supported format (PDF, PNG, JPEG, WEBP).'
      );
      err.statusCode = 400;
      throw err;
    }

    if (detectedMime !== claimedMime) {
      const err = new Error(
        `MIME type mismatch: declared '${claimedMime}' but detected '${detectedMime}' from file magic bytes.`
      );
      err.statusCode = 400;
      throw err;
    }

    // Sanitize filename to prevent directory traversal or unsafe characters
    const sanitizedFilename = path
      .basename(filename || `document_${Date.now()}`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100);

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const sizeBytes = buffer.length;
    const storedFilename = `${crypto.randomUUID()}_${sanitizedFilename}`;
    const objectStorageKey = `cases/${caseId}/${storedFilename}`;

    let localPath;
    try {
      ensureDocumentStorageRoot(this.storageRoot);
      const caseDir = path.join(this.storageRoot, String(caseId));
      fs.mkdirSync(caseDir, { recursive: true, mode: 0o700 });
      localPath = path.join(caseDir, storedFilename);
      fs.writeFileSync(localPath, buffer, { mode: 0o600, flag: 'wx' });
    } catch (_) {
      const error = new Error('Document storage is unavailable.');
      error.statusCode = 503;
      throw error;
    }

    return {
      objectStorageKey,
      sha256,
      sizeBytes,
      detectedMimeType: detectedMime,
      sanitizedFilename,
      localPath
    };
  }

  /**
   * Retrieve stored document binary buffer
   * @param {string} caseId
   * @param {string} objectStorageKey
   * @returns {Promise<Buffer>}
   */
  async getDocumentBuffer(caseId, objectStorageKey) {
    if (!/^[a-f\d]{24}$/i.test(String(caseId)) || typeof objectStorageKey !== 'string' || !objectStorageKey) {
      const err = new Error('Document content is unavailable.');
      err.statusCode = 400;
      throw err;
    }

    const filename = path.basename(objectStorageKey);
    const caseDir = path.join(this.storageRoot, String(caseId));
    let targetPath = path.join(caseDir, filename);

    if (!fs.existsSync(targetPath)) {
      // Fallback search within case directory if timestamp prefixed name differs
      if (fs.existsSync(caseDir)) {
        try {
          const files = fs.readdirSync(caseDir);
          const matched = files.find(f => f.endsWith(filename) || filename.endsWith(f));
          if (matched) {
            targetPath = path.join(caseDir, matched);
          }
        } catch (_) {
          // Ignore filesystem traversal error; handled by targetPath existence check below
        }
      }
    }

    if (!fs.existsSync(targetPath)) {
      const err = new Error('Document content is unavailable.');
      err.statusCode = 404;
      throw err;
    }

    try {
      return fs.readFileSync(targetPath);
    } catch (_) {
      const err = new Error('Document content is unavailable.');
      err.statusCode = 404;
      throw err;
    }
  }
}

module.exports = new StorageService();
