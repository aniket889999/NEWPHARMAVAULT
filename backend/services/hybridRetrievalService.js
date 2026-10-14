const Medicine = require('../models/medicineModel');
const graphAdapter = require('../graph/graphAdapter');

class HybridRetrievalService {
  async retrieve(query) {
    if (!query) return null;

    // 1. Get Graph Evidence (which also extracts the medicine name)
    const graphEvidences = graphAdapter.getGraphEvidence([query]);
    
    let detectedMedicines = [];
    let inventoryEvidence = [];
    let graphEvidenceList = [];
    let warnings = [];
    let confidence = 50; // Base confidence

    if (graphEvidences && graphEvidences.length > 0) {
      confidence += 20; // Boost confidence if we hit the Knowledge Graph
      
      for (const ev of graphEvidences) {
        detectedMedicines.push(ev.node);
        graphEvidenceList.push(ev.evidenceString);
        
        if (ev.prescriptionRequired) {
          warnings.push(`Caution: ${ev.node} is a prescription medicine.`);
        }
        
        // 2. Fetch from MongoDB (Inventory/Price context)
        try {
          const dbMedicines = await Medicine.find({
            $or: [
              { name: { $regex: new RegExp(ev.node, 'i') } },
              { category: { $regex: new RegExp(ev.generic, 'i') } }
            ]
          }).select('name price stock category');

          if (dbMedicines.length > 0) {
            confidence += 15; // Boost if matched in DB
            dbMedicines.forEach(m => {
              inventoryEvidence.push(`[DB] ${m.name} | Price: ₹${m.price} | Stock: ${m.stock > 0 ? m.stock + ' units available' : 'Out of stock'}`);
            });
          }
        } catch (error) {
          console.error("MongoDB Retrieval Error:", error);
        }
      }
    } else {
      // Fallback: If graph didn't catch it, try a generic DB text search
      try {
        const words = query.split(' ').filter(w => w.length > 4); // basic keyword extraction
        for (const word of words) {
          const dbMedicines = await Medicine.find({ name: { $regex: new RegExp(word, 'i') } }).select('name price stock');
          if (dbMedicines.length > 0) {
            detectedMedicines.push(dbMedicines[0].name);
            inventoryEvidence.push(`[DB] ${dbMedicines[0].name} | Price: ₹${dbMedicines[0].price} | Stock: ${dbMedicines[0].stock}`);
            confidence = 60;
            break;
          }
        }
      } catch (err) {
        console.error("Fallback DB Search Error:", err);
      }
    }

    // Adjust confidence based on findings
    if (detectedMedicines.length === 0) {
      confidence = 10;
    } else if (inventoryEvidence.length === 0) {
      confidence -= 10;
    }

    // Safety rules
    const emergencyRegex = /(chest pain|breathing|overdose|unconscious|seizure|suicide)/i;
    if (emergencyRegex.test(query)) {
      warnings.push("EMERGENCY DETECTED: Seek immediate medical help (Dial 112/911).");
      confidence = 100; // 100% confident it's an emergency
    }

    return {
      detectedMedicines: [...new Set(detectedMedicines)],
      inventoryEvidence,
      graphEvidence: graphEvidenceList,
      warnings,
      confidence: Math.min(confidence, 100),
      sourcesUsed: [
        graphEvidenceList.length > 0 ? "Medicine Knowledge Graph" : null,
        inventoryEvidence.length > 0 ? "MongoDB Inventory" : null
      ].filter(Boolean)
    };
  }
}

module.exports = new HybridRetrievalService();
