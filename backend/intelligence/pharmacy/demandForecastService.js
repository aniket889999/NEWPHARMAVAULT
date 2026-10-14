class DemandForecastService {
  async getForecasts(pharmacyId) {
    // Simulated deterministic logic for Phase 9
    return [
      {
        medicine: "Dolo 650",
        predictedWeeklyDemand: 150,
        currentStock: 45,
        shortageRisk: "High",
        demandTrend: "up",
        reason: "Seasonal viral fever spike detected in area."
      },
      {
        medicine: "Amoxicillin 500mg",
        predictedWeeklyDemand: 80,
        currentStock: 300,
        shortageRisk: "Low",
        demandTrend: "stable",
        reason: "Consistent standard usage."
      },
      {
        medicine: "Cetirizine 10mg",
        predictedWeeklyDemand: 120,
        currentStock: 10,
        shortageRisk: "Critical",
        demandTrend: "up",
        reason: "High pollen index causing allergy spike."
      }
    ];
  }
}

module.exports = new DemandForecastService();
