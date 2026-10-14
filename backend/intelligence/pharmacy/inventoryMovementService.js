class InventoryMovementService {
  async getSeasonalTrends(pharmacyId) {
    return [
      {
        season: "Current (Monsoon)",
        predictedSpike: "Antipyretics, Antihistamines",
        probability: 88,
        alert: "Prepare for 40% increase in Paracetamol and Cetirizine demand."
      },
      {
        season: "Upcoming (Winter)",
        predictedSpike: "Cough Syrups, Bronchodilators",
        probability: 92,
        alert: "Stock up on Expectorants by late October."
      }
    ];
  }
}

module.exports = new InventoryMovementService();
