const hybridRetrievalService = require('../services/hybridRetrievalService');

class GraphRagAgent {
  async process(context) {
    if (context.entities.length === 0) {
      context.agentTrace.push("GraphRAG Agent: Skipped (no medicine entities found).");
      return context;
    }

    const allEvidence = [];
    let confidenceSum = 0;

    for (const entity of context.entities) {
      const graphResult = await hybridRetrievalService.retrieve(entity.toLowerCase());
      if (graphResult && graphResult.confidence > 0) {
        allEvidence.push(...graphResult.graphEvidence);
        confidenceSum += graphResult.confidence;
        
        if (graphResult.warnings && graphResult.warnings.length > 0) {
          context.safetyWarnings.push(...graphResult.warnings);
        }
      }
    }

    if (allEvidence.length > 0) {
      context.graphEvidence = allEvidence;
      const avgConfidence = Math.round(confidenceSum / context.entities.length);
      context.confidence = avgConfidence; // baseline confidence
      context.agentTrace.push(`GraphRAG Agent: Retrieved evidence for [${context.entities.join(', ')}] with ${avgConfidence}% confidence.`);
    } else {
      context.agentTrace.push(`GraphRAG Agent: No graph evidence found for [${context.entities.join(', ')}].`);
    }

    return context;
  }
}

module.exports = new GraphRagAgent();
