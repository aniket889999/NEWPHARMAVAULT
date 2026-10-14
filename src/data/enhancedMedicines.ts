import { Medicine, ActiveIngredient, DrugInteraction } from '../types';

export const enhancedMedicines: Medicine[] = [
  {
    id: 'med-001',
    name: 'Paracetamol',
    genericName: 'Acetaminophen',
    manufacturer: 'Acme Pharma Ltd.',
    category: 'Analgesic & Antipyretic',
    description: 'A widely used over-the-counter pain reliever and fever reducer.',
    dosage: 'Adults: 500-1000mg every 4-6 hours as needed (max 4g per day). Children: Dosage varies by age and weight.',
    strength: '500mg',
    dosageForm: 'Tablet',
    therapeuticClass: 'Non-opioid analgesic',
    prescriptionRequired: false,
    sideEffects: [
      'Nausea (rare)',
      'Stomach pain (with overdose)',
      'Allergic reactions (very rare)',
      'Liver damage (with overdose or chronic use)',
      'Skin rash (rare)'
    ],
    usedFor: [
      'Headache and migraine',
      'Fever reduction',
      'Minor aches and pains',
      'Cold and flu symptoms',
      'Toothache',
      'Menstrual pain',
      'Arthritis pain'
    ],
    alternatives: ['Ibuprofen', 'Aspirin', 'Naproxen', 'Diclofenac'],
    expiryDate: '2025-12-31',
    price: 25.50,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/139398/thermometer-headache-pain-pills-139398.jpeg',
    cdscoDrugCode: 'CDSCO-PAR-001',
    fdaApprovalNumber: 'FDA-ANDA-123456',
    regulatoryStatus: 'approved',
    batchNumber: 'PAR2024001',
    manufacturingDate: '2024-01-15',
    activeIngredients: [
      { name: 'Paracetamol', strength: '500', unit: 'mg' }
    ],
    contraindications: [
      'Severe liver disease',
      'Known hypersensitivity to paracetamol',
      'Chronic alcoholism'
    ],
    interactions: [
      {
        drugName: 'Warfarin',
        severity: 'moderate',
        description: 'May increase anticoagulant effect',
        recommendation: 'Monitor INR levels closely'
      },
      {
        drugName: 'Alcohol',
        severity: 'severe',
        description: 'Increased risk of liver toxicity',
        recommendation: 'Avoid alcohol consumption'
      }
    ],
    pregnancyCategory: 'B',
    pharmacyInventory: [
      {
        pharmacyId: 'ph-001',
        pharmacyName: 'MedPlus Pharmacy',
        location: 'Downtown',
        quantity: 150,
        price: 25.50,
        lastUpdated: new Date('2024-01-20'),
        distance: 0.5
      },
      {
        pharmacyId: 'ph-002',
        pharmacyName: 'Apollo Pharmacy',
        location: 'City Center',
        quantity: 200,
        price: 24.00,
        lastUpdated: new Date('2024-01-19'),
        distance: 1.2
      }
    ]
  },
  {
    id: 'med-002',
    name: 'Amoxicillin',
    genericName: 'Amoxicillin Trihydrate',
    manufacturer: 'MediLabs Pharmaceuticals',
    category: 'Antibiotic',
    description: 'A penicillin antibiotic that fights bacteria in the body.',
    dosage: 'Adults: 250-500mg three times daily. Children: Dosage varies by weight.',
    strength: '500mg',
    dosageForm: 'Capsule',
    therapeuticClass: 'Beta-lactam antibiotic',
    prescriptionRequired: true,
    sideEffects: [
      'Diarrhea',
      'Stomach pain',
      'Nausea and vomiting',
      'Rash',
      'Allergic reactions',
      'Yeast infections',
      'Headache'
    ],
    usedFor: [
      'Bronchitis',
      'Pneumonia',
      'Ear infections',
      'Urinary tract infections',
      'Skin and soft tissue infections',
      'Dental infections',
      'Sinusitis'
    ],
    alternatives: ['Azithromycin', 'Cephalexin', 'Doxycycline', 'Clarithromycin'],
    expiryDate: '2024-08-15',
    price: 149.99,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/3683098/pexels-photo-3683098.jpeg',
    cdscoDrugCode: 'CDSCO-AMX-002',
    fdaApprovalNumber: 'FDA-NDA-789012',
    regulatoryStatus: 'approved',
    batchNumber: 'AMX2024002',
    manufacturingDate: '2024-02-01',
    activeIngredients: [
      { name: 'Amoxicillin Trihydrate', strength: '500', unit: 'mg' }
    ],
    contraindications: [
      'Penicillin allergy',
      'Previous severe allergic reaction to beta-lactam antibiotics',
      'Infectious mononucleosis'
    ],
    interactions: [
      {
        drugName: 'Methotrexate',
        severity: 'severe',
        description: 'May increase methotrexate toxicity',
        recommendation: 'Monitor methotrexate levels and adjust dose'
      },
      {
        drugName: 'Oral contraceptives',
        severity: 'moderate',
        description: 'May reduce contraceptive effectiveness',
        recommendation: 'Use additional contraceptive methods'
      }
    ],
    pregnancyCategory: 'B',
    pharmacyInventory: [
      {
        pharmacyId: 'ph-001',
        pharmacyName: 'MedPlus Pharmacy',
        location: 'Downtown',
        quantity: 75,
        price: 149.99,
        lastUpdated: new Date('2024-01-18'),
        distance: 0.5
      }
    ]
  },
  {
    id: 'med-003',
    name: 'Lisinopril',
    genericName: 'Lisinopril',
    manufacturer: 'Heart Health Inc.',
    category: 'ACE Inhibitor',
    description: 'Used to treat high blood pressure and heart failure.',
    dosage: 'Adults: 10-40mg once daily. Start with lower dose and adjust as needed.',
    strength: '10mg',
    dosageForm: 'Tablet',
    therapeuticClass: 'ACE inhibitor',
    prescriptionRequired: true,
    sideEffects: [
      'Dry cough',
      'Dizziness',
      'Headache',
      'Fatigue',
      'High potassium levels',
      'Low blood pressure',
      'Kidney problems'
    ],
    usedFor: [
      'Hypertension (high blood pressure)',
      'Heart failure',
      'Post heart attack treatment',
      'Kidney protection in diabetes',
      'Left ventricular dysfunction'
    ],
    alternatives: ['Enalapril', 'Ramipril', 'Losartan', 'Valsartan'],
    expiryDate: '2024-10-20',
    price: 299.50,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/4021808/pexels-photo-4021808.jpeg',
    cdscoDrugCode: 'CDSCO-LIS-003',
    fdaApprovalNumber: 'FDA-NDA-345678',
    regulatoryStatus: 'approved',
    batchNumber: 'LIS2024003',
    manufacturingDate: '2024-01-10',
    activeIngredients: [
      { name: 'Lisinopril', strength: '10', unit: 'mg' }
    ],
    contraindications: [
      'Pregnancy',
      'Angioedema history',
      'Bilateral renal artery stenosis',
      'Severe kidney disease'
    ],
    interactions: [
      {
        drugName: 'Potassium supplements',
        severity: 'moderate',
        description: 'May cause hyperkalemia',
        recommendation: 'Monitor potassium levels regularly'
      },
      {
        drugName: 'NSAIDs',
        severity: 'moderate',
        description: 'May reduce antihypertensive effect',
        recommendation: 'Monitor blood pressure closely'
      }
    ],
    pregnancyCategory: 'D',
    pharmacyInventory: [
      {
        pharmacyId: 'ph-002',
        pharmacyName: 'Apollo Pharmacy',
        location: 'City Center',
        quantity: 100,
        price: 299.50,
        lastUpdated: new Date('2024-01-21'),
        distance: 1.2
      }
    ]
  },
  {
    id: 'med-004',
    name: 'Metformin',
    genericName: 'Metformin Hydrochloride',
    manufacturer: 'DiaCare Pharmaceuticals',
    category: 'Antidiabetic',
    description: 'First-line medication for the treatment of type 2 diabetes.',
    dosage: 'Adults: Start with 500mg twice daily with meals, may increase to 1000mg twice daily.',
    strength: '500mg',
    dosageForm: 'Extended-release tablet',
    therapeuticClass: 'Biguanide antidiabetic',
    prescriptionRequired: true,
    sideEffects: [
      'Nausea',
      'Vomiting',
      'Diarrhea',
      'Stomach pain',
      'Metallic taste',
      'Lactic acidosis (rare but serious)',
      'Vitamin B12 deficiency'
    ],
    usedFor: [
      'Type 2 diabetes mellitus',
      'Insulin resistance',
      'Polycystic ovary syndrome (off-label)',
      'Prediabetes prevention'
    ],
    alternatives: ['Glyburide', 'Glipizide', 'Sitagliptin', 'Empagliflozin'],
    expiryDate: '2025-01-15',
    price: 199.99,
    inStock: false,
    imageUrl: 'https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg',
    cdscoDrugCode: 'CDSCO-MET-004',
    fdaApprovalNumber: 'FDA-NDA-901234',
    regulatoryStatus: 'approved',
    batchNumber: 'MET2024004',
    manufacturingDate: '2024-01-05',
    activeIngredients: [
      { name: 'Metformin Hydrochloride', strength: '500', unit: 'mg' }
    ],
    contraindications: [
      'Severe kidney disease',
      'Metabolic acidosis',
      'Diabetic ketoacidosis',
      'Severe liver disease',
      'Heart failure requiring medication'
    ],
    interactions: [
      {
        drugName: 'Contrast dye',
        severity: 'severe',
        description: 'Risk of lactic acidosis',
        recommendation: 'Discontinue before contrast procedures'
      },
      {
        drugName: 'Alcohol',
        severity: 'moderate',
        description: 'Increased risk of lactic acidosis',
        recommendation: 'Limit alcohol consumption'
      }
    ],
    pregnancyCategory: 'B',
    pharmacyInventory: []
  },
  {
    id: 'med-005',
    name: 'Atorvastatin',
    genericName: 'Atorvastatin Calcium',
    manufacturer: 'LipidCare Pharmaceuticals',
    category: 'Statin',
    description: 'Used to lower cholesterol and reduce the risk of heart disease.',
    dosage: 'Adults: 10-80mg once daily. Start with lower dose and adjust as needed.',
    strength: '20mg',
    dosageForm: 'Film-coated tablet',
    therapeuticClass: 'HMG-CoA reductase inhibitor',
    prescriptionRequired: true,
    sideEffects: [
      'Muscle pain',
      'Liver problems',
      'Digestive issues',
      'Headache',
      'Insomnia',
      'Memory problems',
      'Increased blood sugar'
    ],
    usedFor: [
      'High cholesterol',
      'Prevention of heart disease',
      'Stroke prevention',
      'Coronary artery disease',
      'Familial hypercholesterolemia'
    ],
    alternatives: ['Rosuvastatin', 'Simvastatin', 'Pravastatin', 'Lovastatin'],
    expiryDate: '2024-11-30',
    price: 399.99,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/3683101/pexels-photo-3683101.jpeg',
    cdscoDrugCode: 'CDSCO-ATO-005',
    fdaApprovalNumber: 'FDA-NDA-567890',
    regulatoryStatus: 'approved',
    batchNumber: 'ATO2024005',
    manufacturingDate: '2024-01-12',
    activeIngredients: [
      { name: 'Atorvastatin Calcium', strength: '20', unit: 'mg' }
    ],
    contraindications: [
      'Active liver disease',
      'Pregnancy',
      'Breastfeeding',
      'Known hypersensitivity to atorvastatin'
    ],
    interactions: [
      {
        drugName: 'Cyclosporine',
        severity: 'severe',
        description: 'Increased risk of myopathy',
        recommendation: 'Avoid combination or reduce atorvastatin dose'
      },
      {
        drugName: 'Grapefruit juice',
        severity: 'moderate',
        description: 'Increases atorvastatin levels',
        recommendation: 'Avoid large amounts of grapefruit juice'
      }
    ],
    pregnancyCategory: 'X',
    pharmacyInventory: [
      {
        pharmacyId: 'ph-001',
        pharmacyName: 'MedPlus Pharmacy',
        location: 'Downtown',
        quantity: 80,
        price: 399.99,
        lastUpdated: new Date('2024-01-22'),
        distance: 0.5
      },
      {
        pharmacyId: 'ph-002',
        pharmacyName: 'Apollo Pharmacy',
        location: 'City Center',
        quantity: 120,
        price: 389.99,
        lastUpdated: new Date('2024-01-20'),
        distance: 1.2
      }
    ]
  }
];

export const getMedicineById = (id: string): Medicine | undefined => {
  return enhancedMedicines.find(med => med.id === id);
};

export const getMedicineByName = (name: string): Medicine | undefined => {
  return enhancedMedicines.find(med => 
    med.name.toLowerCase() === name.toLowerCase() ||
    med.genericName.toLowerCase() === name.toLowerCase()
  );
};

export const searchMedicines = (query: string): Medicine[] => {
  const searchTerm = query.toLowerCase();
  return enhancedMedicines.filter(med => 
    med.name.toLowerCase().includes(searchTerm) || 
    med.genericName.toLowerCase().includes(searchTerm) ||
    med.category.toLowerCase().includes(searchTerm) ||
    med.manufacturer.toLowerCase().includes(searchTerm) ||
    med.therapeuticClass.toLowerCase().includes(searchTerm) ||
    med.activeIngredients.some(ingredient => 
      ingredient.name.toLowerCase().includes(searchTerm)
    )
  );
};

export const getMedicinesByCategory = (category: string): Medicine[] => {
  return enhancedMedicines.filter(med => 
    med.category.toLowerCase().includes(category.toLowerCase())
  );
};

export const getAlternativeMedicines = (medicineId: string): Medicine[] => {
  const medicine = getMedicineById(medicineId);
  if (!medicine) return [];
  
  return enhancedMedicines.filter(med => 
    med.id !== medicineId && 
    (med.therapeuticClass === medicine.therapeuticClass ||
     med.category === medicine.category)
  );
};

export const checkDrugInteractions = (medicineIds: string[]): DrugInteraction[] => {
  const interactions: DrugInteraction[] = [];
  const medicines = medicineIds.map(id => getMedicineById(id)).filter(Boolean) as Medicine[];
  
  medicines.forEach(medicine => {
    medicine.interactions.forEach(interaction => {
      const interactingMedicine = medicines.find(med => 
        med.name.toLowerCase() === interaction.drugName.toLowerCase() ||
        med.genericName.toLowerCase() === interaction.drugName.toLowerCase()
      );
      
      if (interactingMedicine) {
        interactions.push({
          ...interaction,
          drugName: `${medicine.name} + ${interactingMedicine.name}`
        });
      }
    });
  });
  
  return interactions;
};