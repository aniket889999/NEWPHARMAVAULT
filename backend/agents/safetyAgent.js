class SafetyAgent {
  async preCheck(context) {
    const query = context.query.toLowerCase();
    const emergencyKeywords = ['chest pain', 'heart attack', 'suicide', 'kill myself', 'overdose', 'breathing difficulty', 'cant breathe', 'severe bleeding', 'unconscious'];
    
    let isEmergency = false;
    for (const keyword of emergencyKeywords) {
      if (query.includes(keyword)) {
        isEmergency = true;
        context.safetyWarnings.push(`EMERGENCY DETECTED: Symptoms match '${keyword}'. Please seek immediate medical attention or go to the nearest emergency room.`);
        context.agentTrace.push("Safety Agent: Emergency risk detected in query.");
        break;
      }
    }

    if (!isEmergency) {
      context.agentTrace.push("Safety Agent: No emergency risk detected in query.");
    }
    
    return isEmergency;
  }

  async postCheck(context) {
    // Add generic safety warnings based on intent
    if (context.intent === 'side_effects' || context.intent === 'interaction_risk') {
      context.safetyWarnings.push("Do not alter your medication without consulting a doctor.");
    }
    context.agentTrace.push("Safety Agent: Post-response safety guardrails applied.");
    return context;
  }
}

module.exports = new SafetyAgent();
