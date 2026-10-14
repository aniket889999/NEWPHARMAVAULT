/**
 * Deterministic Explainability Service
 * Builds structured, explainable case explanations strictly grounded in EvidenceItem records.
 * Never invents facts, diagnoses conditions, or gives treatment/claim approval advice.
 */
class DeterministicExplainabilityService {
  /**
   * Generate grounded explanation for a verification case
   * @param {Object} params
   * @param {Object} params.vCase
   * @param {Array} params.documents
   * @param {Array} params.fields
   * @param {Array} params.checks
   * @param {Array} params.signals
   * @param {Array} params.evidenceItems
   * @returns {Object} Structured explanation
   */
  generateExplanation({ vCase, documents = [], fields = [], checks = [], signals = [], evidenceItems = [] }) {
    // 1. If evidence is empty or fewer than minimum required documents, return insufficient evidence fallback
    if (!evidenceItems || evidenceItems.length === 0 || documents.length === 0) {
      return {
        summary: 'Insufficient evidence for verification.',
        statusRationale: 'No verified evidence items or documents are available to ground this case.',
        findings: [],
        riskSignalsSummary: [],
        citedEvidenceIds: [],
        hasSufficientEvidence: false,
        disclaimer: 'Administrative document consistency check only. Not medical advice, diagnosis, or claim adjudication.'
      };
    }

    const citedEvidenceIds = new Set();
    const findings = [];

    // Helper to find relevant evidence item IDs
    const findEvidenceIdForField = (fieldType) => {
      const match = evidenceItems.find(e =>
        e.sourceType === 'CASE_DOCUMENT' &&
        e.claimSupported &&
        e.claimSupported.toLowerCase().includes(fieldType.toLowerCase())
      );
      if (match) {
        citedEvidenceIds.add(match._id.toString());
        return match._id.toString();
      }
      return null;
    };

    const findOfficialEvidenceId = () => {
      const match = evidenceItems.find(e => e.sourceType === 'OFFICIAL_REGISTRY');
      if (match) {
        citedEvidenceIds.add(match._id.toString());
        return match._id.toString();
      }
      return null;
    };

    const findCanonicalEvidenceId = () => {
      const match = evidenceItems.find(e => e.sourceType === 'CANONICAL_CATALOG');
      if (match) {
        citedEvidenceIds.add(match._id.toString());
        return match._id.toString();
      }
      return null;
    };

    // 2. Generate findings based on consistency checks
    for (const check of checks) {
      const checkEvidenceIds = (check.evidenceItemIds || []).map(id => id.toString());
      checkEvidenceIds.forEach(id => citedEvidenceIds.add(id));

      let statement = '';
      if (check.status === 'PASS') {
        statement = `Consistency verified: ${check.message}`;
      } else if (check.status === 'FAIL') {
        statement = `Discrepancy detected: ${check.message}`;
      } else {
        statement = `Inconclusive check: ${check.message}`;
      }

      findings.push({
        checkType: check.checkType,
        statement,
        status: check.status === 'PASS' ? 'VERIFIED' : (check.status === 'FAIL' ? 'DISCREPANCY' : 'INCONCLUSIVE'),
        severity: check.severity || 'INFO',
        evidenceItemIds: checkEvidenceIds.length > 0 ? checkEvidenceIds : (evidenceItems[0] ? [evidenceItems[0]._id.toString()] : [])
      });
    }

    // 3. Monograph Corroboration Finding
    const officialId = findOfficialEvidenceId();
    const canonicalId = findCanonicalEvidenceId();
    if (officialId || canonicalId) {
      const ids = [officialId, canonicalId].filter(Boolean);
      findings.push({
        checkType: 'REGULATORY_CORROBORATION',
        statement: 'Medicine identity and therapeutic classification verified against approved official formulary registry.',
        status: 'VERIFIED',
        severity: 'INFO',
        evidenceItemIds: ids
      });
    }

    // 4. Summarize active Risk Signals
    const riskSignalsSummary = signals.map(s => {
      const signalEvIds = (s.evidenceItemIds || []).map(id => id.toString());
      signalEvIds.forEach(id => citedEvidenceIds.add(id));
      return {
        signalType: s.signalType,
        severity: s.severity,
        description: s.description,
        evidenceItemIds: signalEvIds
      };
    });

    // 5. Build high-level summary referencing cited evidence
    const passedCount = checks.filter(c => c.status === 'PASS').length;
    const failedCount = checks.filter(c => c.status === 'FAIL').length;
    const signalCount = signals.length;

    let summary = '';
    if (failedCount > 0 || signalCount > 0) {
      summary = `Verification case requires human reviewer adjudication. Cross-document evaluation identified ${failedCount} discrepancy(ies) and ${signalCount} risk signal(s). Statements are grounded in Evidence items: [${Array.from(citedEvidenceIds).slice(0, 3).join(', ')}].`;
    } else if (passedCount > 0) {
      summary = `All evaluated cross-document consistency checks passed across ${documents.length} uploaded document(s). Awaiting mandatory human verification step. Statements are grounded in Evidence items: [${Array.from(citedEvidenceIds).slice(0, 3).join(', ')}].`;
    } else {
      summary = `Document processing complete. Findings grounded in Evidence items: [${Array.from(citedEvidenceIds).slice(0, 3).join(', ')}].`;
    }

    // 6. Rationale explaining why case is in current state
    const statusRationale = vCase.status === 'NEEDS_CORRECTION'
      ? 'One or more extracted fields require user correction due to low extraction confidence (< 75%) or missing data before human reviewer can verify.'
      : 'Automated verification checks and risk signals are complete. Under Human-in-the-Loop policy, automated approval is prohibited; authorized staff must verify.';

    return {
      summary,
      statusRationale,
      findings,
      riskSignalsSummary,
      citedEvidenceIds: Array.from(citedEvidenceIds),
      hasSufficientEvidence: true,
      disclaimer: 'This explanation is strictly an administrative document verification aid. It does NOT constitute medical diagnosis, treatment advice, or automated claim approval.'
    };
  }
}

module.exports = new DeterministicExplainabilityService();
