// Reviewed routing vocabulary, not a clinical knowledge base. Only these fixed
// public terms may be submitted to the official web-search tool.
module.exports = Object.freeze([
  { id: 'paracetamol', label: 'Paracetamol', aliases: ['paracetamol', 'acetaminophen'], webTerm: 'acetaminophen' },
  { id: 'metformin', label: 'Metformin', aliases: ['metformin'], webTerm: 'metformin' },
  { id: 'cetirizine', label: 'Cetirizine', aliases: ['cetirizine'], webTerm: 'cetirizine' },
  { id: 'amoxicillin', label: 'Amoxicillin', aliases: ['amoxicillin'], webTerm: 'amoxicillin' },
  { id: 'ibuprofen', label: 'Ibuprofen', aliases: ['ibuprofen'], webTerm: 'ibuprofen' },
  { id: 'atorvastatin', label: 'Atorvastatin', aliases: ['atorvastatin'], webTerm: 'atorvastatin' },
  { id: 'losartan', label: 'Losartan', aliases: ['losartan'], webTerm: 'losartan' },
  { id: 'omeprazole', label: 'Omeprazole', aliases: ['omeprazole'], webTerm: 'omeprazole' },
  { id: 'pantoprazole', label: 'Pantoprazole', aliases: ['pantoprazole'], webTerm: 'pantoprazole' },
  { id: 'azithromycin', label: 'Azithromycin', aliases: ['azithromycin'], webTerm: 'azithromycin' },
  { id: 'medicine-storage', label: 'Medicine storage', aliases: ['medicine storage', 'medication storage', 'store medicines', 'storing medicines'], webTerm: 'medicine storage', concept: true },
  { id: 'medicine-safety', label: 'Medicine safety', aliases: ['medicine safety', 'medication safety', 'drug safety'], webTerm: 'medicine safety', concept: true },
  { id: 'medication-errors', label: 'Medication errors', aliases: ['medication errors', 'medication error', 'medicine errors'], webTerm: 'medication errors', concept: true },
  { id: 'antibiotic-resistance', label: 'Antibiotic resistance', aliases: ['antibiotic resistance', 'antimicrobial resistance'], webTerm: 'antibiotic resistance', concept: true },
  { id: 'generic-medicines', label: 'Generic medicines', aliases: ['generic medicines', 'generic drugs'], webTerm: 'generic drugs', concept: true },
  { id: 'antibiotics', label: 'Antibiotics', aliases: ['antibiotics', 'antibiotic'], webTerm: 'antibiotics', concept: true },
  { id: 'workflow-human-review', label: 'Human-in-the-loop validation', aliases: ['human-in-the-loop validation', 'human in the loop', 'human review', 'hitl'], concept: true, localOnly: true },
  { id: 'workflow-ocr', label: 'Document OCR', aliases: ['ocr', 'document extraction'], concept: true, localOnly: true },
  { id: 'workflow-trustrag', label: 'TrustRAG evidence routing', aliases: ['trustrag', 'evidence routing'], concept: true, localOnly: true },
  { id: 'workflow-freshness', label: 'Answer freshness', aliases: ['answer freshness', 'evidence freshness', 'stale answer', 'stale answers'], concept: true, localOnly: true },
  { id: 'workflow-consistency', label: 'Document consistency', aliases: ['strength mismatch', 'strength discrepancy', 'risk signals', 'risk signal', 'document consistency'], concept: true, localOnly: true },
  { id: 'workflow-identity', label: 'Medicine identity resolution', aliases: ['identity resolution', 'identity matching'], concept: true, localOnly: true }
].map(value => Object.freeze({ ...value, aliases: Object.freeze(value.aliases) })));
