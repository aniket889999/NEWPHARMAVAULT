class HallucinationDetector {
  detect(consistencyResult, context) {
    if (consistencyResult.conflictingClaims.length > 0) return 'High';
    if (consistencyResult.unsupportedClaims.some(c => c.type === 'dosage' || c.type === 'medicine_use')) return 'High';
    
    if (consistencyResult.evidenceCoverage < 50 && context.entities.length > 0) return 'High';
    if (consistencyResult.evidenceCoverage < 80 && context.entities.length > 0) return 'Medium';
    
    if (context.entities.length > 0 && (!context.graphEvidence || context.graphEvidence.length === 0) && !context.patientIntelligenceEvidence && !context.pharmacyEvidence) {
      return 'High'; // Missing graph for entity
    }

    return 'Low';
  }
}

module.exports = new HallucinationDetector();
