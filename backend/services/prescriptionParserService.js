const { GoogleGenerativeAI } = require('@google/generative-ai');
const hybridRetrievalService = require('./hybridRetrievalService');

class PrescriptionParserService {
  async parse(rawText, imageBase64) {
    let structuredData = {
      medicines: [],
      doctorName: "Unknown",
      patientName: "Unknown",
      prescriptionDate: new Date().toISOString().split('T')[0],
      rawText: rawText || "",
      overallConfidence: 0
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return structuredData;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 1. Ask Gemini to extract structured JSON from rawText or image
    const prompt = `You are a medical data extraction AI. Extract the following information from the provided prescription text/image.
    Return ONLY a valid JSON object matching this exact structure, with no markdown formatting or extra text:
    {
      "doctorName": "string or Unknown",
      "patientName": "string or Unknown",
      "prescriptionDate": "YYYY-MM-DD or Unknown",
      "medicines": [
        {
          "medicineName": "exact name found",
          "dosage": "e.g. 500mg, 10ml",
          "frequency": "e.g. 1-0-1, twice daily",
          "duration": "e.g. 5 days, 1 week",
          "instructions": "e.g. after meals",
          "confidence": number from 0 to 100
        }
      ]
    }`;

    let result;
    try {
      if (imageBase64 && imageBase64.startsWith('data:image')) {
        const mimeTypeMatch = imageBase64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        
        result = await model.generateContent([
          prompt, 
          { inlineData: { data: base64Data, mimeType } }
        ]);
      } else {
        result = await model.generateContent([prompt, rawText]);
      }

      let responseText = result.response.text();
      // Clean markdown formatting if present
      responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsed = JSON.parse(responseText);
      structuredData = { ...structuredData, ...parsed };
      
      let totalConfidence = 0;

      // 2. Cross-reference with Inventory & GraphRAG
      for (let i = 0; i < structuredData.medicines.length; i++) {
        let med = structuredData.medicines[i];
        
        // Use hybrid retrieval to find inventory and graph evidence
        const hybridResult = await hybridRetrievalService.retrieve(med.medicineName);
        
        med.matchedInventoryId = hybridResult.detectedMedicines.length > 0 ? hybridResult.detectedMedicines[0] : "";
        med.graphEvidence = hybridResult.graphEvidence || [];
        med.warnings = hybridResult.warnings || [];
        med.stock = 0;
        med.price = 0;
        med.needsReview = med.confidence < 80 || hybridResult.confidence < 50;

        // Extract price and stock from inventory evidence strings if present
        if (hybridResult.inventoryEvidence && hybridResult.inventoryEvidence.length > 0) {
          const invStr = hybridResult.inventoryEvidence[0];
          const priceMatch = invStr.match(/Price: ₹([0-9.]+)/);
          const stockMatch = invStr.match(/Stock: ([0-9]+)/);
          if (priceMatch) med.price = parseFloat(priceMatch[1]);
          if (stockMatch) med.stock = parseInt(stockMatch[1], 10);
        }

        // Safety flags
        if (med.warnings.length > 0) med.needsReview = true;

        totalConfidence += med.confidence;
      }

      if (structuredData.medicines.length > 0) {
        structuredData.overallConfidence = Math.round(totalConfidence / structuredData.medicines.length);
      }

    } catch (err) {
      console.error("PrescriptionParserService Error:", err);
    }

    return structuredData;
  }
}

module.exports = new PrescriptionParserService();
