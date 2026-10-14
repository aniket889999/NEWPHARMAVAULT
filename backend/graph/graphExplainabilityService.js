class GraphExplainabilityService {
  generateExplanation(traversalResults) {
    if (!traversalResults || traversalResults.length === 0) return null;

    let readableExplanations = [];
    let confidence = 0;
    
    traversalResults.forEach(res => {
      if (res.paths && res.paths.length > 0) {
        confidence = 90; // Graph multi-hop hit
        const explanation = `Mapped ${res.node} to ${res.genericName}. Extracted relations: ${res.paths.join('; ')}. Source: ${res.source}.`;
        readableExplanations.push(explanation);
      }
    });

    return {
      readableExplanations,
      confidence,
      source: traversalResults[0].source
    };
  }
}

module.exports = new GraphExplainabilityService();
