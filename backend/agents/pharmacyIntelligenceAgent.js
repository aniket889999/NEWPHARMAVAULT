const Medicine = require('../models/medicineModel');
const Prescription = require('../models/prescriptionModel');

class PharmacyIntelligenceAgent {
  async process(context) {
    if (context.userRole !== 'pharmacy') {
      context.agentTrace.push("Pharmacy Intelligence Agent: Skipped (User is not pharmacy role).");
      return context;
    }

    if (context.intent.includes('inventory_question') || context.intent.includes('expiry_risk')) {
      const medicines = await Medicine.find({});
      let lowStock = [];
      let expiringSoon = [];
      
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);

      medicines.forEach(m => {
        if (m.stock <= 30) lowStock.push(`${m.name} (${m.stock} units)`);
        if (new Date(m.expiryDate) <= thirtyDays) expiringSoon.push(`${m.name}`);
      });

      context.pharmacyEvidence = {
        lowStock: lowStock.slice(0, 5), // top 5
        expiringSoon: expiringSoon.slice(0, 5)
      };

      context.agentTrace.push("Pharmacy Intelligence Agent: Retrieved dashboard risks.");
    }

    return context;
  }
}

module.exports = new PharmacyIntelligenceAgent();
