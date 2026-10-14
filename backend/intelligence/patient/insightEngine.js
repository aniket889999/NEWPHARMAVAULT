class InsightEngine {
  async generateInsights(adherenceStats, refillRisks, timeline) {
    const insights = [];
    const riskFlags = [];

    // Analyze Adherence
    if (adherenceStats.currentScore < 80) {
      insights.push("Adherence dropping for diabetes medicines.");
      riskFlags.push("Low adherence risk");
    }

    if (adherenceStats.dosesMissed >= 3) {
      insights.push(`You missed medicine ${adherenceStats.dosesMissed} times this week.`);
      riskFlags.push("Chronic inconsistency warning");
    }

    // Analyze Refills
    const criticalRefills = refillRisks.filter(r => r.riskLevel === "High");
    if (criticalRefills.length > 0) {
      criticalRefills.forEach(cr => {
        insights.push(`Refill recommended for ${cr.medicine.split(' ')[0]}.`);
        riskFlags.push("Missed refill risk");
      });
    }

    // Disclaimer ensuring no diagnosis
    insights.push("Note: AI behavioral insights only. Consult a pharmacist or doctor for medical advice.");

    return {
      insights,
      riskFlags: [...new Set(riskFlags)] // unique flags
    };
  }
}

module.exports = new InsightEngine();
