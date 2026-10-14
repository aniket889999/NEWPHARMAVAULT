const neo4jService = require('./neo4jService');
const graphService = require('./graphService');
const ontologyMapper = require('./ontologyMapper');
const graphTraversalService = require('./graphTraversalService');

class GraphAdapter {
  constructor() {
    this.source = 'InMemoryGraph';
    this.init();
  }

  async init() {
    const isConnected = await neo4jService.connect();
    if (isConnected) {
      this.source = 'Neo4j';
    }
  }

  getEvidence(entities) {
    // Determine the source
    if (this.source === 'Neo4j') {
      // In production: execute Cypher query using neo4jService.query()
      // For now, fallback to in-memory traversal simulation safely
      return graphTraversalService.traverseMultiHop(entities, this.source);
    }
    
    // In-memory fallback using graphTraversalService for deeper multi-hop reasoning
    return graphTraversalService.traverseMultiHop(entities, this.source);
  }

  // Legacy compatibility for GraphRAG agent
  getGraphEvidence(entities) {
    return this.getEvidence(entities);
  }
}

module.exports = new GraphAdapter();
