const { GoogleGenerativeAI } = require('@google/generative-ai');

class TranslationService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  async translateToEnglish(text, sourceLanguage) {
    if (sourceLanguage === 'en') return text;

    try {
      const prompt = `Translate the following healthcare query into English accurately, preserving medical intent.
      Text: "${text}"
      Source Language: ${sourceLanguage}
      Return ONLY the translated string.`;
      
      const result = await this.model.generateContent(prompt);
      return result.response.text().trim();
    } catch (e) {
      // Translation error logging redacted
      return text;
    }
  }

  async translateFromEnglish(text, targetLanguage) {
    if (targetLanguage === 'en' || targetLanguage === 'hinglish') return text;
    
    // Quick mapping for target languages
    const langMap = {
      'hi': 'Hindi',
      'mr': 'Marathi'
    };
    
    const langName = langMap[targetLanguage] || targetLanguage;

    try {
      const prompt = `Translate the following healthcare AI response into ${langName}. 
      Ensure tone is professional, accessible, and grammatically correct. Keep medical terms like 'Paracetamol', 'Dolo' in English script or properly transliterated.
      Text to translate:
      "${text}"
      
      Return ONLY the translated text.`;
      
      const result = await this.model.generateContent(prompt);
      return result.response.text().trim();
    } catch (e) {
      // Translation error logging redacted
      return text; // fallback to English
    }
  }
}

module.exports = new TranslationService();
