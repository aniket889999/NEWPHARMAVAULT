const { GoogleGenerativeAI } = require('@google/generative-ai');
const deterministicExplainabilityService = require('./deterministicExplainabilityService');
const { buildStructuredEvidencePayload, mapEvidenceAliases } = require('../../config/llmExportPolicy');

/**
 * Server-Side LLM Explainability Service (Optional Adapter)
 * Disabled by default via TRUSTRAG_LLM_ENABLED=false.
 * When enabled, strictly requires grounded EvidenceItem IDs for every finding.
 * Never acts as an automated decision-maker.
 */
class LlmExplainabilityService {
  constructor() {
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  /**
   * Check if LLM integration is explicitly enabled
   */
  isLlmEnabled() {
    return process.env.TRUSTRAG_LLM_ENABLED === 'true' &&
      process.env.TRUSTRAG_LLM_EXPORT_ALLOWED === 'true' &&
      Boolean(process.env.GEMINI_API_KEY);
  }

  /**
   * Generate explanation with fallback to deterministic explanation
   * @param {Object} context Case and evidence context
   * @returns {Promise<Object>} Structured explanation
   */
  async generateExplanation(context) {
    const deterministicFallback = deterministicExplainabilityService.generateExplanation(context);

    // If disabled or insufficient evidence, return deterministic engine output directly
    if (!this.isLlmEnabled() || !deterministicFallback.hasSufficientEvidence) {
      return {
        ...deterministicFallback,
        generatedBy: 'DETERMINISTIC_ENGINE'
      };
    }

    try {
      const llmResult = await this._callGeminiExplainer(context);

      // Strict validation: every statement in findings must cite a valid EvidenceItem ID
      const validEvidenceIds = new Set((context.evidenceItems || []).map(e => e._id ? e._id.toString() : e.id));
      const isValid = this._validateLlmOutput(llmResult, validEvidenceIds);

      if (!isValid) {
        console.warn('[TrustRAG LLM] LLM response contained hallucinated or uncited findings. Falling back to deterministic explanation.');
        return {
          ...deterministicFallback,
          generatedBy: 'DETERMINISTIC_ENGINE (LLM_FALLBACK_UNGROUNDED)'
        };
      }

      return {
        summary: llmResult.summary,
        statusRationale: deterministicFallback.statusRationale,
        findings: llmResult.findings,
        riskSignalsSummary: deterministicFallback.riskSignalsSummary,
        citedEvidenceIds: llmResult.evidenceItemIds,
        uncertainty: llmResult.uncertainty || 'LOW',
        hasSufficientEvidence: true,
        generatedBy: 'SERVER_SIDE_GEMINI_STRUCTURED_SUMMARY',
        disclaimer: deterministicFallback.disclaimer
      };
    } catch (err) {
      // SDK errors may include URLs, prompts or credentials. Never log their content.
      console.warn('[TrustRAG LLM] Structured summary unavailable. Using deterministic fallback.');
      return {
        ...deterministicFallback,
        generatedBy: 'DETERMINISTIC_ENGINE (LLM_ERROR_FALLBACK)'
      };
    }
  }

  /**
   * Send only allow-listed structural results to Gemini. The real evidence IDs
   * stay on this server; aliases are translated back after response validation.
   */
  async _callGeminiExplainer(context) {
    const { payload, aliasToId } = buildStructuredEvidencePayload(context);
    if (payload.checks.length === 0 && payload.signals.length === 0) {
      throw new Error('No exportable structured evidence.');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1500 }
    });

    const prompt = `You are an explainable verification auditor for healthcare documentation consistency.
Summarize only the supplied check statuses and linked risk-signal types.
Source content was intentionally withheld. Do not infer medicine values, names,
dates, diagnoses, regulatory approval, missing document contents or claim decisions.

CRITICAL RULES:
1. Every finding statement MUST cite one or more valid "evidenceId" strings from the provided Evidence Items.
2. DO NOT make claim approval or rejection decisions.
3. DO NOT offer medical advice, diagnosis, or treatment recommendations.
4. If an observation cannot be supported by an Evidence Item, do NOT mention it.
5. Return ONLY a valid JSON object matching this exact schema:

{
  "summary": "High-level neutral case explanation citing key evidence",
  "findings": [
    {
      "statement": "Factual statement describing a check or document finding",
      "evidenceItemIds": ["evidenceId1"],
      "status": "VERIFIED"
    }
  ],
  "evidenceItemIds": ["all cited evidenceId strings"],
  "uncertainty": "LOW" | "MEDIUM" | "HIGH"
}

ALLOW-LISTED STRUCTURED RESULTS:
${JSON.stringify(payload)}
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return mapEvidenceAliases(JSON.parse(text), aliasToId);
  }

  /**
   * Validate that all findings contain valid, non-empty EvidenceItem IDs from the actual set
   */
  _validateLlmOutput(llmResult, validEvidenceIds) {
    if (!llmResult || typeof llmResult !== 'object') return false;
    if (!llmResult.summary || typeof llmResult.summary !== 'string') return false;
    if (!Array.isArray(llmResult.findings) || llmResult.findings.length === 0) return false;
    if (!Array.isArray(llmResult.evidenceItemIds) || llmResult.evidenceItemIds.length === 0) return false;

    // Check every finding
    for (const finding of llmResult.findings) {
      if (!finding.statement || typeof finding.statement !== 'string') return false;
      if (!Array.isArray(finding.evidenceItemIds) || finding.evidenceItemIds.length === 0) return false;

      // Every cited ID must exist in our ground truth set
      for (const id of finding.evidenceItemIds) {
        if (!validEvidenceIds.has(String(id))) {
          return false;
        }
      }
    }

    // Top-level evidenceItemIds must also be valid
    for (const id of llmResult.evidenceItemIds) {
      if (!validEvidenceIds.has(String(id))) {
        return false;
      }
    }

    return true;
  }
}

module.exports = new LlmExplainabilityService();
