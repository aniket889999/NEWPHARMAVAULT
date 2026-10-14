const asyncHandler = require('../middleware/asyncHandler');
const hybridRetrievalService = require('../services/hybridRetrievalService');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// @desc    Handle GraphRAG standalone queries
// @route   POST /api/graphrag/query
const handleGraphRAGQuery = asyncHandler(async (req, res) => {
  const { query } = req.body;

  if (!query) {
    res.status(400);
    throw new Error('Query is required');
  }

  // 1. Hybrid Retrieval
  const retrievalResult = await hybridRetrievalService.retrieve(query);

  // 2. Format Context for LLM
  let contextStr = `\n--- GraphRAG Evidence ---\n`;
  if (retrievalResult.graphEvidence.length > 0) {
    contextStr += `Knowledge Graph Data: ${retrievalResult.graphEvidence.join(' | ')}\n`;
  }
  if (retrievalResult.inventoryEvidence.length > 0) {
    contextStr += `Database Inventory: ${retrievalResult.inventoryEvidence.join(' | ')}\n`;
  }
  if (retrievalResult.warnings.length > 0) {
    contextStr += `CRITICAL WARNINGS: ${retrievalResult.warnings.join(' | ')}\n`;
  }

  // 3. Generate Answer
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const systemPrompt = `You are PharmaVault GraphRAG AI. Answer the user's query based ONLY on the evidence provided. 
  If the evidence is weak (confidence < 40), mention that you cannot fully verify the information.
  DO NOT invent medical facts outside the provided evidence.
  Format the answer clearly.
  
  EVIDENCE:
  ${contextStr}`;

  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt 
  });

  const result = await model.generateContent(query);
  const answer = result.response.text();

  res.status(200).json({
    answer,
    detectedMedicine: retrievalResult.detectedMedicines.join(', ') || "None",
    evidence: {
      inventory: retrievalResult.inventoryEvidence,
      graph: retrievalResult.graphEvidence
    },
    confidence: retrievalResult.confidence,
    warnings: retrievalResult.warnings,
    sourcesUsed: retrievalResult.sourcesUsed
  });
});

module.exports = { handleGraphRAGQuery };
