const graphService = require('./graph/graphService');

console.log("=== Testing 'What is Dolo used for?' ===");
console.log(JSON.stringify(graphService.getGraphEvidence('What is Dolo used for?'), null, 2));

console.log("\n=== Testing 'What are side effects of Dolo?' ===");
console.log(JSON.stringify(graphService.getGraphEvidence('What are side effects of Dolo?'), null, 2));

console.log("\n=== Testing 'Suggest alternative to Dolo' ===");
console.log(JSON.stringify(graphService.getGraphEvidence('Suggest alternative to Dolo'), null, 2));
