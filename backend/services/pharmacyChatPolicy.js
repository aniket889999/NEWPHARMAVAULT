// Deterministic domain boundary, not a medical triage or diagnostic model.
// Run locally before retrieval/model egress. No identity or health text is logged.
const POLICY_VERSION = 'pharmacy-domain-v1';

function routePharmacyQuestion({ message, caseId, resolved }) {
  const current = message.trim();
  const context = resolved.question || current;
  const result = (intent, reasonCode, reply, mode = 'CLARIFY') => ({
    intent, reasonCode, policyVersion: POLICY_VERSION, action: reply ? 'RESPOND' : 'RETRIEVE', reply, mode
  });
  if (/\b(chest pain|can[’']?t breathe|cannot breathe|unable to breathe|difficulty breathing|breathing difficulty|trouble breathing|shortness of breath|overdose|took too much|taken too much|swallowed too much|unconscious|seizure|severe allergic reaction)\b/i.test(current)) {
    return result('EMERGENCY', 'URGENT_SYMPTOMS', 'This may need urgent medical attention. Contact local emergency services or a qualified healthcare professional now. Do not wait for a chatbot response.', 'SAFETY');
  }
  if (/\b(weather|stock market|share market|cryptocurrency|bitcoin|football|cricket|movies?|horoscope|elections?)\b|\b(write|debug|generate)\b.{0,25}\b(code|python|javascript|essay|poem|sql)\b/i.test(current)) {
    return result('OUT_OF_DOMAIN', 'OUTSIDE_PHARMACY_SCOPE', 'I focus on medicine information and prescription, invoice and health-claim evidence. I can’t help with that unrelated topic. What pharmacy or document-verification question would you like to ask?', 'ABSTAIN');
  }
  if (/^(hi|hello|hey|good (morning|evening|afternoon))[!.\s]*$/i.test(current)) {
    return result('WORKFLOW_HELP', 'GREETING', 'Hi! I’m PharmaVault’s pharmacy evidence assistant. I can explain supported medicine references, clarify medicine identity, or help you understand an uploaded verification case. What would you like to check?', 'CONVERSATIONAL_HELP');
  }
  if (/^(thanks|thank you)[!.\s]*$/i.test(current)) return result('WORKFLOW_HELP', 'ACKNOWLEDGEMENT', 'You’re welcome. Ask a follow-up or select a verification case whenever you need to check the evidence.', 'CONVERSATIONAL_HELP');
  if (/\b(dog|cat|pet|veterinary|veterinarian)\b/i.test(current)) return result('CLINICAL_REFERRAL', 'HUMAN_REFERENCE_NOT_VETERINARY', 'These are human medicine references, not veterinary guidance. Please ask a veterinarian about an animal’s treatment.', 'ABSTAIN');
  if (/\b(dosages?(?!\s+(form|strength))|how (many|much).*(take|give)|pregnan\w*|breastfeed\w*|my (baby|child)|diagnos\w*|should i (take|stop|switch)|can i take|is it safe for me|interactions?|banned|regulatory approval|live stock|current price)\b|\b(recommend|prescribe|choose|best)\b.{0,35}\b(medicine|drug|antibiotic|treatment)\b/i.test(context)) {
    return result('CLINICAL_REFERRAL', 'PERSONAL_OR_UNVERIFIED_DECISION', 'I can explain general reference information, but I can’t choose a treatment or dose, diagnose symptoms, confirm personal suitability, or verify live stock or regulatory status. Please ask a qualified pharmacist or doctor for that decision.', 'ABSTAIN');
  }
  if (!caseId && /\bmy\s+(?:verification\s+)?(case|claim|prescription|invoice|bill|rx)\b|\b(our|this)\s+case\b/i.test(current)) {
    return result('CASE_DOCUMENT_QUERY', 'CASE_SELECTION_REQUIRED', 'Which verification case should I use? Select it under Evidence scope first. I won’t treat a general example or chat history as evidence about your documents.');
  }
  // "Now switch to Cetirizine. Can it ...?" changes the conversation topic; it is not a request to swap medicines.
  const withoutTopicSwitch = current.replace(/^\s*(?:ok(?:ay)?[,\s]+)?(?:now\s+)?(?:let[’']?s\s+)?(?:switch|change|move)(?:\s+the)?(?:\s+topic)?\s+to\s+[a-z][\w-]*(?:\s+[a-z][\w-]*)?\s*[.:;!?]\s+(?=\S)/i, '');
  if (/\b(swap|substitute|replace|interchangeable|switch to|take instead)\b/i.test(withoutTopicSwitch)) {
    return result('MEDICINE_IDENTITY', 'SUBSTITUTION_NEEDS_PROFESSIONAL_REVIEW', 'I can compare recorded medicine identities, but I can’t recommend a substitution. What are the exact generic names, strengths and dosage forms shown on the two products? A pharmacist must decide whether substitution is appropriate.');
  }
  const brandOnly = /\b(dolo|crocin|calpol|glycomet|glucophage|cetzine|zyrtec)\b/i.test(current) && !/\b(paracetamol|metformin|cetirizine)\b/i.test(current);
  const identity = /\b(generic|brand|strength|dosage form|ingredient|identity|same medicine)\b/i.test(current);
  if (brandOnly && !/\d\s*(mg|mcg|ml)\b|\b(tablet|capsule|syrup|suspension)\b/i.test(current)) {
    return result('MEDICINE_IDENTITY', 'AMBIGUOUS_BRAND', 'Which strength and dosage form are printed on the product? A brand can have multiple formulations, so the brand name alone is not enough for a reliable identity comparison.');
  }
  if (/\b(compare|difference)\b/i.test(current) && !identity) return result('MEDICINE_IDENTITY', 'COMPARISON_SCOPE_NEEDED', 'Would you like to compare recorded medicine identities or general reference information? I can explain those differences, but I can’t choose a treatment or recommend a substitute.');
  if (identity && !resolved.topics.length) return result('MEDICINE_IDENTITY', 'IDENTITY_REFERENCE_NOT_RESOLVED', 'I couldn’t resolve that medicine to the supported identity references. What exact generic name, brand, strength and dosage form are printed on it? I won’t use a similar-looking medicine as evidence.');
  if (identity) return result('MEDICINE_IDENTITY', 'IDENTITY_LOOKUP');
  if (resolved.topics.length) return result('MEDICINE_EDUCATION', 'SUPPORTED_TOPIC');
  if (/side effects?|symptoms?|\btreat\w*\b|\b(medicine|drug)\b/i.test(current)) {
    return result('MEDICINE_EDUCATION', 'REFERENCE_OR_MEDICINE_NAME_NEEDED', 'What is the exact generic medicine name? My current educational references cover Paracetamol, Metformin, Cetirizine, Amoxicillin and antibiotic basics. I won’t invent information for medicines outside that reference set.');
  }
  if (/\b(pharmavault|trustrag|rag|evidence|ocr|prescription|invoice|claim|pharmacy|pharmacist|review|validation|verify|verification|fhir|nhcx|document|privacy|upload|correction|risk signal)\b/i.test(context)) return result('WORKFLOW_HELP', 'PROJECT_OR_DOCUMENT_EVIDENCE');
  return result('WORKFLOW_HELP', 'QUESTION_NEEDS_FOCUS', 'Would you like medicine information, a medicine identity check, or help with prescription, invoice or claim evidence? Choose one and I’ll use the relevant sources.');
}

module.exports = { routePharmacyQuestion, POLICY_VERSION };
