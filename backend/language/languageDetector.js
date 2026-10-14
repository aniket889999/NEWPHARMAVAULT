const { GoogleGenerativeAI } = require('@google/generative-ai');

class LanguageDetector {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  async detect(text) {
    if (!text) return { language: "en", confidence: 1 };
    
    // Quick heuristic
    if (/[\u0900-\u097F]/.test(text)) {
      if (text.includes('आहे') || text.includes('माझी') || text.includes('मला')) return { language: "mr", confidence: 0.9 };
      return { language: "hi", confidence: 0.9 };
    }

    try {
      const prompt = `Identify the language of this text: "${text}". 
      Return ONLY a JSON object: {"language": "en|hi|mr|hinglish", "confidence": 0.95}`;
      const result = await this.model.generateContent(prompt);
      let responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(responseText);
      return parsed;
    } catch (e) {
      // Detection error logging redacted
      return { language: 'en', confidence: 1 };
    }
  }
}

module.exports = new LanguageDetector();
