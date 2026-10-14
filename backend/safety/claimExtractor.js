class ClaimExtractor {
  extractClaims(answer, context) {
    const claims = [];
    const text = answer.toLowerCase();

    // Medicine Use Claims
    if (context.entities && context.entities.length > 0) {
      context.entities.forEach(entity => {
        const entStr = entity.toLowerCase();
        if (text.includes(entStr) && (text.includes('used for') || text.includes('treat') || text.includes('cure'))) {
          claims.push({ type: 'medicine_use', entity, claim: 'Medical use claim' });
        }
        if (text.includes(entStr) && (text.includes('side effect') || text.includes('cause') || text.includes('nausea'))) {
          claims.push({ type: 'side_effect', entity, claim: 'Side effect claim' });
        }
        if (text.includes('available') || text.includes('stock')) {
          claims.push({ type: 'inventory', entity, claim: 'Stock availability claim' });
        }
        if (text.includes('mg') || text.includes('tablet') || text.includes('dose') || text.includes('take')) {
          claims.push({ type: 'dosage', entity, claim: 'Dosage or administration claim' });
        }
      });
    }

    if (text.includes('safe') || text.includes('no interaction')) {
      claims.push({ type: 'safety', entity: 'general', claim: 'General safety claim' });
    }

    return claims;
  }
}

module.exports = new ClaimExtractor();
