class ContradictionDetector {
  detect(consistencyResult, answer, context) {
    const flags = [];
    const text = answer.toLowerCase();

    // Inventory Contradiction
    if (consistencyResult.conflictingClaims.some(c => c.type === 'inventory')) {
      flags.push('AI claimed stock availability but inventory data indicates out of stock.');
    }

    // Safety Contradiction
    if (text.includes('safe to take') || text.includes('no interaction')) {
      if (context.safetyWarnings && context.safetyWarnings.length > 0) {
        flags.push('AI claimed safety but GraphRAG identified severe interactions/cautions.');
      }
    }

    // Prescription Contradiction
    if (text.includes('without prescription') || text.includes('over the counter')) {
      if (context.graphEvidence && context.graphEvidence.some(ev => ev.toLowerCase().includes('prescription'))) {
        flags.push('AI claimed OTC but GraphRAG marks medicine as Prescription Only.');
      }
    }

    return flags;
  }
}

module.exports = new ContradictionDetector();
