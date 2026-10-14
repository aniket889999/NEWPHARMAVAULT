const { medicineNodes } = require('./medicineGraphData');
const ontologyMapper = require('./ontologyMapper');

class GraphTraversalService {
  traverseMultiHop(entities, source) {
    let results = [];
    
    // Normalize entities
    const normalized = ontologyMapper.detectOntologyEntities(entities.join(' '));
    const searchTerms = [...new Set([...normalized.medicines, ...normalized.symptoms, ...entities])];

    searchTerms.forEach(term => {
      const q = term.toLowerCase();
      
      const node = medicineNodes.find(n => 
        n.medicineName.toLowerCase() === q || 
        n.id === q || 
        (n.aliases && n.aliases.some(a => a.toLowerCase() === q)) ||
        (n.genericName && n.genericName.toLowerCase() === q)
      );

      if (node) {
        // Multi-hop inheritance (Node -> Generic -> Relations)
        let genericNode = medicineNodes.find(n => n.medicineName === node.genericName);
        
        let paths = [];
        let uses = [...(node.relations.treats || [])];
        let sideEffects = [...(node.relations.may_cause || [])];
        let alternatives = [...(node.relations.alternative_to || [])];
        let cautions = [...(node.relations.caution_with || [])];

        if (genericNode) {
          paths.push(`${node.medicineName} → HAS_GENERIC → ${genericNode.medicineName}`);
          
          if (genericNode.relations.treats) {
            uses = [...new Set([...uses, ...genericNode.relations.treats])];
            paths.push(`${genericNode.medicineName} → TREATS → ${uses.join(', ')}`);
          }
          if (genericNode.relations.may_cause) {
            sideEffects = [...new Set([...sideEffects, ...genericNode.relations.may_cause])];
            paths.push(`${genericNode.medicineName} → MAY_CAUSE → ${sideEffects.join(', ')}`);
          }
          if (genericNode.relations.alternative_to) {
            alternatives = [...new Set([...alternatives, ...genericNode.relations.alternative_to])];
            paths.push(`${genericNode.medicineName} → ALTERNATIVE_TO → ${alternatives.join(', ')}`);
          }
          if (genericNode.relations.caution_with) {
            cautions = [...new Set([...cautions, ...genericNode.relations.caution_with])];
            paths.push(`${genericNode.medicineName} → CAUTION_WITH → ${cautions.join(', ')}`);
          }
        }

        let evString = `${node.medicineName} (Generic: ${node.genericName || 'Self'}). `;
        if (uses.length) evString += `It treats: ${uses.join(', ')}. `;
        if (sideEffects.length) evString += `It may cause: ${sideEffects.join(', ')}. `;
        if (alternatives.length) evString += `Alternatives: ${alternatives.join(', ')}. `;
        if (cautions.length) evString += `Caution with: ${cautions.join(', ')}. `;
        if (node.properties && node.properties.safetyNote) evString += `Safety Note: ${node.properties.safetyNote}`;

        results.push({
          node: node.medicineName,
          genericName: node.genericName || node.medicineName,
          evidenceString: evString.trim(),
          paths: paths,
          uses, sideEffects, alternatives, cautions,
          source: source
        });
      } else {
        // If it's a symptom, find treating medicines
        const symptom = ontologyMapper.normalizeSymptom(q);
        let treatsSymptom = [];
        
        medicineNodes.forEach(n => {
          let treats = n.relations.treats || [];
          const gen = medicineNodes.find(gn => gn.medicineName === n.genericName);
          if (gen && gen.relations.treats) {
            treats = [...new Set([...treats, ...gen.relations.treats])];
          }
          if (treats.some(t => t.toLowerCase().includes(symptom))) {
            treatsSymptom.push(n.medicineName);
          }
        });

        if (treatsSymptom.length > 0) {
          results.push({
            node: q,
            genericName: "Symptom",
            evidenceString: `The symptom '${q}' can be treated by: ${treatsSymptom.join(', ')}.`,
            paths: treatsSymptom.map(m => `${m} → TREATS → ${q}`),
            uses: [q], sideEffects: [], alternatives: [], cautions: [],
            source: source
          });
        }
      }
    });

    return results;
  }

  // Symptom to Medicine Reverse Traversal
  findMedicinesForSymptom(symptom) {
    const q = ontologyMapper.normalizeSymptom(symptom);
    let matches = [];
    
    medicineNodes.forEach(node => {
      let treats = node.relations.treats || [];
      // check generic too
      const gen = medicineNodes.find(n => n.medicineName === node.genericName);
      if (gen && gen.relations.treats) {
        treats = [...new Set([...treats, ...gen.relations.treats])];
      }

      if (treats.some(t => t.toLowerCase().includes(q))) {
        matches.push(node.medicineName);
      }
    });

    return matches;
  }
}

module.exports = new GraphTraversalService();
