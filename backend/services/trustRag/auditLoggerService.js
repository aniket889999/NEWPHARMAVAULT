const AuditEvent = require('../../models/auditEventModel');

/**
 * Audit Logger Service
 * Appends immutable audit records without leaking patient PHI or secrets.
 */
class AuditLoggerService {
  /**
   * Log an audit event
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} [params.caseId]
   * @param {string|mongoose.Types.ObjectId} params.actorId
   * @param {string} params.actorRole
   * @param {string} params.action
   * @param {string} params.targetType
   * @param {string} params.targetId
   * @param {Object} [params.metadata]
   */
  async logEvent({ caseId, actorId, actorRole, action, targetType, targetId, metadata = {} }) {
    try {
      // Redact sensitive patterns from metadata
      const sanitizedMeta = this._sanitizeMetadata(metadata);

      const event = new AuditEvent({
        caseId: caseId || null,
        actorId,
        actorRole: actorRole || 'system',
        action,
        targetType,
        targetId: String(targetId),
        metadata: sanitizedMeta,
        createdAt: new Date()
      });

      return await event.save();
    } catch (err) {
      // In production or test, log to stderr without breaking caller if non-critical
      console.error('[TrustRAG Audit] Failed to record audit event:', err.message);
      throw err;
    }
  }

  _sanitizeMetadata(meta) {
    if (!meta || typeof meta !== 'object') return {};
    const sanitized = {};
    for (const [key, value] of Object.entries(meta)) {
      if (/password|token|secret|key|authorization/i.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.startsWith('data:image')) {
        sanitized[key] = '[BASE64_IMAGE_DATA_REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this._sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}

module.exports = new AuditLoggerService();
