class VerificationAgent {
  async process(context) {
    let verifiedStatus = true; // true, false, or 'partially'
    let unsupportedClaims = [];
    
    if (context.entities.length === 0 && !context.patientIntelligenceEvidence && !context.pharmacyEvidence && !context.prescriptionEvidence) {
      verifiedStatus = false;
      unsupportedClaims.push("No specific medicine or symptom was recognized in the query.");
      context.confidence = Math.min(context.confidence, 20);
    } else {
      if ((!context.graphEvidence || context.graphEvidence.length === 0) && !context.patientIntelligenceEvidence && !context.pharmacyEvidence && !context.prescriptionEvidence) {
        verifiedStatus = false;
        unsupportedClaims.push("No verified GraphRAG or system evidence supports this claim.");
        context.confidence = Math.max(0, context.confidence - 40);
      }
      
      let exactInventory = false;
      let genericInventory = false;
      if (context.inventoryEvidence && context.inventoryEvidence.length > 0) {
        // Did we find an exact match or just generic equivalents?
        context.inventoryEvidence.forEach(ev => {
          if (ev.includes('generic equivalents available')) {
             genericInventory = true;
          } else {
             exactInventory = true;
          }
        });
      }

      if (context.inventoryEvidence.length === 0) {
        context.confidence = Math.max(0, context.confidence - 20);
      } else if (!exactInventory && genericInventory) {
        // Exact missing but generic available
        verifiedStatus = 'partially';
        unsupportedClaims.push("Exact medicine not in stock, relying on generic equivalents.");
        context.confidence = Math.max(0, Math.min(context.confidence, 75));
      }
    }

    if (context.confidence < 40) {
      verifiedStatus = false;
      if (!unsupportedClaims.includes("Confidence score is too low to guarantee accuracy.")) {
        unsupportedClaims.push("Confidence score is too low to guarantee accuracy.");
      }
    }

    if (context.safetyWarnings.length > 0 && context.safetyWarnings.some(w => w.includes('EMERGENCY'))) {
      verifiedStatus = true; // Emergency rules always override
    }

    // Pass information down
    context.verification = {
      verified: verifiedStatus,
      unsupportedClaims
    };

    if (verifiedStatus === true) {
      context.agentTrace.push("Verification Agent: All claims cross-verified successfully.");
    } else if (verifiedStatus === 'partially') {
      context.agentTrace.push(`Verification Agent: Partially verified. Issues: ${unsupportedClaims.join(', ')}`);
    } else {
      context.agentTrace.push(`Verification Agent: Verification failed. Issues: ${unsupportedClaims.join(', ')}`);
    }

    return context;
  }
}

module.exports = new VerificationAgent();
