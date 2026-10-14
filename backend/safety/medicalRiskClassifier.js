class MedicalRiskClassifier {
  classify(query, answer, context) {
    const text = (query + " " + answer).toLowerCase();
    
    if (/(chest pain|breathing|overdose|unconscious|seizure|suicide|blood)/i.test(query)) {
      return 'Emergency Risk';
    }
    
    if (/(child|baby|infant|toddler|pregnant|pregnancy|breastfeeding)/i.test(text)) {
      return 'Pediatric / Pregnancy Risk';
    }
    
    if (/(mg|ml|tablet|dose|how many|how much|when to take)/i.test(query)) {
      return 'Dosage Advice Risk';
    }

    if (context.safetyWarnings && context.safetyWarnings.length > 0) {
      return 'Interaction / Contraindication Risk';
    }

    if (context.graphEvidence && context.graphEvidence.some(ev => ev.includes('prescription'))) {
      return 'Prescription Required Risk';
    }

    if (context.entities && context.entities.length > 0) {
      return 'Medicine Safety';
    }

    return 'General Info';
  }
}

module.exports = new MedicalRiskClassifier();
