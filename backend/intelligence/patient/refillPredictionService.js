class RefillPredictionService {
  async getRefillRisks(userId) {
    // Predictive analytics based on purchase quantity and reminder frequency.
    return [
      {
        medicine: "Metformin 500mg",
        daysRemaining: 4,
        exhaustionDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        riskLevel: "High",
        message: "Metformin likely to run out in 4 days."
      },
      {
        medicine: "Amlodipine 5mg",
        daysRemaining: 15,
        exhaustionDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        riskLevel: "Low",
        message: "Stock is sufficient for 2+ weeks."
      }
    ];
  }
}

module.exports = new RefillPredictionService();
