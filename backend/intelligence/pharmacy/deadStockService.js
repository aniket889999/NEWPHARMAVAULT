class DeadStockService {
  async getDeadStock(pharmacyId) {
    return [
      {
        medicine: "Pantoprazole 40mg",
        daysInactive: 48,
        capitalBlocked: 12500,
        score: 85,
        suggestedAction: "Discount to clear or return to supplier"
      },
      {
        medicine: "Vitamin D3 60K",
        daysInactive: 65,
        capitalBlocked: 8000,
        score: 92,
        suggestedAction: "Run promotion for winter wellness"
      }
    ];
  }
}

module.exports = new DeadStockService();
