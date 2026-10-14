// Future Neo4j Seed script
// Maps current medicineGraphData.js into Cypher queries.

const { medicineNodes } = require('./medicineGraphData');

function generateCypherQueries() {
  const queries = [];
  
  medicineNodes.forEach(node => {
    // Merge Node
    queries.push(`MERGE (m:Medicine {id: "${node.id}", name: "${node.medicineName}"})`);
    
    // Merge Generic
    if (node.genericName) {
      queries.push(`MERGE (g:Generic {name: "${node.genericName}"})`);
      queries.push(`MATCH (m:Medicine {id: "${node.id}"}), (g:Generic {name: "${node.genericName}"}) MERGE (m)-[:HAS_GENERIC]->(g)`);
    }

    // Traits
    if (node.relations.treats) {
      node.relations.treats.forEach(s => {
        queries.push(`MERGE (s:Symptom {name: "${s.trim()}"})`);
        queries.push(`MATCH (m:Medicine {id: "${node.id}"}), (s:Symptom {name: "${s.trim()}"}) MERGE (m)-[:TREATS]->(s)`);
      });
    }
  });

  return queries;
}

module.exports = { generateCypherQueries };
