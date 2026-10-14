const { GoogleGenerativeAI } = require('@google/generative-ai');
const safetyAgent = require('./safetyAgent');
const graphRagAgent = require('./graphRagAgent');
const inventoryAgent = require('./inventoryAgent');
const recommendationAgent = require('./recommendationAgent');
const prescriptionAgent = require('./prescriptionAgent');
const pharmacyIntelligenceAgent = require('./pharmacyIntelligenceAgent');
const patientIntelligenceAgent = require('./patientIntelligenceAgent');
const verificationAgent = require('./verificationAgent');
const { medicineNodes } = require('../graph/medicineGraphData');
const Medicine = require('../models/medicineModel');

class Orchestrator {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  async detectIntentAndEntities(query) {
    const q = query.toLowerCase();
    let intents = new Set();
    
    // Deterministic intent rules
    if (q.match(/available|stock|price|sell/)) intents.add("availability_check");
    if (q.match(/used for|use|what is/)) intents.add("medicine_info");
    if (q.match(/side effect|effects/)) intents.add("side_effects");
    if (q.match(/alternative|substitute/)) intents.add("alternatives");
    if (q.match(/prescription|last prescription/)) intents.add("prescription_question");
    if (q.match(/reorder|low stock/)) intents.add("inventory_question");
    if (q.match(/expiry|expire/)) intents.add("expiry_risk");
    if (q.match(/adherence|missed dose|taking correctly/)) intents.add("patient_adherence");
    if (q.match(/need refill|run out|exhaust/)) intents.add("refill_risk");
    if (q.match(/timeline|recent event/)) intents.add("medicine_timeline");
    if (q.match(/taking|currently taking|active/)) intents.add("active_medicines");
    if (q.match(/insight|behavior/)) intents.add("patient_insights");
    if (q.match(/^(hi|hello|hey|kaise ho|good morning|good evening|thanks|thank you|bye|how are you|hii|heya)[\s!?.]*$/i)) intents.add("casual_conversation");

    let entities = new Set();
    // Deterministic entity matching from GraphRAG aliases/names
    medicineNodes.forEach(node => {
      if (q.includes(node.medicineName.toLowerCase()) || 
          q.includes(node.id) || 
          (node.aliases && node.aliases.some(alias => q.includes(alias)))) {
        entities.add(node.medicineName);
      }
    });

    // Deterministic entity matching from MongoDB
    try {
      const allMedicines = await Medicine.find({}, 'name');
      allMedicines.forEach(m => {
        if (q.includes(m.name.toLowerCase())) {
          entities.add(m.name);
        }
      });
    } catch (e) {
      // Error logging redacted
    }

    try {
      const prompt = `Analyze this query (it could be in English, Hindi, Marathi, or Hinglish): "${query}"
      Classify the intent into ONE of these primary categories:
      CASUAL: "casual_conversation", "greeting", "thanks", "goodbye", "small_talk"
      MEDICAL/PHARMACY: "medicine_info", "symptom_guidance", "availability_check", "side_effects", "alternatives", "prescription_question", "inventory_question", "expiry_risk", "interaction_risk", "emergency", "patient_adherence", "refill_risk", "medicine_timeline", "active_medicines", "patient_insights"
      
      Return ONLY a valid JSON object:
      {
        "intent": "exact_string_from_above_list_or_unknown",
        "entities": ["list of medicine names or symptoms found (translate to english if possible)"]
      }`;
      const result = await this.model.generateContent(prompt);
      let text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(text);
      if (parsed.intent && parsed.intent !== "unknown") intents.add(parsed.intent);
      if (parsed.entities) parsed.entities.forEach(e => entities.add(e));
    } catch(e) {
      // Error logging redacted
    }

    if (intents.size === 0) intents.add("unknown");

    const finalIntent = Array.from(intents).join(' + ');
    const finalEntities = Array.from(entities);

    return { intent: finalIntent, entities: finalEntities };
  }

  async run(query, userRole, userId, tenantContext) {
    const context = {
      query,
      userRole,
      tenantContext,
      intent: "",
      entities: [],
      prescriptionEvidence: null,
      graphEvidence: [],
      inventoryEvidence: [],
      pharmacyEvidence: null,
      patientIntelligenceEvidence: null,
      recommendations: [],
      safetyWarnings: [],
      verification: {},
      confidence: 100,
      agentTrace: []
    };

    context.agentTrace.push("Orchestrator: Received query and initialized context.");

    // Phase 12 - MULTILINGUAL HANDLING
    const languageDetector = require('../language/languageDetector');
    const translationService = require('../language/translationService');
    const multilingualEntityMapper = require('../language/multilingualEntityMapper');
    const multilingualSafetyService = require('../language/multilingualSafetyService');

    const langDetect = await languageDetector.detect(query);
    context.sourceLanguage = langDetect.language;
    context.agentTrace.push(`Language Detector: Detected ${context.sourceLanguage} (${Math.round(langDetect.confidence * 100)}% confidence).`);

    let processingQuery = query;

    // 1. Emergency Pre-Check BEFORE Intent
    const emergencyCheck = multilingualSafetyService.checkEmergency(query);
    if (emergencyCheck.isEmergency) {
       context.safetyWarnings.push('EMERGENCY');
       context.confidence = 100;
       context.verification.verified = true;
       return {
          answer: emergencyCheck.response,
          responseType: 'emergency',
          showTrustLayer: false,
          ...context
       };
    }

    // 2. Intent Detection (On raw query to catch casual accurately)
    const detected = await this.detectIntentAndEntities(query);
    context.intent = detected.intent;
    context.entities = detected.entities;
    context.agentTrace.push(`Orchestrator: Intent detected: ${context.intent}`);
    context.agentTrace.push(`Orchestrator: Entities extracted: [${context.entities.join(', ')}]`);

    const casualIntents = ['casual_conversation', 'greeting', 'thanks', 'goodbye', 'small_talk'];
    const isCasual = casualIntents.some(i => context.intent.includes(i));

    if (isCasual) {
      context.agentTrace.push("Orchestrator: Casual conversation detected. Bypassing medical engines.");
      context.verification.verified = "not_applicable";
      context.confidence = null;
      return await this.generateFinalResponse(context);
    }

    // 3. Multilingual Normalization (Only for medical)
    if (context.sourceLanguage !== 'en') {
      const normalizedQuery = await multilingualEntityMapper.normalize(query, context.sourceLanguage);
      processingQuery = await translationService.translateToEnglish(normalizedQuery, context.sourceLanguage);
      context.agentTrace.push(`Translation Engine: Translated to English -> "${processingQuery}"`);
      
      // Safety Pre-check (English)
      const isEmergencyEng = await safetyAgent.preCheck(context);
      if (isEmergencyEng) {
        context.confidence = 100;
        context.verification.verified = true;
        return await this.generateFinalResponse(context);
      }
    }

    // 3. Parallel Execution of required agents
    const agentPromises = [];
    
    // Always run GraphRAG and Inventory if there are entities
    if (context.entities.length > 0) {
      agentPromises.push(graphRagAgent.process(context));
      agentPromises.push(inventoryAgent.process(context));
    }

    if (context.intent.includes('alternatives') || context.intent.includes('availability_check') || context.intent.includes('symptom_guidance')) {
      agentPromises.push(recommendationAgent.process(context));
    }

    if (context.intent.includes('prescription_question')) {
      agentPromises.push(prescriptionAgent.process(context, userId));
    }

    if (userRole === 'pharmacy' && (context.intent.includes('inventory_question') || context.intent.includes('expiry_risk'))) {
      agentPromises.push(pharmacyIntelligenceAgent.process(context));
    }

    if (context.intent.match(/patient_adherence|refill_risk|medicine_timeline|active_medicines|patient_insights/)) {
      agentPromises.push(
        patientIntelligenceAgent.evaluate(context).then(res => {
          if (res.hasEvidence) {
            context.patientIntelligenceEvidence = res.evidenceString;
            context.patientIntelligenceData = res.evidenceObj;
            context.agentTrace.push("Patient Intelligence Agent: Retrieved behavioral and timeline data.");
          }
        })
      );
    }

    await Promise.all(agentPromises);

    // 4. Verification
    await verificationAgent.process(context);

    // 5. Safety Post-check
    await safetyAgent.postCheck(context);

    // 6. Generate Response
    return await this.generateFinalResponse(context);
  }

  async generateFinalResponse(context) {
    if (context.safetyWarnings.some(w => w.includes('EMERGENCY'))) {
      return {
        answer: `🚨 ${context.safetyWarnings.join(' ')}\n\nPlease contact emergency services immediately.`,
        ...context
      };
    }

    const casualIntents = ['casual_conversation', 'greeting', 'thanks', 'goodbye', 'small_talk'];
    const isCasual = casualIntents.some(i => context.intent.includes(i));
    
    let systemPrompt;
    
    if (isCasual) {
      systemPrompt = `You are the PharmaVault Health Assistant. The user is starting a casual conversation, greeting, or small talk.
      Your task is to respond NATURALLY in the EXACT SAME LANGUAGE AND STYLE as the user's query (e.g. if Hinglish, reply in Hinglish. If Marathi, reply in Marathi. If Hindi, reply in Hindi).
      Be polite, friendly, and brief. Ask how you can help them with their health or medicines. Do NOT provide medical advice.
      User Query: "${context.query}"`;
    } else {
      systemPrompt = `You are the PharmaVault AI Orchestrator. Provide a final response to the user's query based ONLY on the evidence provided below.
      Respond NATURALLY in the EXACT SAME LANGUAGE AND STYLE as the user's original query (e.g., if Hinglish, reply in Hinglish. If Marathi, reply in Marathi).
      If the Verification Status is "Unverified", inform the user that you cannot guarantee the accuracy of the answer.
      If you are recommending medicines for a symptom, ALWAYS include a safe disclaimer (e.g., "dosage doctor/pharmacist se confirm karein"). Do NOT give exact dosage unless prescription evidence exists.
      
      Query: "${context.query}"
      Intent: ${context.intent}
      Verification Status: ${context.verification.verified ? "Verified" : "Unverified"}
      Confidence: ${context.confidence}%
      
      EVIDENCE:\n`;

      if (context.graphEvidence.length > 0) systemPrompt += `- GraphRAG: ${context.graphEvidence.join(' | ')}\n`;
      if (context.inventoryEvidence.length > 0) systemPrompt += `- Inventory: ${context.inventoryEvidence.join(' | ')}\n`;
      if (context.recommendations.length > 0) systemPrompt += `- Recommendations: ${context.recommendations.join(' | ')}\n`;
      if (context.safetyWarnings.length > 0) systemPrompt += `- Safety Warnings: ${context.safetyWarnings.join(' | ')}\n`;
      if (context.prescriptionEvidence) systemPrompt += `- Prescriptions: ${JSON.stringify(context.prescriptionEvidence)}\n`;
      if (context.pharmacyEvidence) systemPrompt += `- Pharmacy Metrics: ${JSON.stringify(context.pharmacyEvidence)}\n`;
      if (context.patientIntelligenceEvidence) systemPrompt += `- Patient Intelligence: ${context.patientIntelligenceEvidence}\n`;

      if (!context.verification.verified) {
         systemPrompt += `\nUnverified Claims: ${context.verification.unsupportedClaims.join(', ')}`;
      }
    }

    let finalAnswer = "";
    try {
      const result = await this.model.generateContent(systemPrompt);
      finalAnswer = result.response.text();
      context.agentTrace.push("Orchestrator: Final response generated.");
    } catch(e) {
      
      let fallbackAnswer = "";
      let hasData = false;

      if (context.graphEvidence.length > 0) {
        fallbackAnswer += context.graphEvidence.join(' ') + " ";
        hasData = true;
      }
      if (context.inventoryEvidence.length > 0) {
        fallbackAnswer += context.inventoryEvidence.join(' ') + " ";
        hasData = true;
      }
      if (context.recommendations.length > 0) {
        fallbackAnswer += context.recommendations.join(' ') + " ";
        hasData = true;
      }
      if (context.prescriptionEvidence) {
        fallbackAnswer += `According to your latest prescription dated ${context.prescriptionEvidence.date}, you were prescribed: ${context.prescriptionEvidence.medicines}. `;
        hasData = true;
      }
      if (context.pharmacyEvidence) {
        fallbackAnswer += `Pharmacy Dashboard Data: Low Stock Items: ${context.pharmacyEvidence.lowStock.join(', ') || 'None'}. Expiring Soon: ${context.pharmacyEvidence.expiringSoon.join(', ') || 'None'}. `;
        hasData = true;
      }
      
      if (!hasData) {
          fallbackAnswer = "I apologize, but my generation engine encountered an error, and I could not retrieve specific data to answer your query. Please try asking in a different way.";
      } else {
          fallbackAnswer += "\n\n*(Note: This is a system-generated summary based on available data as the natural language engine is currently overloaded. Please consult a pharmacist before substituting medicines.)*";
      }
      
      if (context.verification.verified === true) {
         context.verification.verified = 'partially';
         context.verification.unsupportedClaims.push("Natural language generation failed; utilizing exact data fallback.");
      }
      
      context.agentTrace.push("Orchestrator: Generated deterministic fallback response.");
      finalAnswer = fallbackAnswer.trim();
    }

    const casualIntents2 = ['casual_conversation', 'greeting', 'thanks', 'goodbye', 'small_talk'];
    if (casualIntents2.some(i => context.intent.includes(i))) {
      return {
        answer: finalAnswer,
        query: context.query,
        userRole: context.userRole,
        intent: context.intent,
        verified: "not_applicable",
        confidence: null,
        responseType: "casual",
        showTrustLayer: false,
        agentTrace: context.agentTrace
      };
    }

    // Phase 11 - SAFETY ENGINE VERIFICATION (Post-Generation)
    const claimExtractor = require('../safety/claimExtractor');
    const evidenceConsistencyChecker = require('../safety/evidenceConsistencyChecker');
    const hallucinationDetector = require('../safety/hallucinationDetector');
    const medicalRiskClassifier = require('../safety/medicalRiskClassifier');
    const contradictionDetector = require('../safety/contradictionDetector');
    const confidenceCalibrator = require('../safety/confidenceCalibrator');
    const humanReviewEngine = require('../safety/humanReviewEngine');
    const safetyPolicyEngine = require('../safety/safetyPolicyEngine');
    const safetyAuditLogger = require('../safety/safetyAuditLogger');

    const claims = claimExtractor.extractClaims(finalAnswer, context);
    const consistency = evidenceConsistencyChecker.checkConsistency(claims, context);
    const hallucinationRisk = hallucinationDetector.detect(consistency, context);
    const riskClass = medicalRiskClassifier.classify(context.query, finalAnswer, context);
    const contradictionFlags = contradictionDetector.detect(consistency, finalAnswer, context);
    
    const explainabilityService = require('../services/explainabilityService');
    const explanation = explainabilityService.generateExplanation(context);
    
    // Calibrate Confidence
    const calibration = confidenceCalibrator.calibrate(explanation.confidenceBreakdown.finalConfidence, hallucinationRisk, riskClass);
    explanation.confidenceBreakdown.finalConfidence = calibration.calibratedConfidence;
    context.confidence = calibration.calibratedConfidence;

    // Human Review
    const reviewStatus = humanReviewEngine.evaluate(hallucinationRisk, riskClass, contradictionFlags, context);

    // Policy Enforcement (overwrites answer if needed)
    finalAnswer = safetyPolicyEngine.applyPolicies(finalAnswer, riskClass, context);

    // Attach Safety Data to Context
    context.safetyData = {
      hallucinationRisk,
      riskClass,
      unsupportedClaims: consistency.unsupportedClaims,
      contradictionFlags,
      reviewRequired: reviewStatus.reviewRequired,
      reviewReason: reviewStatus.reviewReason,
      calibrationReason: calibration.calibrationReason
    };

    // Update explanation payload
    context.explanation = {
      ...explanation,
      safetyData: context.safetyData
    };

    context.agentTrace.push(`Safety Engine: Risk=${riskClass}, Hallucination=${hallucinationRisk}, Confidence=${context.confidence}%`);

    // Phase 13 - WORKFLOW AUTOMATION TRIGGER
    if (hallucinationRisk === 'High' || contradictionFlags.length > 0) {
      try {
        const workflowEngine = require('../workflows/workflowEngine');
        await workflowEngine.triggerEvent(
          contradictionFlags.length > 0 ? 'contradiction_detected' : 'hallucination_risk_high',
          context
        );
        context.agentTrace.push(`Workflow Engine: Triggered escalation workflow due to safety flags.`);
      } catch (wfError) {
        // Redacted workflow engine error
      }
    }

    // Log Audit
    if (context.userRole) {
      await safetyAuditLogger.log({
        userRole: context.userRole,
        query: context.query,
        answer: finalAnswer,
        riskLevel: riskClass,
        hallucinationRisk,
        confidence: context.confidence,
        unsupportedClaims: consistency.unsupportedClaims.map(c => c.claim),
        contradictionFlags,
        reviewRequired: reviewStatus.reviewRequired,
        reviewReason: reviewStatus.reviewReason,
        agentTrace: context.agentTrace
      });
    }

    return {
      answer: finalAnswer,
      responseType: "medical",
      showTrustLayer: true,
      tenantContext: context.tenantContext,
      ...context
    };
  }
}

module.exports = new Orchestrator();
