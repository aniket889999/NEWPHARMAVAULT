class SafetyPolicyEngine {
  applyPolicies(answer, riskClass, context) {
    let finalAnswer = answer;
    
    if (riskClass === 'Emergency Risk') {
      finalAnswer = "🚨 MEDICAL EMERGENCY DETECTED. Please stop using this AI assistant and seek immediate medical attention. Dial your local emergency number (112/911) or visit the nearest hospital immediately.";
    } else if (riskClass === 'Dosage Advice Risk') {
      if (!context.prescriptionEvidence) {
        finalAnswer += "\n\n⚠️ Safety Policy: I cannot provide specific dosage instructions without a verified prescription. Please consult your doctor or pharmacist.";
      }
    } else if (riskClass === 'Pediatric / Pregnancy Risk') {
      finalAnswer += "\n\n⚠️ Safety Policy: Medicines affecting children or pregnant women require strict medical supervision. Please do not administer based solely on AI advice.";
    }

    return finalAnswer;
  }
}

module.exports = new SafetyPolicyEngine();
