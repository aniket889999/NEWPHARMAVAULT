class SubstituteRankingService {
  async getRankedSubstitutes(pharmacyId, medicineName) {
    // In production, this would do a heavy query joining GraphRAG alternatives + Inventory DB.
    if (medicineName.toLowerCase() === "dolo 650") {
      return [
        {
          name: "Crocin 650",
          matchScore: 99,
          stock: 120,
          price: 30,
          rankReason: "Best Available (High Stock, Perfect Match)"
        },
        {
          name: "Calpol 650",
          matchScore: 98,
          stock: 15,
          price: 28,
          rankReason: "Low Stock Warning"
        },
        {
          name: "Paracip 650",
          matchScore: 95,
          stock: 0,
          price: 25,
          rankReason: "Out of Stock"
        }
      ];
    }
    return [];
  }
}

module.exports = new SubstituteRankingService();
