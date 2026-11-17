'use strict';

/**
 * Structural FHIR R4 validator for the resources PharmaVault exports.
 *
 * Checks: Bundle shape, required elements (R4 cardinality 1..*), value-set
 * codes for status fields, id format, and that every urn reference resolves
 * inside the Bundle. It is NOT a full profile/terminology validator (use the
 * official HL7 validator or the NHCX sandbox for that).
 */

const ID_PATTERN = /^[A-Za-z0-9\-.]{1,64}$/;
const BUNDLE_TYPES = ['document', 'message', 'transaction', 'transaction-response', 'batch', 'batch-response', 'history', 'searchset', 'collection'];

const RULES = {
  Task: {
    required: ['status', 'intent'],
    codes: {
      status: ['draft', 'requested', 'received', 'accepted', 'rejected', 'ready', 'cancelled', 'in-progress', 'on-hold', 'failed', 'completed', 'entered-in-error'],
      intent: ['unknown', 'proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option']
    }
  },
  Patient: { required: [], codes: {} },
  Organization: { required: [], codes: {} },
  DocumentReference: {
    required: ['status', 'content'],
    codes: { status: ['current', 'superseded', 'entered-in-error'] }
  },
  Claim: {
    required: ['status', 'type', 'use', 'patient', 'created', 'provider', 'priority', 'insurance'],
    codes: { status: ['active', 'cancelled', 'draft', 'entered-in-error'], use: ['claim', 'preauthorization', 'predetermination'] }
  },
  ClaimResponse: {
    required: ['status', 'type', 'use', 'patient', 'created', 'insurer', 'outcome'],
    codes: {
      status: ['active', 'cancelled', 'draft', 'entered-in-error'],
      use: ['claim', 'preauthorization', 'predetermination'],
      outcome: ['queued', 'complete', 'error', 'partial']
    }
  },
  Coverage: {
    required: ['status', 'beneficiary', 'payor'],
    codes: { status: ['active', 'cancelled', 'draft', 'entered-in-error'] }
  }
};

function isEmpty(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

function collectReferences(node, path, out) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectReferences(item, `${path}[${index}]`, out));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'reference' && typeof value === 'string') out.push({ path: `${path}.reference`, reference: value });
      else collectReferences(value, `${path}.${key}`, out);
    }
  }
  return out;
}

function validateBundle(bundle) {
  const issues = [];
  const add = (severity, path, message) => issues.push({ severity, path, message });

  if (!bundle || bundle.resourceType !== 'Bundle') {
    add('error', 'Bundle', 'resourceType must be "Bundle".');
    return { valid: false, issues };
  }
  if (!BUNDLE_TYPES.includes(bundle.type)) add('error', 'Bundle.type', `Invalid bundle type "${bundle.type}".`);
  if (bundle.id !== undefined && !ID_PATTERN.test(bundle.id)) add('error', 'Bundle.id', 'Invalid id format.');
  if (!Array.isArray(bundle.entry)) {
    add('error', 'Bundle.entry', 'entry must be an array.');
    return { valid: false, issues };
  }

  const fullUrls = new Set();
  bundle.entry.forEach((entry, index) => {
    const base = `Bundle.entry[${index}]`;
    if (!entry || typeof entry !== 'object') return add('error', base, 'Entry must be an object.');
    if (!entry.fullUrl) add('error', `${base}.fullUrl`, 'fullUrl is required for collection bundles.');
    else if (fullUrls.has(entry.fullUrl)) add('error', `${base}.fullUrl`, 'Duplicate fullUrl.');
    else fullUrls.add(entry.fullUrl);

    const resource = entry.resource;
    if (!resource || typeof resource.resourceType !== 'string') return add('error', `${base}.resource`, 'resource.resourceType is required.');
    const rule = RULES[resource.resourceType];
    const rpath = `${base}.resource(${resource.resourceType})`;
    if (!rule) return add('warning', rpath, 'Resource type is not checked by this validator.');
    if (resource.id !== undefined && !ID_PATTERN.test(resource.id)) add('error', `${rpath}.id`, 'Invalid id format.');
    for (const field of rule.required) {
      if (isEmpty(resource[field])) add('error', `${rpath}.${field}`, `${field} is required (R4 cardinality).`);
    }
    for (const [field, allowed] of Object.entries(rule.codes)) {
      if (!isEmpty(resource[field]) && !allowed.includes(resource[field])) {
        add('error', `${rpath}.${field}`, `"${resource[field]}" is not a valid ${resource.resourceType}.${field} code.`);
      }
    }
    if (resource.resourceType === 'DocumentReference') {
      (resource.content || []).forEach((content, i) => {
        if (!content?.attachment) add('error', `${rpath}.content[${i}].attachment`, 'attachment is required.');
      });
    }
    if (resource.resourceType === 'Claim') {
      (resource.insurance || []).forEach((ins, i) => {
        if (typeof ins.sequence !== 'number' || typeof ins.focal !== 'boolean' || !ins.coverage) {
          add('error', `${rpath}.insurance[${i}]`, 'insurance requires sequence, focal and coverage.');
        }
      });
      if (!resource.insurance?.some((ins) => ins.focal === true)) add('error', `${rpath}.insurance`, 'Exactly one focal insurance is expected.');
    }
  });

  for (const ref of collectReferences(bundle.entry, 'Bundle.entry', [])) {
    if (ref.reference.startsWith('urn:uuid:') && !/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(ref.reference)) {
      add('error', ref.path, `Reference ${ref.reference} is not a valid urn:uuid.`);
    } else if (ref.reference.startsWith('urn:uuid:') && !fullUrls.has(ref.reference)) {
      add('error', ref.path, `Reference ${ref.reference} does not resolve inside the Bundle.`);
    }
  }

  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}

module.exports = { validateBundle };
