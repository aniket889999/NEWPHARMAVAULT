const graphService = require('../graph/graphService');
const Medicine = require('../models/medicineModel');

class RecommendationAgent {
  async process(context) {
    if (!context.intent.includes('alternatives') && !context.intent.includes('availability_check')) {
      context.agentTrace.push("Recommendation Agent: Skipped (not an alternative/availability query).");
      return context;
    }

    if (context.entities.length === 0) return context;

    for (const entity of context.entities) {
      const node = graphService.findMedicineNode(entity);
      if (node && node.relations && node.relations.alternative_to) {
        const altNames = node.relations.alternative_to;
        
        // Find which alternatives are in stock
        const inStockAlts = await Medicine.find({
          name: { $regex: new RegExp(altNames.join('|'), 'i') },
          stock: { $gt: 0 }
        });

        if (inStockAlts.length > 0) {
          const suggestions = inStockAlts.map(a => `${a.name} (₹${a.price})`).join(', ');
          context.recommendations.push(`Available alternatives for ${entity}: ${suggestions}`);
          context.agentTrace.push(`Recommendation Agent: Found in-stock alternatives for ${entity}.`);
        } else {
          context.recommendations.push(`No available alternatives currently in stock for ${entity}.`);
          context.agentTrace.push(`Recommendation Agent: Alternatives for ${entity} are out of stock.`);
        }
      }
    }

    return context;
  }
}

module.exports = new RecommendationAgent();
