class ConfidenceCalibrator {
  calibrate(rawConfidence, hallucinationRisk, riskClass) {
    let calibrated = rawConfidence;
    let reason = "Standard mult-agent consensus.";

    if (hallucinationRisk === 'High') {
      calibrated = Math.min(calibrated, 20);
      reason = "High hallucination risk detected due to unsupported or conflicting claims.";
    } else if (hallucinationRisk === 'Medium') {
      calibrated = Math.min(calibrated, 60);
      reason = "Medium hallucination risk: Partial evidence coverage.";
    }

    const highRiskClasses = ['Emergency Risk', 'Pediatric / Pregnancy Risk', 'Dosage Advice Risk'];
    if (highRiskClasses.includes(riskClass) && calibrated > 50) {
      calibrated = Math.min(calibrated, 75); // Cap confidence for high medical risk queries unless overridden by safety policies
      reason += ` Confidence capped due to sensitive medical risk class: ${riskClass}.`;
    }

    if (riskClass === 'Emergency Risk') {
      calibrated = 100; // Emergency responses (disclaimers) are 100% confident
      reason = "Emergency override.";
    }

    return {
      rawConfidence,
      calibratedConfidence: calibrated,
      calibrationReason: reason.trim()
    };
  }
}

module.exports = new ConfidenceCalibrator();
