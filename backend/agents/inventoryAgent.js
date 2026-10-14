const Medicine = require('../models/medicineModel');

class InventoryAgent {
  async process(context) {
    if (context.entities.length === 0) {
      context.agentTrace.push("Inventory Agent: Skipped (no medicine entities found).");
      return context;
    }

    const inventoryEvidence = [];

    const { medicineNodes } = require('../graph/medicineGraphData');

    for (const entity of context.entities) {
      // Clean string for fuzzy match: remove mg, spaces, symbols
      const cleanEntity = entity.replace(/mg/ig, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      // Find all medicines in DB for this organization
      const query = {};
      if (context.tenantContext?.organizationId) {
        query.organizationId = context.tenantContext.organizationId;
      }
      const allMeds = await Medicine.find(query);
      
      let matchedMed = allMeds.find(m => {
        const cleanName = m.name.replace(/mg/ig, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return cleanName.includes(cleanEntity) || cleanEntity.includes(cleanName);
      });

      if (matchedMed) {
        let status = matchedMed.stock === 0 ? 'Out of Stock' : (matchedMed.stock < 20 ? 'Low Stock' : 'In Stock');
        inventoryEvidence.push(`${matchedMed.name} (Price: ₹${matchedMed.price}, Stock: ${matchedMed.stock})`);
        context.agentTrace.push(`Inventory Agent: Exact or fuzzy match found for ${matchedMed.name} (Stock: ${matchedMed.stock}).`);
      } else {
        context.agentTrace.push(`Inventory Agent: Exact ${entity} stock not found; checked generic alternatives.`);
        
        // Find generic node from graph
        const node = medicineNodes.find(n => 
          n.medicineName.toLowerCase() === entity.toLowerCase() || 
          (n.aliases && n.aliases.some(a => a.toLowerCase() === entity.toLowerCase())) ||
          n.id === entity.toLowerCase()
        );

        if (node && node.genericName) {
           const genericAlts = allMeds.filter(m => m.category.toLowerCase().includes(node.genericName.toLowerCase()) || m.genericName?.toLowerCase().includes(node.genericName.toLowerCase()));
           if (genericAlts.length > 0) {
             const altsList = genericAlts.map(a => `${a.name} (₹${a.price})`).join(', ');
             inventoryEvidence.push(`Exact ${entity} not in stock, but generic equivalents available: ${altsList}`);
             context.agentTrace.push(`Inventory Agent: Found generic equivalents for ${entity}.`);
           }
        }
      }
    }

    if (inventoryEvidence.length > 0) {
      context.inventoryEvidence = inventoryEvidence;
    }

    return context;
  }
}

module.exports = new InventoryAgent();
