const mongoose = require('mongoose');
const CanonicalMedicine = require('../../models/canonicalMedicineModel');
const {
  ACADEMIC_CATALOGUE_VERSION,
  ACADEMIC_SOURCE_NOTE,
  ACADEMIC_MEDICINE_CATALOGUE
} = require('../../data/academicMedicineCatalogue');

/**
 * Identity Resolution Service
 *
 * Implements explainable, deterministic cross-brand medicine identity resolution
 * for PharmaVault TrustRAG.
 *
 * IMPORTANT ACADEMIC BOUNDARY:
 * Curated academic reference catalogue — not live regulatory verification.
 * Deterministic normalization and matching only; zero external LLM or public web scraping.
 * Low-confidence, ambiguous, or weak OCR text must require human confirmation.
 */
class IdentityResolutionService {
  /**
   * Deterministically resolve a medicine query string to a canonical record in the curated catalogue.
   *
   * @param {string} medicineQuery - Raw or extracted medicine query string
   * @param {Object} [context={}] - Optional context (e.g. extracted strength or dosage form)
   * @returns {Promise<{
   *   resolved: boolean,
   *   ambiguous: boolean,
   *   matchScore: number,
   *   matchBasis: string,
   *   canonical: Object|null,
   *   candidates: Array<Object>,
   *   rawQuery: string,
   *   sourceNote: string,
   *   catalogueVersion: string
   * }>}
   */
  async resolveMedicine(medicineQuery, context = {}) {
    const rawQuery = typeof medicineQuery === 'string' ? medicineQuery : '';

    // 1. Weak / Empty OCR Text Guard
    // Reject empty, non-string, or text with fewer than 3 characters / letters
    if (!rawQuery || rawQuery.trim().length < 3 || !/[a-zA-Z]{3,}/.test(rawQuery)) {
      return {
        resolved: false,
        ambiguous: false,
        matchScore: 0,
        matchBasis: rawQuery.trim().length > 0 ? 'Weak OCR Text' : 'None',
        canonical: null,
        candidates: [],
        rawQuery,
        sourceNote: ACADEMIC_SOURCE_NOTE,
        catalogueVersion: ACADEMIC_CATALOGUE_VERSION
      };
    }

    // 2. Deterministic Normalization
    const norm = this.normalizeQuery(rawQuery, context);

    // 3. Fetch curated catalogue records from database (or in-memory academic catalogue if DB unseeded)
    let records = [];
    try {
      records = await CanonicalMedicine.find({});
    } catch {
      // In offline unit tests without mongo connection, fall back safely to in-memory catalogue
      records = [];
    }

    if (!records || records.length === 0) {
      if (mongoose.connection.readyState === 0) {
        // Disconnected in-memory fallback for standalone testing
        records = ACADEMIC_MEDICINE_CATALOGUE;
      } else {
        // Connected DB is empty: do NOT silently invent records at runtime
        return {
          resolved: false,
          ambiguous: false,
          matchScore: 0,
          matchBasis: 'None',
          canonical: null,
          candidates: [],
          rawQuery,
          sourceNote: ACADEMIC_SOURCE_NOTE,
          catalogueVersion: ACADEMIC_CATALOGUE_VERSION
        };
      }
    }

    // 4. Deterministic Scoring across all catalogue candidates
    const scoredCandidates = [];

    for (const record of records) {
      const evaluation = this._evaluateMatch(norm, record);
      if (evaluation.score >= 0.60) {
        scoredCandidates.push({
          score: evaluation.score,
          basis: evaluation.basis,
          record
        });
      }
    }

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // 5. Evaluation and Human-in-the-Loop Thresholding
    if (scoredCandidates.length === 0) {
      return {
        resolved: false,
        ambiguous: false,
        matchScore: 0,
        matchBasis: 'None',
        canonical: null,
        candidates: [],
        rawQuery,
        sourceNote: ACADEMIC_SOURCE_NOTE,
        catalogueVersion: ACADEMIC_CATALOGUE_VERSION
      };
    }

    const topCandidate = scoredCandidates[0];

    // High confidence resolution threshold: 0.85
    if (topCandidate.score >= 0.85) {
      // Check for ambiguous ties with conflicting generic names
      const topTies = scoredCandidates.filter(c => c.score >= topCandidate.score - 0.05);
      const distinctGenerics = new Set(topTies.map(c => (c.record.genericName || '').toLowerCase().trim()));

      if (distinctGenerics.size === 1) {
        // Confidently resolved to a single generic active ingredient
        return {
          resolved: true,
          ambiguous: false,
          matchScore: topCandidate.score,
          matchBasis: topCandidate.basis,
          canonical: this._serializeRecord(topCandidate.record),
          candidates: scoredCandidates.slice(0, 5).map(c => this._formatCandidate(c)),
          rawQuery,
          sourceNote: ACADEMIC_SOURCE_NOTE,
          catalogueVersion: ACADEMIC_CATALOGUE_VERSION
        };
      } else {
        // Ambiguous: multiple conflicting generic candidates
        return {
          resolved: false,
          ambiguous: true,
          matchScore: topCandidate.score,
          matchBasis: 'Partial Candidate',
          canonical: null,
          candidates: scoredCandidates.slice(0, 5).map(c => this._formatCandidate(c)),
          rawQuery,
          sourceNote: ACADEMIC_SOURCE_NOTE,
          catalogueVersion: ACADEMIC_CATALOGUE_VERSION
        };
      }
    }

    // Low confidence (< 0.85): requires human correction
    return {
      resolved: false,
      ambiguous: scoredCandidates.length > 1,
      matchScore: topCandidate.score,
      matchBasis: topCandidate.basis,
      canonical: null,
      candidates: scoredCandidates.slice(0, 5).map(c => this._formatCandidate(c)),
      rawQuery,
      sourceNote: ACADEMIC_SOURCE_NOTE,
      catalogueVersion: ACADEMIC_CATALOGUE_VERSION
    };
  }

  /**
   * Deterministic string normalizer
   * Strips dosage prefixes, prescription frequency noise, and extracts strength tokens.
   */
  normalizeQuery(query, context = {}) {
    let text = query.trim().toLowerCase();

    // Strip dosage form prefix: tab, tablet, cap, capsule, syp, syrup, inj, etc.
    text = text.replace(/^(?:tab(?:let)?|cap(?:sule)?|syp(?:rup)?|inj(?:ection)?|susp(?:ension)?)\.?\s+/i, '').trim();

    // Extract strength token if embedded
    const strengthMatch = text.match(/\b(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|gm|iu))\b/i);
    const queryStrength = strengthMatch
      ? strengthMatch[1].replace(/\s+/g, '').toLowerCase()
      : context.strength
      ? String(context.strength).replace(/\s+/g, '').toLowerCase()
      : null;

    // Clean prescription frequency words
    const cleanText = text
      .replace(/\b(1-0-1|1-1-1|0-1-0|od|bd|tds|qid|sos|stat|oral|po)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Token array of alphanumeric words length >= 2
    const tokens = cleanText
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2);

    return {
      rawText: query,
      cleanText,
      queryStrength,
      tokens
    };
  }

  /**
   * Evaluates a normalized query against a single catalogue record
   */
  _evaluateMatch(norm, record) {
    const brand = (record.brandName || '').toLowerCase().trim();
    const generic = (record.genericName || '').toLowerCase().trim();
    const aliases = (record.aliases || []).map(a => a.toLowerCase().trim());
    const recStrength = (record.strength || '').replace(/\s+/g, '').toLowerCase();

    const isStrengthMatch = Boolean(norm.queryStrength && recStrength && norm.queryStrength === recStrength);
    const isStrengthMismatch = Boolean(norm.queryStrength && recStrength && norm.queryStrength !== recStrength);

    // 1. Exact Brand + Strength Match
    const matchesBrandDirectly = norm.cleanText === brand || aliases.includes(norm.cleanText);
    if (matchesBrandDirectly && isStrengthMatch) {
      return { score: 1.0, basis: 'Brand + Strength' };
    }

    // 2. Exact Brand Alias (without strength mismatch)
    if (matchesBrandDirectly) {
      if (isStrengthMismatch) {
        return { score: 0.70, basis: 'Partial Candidate' };
      }
      return { score: 0.98, basis: 'Exact Brand Alias' };
    }

    // 3. Exact Generic Match
    const matchesGenericDirectly = norm.cleanText === generic;
    if (matchesGenericDirectly && isStrengthMatch) {
      return { score: 1.0, basis: 'Exact Generic' };
    }
    if (matchesGenericDirectly) {
      if (isStrengthMismatch) {
        return { score: 0.70, basis: 'Partial Candidate' };
      }
      return { score: 0.95, basis: 'Exact Generic' };
    }

    // 4. Brand Base Match (strip strength from both and compare)
    const textNoStrength = norm.cleanText.replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|gm|iu)\b/i, '').trim();
    const brandNoStrength = brand.replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|gm|iu)\b/i, '').trim();
    const aliasesNoStrength = aliases.map(a => a.replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|gm|iu)\b/i, '').trim());

    if (textNoStrength.length >= 3 && (textNoStrength === brandNoStrength || aliasesNoStrength.includes(textNoStrength))) {
      if (isStrengthMatch) {
        return { score: 1.0, basis: 'Brand + Strength' };
      }
      if (isStrengthMismatch) {
        return { score: 0.70, basis: 'Partial Candidate' };
      }
      return { score: 0.95, basis: 'Exact Brand Alias' };
    }

    // 5. Generic Base Match (e.g. "Paracetamol 500" matching generic "Paracetamol")
    const genericNoStrength = generic.replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|gm|iu)\b/i, '').trim();
    if (textNoStrength.length >= 3 && textNoStrength === genericNoStrength) {
      if (isStrengthMatch) {
        return { score: 1.0, basis: 'Exact Generic' };
      }
      if (isStrengthMismatch) {
        return { score: 0.70, basis: 'Partial Candidate' };
      }
      return { score: 0.92, basis: 'Exact Generic' };
    }

    // 6. Token Overlap / Partial Candidate Match
    const brandTokens = brand.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(t => t.length >= 2);
    const genericTokens = generic.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(t => t.length >= 2);

    const matchingBrandTokens = norm.tokens.filter(t => brandTokens.includes(t));
    const matchingGenericTokens = norm.tokens.filter(t => genericTokens.includes(t));

    const brandOverlap = brandTokens.length > 0 ? matchingBrandTokens.length / Math.max(norm.tokens.length, brandTokens.length) : 0;
    const genericOverlap = genericTokens.length > 0 ? matchingGenericTokens.length / genericTokens.length : 0;

    const maxOverlap = Math.max(brandOverlap, genericOverlap);

    if (maxOverlap >= 0.5) {
      let candidateScore = 0.60 + (maxOverlap * 0.22);
      if (isStrengthMatch) candidateScore += 0.08;
      if (isStrengthMismatch) candidateScore -= 0.15;
      const finalScore = Math.min(0.84, Math.max(0.40, Math.round(candidateScore * 100) / 100));
      return { score: finalScore, basis: 'Partial Candidate' };
    }

    return { score: 0, basis: 'None' };
  }

  _serializeRecord(doc) {
    if (!doc) return null;
    return typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  }

  _formatCandidate(c) {
    const rawRec = this._serializeRecord(c.record);
    return {
      ...rawRec,
      matchScore: c.score,
      matchBasis: c.basis
    };
  }
}

module.exports = new IdentityResolutionService();
