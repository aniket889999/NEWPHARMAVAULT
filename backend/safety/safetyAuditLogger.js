const SafetyAudit = require('../models/safetyAuditModel');

class SafetyAuditLogger {
  async log(data) {
    try {
      const logEntry = new SafetyAudit(data);
      await logEntry.save();
    } catch (err) {
      console.error("Failed to log safety audit:", err);
    }
  }

  async getLogs() {
    return await SafetyAudit.find({}).sort('-createdAt').limit(100);
  }

  async getSummary() {
    const total = await SafetyAudit.countDocuments();
    const highRisk = await SafetyAudit.countDocuments({ riskLevel: { $in: ['Emergency Risk', 'Dosage Advice Risk', 'Pediatric / Pregnancy Risk'] } });
    const hallucinations = await SafetyAudit.countDocuments({ hallucinationRisk: 'High' });
    const reviewRequired = await SafetyAudit.countDocuments({ reviewRequired: true });
    
    // Contradictions
    const allLogs = await SafetyAudit.find({}).select('contradictionFlags');
    let contradictions = 0;
    allLogs.forEach(l => {
      if (l.contradictionFlags && l.contradictionFlags.length > 0) contradictions++;
    });

    return {
      total,
      highRisk,
      hallucinations,
      reviewRequired,
      contradictions
    };
  }
}

module.exports = new SafetyAuditLogger();
