class SupplierIntelligenceService {
  async getSuppliers(pharmacyId) {
    return [
      {
        id: "sup_1",
        name: "Medico Pharma Distributors",
        trustScore: 98,
        deliveryReliability: "Excellent",
        counterfeitRisk: "Very Low",
        priceCompetitiveness: "Good",
        recommended: true
      },
      {
        id: "sup_2",
        name: "Global Health Supply",
        trustScore: 65,
        deliveryReliability: "Inconsistent",
        counterfeitRisk: "Medium",
        priceCompetitiveness: "Excellent",
        recommended: false,
        warning: "Frequent delays reported (Avg 3.2 days late)"
      }
    ];
  }
}

module.exports = new SupplierIntelligenceService();
