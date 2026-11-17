// Developer-authored synthetic retrieval labels, not clinical answer labels.
module.exports = [
  ['workflow-human-review', 'DEFINITION', 'human-review', ['What is human-in-the-loop validation?', 'Define human review', 'Explain accountable pharmacist review']],
  ['workflow-ocr', 'DEFINITION', 'ocr', ['What is OCR?', 'Define document extraction', 'Explain printed document OCR']],
  ['workflow-consistency', 'DEFINITION', 'strength-mismatch', ['What is a strength mismatch?', 'Define prescription invoice strength discrepancy', 'Explain mismatched medicine strengths']],
  ['workflow-freshness', 'DEFINITION', 'project-answer-freshness-v2', ['What is answer freshness?', 'Define evidence freshness', 'Explain stale answers after correction']],
  ['workflow-trustrag', 'OVERVIEW', 'project-routing-current-v2', ['How does current TrustRAG work?', 'Explain controlled evidence routing', 'Does PharmaVault use public web lookup?']],
  ['paracetamol', 'OVERVIEW', 'nhs-paracetamol-overview', ['What is Paracetamol used for?', 'Explain general Paracetamol information', 'Describe Paracetamol']],
  ['paracetamol', 'SIDE_EFFECTS', 'nhs-paracetamol-effects', ['What are Paracetamol side effects?', 'Explain possible Paracetamol adverse effects', 'Describe Paracetamol risks']],
  ['metformin', 'OVERVIEW', 'nhs-metformin-overview', ['What is Metformin?', 'Explain Metformin general information', 'Describe Metformin']],
  ['metformin', 'SIDE_EFFECTS', 'nhs-metformin-effects', ['What are Metformin side effects?', 'Explain Metformin adverse effects', 'Describe possible Metformin risks']],
  ['antibiotic-resistance', 'DEFINITION', 'reference-antibiotic-resistance-definition', ['What is antibiotic resistance?', 'Define antibiotic resistance', 'Does antibiotic resistance mean the body is resistant?']],
  ['antibiotic-resistance', 'PREVENTION', 'reference-antibiotic-resistance-prevention', ['How can antibiotic resistance be prevented?', 'Explain prevention of antibiotic resistance', 'How to reduce antibiotic resistance?']],
  ['medicine-safety', 'PREVENTION', 'reference-medicine-safety', ['How to prevent medication errors?', 'Explain medicine safety practices', 'How can unclear medicine instructions be checked?']],
  ['medicine-storage', 'OVERVIEW', 'reference-medicine-storage', ['Explain medicine storage safety', 'How should medicine storage be checked?', 'Describe general medicine storage']],
  ['generic-medicines', 'IDENTITY', 'reference-generics', ['Explain generic medicine identity', 'Which attributes distinguish generic medicines?', 'Does a shared generic ingredient prove substitution is appropriate?']]
].map(([topic, focus, sourceKey, queries], index) => ({ id: 'training-family-' + index, topic, focus, sourceKey, queries }));
