class AdherenceService {
  async calculateScore(userId) {
    // In production, we'd calculate ratio of taken vs missed reminders over 30 days.
    // For Phase 8, we build the deterministic behavior model.
    let baseScore = 100;
    
    // Simulated metrics
    const stats = {
      totalScheduled: 28,
      dosesTaken: 22,
      dosesMissed: 6,
      lateRefills: 1,
      currentScore: 0,
      trend: "dropping"
    };

    // Calculate completion rate (78%)
    const completionRate = stats.dosesTaken / stats.totalScheduled;
    baseScore = Math.round(baseScore * completionRate);

    // Penalty for late refills
    baseScore -= (stats.lateRefills * 5);

    // Bound the score
    stats.currentScore = Math.max(0, Math.min(100, baseScore));
    
    if (stats.currentScore > 90) stats.trend = "stable";
    else if (stats.currentScore > 75) stats.trend = "improving";
    else stats.trend = "dropping";

    return stats;
  }
}

module.exports = new AdherenceService();
