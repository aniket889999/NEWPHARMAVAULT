class HumanReviewEngine {
  evaluate(hallucinationRisk, riskClass, contradictionFlags, context) {
    if (contradictionFlags.length > 0) {
      return { reviewRequired: true, reviewReason: "Critical contradiction detected between AI answer and source of truth." };
    }
    
    if (hallucinationRisk === 'High') {
      return { reviewRequired: true, reviewReason: "High hallucination risk. Answer generated with insufficient evidence." };
    }

    const manualReviewClasses = ['Dosage Advice Risk', 'Pediatric / Pregnancy Risk'];
    if (manualReviewClasses.includes(riskClass)) {
      return { reviewRequired: true, reviewReason: `Policy flags this risk class (${riskClass}) for mandatory pharmacist review.` };
    }

    if (context.verification && context.verification.verified === false && context.entities.length > 0) {
      return { reviewRequired: true, reviewReason: "Verification agent failed to verify claims." };
    }

    return { reviewRequired: false, reviewReason: "" };
  }
}

module.exports = new HumanReviewEngine();
