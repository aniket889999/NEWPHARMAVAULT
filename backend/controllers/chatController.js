const asyncHandler = require('../middleware/asyncHandler');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Medicine = require('../models/medicineModel');

const hybridRetrievalService = require('../services/hybridRetrievalService');

// @desc    Handle AI Chat queries
// @route   POST /api/chat
const handleChat = asyncHandler(async (req, res) => {
  const { message, medicineId, history } = req.body;

  if (typeof message !== 'string') {
    res.status(400);
    throw new Error('Valid message is required');
  }

  const messageTrimmed = message.trim();
  if (!messageTrimmed || messageTrimmed.length > 2000) {
    res.status(400);
    throw new Error('Valid non-empty message is required (max 2000 characters)');
  }
  
  if (history && !Array.isArray(history)) {
     res.status(400); throw new Error('History must be an array');
  }
  
  if (history && history.length > 20) {
     res.status(400); throw new Error('History too long (max 20)');
  }

  if (history) {
    for (const msg of history) {
      if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) {
         res.status(400); throw new Error('History entry must be a valid object');
      }
      if (!['user', 'model', 'assistant'].includes(msg.role)) {
         res.status(400); throw new Error('Invalid history role');
      }
      if (typeof msg.text !== 'string' || msg.text.trim() === '' || msg.text.length > 2000) {
         res.status(400); throw new Error('Invalid history message length or content');
      }
    }
  }

  let medicineContext = null;
  if (medicineId) {
     const mongoose = require('mongoose');
     if (!mongoose.Types.ObjectId.isValid(medicineId)) {
        res.status(400);
        throw new Error('Invalid medicine ID format');
     }
     
     const query = { _id: medicineId };
     
     // Enforce tenant isolation for pharmacy staff
     if (req.user && ['pharmacy', 'org_admin', 'pharmacist', 'branch_manager'].includes(req.user.role)) {
       if (!req.tenantContext || !req.tenantContext.organizationId) {
         res.status(403);
         throw new Error('Organization context is missing. Access denied.');
       }
       query.organizationId = req.tenantContext.organizationId;
     }
     
     medicineContext = await Medicine.findOne(query).select('name category description manufacturer prescriptionRequired');
     
     if (!medicineContext) {
        res.status(404);
        throw new Error('Medicine not found or access denied');
     }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Rely on envValidator to catch missing keys on startup, this check ensures safety if somehow missing at runtime
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // 1. GraphRAG Hybrid Retrieval
  const retrievalResult = await hybridRetrievalService.retrieve(message);

  let graphContextStr = `\n--- GRAPHRAG EVIDENCE ---\n`;
  if (retrievalResult.graphEvidence.length > 0) {
    graphContextStr += `Knowledge Graph Data: ${retrievalResult.graphEvidence.join(' | ')}\n`;
  }
  if (retrievalResult.inventoryEvidence.length > 0) {
    graphContextStr += `Database Inventory: ${retrievalResult.inventoryEvidence.join(' | ')}\n`;
  }
  if (retrievalResult.warnings.length > 0) {
    graphContextStr += `CRITICAL WARNINGS: ${retrievalResult.warnings.join(' | ')}\n`;
  }

  // Construct context string if a specific medicine is selected
  let contextStr = '';
  if (medicineContext) {
    contextStr = `\nThe user is currently viewing the medicine: ${medicineContext.name} (Category: ${medicineContext.category}). Please tailor your advice primarily to this medicine where relevant.`;
  }

  const systemPrompt = `You are the PharmaVault Health Assistant AI, a smart, proactive, and empathetic medical assistant powered by GraphRAG. 
  
Rules you MUST follow strictly:
1. **Greetings & Empathy:** Respond empathetically to "I'm not feeling well" or similar phrases before offering medical info. If the user says "hi" or "hello", reply warmly: "Hello! How can I help you with medicines or health-related questions today?"
2. **Context Awareness:** The user may refer to "this medicine". Use the medicineContext provided to understand what they are looking at.
3. **GraphRAG Reasoning (IMPORTANT):** Answer primarily using the GraphRAG Evidence provided below. If the evidence is weak (Confidence < 40), explicitly tell the user that the information cannot be fully verified in our database. Do NOT invent medical facts. 
4. **Structured Responses:** Organize your answers cleanly with bold headers when appropriate (e.g., **Uses**, **Side Effects**, **Precautions**, **Availability**). Use bullet points.
5. **Medical Safety:** For emergency symptoms, pregnancy, children, allergies, chronic disease, or severe side effects, strictly advise consulting a doctor immediately. Do not give exact dosages without prescription context.
6. **Database Context & Suggestions:** Actively suggest alternatives from our database if mentioned in the GraphRAG evidence. ${contextStr}
7. **Explainability Segment:** At the end of your response, you MUST include a brief section titled "Why this answer?" explaining:
   - Which medicine was detected
   - What graph relationships or inventory data were used
   - Confidence hint (e.g., "High confidence based on verified Knowledge Graph")
   - Any safety warnings applied.
8. **Blockchain & Regulatory Risk Analysis:** If a user scans a medicine, they will see a Trust Score. If the CDSCO (Central Drugs Standard Control Organization) status is "Banned" or "Suspended", strongly warn the user that it is unsafe to consume. Explain that a score of 0-30 means safe, 30-70 means medium risk (e.g., nearing expiry or suspended), and >70 means HIGH RISK counterfeit or banned. Suggest a safe, CDSCO-approved alternative from the DB.
9. **Insurance:** If asked about insurance, explain that PharmaVault provides automatic mock Insurance eligibility checks in the Cart for chronic medicines (like Pantoprazole, Metformin, Amlodipine).
10. **Out-of-context:** If the user asks about movies, coding, politics, or jokes, politely refuse.
11. **Dynamic Suggestions:** At the very end of your response, on a new line, you may optionally provide quick reply buttons for the UI by typing them exactly like this: SUGGESTIONS: Button 1 | Button 2 | Button 3

${graphContextStr}`;

  const primaryModel = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt 
  });
  
  const fallbackModel = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt 
  });

  const formattedHistory = (history || []).map(msg => ({
    role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.text }]
  }));

  const contentPayload = {
    contents: [
      ...formattedHistory,
      { role: 'user', parts: [{ text: messageTrimmed }] }
    ]
  };

  try {
    try {
      // 1. Try Primary Model
      const result = await primaryModel.generateContent(contentPayload);
      const responseText = result.response.text();
      res.status(200).json({ reply: responseText });
    } catch (primaryError) {
      // 2. Try Fallback Model
      const fallbackResult = await fallbackModel.generateContent(contentPayload);
      const responseText = fallbackResult.response.text();
      res.status(200).json({ reply: responseText });
    }
  } catch (finalError) {
    console.error("[AI] Primary and fallback models failed");
    res.status(503).json({ message: 'AI assistant is temporarily busy. Please try again.' });
  }
});

// @desc    Handle Vision OCR Fallback
// @route   POST /api/chat/vision-ocr
const handleVisionOCR = asyncHandler(async (req, res) => {
  const { imageBase64 } = req.body;
  
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    res.status(400); throw new Error('Image is required');
  }

  const mimeTypeMatch = imageBase64.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!mimeTypeMatch) {
    res.status(400); throw new Error('Invalid image format. Only JPEG, PNG, and WebP Base64 strings are accepted.');
  }

  const mimeType = mimeTypeMatch[1];
  const base64Data = mimeTypeMatch[2];
  
  if (!base64Data || base64Data.length % 4 !== 0) {
    res.status(400); throw new Error('Invalid base64 encoding length');
  }

  const decodedBuffer = Buffer.from(base64Data, 'base64');
  if (decodedBuffer.length === 0) {
    res.status(400); throw new Error('Empty image content');
  }
  
  const reEncoded = decodedBuffer.toString('base64').replace(/=+$/, '');
  const originalNoPadding = base64Data.replace(/=+$/, '');
  if (reEncoded !== originalNoPadding) {
    res.status(400); throw new Error('Malformed base64 payload detected');
  }

  if (decodedBuffer.length > 5000000) { // Limit to ~5MB decoded
    res.status(400); throw new Error('Decoded image exceeds size limit of 5MB');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500); throw new Error('Gemini API key is missing');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Using gemini-2.5-flash as the multimodal model
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    const prompt = `Extract all medicine names from this prescription image. 
    Return ONLY a comma-separated list of the medicine names. Do not include dosages, instructions, or any other text. 
    If you cannot read anything, return "NONE".`;

    const imageParts = [
      {
        inlineData: {
          data: base64Data,
          mimeType
        }
      }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();
    
    res.json({ text: responseText });
  } catch (error) {
    console.error("[AI] Vision processing failed");
    res.status(500).json({ message: 'AI Vision failed to process the image.' });
  }
});

module.exports = { handleChat, handleVisionOCR };
