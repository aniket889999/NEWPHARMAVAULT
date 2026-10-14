const { GoogleGenerativeAI } = require('@google/generative-ai');

class MultilingualEntityMapper {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  async normalize(query, sourceLanguage) {
    if (sourceLanguage === 'en') return query;

    // Hardcoded fallbacks for speed
    let normalized = query.toLowerCase();
    
    const map = {
      'bukhar': 'fever',
      'बुखार': 'fever',
      'ताप': 'fever',
      'headache': 'headache',
      'sir dard': 'headache',
      'सिरदर्द': 'headache',
      'डोकेदुखी': 'headache',
      'cough': 'cough',
      'khansi': 'cough',
      'खांसी': 'cough',
      'खोकला': 'cough',
      'acidity': 'acidity',
      'gas': 'acidity',
      'stomach burning': 'acidity',
      'ऍसिडिटी': 'acidity',
      'एसिडिटी': 'acidity',
      'दर्द': 'pain',
      'डोलो': 'dolo',
      'पॅरासिटामॉल': 'paracetamol'
    };

    for (const [key, val] of Object.entries(map)) {
      if (normalized.includes(key)) {
        normalized = normalized.replace(new RegExp(key, 'g'), val);
      }
    }

    // Use Gemini for advanced normalization if still contains non-english
    if (/[\u0900-\u097F]/.test(normalized)) {
       try {
         const prompt = `Extract and normalize any healthcare symptoms or medicine names from this text into their standard English equivalents.
         Text: "${normalized}"
         Return the original text with the medical terms replaced by their English equivalents. Keep non-medical words as is.`;
         const result = await this.model.generateContent(prompt);
         normalized = result.response.text().trim();
       } catch (e) {
         // Normalization error logging redacted
       }
    }

    return normalized;
  }
}

module.exports = new MultilingualEntityMapper();
