class EvidenceConsistencyChecker {
  checkConsistency(claims, context) {
    let supportedClaims = [];
    let unsupportedClaims = [];
    let conflictingClaims = [];

    const graphStr = (context.graphEvidence || []).join(' ').toLowerCase();
    const invStr = (context.inventoryEvidence || []).join(' ').toLowerCase();

    claims.forEach(c => {
      if (c.type === 'medicine_use' || c.type === 'side_effect') {
        if (graphStr.includes(c.entity.toLowerCase())) {
          supportedClaims.push(c);
        } else {
          unsupportedClaims.push(c);
        }
      } else if (c.type === 'inventory') {
        if (invStr.includes(c.entity.toLowerCase())) {
          supportedClaims.push(c);
        } else {
          conflictingClaims.push(c);
        }
      } else if (c.type === 'dosage') {
        if (context.prescriptionEvidence && context.prescriptionEvidence.toLowerCase().includes(c.entity.toLowerCase())) {
          supportedClaims.push(c);
        } else {
          unsupportedClaims.push(c);
        }
      } else {
        supportedClaims.push(c); // soft fallback
      }
    });

    const evidenceCoverage = claims.length > 0 ? Math.round((supportedClaims.length / claims.length) * 100) : 100;

    return {
      supportedClaims,
      unsupportedClaims,
      conflictingClaims,
      evidenceCoverage
    };
  }
}

module.exports = new EvidenceConsistencyChecker();
