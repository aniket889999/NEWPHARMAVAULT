'use strict';

// Every claims/payer/notification route must be documented in the OpenAPI contract
// with the same method, and vice versa. Dependency-free (reads files as text).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const routesSource = fs.readFileSync(path.join(root, 'backend/routes/claimsRoutes.js'), 'utf8');
const contract = fs.readFileSync(path.join(root, 'contracts/openapi/pharmavault-trustrag-v1.yaml'), 'utf8');

function contractOperations() {
  const ops = new Set();
  let current = null;
  for (const line of contract.split('\n')) {
    const pathMatch = line.match(/^ {2}(\/[^:\s]+):\s*$/);
    if (pathMatch) { current = pathMatch[1]; continue; }
    const methodMatch = line.match(/^ {4}(get|post|put|patch|delete):\s*$/);
    if (current && methodMatch) ops.add(`${methodMatch[1].toUpperCase()} ${current}`);
  }
  return ops;
}

function routeOperations() {
  return [...routesSource.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)]
    .map(([, method, route]) => `${method.toUpperCase()} ${route.replace(/:(\w+)/g, '{$1}')}`);
}

test('claims routes and OpenAPI contract describe the same operations', () => {
  const documented = contractOperations();
  const routes = routeOperations();
  assert.ok(routes.length >= 19, 'expected the full claims route table');
  for (const op of routes) assert.ok(documented.has(op), `route not in contract: ${op}`);
  const claimsDocumented = [...documented].filter((op) => /\s\/(claims|payer|notifications|pharmacy\/claims)/.test(op));
  for (const op of claimsDocumented) assert.ok(routes.includes(op), `contract operation has no route: ${op}`);
});

test('contract registers the claims schemas and MFA endpoints', () => {
  for (const name of ['claim.schema.json', 'case-share-grant.schema.json', 'notification.schema.json']) {
    assert.match(contract, new RegExp(`\\.\\./schemas/${name.replace('.', '\\.')}`));
    assert.ok(fs.existsSync(path.join(root, 'contracts/schemas', name)));
  }
  for (const op of ['POST /users/mfa/setup', 'POST /users/mfa/enable', 'POST /users/mfa/disable']) {
    assert.ok(contractOperations().has(op), op);
  }
});
