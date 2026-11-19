// Routing vocabulary, not a clinical knowledge base. Only fixed generic public
// terms may enter web search. Brand aliases are recognition hints only: the
// brand boundary asks for label confirmation, never ingredient equivalence.
const baseTopics = [
  { id: 'paracetamol', label: 'Paracetamol', aliases: ['paracetamol', 'acetaminophen'], brandAliases: ['dolo', 'dolo 650', 'crocin', 'calpol'], webTerm: 'acetaminophen' },
  { id: 'metformin', label: 'Metformin', aliases: ['metformin'], brandAliases: ['glycomet'], webTerm: 'metformin' },
  { id: 'cetirizine', label: 'Cetirizine', aliases: ['cetirizine'], brandAliases: ['cetzine', 'okacet'], webTerm: 'cetirizine' },
  { id: 'amoxicillin', label: 'Amoxicillin', aliases: ['amoxicillin'], brandAliases: ['augmentin'], webTerm: 'amoxicillin' },
  { id: 'ibuprofen', label: 'Ibuprofen', aliases: ['ibuprofen'], brandAliases: ['brufen', 'combiflam'], webTerm: 'ibuprofen' },
  { id: 'atorvastatin', label: 'Atorvastatin', aliases: ['atorvastatin'], brandAliases: ['atorva', 'lipitor'], webTerm: 'atorvastatin' },
  { id: 'losartan', label: 'Losartan', aliases: ['losartan'], webTerm: 'losartan' },
  { id: 'omeprazole', label: 'Omeprazole', aliases: ['omeprazole'], brandAliases: ['omez'], webTerm: 'omeprazole' },
  { id: 'pantoprazole', label: 'Pantoprazole', aliases: ['pantoprazole'], brandAliases: ['pan 40', 'pantocid'], webTerm: 'pantoprazole' },
  { id: 'azithromycin', label: 'Azithromycin', aliases: ['azithromycin'], brandAliases: ['azee', 'azithral'], webTerm: 'azithromycin' },
  { id: 'amlodipine', label: 'Amlodipine', aliases: ['amlodipine'], brandAliases: ['amlong', 'stamlo'], webTerm: 'amlodipine' },
  { id: 'levothyroxine', label: 'Levothyroxine', aliases: ['levothyroxine'], brandAliases: ['thyronorm', 'eltroxin'], webTerm: 'levothyroxine' },
  { id: 'montelukast', label: 'Montelukast', aliases: ['montelukast'], brandAliases: ['montair'], webTerm: 'montelukast' },
  { id: 'ondansetron', label: 'Ondansetron', aliases: ['ondansetron'], brandAliases: ['emeset'], webTerm: 'ondansetron' },
  { id: 'aspirin', label: 'Aspirin', aliases: ['aspirin'], brandAliases: ['ecosprin', 'disprin'], webTerm: 'aspirin' },
  { id: 'diclofenac', label: 'Diclofenac', aliases: ['diclofenac'], brandAliases: ['voveran'], webTerm: 'diclofenac' },
  { id: 'telmisartan', label: 'Telmisartan', aliases: ['telmisartan'], brandAliases: ['telma'], webTerm: 'telmisartan' },
  { id: 'insulin', label: 'Insulin', aliases: ['insulin'], webTerm: 'insulin' },
  { id: 'iron-supplements', label: 'Ferrous sulfate (iron supplement)', aliases: ['iron tablets', 'iron supplement', 'ferrous sulfate'], webTerm: 'ferrous sulfate' },
  // Common symptoms and conditions (answered from the approved MedlinePlus health-topic pages).
  { id: 'fever', label: 'Fever', aliases: ['fever', 'high temperature', 'bukhar'], webTerm: 'fever', concept: true },
  { id: 'cough', label: 'Cough', aliases: ['cough', 'coughing', 'dry cough', 'wet cough'], webTerm: 'cough', concept: true },
  { id: 'common-cold', label: 'Common cold', aliases: ['common cold', 'cold and flu', 'runny nose', 'blocked nose'], webTerm: 'common cold', concept: true },
  { id: 'headache', label: 'Headache', aliases: ['headache', 'headaches', 'head ache'], webTerm: 'headache', concept: true },
  { id: 'migraine', label: 'Migraine', aliases: ['migraine', 'migraines'], webTerm: 'migraine', concept: true },
  { id: 'heartburn', label: 'Acidity and heartburn', aliases: ['acidity', 'heartburn', 'acid reflux', 'gerd'], webTerm: 'heartburn', concept: true },
  { id: 'diarrhea', label: 'Diarrhoea', aliases: ['diarrhea', 'diarrhoea', 'loose motion', 'loose motions'], webTerm: 'diarrhea', concept: true },
  { id: 'high-blood-pressure', label: 'High blood pressure', aliases: ['high blood pressure', 'hypertension'], webTerm: 'high blood pressure', concept: true },
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
];
const directory = require('./nhsMedicineDirectory.v1.json');
const baseNames = new Set(baseTopics.flatMap(value => value.aliases));
const additions = directory.records.filter(value => /^[a-z0-9-]{3,90}$/.test(value.slug) && typeof value.label === 'string' && value.label.length <= 160 && !/\bsee\b/i.test(value.label))
  .filter(value => !baseNames.has(value.label.toLowerCase()) && !['paracetamol-for-adults', 'ibuprofen-for-adults', 'ferrous-sulfate'].includes(value.slug))
  .map(value => {
    const label = value.label.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const generic = label.split(/\s+for\s+/i)[0];
    // A qualified child/product page must not claim an existing generic alias.
    // Explicit longer names still win in the resolver; bare paracetamol must
    // not silently become the children's formulation (or an ambiguous pair).
    return { id: 'nhs-' + value.slug, label, aliases: [...new Set([label.toLowerCase(), ...(generic.length >= 4 && !baseNames.has(generic.toLowerCase()) ? [generic.toLowerCase()] : [])])],
      webTerm: label.toLowerCase(), officialMedicineRoot: 'https://www.nhs.uk/medicines/' + value.slug + '/', directorySource: directory.sourceUrl };
  });
module.exports = Object.freeze([...baseTopics, ...additions].map(value => Object.freeze({ ...value,
  strictWebTopic: ['fever', 'cough', 'common-cold', 'headache', 'migraine', 'heartburn', 'diarrhea', 'high-blood-pressure'].includes(value.id),
  aliases: Object.freeze(value.aliases), brandAliases: Object.freeze(value.brandAliases || []) })));
