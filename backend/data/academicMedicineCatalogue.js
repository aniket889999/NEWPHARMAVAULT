/**
 * PharmaVault Curated Academic Medicine Catalogue
 *
 * IMPORTANT ACADEMIC BOUNDARY:
 * Curated academic reference catalogue — not live regulatory verification.
 * This is a curated academic MVP catalogue, not a live CDSCO, NHCX, AB-PMJAY,
 * or national medicine database. Does not scrape the web or perform live lookups.
 */

const ACADEMIC_CATALOGUE_VERSION = '2026.1-academic';
const ACADEMIC_SOURCE_NOTE = 'Curated academic reference catalogue — not live regulatory verification.';

const ACADEMIC_MEDICINE_CATALOGUE = [
  // 1. Paracetamol (Analgesic & Antipyretic)
  {
    brandName: 'Crocin 500',
    genericName: 'Paracetamol',
    strength: '500mg',
    strengthUnit: 'mg',
    dosageForm: 'Tablet',
    manufacturer: 'GlaxoSmithKline Pharmaceuticals',
    aliases: [
      'Crocin',
      'Crocin 500mg',
      'Crocin Advance',
      'Paracetamol 500',
      'Paracetamol 500mg',
      'Pacimol 500',
      'Dolo 500',
      'Calpol 500'
    ],
    regulatoryIdentifiers: ['ACAD-PARA-500-TAB'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },
  {
    brandName: 'Dolo 650',
    genericName: 'Paracetamol',
    strength: '650mg',
    strengthUnit: 'mg',
    dosageForm: 'Tablet',
    manufacturer: 'Micro Labs',
    aliases: [
      'Dolo',
      'Dolo 650mg',
      'Crocin 650',
      'Calpol 650',
      'Pacimol 650',
      'Paracetamol 650',
      'Paracetamol 650mg'
    ],
    regulatoryIdentifiers: ['ACAD-PARA-650-TAB'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },
  {
    brandName: 'Calpol Suspension',
    genericName: 'Paracetamol',
    strength: '120mg/5ml',
    strengthUnit: 'mg/5ml',
    dosageForm: 'Syrup',
    manufacturer: 'GlaxoSmithKline Pharmaceuticals',
    aliases: [
      'Calpol Paediatric',
      'Calpol Syrup',
      'Paracetamol Syrup',
      'Paracetamol Suspension',
      'Calpol 120mg/5ml'
    ],
    regulatoryIdentifiers: ['ACAD-PARA-120-SYR'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },

  // 2. Metformin (Antidiabetic)
  {
    brandName: 'Glycomet 500',
    genericName: 'Metformin',
    strength: '500mg',
    strengthUnit: 'mg',
    dosageForm: 'Tablet',
    manufacturer: 'USV Private Limited',
    aliases: [
      'Glycomet',
      'Glycomet 500mg',
      'Metformin 500',
      'Metformin 500mg',
      'Obimet 500',
      'Glucophage 500',
      'Cetapin 500'
    ],
    regulatoryIdentifiers: ['ACAD-MET-500-TAB'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },
  {
    brandName: 'Glycomet 850',
    genericName: 'Metformin',
    strength: '850mg',
    strengthUnit: 'mg',
    dosageForm: 'Tablet',
    manufacturer: 'USV Private Limited',
    aliases: [
      'Glycomet 850mg',
      'Metformin 850',
      'Metformin 850mg',
      'Obimet 850'
    ],
    regulatoryIdentifiers: ['ACAD-MET-850-TAB'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },

  // 3. Cetirizine (Antihistamine)
  {
    brandName: 'Okacet',
    genericName: 'Cetirizine',
    strength: '10mg',
    strengthUnit: 'mg',
    dosageForm: 'Tablet',
    manufacturer: 'Cipla',
    aliases: [
      'Okacet 10',
      'Okacet 10mg',
      'Cetirizine 10mg',
      'Cetzine 10',
      'Cetzine',
      'Alerid 10',
      'Zyrtec 10'
    ],
    regulatoryIdentifiers: ['ACAD-CET-10-TAB'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },
  {
    brandName: 'Okacet Syrup',
    genericName: 'Cetirizine',
    strength: '5mg/5ml',
    strengthUnit: 'mg/5ml',
    dosageForm: 'Syrup',
    manufacturer: 'Cipla',
    aliases: [
      'Cetirizine Syrup',
      'Cetzine Syrup',
      'Alerid Syrup',
      'Okacet 5mg/5ml'
    ],
    regulatoryIdentifiers: ['ACAD-CET-5-SYR'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },

  // 4. Azithromycin (Antibiotic)
  {
    brandName: 'Azee 500',
    genericName: 'Azithromycin',
    strength: '500mg',
    strengthUnit: 'mg',
    dosageForm: 'Tablet',
    manufacturer: 'Cipla',
    aliases: [
      'Azee',
      'Azee 500mg',
      'Azithral 500',
      'Azithral 500mg',
      'Zady 500',
      'Azithromycin 500mg',
      'Zithromax 500'
    ],
    regulatoryIdentifiers: ['ACAD-AZI-500-TAB'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },
  {
    brandName: 'Azithral 250',
    genericName: 'Azithromycin',
    strength: '250mg',
    strengthUnit: 'mg',
    dosageForm: 'Tablet',
    manufacturer: 'Alembic Pharmaceuticals',
    aliases: [
      'Azee 250',
      'Azithral 250mg',
      'Azithromycin 250mg',
      'Zady 250'
    ],
    regulatoryIdentifiers: ['ACAD-AZI-250-TAB'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },

  // 5. Pantoprazole (Proton Pump Inhibitor)
  {
    brandName: 'Pan 40',
    genericName: 'Pantoprazole',
    strength: '40mg',
    strengthUnit: 'mg',
    dosageForm: 'Tablet',
    manufacturer: 'Alkem Laboratories',
    aliases: [
      'Pan',
      'Pan 40mg',
      'Pantocid 40',
      'Pantodac 40',
      'Pantoprazole 40mg',
      'Protonix 40'
    ],
    regulatoryIdentifiers: ['ACAD-PAN-40-TAB'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },
  {
    brandName: 'Pan D',
    genericName: 'Pantoprazole + Domperidone',
    strength: '40mg/30mg',
    strengthUnit: 'mg',
    dosageForm: 'Capsule',
    manufacturer: 'Alkem Laboratories',
    aliases: [
      'Pan-D',
      'Pantocid D',
      'Pantodac DSR',
      'Pantoprazole Domperidone'
    ],
    regulatoryIdentifiers: ['ACAD-PAND-CAP'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },

  // 6. Amoxicillin + Clavulanic Acid (Broad Spectrum Antibacterial)
  {
    brandName: 'Augmentin 625 Duo',
    genericName: 'Amoxicillin + Clavulanic Acid',
    strength: '625mg',
    strengthUnit: 'mg',
    dosageForm: 'Tablet',
    manufacturer: 'GlaxoSmithKline Pharmaceuticals',
    aliases: [
      'Augmentin',
      'Augmentin 625',
      'Augmentin 625mg',
      'Moxclav 625',
      'Clavam 625',
      'Amoxyclav 625'
    ],
    regulatoryIdentifiers: ['ACAD-AUG-625-TAB'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },
  {
    brandName: 'Augmentin DDS Suspension',
    genericName: 'Amoxicillin + Clavulanic Acid',
    strength: '228.5mg/5ml',
    strengthUnit: 'mg/5ml',
    dosageForm: 'Suspension',
    manufacturer: 'GlaxoSmithKline Pharmaceuticals',
    aliases: [
      'Augmentin Syrup',
      'Augmentin Dry Syrup',
      'Moxclav Suspension',
      'Clavam Suspension'
    ],
    regulatoryIdentifiers: ['ACAD-AUG-228-SUSP'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },

  // 7. Atorvastatin (Lipid-lowering HMG-CoA reductase inhibitor)
  {
    brandName: 'Atorva 10',
    genericName: 'Atorvastatin',
    strength: '10mg',
    strengthUnit: 'mg',
    dosageForm: 'Tablet',
    manufacturer: 'Zydus Cadila',
    aliases: [
      'Atorva',
      'Atorva 10mg',
      'Storvas 10',
      'Lipikind 10',
      'Atorvastatin 10mg',
      'Lipitor 10'
    ],
    regulatoryIdentifiers: ['ACAD-ATOR-10-TAB'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },
  {
    brandName: 'Atorva 20',
    genericName: 'Atorvastatin',
    strength: '20mg',
    strengthUnit: 'mg',
    dosageForm: 'Tablet',
    manufacturer: 'Zydus Cadila',
    aliases: [
      'Atorva 20mg',
      'Storvas 20',
      'Lipikind 20',
      'Atorvastatin 20mg',
      'Lipitor 20'
    ],
    regulatoryIdentifiers: ['ACAD-ATOR-20-TAB'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },

  // 8. Losartan (Angiotensin II Receptor Blocker - Antihypertensive)
  {
    brandName: 'Losar 50',
    genericName: 'Losartan',
    strength: '50mg',
    strengthUnit: 'mg',
    dosageForm: 'Tablet',
    manufacturer: 'Unichem Laboratories',
    aliases: [
      'Losar',
      'Losar 50mg',
      'Repace 50',
      'Tozaar 50',
      'Losartan 50mg',
      'Cozaar 50'
    ],
    regulatoryIdentifiers: ['ACAD-LOS-50-TAB'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  },

  // 9. Omeprazole (Proton Pump Inhibitor)
  {
    brandName: 'Omez 20',
    genericName: 'Omeprazole',
    strength: '20mg',
    strengthUnit: 'mg',
    dosageForm: 'Capsule',
    manufacturer: "Dr. Reddy's Laboratories",
    aliases: [
      'Omez',
      'Omez 20mg',
      'Ocid 20',
      'Omecip 20',
      'Omeprazole 20mg',
      'Prilosec 20'
    ],
    regulatoryIdentifiers: ['ACAD-OMZ-20-CAP'],
    sourceVersion: ACADEMIC_CATALOGUE_VERSION,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  }
];

module.exports = {
  ACADEMIC_CATALOGUE_VERSION,
  ACADEMIC_SOURCE_NOTE,
  ACADEMIC_MEDICINE_CATALOGUE
};
