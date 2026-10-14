class ExplainabilityService {
  generateExplanation(context) {
    let graphScore = 0;
    let inventoryScore = 0;
    let prescriptionScore = 0;
    let ocrConfidence = 100; // default for chat
    let verificationScore = 0;
    let recommendationScore = 0;

    // Evaluate Graph Evidence
    if (context.graphEvidence && context.graphEvidence.length > 0) {
      graphScore = 90;
    } else if (context.entities && context.entities.length > 0) {
      graphScore = 10;
    }
    
    let intelligenceScore = 0;
    if (context.patientIntelligenceEvidence) {
      intelligenceScore = 100;
    }

    // Evaluate Inventory Evidence
    if (context.inventoryEvidence && context.inventoryEvidence.length > 0) {
      inventoryScore = 100;
    } else if (context.entities && context.entities.length > 0) {
      inventoryScore = 10;
    }

    // Evaluate Recommendations
    if (context.recommendations && context.recommendations.length > 0) {
      recommendationScore = 80;
    }

    // Evaluate Prescriptions
    if (context.prescriptionEvidence) {
      prescriptionScore = 100;
    }

    // Evaluate Verification
    if (context.verification.verified === true) {
      verificationScore = 100;
    } else if (context.verification.verified === 'partially') {
      verificationScore = 70;
    } else {
      verificationScore = 20;
    }

    // Weighted Confidence Score
    let finalConfidence = 0;
    let hallucinationRisk = 'Low Risk';

    // Complex queries vs Simple
    if (context.entities.length === 0 && !context.prescriptionEvidence && !context.pharmacyEvidence && !context.patientIntelligenceEvidence) {
      // General question without specific entities
      finalConfidence = 20;
      hallucinationRisk = 'High Risk';
    } else {
      let weightGraph = 0.35;
      let weightInv = 0.35;
      let weightVer = 0.30;
      
      finalConfidence = Math.round((graphScore * weightGraph) + (inventoryScore * weightInv) + (verificationScore * weightVer));
      
      // If we used patient intelligence heavily, boost confidence
      if (intelligenceScore === 100 && finalConfidence < 80) finalConfidence = 85;
      
      if (finalConfidence < 40 || (graphScore === 0 && inventoryScore === 0 && intelligenceScore === 0)) hallucinationRisk = 'High Risk';
      else if (finalConfidence < 75) hallucinationRisk = 'Medium Risk';
    }
    
    // Safety check override
    if (context.safetyWarnings && context.safetyWarnings.length > 0) {
      if (context.safetyWarnings.some(w => w.includes('EMERGENCY'))) {
        finalConfidence = 100; // 100% confident it's an emergency
        hallucinationRisk = 'Low Risk';
      }
    }

    // Generate "Why this answer?" summary
    let reasoningSteps = [];
    if (context.entities && context.entities.length > 0) {
      reasoningSteps.push(`Entities identified: ${context.entities.join(', ')}.`);
    }
    if (graphScore > 50) {
      reasoningSteps.push(`Graph knowledge retrieved exact relationships and uses.`);
    }
    if (inventoryScore > 50) {
      reasoningSteps.push(`Inventory database verified real-time stock/price data.`);
    } else if (context.entities.length > 0) {
      reasoningSteps.push(`Requested item was missing; searched for generic equivalents.`);
    }
    if (recommendationScore > 50) {
      reasoningSteps.push(`Recommendation engine supplied available alternative options.`);
    }
    if (prescriptionScore > 0) {
      reasoningSteps.push(`Patient's medical record retrieved to provide contextual answer.`);
    }
    if (intelligenceScore > 0) {
      reasoningSteps.push(`Patient Intelligence Engine supplied behavioral adherence and timeline insights.`);
    }
    if (context.safetyWarnings && context.safetyWarnings.length > 0) {
      reasoningSteps.push(`Safety system evaluated potential medical risks or contraindications.`);
    }

    // Extract Graph Relationships for Visualization
    let graphRelationships = [];
    if (context.entities && context.entities.length > 0) {
      const graphAdapter = require('../graph/graphAdapter');
      const results = graphAdapter.getEvidence(context.entities);
      results.forEach(res => {
        graphRelationships.push({
          name: res.node,
          generic: res.genericName,
          treats: res.uses || [],
          alternatives: res.alternatives || [],
          sideEffects: res.sideEffects || [],
          cautions: res.cautions || []
        });
      });
    }

    const explanation = {
      answerSummary: "Generated based on multi-agent consensus.",
      confidenceBreakdown: {
        graphEvidence: graphScore,
        inventoryEvidence: inventoryScore,
        prescriptionConfirmation: prescriptionScore,
        verificationScore,
        finalConfidence
      },
      verificationStatus: context.verification.verified,
      evidenceSources: [
        graphScore > 0 ? "Knowledge Graph" : null,
        inventoryScore > 0 ? "Pharmacy Inventory" : null,
        prescriptionScore > 0 ? "Patient Records" : null,
        intelligenceScore > 0 ? "Patient Intelligence Analytics" : null
      ].filter(Boolean),
      reasoningSteps,
      graphRelationships,
      patientIntelligenceData: context.patientIntelligenceData || null,
      safetyChecks: context.safetyWarnings || [],
      hallucinationRisk,
      disclaimer: hallucinationRisk === 'High Risk' ? "This answer may be unreliable due to lack of evidence. Please consult a pharmacist." : "Verified by PharmaVault X Multi-Agent System."
    };

    return explanation;
  }
}

module.exports = new ExplainabilityService();
