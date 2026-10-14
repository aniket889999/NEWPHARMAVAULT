class ReorderEngine {
  async getReorderSuggestions(pharmacyId) {
    return [
      {
        medicine: "Cetirizine 10mg",
        currentStock: 10,
        suggestedQuantity: 200,
        reorderUrgency: 95,
        expectedShortageDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: "Critical"
      },
      {
        medicine: "Dolo 650",
        currentStock: 45,
        suggestedQuantity: 300,
        reorderUrgency: 80,
        expectedShortageDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: "High"
      }
    ];
  }
}

module.exports = new ReorderEngine();
