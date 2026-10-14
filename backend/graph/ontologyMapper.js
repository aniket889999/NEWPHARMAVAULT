class OntologyMapper {
  constructor() {
    this.medicineSynonyms = {
      'dolo': 'Dolo 650',
      'dolo 650': 'Dolo 650',
      'डोलो': 'Dolo 650',
      'crocin': 'Crocin 650',
      'क्रोसिन': 'Crocin 650',
      'paracetamol': 'Paracetamol',
      'p-mol': 'Paracetamol',
      'पॅरासिटामॉल': 'Paracetamol',
      'calpol': 'Calpol 650',
      'metformin': 'Metformin 500mg',
      'sugar medicine': 'Metformin 500mg',
      'शुगर की दवा': 'Metformin 500mg',
      'bp medicine': 'Amlodipine 5mg',
      'amox': 'Amoxicillin 500mg'
    };

    this.symptomSynonyms = {
      'fever': 'fever',
      'high temperature': 'fever',
      'बुखार': 'fever',
      'ताप': 'fever',
      'stomach ache': 'stomach pain',
      'stomach pain': 'stomach pain',
      'gastric issue': 'stomach pain',
      'पेट दर्द': 'stomach pain',
      'sugar': 'diabetes',
      'diabetes': 'diabetes',
      'bp': 'hypertension',
      'high bp': 'hypertension',
      'दर्द': 'pain',
      'दुखणे': 'pain'
    };
  }

  normalizeMedicineName(term) {
    const t = term.toLowerCase().trim();
    return this.medicineSynonyms[t] || term;
  }

  normalizeSymptom(term) {
    const t = term.toLowerCase().trim();
    return this.symptomSynonyms[t] || term;
  }

  detectOntologyEntities(query) {
    const q = query.toLowerCase();
    const entities = {
      medicines: new Set(),
      symptoms: new Set()
    };

    Object.keys(this.medicineSynonyms).forEach(syn => {
      if (q.includes(syn)) entities.medicines.add(this.medicineSynonyms[syn]);
    });

    Object.keys(this.symptomSynonyms).forEach(syn => {
      if (q.includes(syn)) entities.symptoms.add(this.symptomSynonyms[syn]);
    });

    return {
      medicines: Array.from(entities.medicines),
      symptoms: Array.from(entities.symptoms)
    };
  }
}

module.exports = new OntologyMapper();
