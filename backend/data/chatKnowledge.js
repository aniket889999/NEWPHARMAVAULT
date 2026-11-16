// First-party product documentation, not clinical guidelines or live regulation.
// Keep each passage independently attributable and versioned.
module.exports = [
  {
    key: 'workflow', title: 'Verification workflow', version: '2026-11-16',
    text: 'PharmaVault groups a required prescription and pharmacy invoice into one verification case; a health claim form is optional supporting evidence. Create a case, upload the required pair, run local OCR, let authorized staff confirm or correct uncertain extracted fields and medicine grouping, then inspect the current comparison. Uploaded supporting documents also need complete page coverage before verification. The system presents evidence for an accountable human decision and does not automatically approve insurance claims.'
  },
  {
    key: 'human-review', title: 'Human-in-the-loop validation', version: '2026-10-15',
    text: 'Human-in-the-loop validation means an authorized pharmacist or claims reviewer checks extracted fields, source documents and risk signals before making a verification decision. The review actions are Verify, Return for Correction and Escalate. A reason and audit trail record the action. A chatbot answer cannot verify, reject, close or approve a case.'
  },
  {
    key: 'strength-mismatch', title: 'Medicine strength mismatch', version: '2026-10-15',
    text: 'A medicine strength mismatch is a discrepancy between recorded strengths in different documents. In a synthetic example, a prescription says Paracetamol 500 mg while an invoice says Paracetamol 650 mg. The reviewer should inspect the two source passages, correct an OCR error only when the original supports the correction, or escalate an unresolved discrepancy. A mismatch alone does not prove fraud or mean that one strength should be substituted for another.'
  },
  {
    key: 'ocr', title: 'Document upload and OCR correction', version: '2026-10-15',
    text: 'The current verification MVP accepts prescriptions, pharmacy invoices and claim forms as supported images or PDFs. Local Tesseract reads printed English text. OCR may misread medicine names, strengths, quantities, dates or amounts. Low-confidence extraction needs human confirmation against the original. PDF processing is bounded to three pages; omitted pages mean incomplete evidence, not a fully checked document.'
  },
  {
    key: 'medicine-identity', title: 'Medicine identity matching', version: '2026-10-15',
    text: 'Medicine identity resolution compares brand name, generic name, strength and dosage form against a small versioned academic catalogue. Similar brand names or a shared generic ingredient do not establish interchangeable medicines. Unresolved or ambiguous identity needs review. The academic catalogue is not live CDSCO regulatory verification and contains no verified stock, price or prescribing advice.'
  },
  {
    key: 'risk', title: 'Consistency checks and risk signals', version: '2026-10-15',
    text: 'Consistency checks compare medicine names, strengths, dosage forms, quantities and document dates. Risk signals can flag low OCR confidence, missing fields, strength or name mismatch, quantity mismatch, date inconsistency, duplicate-document signals, ambiguous identity and insufficient evidence. A risk signal is a reason to investigate, not proof of tampering, counterfeiting or fraud. Human review remains necessary.'
  },
  {
    key: 'claim', title: 'Health claim and verification scope', version: '2026-10-15',
    text: 'In this project, a health claim is a request for an insurer or health scheme to pay or reimburse healthcare costs. PharmaVault checks consistency of supporting documents. It does not establish policy eligibility, reimbursement entitlement, medical necessity or a final insurance payment decision.'
  },
  {
    key: 'fhir', title: 'Draft FHIR and NHCX export', version: '2026-10-15',
    text: 'PharmaVault can export an academic draft FHIR-style evidence bundle. This is not certified NHCX conformance, an NHCX connection or proof that an insurer will accept the bundle. Formal profile validation and live exchange integration remain separate work.'
  },
  {
    key: 'rag', title: 'How the evidence chatbot retrieves answers', version: '2026-11-09',
    text: 'Retrieval-augmented generation (RAG) retrieves relevant source passages before a model writes an answer. Public Health Assistant chat can combine BM25 keyword retrieval with Gemini embeddings in a bounded in-memory vector index, then use Gemini to explain the retrieved passages with citations. The knowledge includes project guides, academic medicine identities and a small source-linked educational reference set. Private case fields and findings require authorization and stay on the local extractive path. Unsupported questions should produce abstention. This is not live web search, a managed vector database or a clinically validated assistant.'
  },
  {
    key: 'privacy', title: 'Chat privacy and generation modes', version: '2026-11-09',
    text: 'Private case retrieval is restricted to the signed-in case owner or authorized organization staff. Private case passages, raw questions and raw conversation history are not sent to the chatbot external model. Public generation receives allow-listed public passages, filtered topic vocabulary and a fixed intent label, after explicit server-side enablement and public export permission. Local extractive mode quotes passages without using an LLM. Chats are kept only in bounded memory and are cleared on reload or sign-out. Citations establish traceability but do not guarantee semantic or clinical accuracy.'
  }
];
