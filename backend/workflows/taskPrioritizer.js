class TaskPrioritizer {
  calculatePriority(event, context) {
    let score = 0;
    
    // Medical risk
    if (context.riskClass === 'Emergency Risk') score += 100;
    else if (context.riskClass === 'High Risk') score += 70;
    else if (context.riskClass === 'Medium Risk') score += 40;

    // Safety Engine
    if (context.hallucinationRisk === 'High') score += 60;
    if (context.contradictionDetected) score += 80;

    // Pharmacy Operations
    if (event === 'expiry_approaching' && context.daysToExpiry < 30) score += 50;
    if (event === 'medicine_low_stock' && context.stockLevel <= 5) score += 60;
    
    // Patient Intelligence
    if (event === 'refill_risk_high') score += 40;
    if (event === 'reminder_missed_repeatedly') score += 60;
    if (event === 'prescription_ambiguity' || event === 'ocr_confidence_low') score += 75;

    // Emergency explicitly
    if (event === 'emergency_flag' || event === 'severe_interaction') score += 100;

    return this.scoreToPriorityLevel(score);
  }

  scoreToPriorityLevel(score) {
    if (score >= 90) return 'Critical';
    if (score >= 60) return 'High';
    if (score >= 30) return 'Medium';
    return 'Low';
  }
}

module.exports = new TaskPrioritizer();
