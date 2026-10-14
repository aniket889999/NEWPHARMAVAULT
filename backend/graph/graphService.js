const { medicineNodes } = require('./medicineGraphData');

// Simple in-memory graph traversal for Phase 2 MVP
// TODO: Phase 3 will replace this with actual Neo4j cypher queries

class GraphService {
  
  // Find a medicine node by name or generic name (case-insensitive)
  findMedicineNode(query) {
    if (!query) return null;
    const lowerQuery = query.toLowerCase();
    return medicineNodes.find(
      node => node.medicineName.toLowerCase().includes(lowerQuery) || 
              node.genericName.toLowerCase().includes(lowerQuery) ||
              (node.aliases && node.aliases.some(alias => lowerQuery.includes(alias.toLowerCase())))
    );
  }

  getMedicineUses(medicineName) {
    const node = this.findMedicineNode(medicineName);
    return node ? node.relations.treats : [];
  }

  getSideEffects(medicineName) {
    const node = this.findMedicineNode(medicineName);
    return node ? node.relations.may_cause : [];
  }

  getAlternatives(medicineName) {
    const node = this.findMedicineNode(medicineName);
    return node ? node.relations.alternative_to : [];
  }

  getInteractions(medicineName) {
    // In our simplified graph, caution_with acts as interaction/contraindication
    const node = this.findMedicineNode(medicineName);
    return node ? node.relations.caution_with : [];
  }

  getContraindications(medicineName) {
    const node = this.findMedicineNode(medicineName);
    return node ? node.relations.caution_with : [];
  }

  // Helper to merge relationships from generic node
  _inheritFromGeneric(node) {
    if (!node.genericName) return node;
    const genericNode = this.findMedicineNode(node.genericName);
    if (!genericNode || genericNode.id === node.id) return node;

    // Merge arrays, removing duplicates
    const merge = (arr1, arr2) => [...new Set([...(arr1 || []), ...(arr2 || [])])];

    return {
      ...node,
      relations: {
        treats: merge(node.relations.treats, genericNode.relations.treats),
        may_cause: merge(node.relations.may_cause, genericNode.relations.may_cause),
        alternative_to: merge(node.relations.alternative_to, genericNode.relations.alternative_to),
        caution_with: merge(node.relations.caution_with, genericNode.relations.caution_with),
        used_for: merge(node.relations.used_for, genericNode.relations.used_for)
      }
    };
  }

  // Master function to extract all relevant graph evidence for an entity/query
  getGraphEvidence(query) {
    const lowerQuery = query.toLowerCase();
    
    // Find matched nodes
    const matchedNodes = medicineNodes.filter(node => 
      lowerQuery.includes(node.medicineName.toLowerCase()) || 
      lowerQuery.includes(node.genericName.toLowerCase()) ||
      (node.aliases && node.aliases.some(alias => lowerQuery.includes(alias.toLowerCase())))
    );

    if (matchedNodes.length === 0) return null;

    const evidences = matchedNodes.map(rawNode => {
      // Traverse and inherit properties from the generic node
      const node = this._inheritFromGeneric(rawNode);

      const uses = [...new Set([...(node.relations.treats || []), ...(node.relations.used_for || [])])];
      const sideEffects = node.relations.may_cause || [];
      const alternatives = node.relations.alternative_to || [];
      const cautions = node.relations.caution_with || [];

      let evidenceString = `${node.medicineName} (Generic: ${node.genericName}). `;
      if (uses.length > 0) evidenceString += `It treats: ${uses.join(', ')}. `;
      if (sideEffects.length > 0) evidenceString += `It may cause: ${sideEffects.join(', ')}. `;
      if (alternatives.length > 0) evidenceString += `Alternatives: ${alternatives.join(', ')}. `;
      if (cautions.length > 0) evidenceString += `Caution with: ${cautions.join(', ')}. `;
      if (node.safetyNotes) evidenceString += `Safety Note: ${node.safetyNotes}`;
      
      return {
        node: node.medicineName,
        genericName: node.genericName,
        prescriptionRequired: node.prescriptionRequired,
        safetyNotes: node.safetyNotes,
        evidenceString: evidenceString.trim(),
        uses,
        sideEffects,
        alternatives,
        cautions
      };
    });

    return evidences;
  }
}

module.exports = new GraphService();
