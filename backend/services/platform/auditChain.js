'use strict';

/**
 * Tamper-evident audit log: every new AuditEvent is linked into one hash chain.
 *
 *   hash_n = H(prevHash_n || canonical(event_n)),  prevHash_n = hash_{n-1}
 *
 * The chain head ({_id:'audit', seq, hash}) is advanced with a compare-and-swap,
 * so several API instances can append safely. The event is written after the head
 * moves; if that write ever fails, verification reports a missing sequence number
 * instead of silently passing.
 *
 * H is SHA-256, or HMAC-SHA-256 when AUDIT_CHAIN_KEY (32+ chars) is set. With the
 * key kept outside the database, someone who can write to MongoDB still cannot
 * rebuild a valid chain after editing an event.
 *
 * Hooked into the AuditEvent model (pre-save), so callers that use
 * AuditEvent.create() directly — including frozen research files — are covered.
 */
const crypto = require('node:crypto');


const HEAD_ID = 'audit';
const GENESIS = '0'.repeat(64);
const HEAD_COLLECTION = 'auditchainheads';
const MAX_ATTEMPTS = 50;

/** JSON with recursively sorted keys; ObjectIds/Dates become their JSON forms. */
function canonical(value) {
  const plain = value === undefined ? null : JSON.parse(JSON.stringify(value));
  const sort = (v) => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      return Object.keys(v).sort().reduce((o, k) => {
        const child = sort(v[k]);
        // Mongoose "minimize" drops empty nested objects on save, so they are ignored here too.
        if (!(child && typeof child === 'object' && !Array.isArray(child) && Object.keys(child).length === 0)) o[k] = child;
        return o;
      }, {});
    }
    return v;
  };
  return JSON.stringify(sort(plain));
}

function eventPayload(e) {
  return {
    id: String(e._id),
    caseId: e.caseId ? String(e.caseId) : null,
    actorId: e.actorId ? String(e.actorId) : null,
    actorRole: e.actorRole ?? null,
    action: e.action ?? null,
    targetType: e.targetType ?? null,
    targetId: e.targetId == null ? null : String(e.targetId),
    metadata: e.metadata ?? {},
    createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : null
  };
}

function chainKey(env = process.env) {
  const key = env.AUDIT_CHAIN_KEY;
  return typeof key === 'string' && key.length >= 32 ? key : null;
}

function algorithm(env = process.env) {
  return chainKey(env) ? 'hmac-sha256' : 'sha256';
}

function linkHash({ seq, prevHash, event, alg = algorithm() }, env = process.env) {
  const material = `${seq}|${prevHash}|${canonical(eventPayload(event))}`;
  if (alg === 'hmac-sha256') {
    const key = chainKey(env);
    if (!key) throw Object.assign(new Error('AUDIT_CHAIN_KEY is needed to check HMAC-linked audit events.'), { code: 'AUDIT_CHAIN_KEY_MISSING' });
    return crypto.createHmac('sha256', key).update(material).digest('hex');
  }
  return crypto.createHash('sha256').update(material).digest('hex');
}

// Loaded lazily so the pure hashing helpers can be tested without a database driver.
const headCollection = () => require('mongoose').connection.db.collection(HEAD_COLLECTION);

/** Reserves the next link for `event` and fills chainSeq/prevHash/hash/chainAlg on it. */
async function appendLink(event) {
  const heads = headCollection();
  const alg = algorithm();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const head = await heads.findOne({ _id: HEAD_ID });
    const seq = (head?.seq || 0) + 1;
    const prevHash = head?.hash || GENESIS;
    const hash = linkHash({ seq, prevHash, event, alg });
    try {
      const moved = head
        ? (await heads.updateOne({ _id: HEAD_ID, seq: head.seq, hash: head.hash }, { $set: { seq, hash, updatedAt: new Date() } })).modifiedCount === 1
        : (await heads.insertOne({ _id: HEAD_ID, seq, hash, updatedAt: new Date() }), true);
      if (moved) {
        event.chainSeq = seq;
        event.prevHash = prevHash;
        event.hash = hash;
        event.chainAlg = alg;
        return;
      }
    } catch (error) {
      if (error?.code !== 11000) throw error; // another instance created the head first
    }
    await new Promise((r) => setTimeout(r, Math.min(2 ** attempt, 25)));
  }
  throw Object.assign(new Error('Audit chain is busy. Try again.'), { statusCode: 503, code: 'AUDIT_CHAIN_BUSY' });
}

/**
 * Walks the chain in order and reports the first problem.
 * Problems: MISSING_EVENT (gap), PREV_HASH_MISMATCH (re-ordered/removed), HASH_MISMATCH (edited),
 * HEAD_MISMATCH (newest events removed).
 */
async function verifyChain(AuditEvent, { fromSeq = 1, batchSize = 1000 } = {}) {
  const head = await headCollection().findOne({ _id: HEAD_ID });
  const legacyUnchained = await AuditEvent.countDocuments({ chainSeq: { $exists: false } });
  let expectedSeq = fromSeq;
  let prevHash = null;
  let checked = 0;
  if (fromSeq > 1) {
    const prev = await AuditEvent.findOne({ chainSeq: fromSeq - 1 }).select('hash').lean();
    prevHash = prev?.hash || null;
  } else {
    prevHash = GENESIS;
  }
  const fail = (problem, seq, detail) => ({ ok: false, problem, seq, detail, checked, headSeq: head?.seq || 0, legacyUnchained });

  for (;;) {
    const batch = await AuditEvent.find({ chainSeq: { $gte: expectedSeq } }).sort({ chainSeq: 1 }).limit(batchSize).lean();
    if (!batch.length) break;
    for (const e of batch) {
      if (e.chainSeq !== expectedSeq) return fail('MISSING_EVENT', expectedSeq, `next stored event is #${e.chainSeq}`);
      if (prevHash !== null && e.prevHash !== prevHash) return fail('PREV_HASH_MISMATCH', e.chainSeq, 'link to the previous event is broken');
      let recomputed;
      try {
        recomputed = linkHash({ seq: e.chainSeq, prevHash: e.prevHash, event: e, alg: e.chainAlg || 'sha256' });
      } catch (error) {
        return fail(error.code || 'VERIFY_ERROR', e.chainSeq, error.message);
      }
      if (recomputed !== e.hash) return fail('HASH_MISMATCH', e.chainSeq, 'event content differs from what was recorded');
      prevHash = e.hash;
      expectedSeq += 1;
      checked += 1;
    }
  }
  const lastSeq = expectedSeq - 1;
  if (head && (head.seq !== lastSeq || (checked > 0 && head.hash !== prevHash))) {
    return fail(head.seq > lastSeq ? 'MISSING_EVENT' : 'HEAD_MISMATCH', lastSeq + 1, `chain head is #${head.seq}`);
  }
  return { ok: true, checked, fromSeq, headSeq: head?.seq || 0, headHash: head?.hash || null, legacyUnchained };
}

module.exports = { GENESIS, HEAD_ID, HEAD_COLLECTION, canonical, eventPayload, linkHash, algorithm, appendLink, verifyChain };
