import { Medicine } from '../types';

export const medicines = [
  {
    id: 'med-001',
    name: 'Paracetamol',
    manufacturer: 'Acme Pharma',
    category: 'Analgesic',
    description: 'A common pain reliever and fever reducer.',
    dosage: 'Adults: 500-1000mg every 4-6 hours as needed (max 4g per day). Children: Dosage varies by age and weight.',
    sideEffects: [
      'Nausea',
      'Stomach pain',
      'Allergic reactions (rare)',
      'Liver damage (with overdose)'
    ],
    usedFor: [
      'Headache',
      'Fever',
      'Minor aches and pains',
      'Cold and flu symptoms',
      'Toothache'
    ],
    alternatives: ['Ibuprofen', 'Aspirin', 'Naproxen'],
    expiryDate: '2024-12-31',
    price: 25.50,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/139398/thermometer-headache-pain-pills-139398.jpeg'
  },
  {
    id: 'med-002',
    name: 'Amoxicillin',
    manufacturer: 'MediLabs',
    category: 'Antibiotic',
    description: 'A penicillin antibiotic that fights bacteria in the body.',
    dosage: 'Adults: 250-500mg three times daily. Children: Dosage varies by weight.',
    sideEffects: [
      'Diarrhea',
      'Stomach pain',
      'Nausea',
      'Vomiting',
      'Rash',
      'Allergic reactions'
    ],
    usedFor: [
      'Bronchitis',
      'Pneumonia',
      'Ear infections',
      'Urinary tract infections',
      'Skin infections'
    ],
    alternatives: ['Azithromycin', 'Cephalexin', 'Doxycycline'],
    expiryDate: '2024-08-15',
    price: 149.99,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/3683098/pexels-photo-3683098.jpeg'
  },
  {
    id: 'med-003',
    name: 'Lisinopril',
    manufacturer: 'Heart Health Inc.',
    category: 'ACE Inhibitor',
    description: 'Used to treat high blood pressure and heart failure.',
    dosage: 'Adults: 10-40mg once daily. Start with lower dose and adjust as needed.',
    sideEffects: [
      'Dry cough',
      'Dizziness',
      'Headache',
      'Fatigue',
      'High potassium levels'
    ],
    usedFor: [
      'Hypertension (high blood pressure)',
      'Heart failure',
      'Post heart attack treatment',
      'Kidney protection in diabetes'
    ],
    alternatives: ['Enalapril', 'Ramipril', 'Losartan'],
    expiryDate: '2024-10-20',
    price: 299.50,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/4021808/pexels-photo-4021808.jpeg'
  },
  {
    id: 'med-004',
    name: 'Metformin',
    manufacturer: 'DiaCare',
    category: 'Antidiabetic',
    description: 'First-line medication for the treatment of type 2 diabetes.',
    dosage: 'Adults: Start with 500mg twice daily with meals, may increase to 1000mg twice daily.',
    sideEffects: [
      'Nausea',
      'Vomiting',
      'Diarrhea',
      'Stomach pain',
      'Metallic taste',
      'Lactic acidosis (rare but serious)'
    ],
    usedFor: [
      'Type 2 diabetes',
      'Insulin resistance',
      'Polycystic ovary syndrome (off-label)'
    ],
    alternatives: ['Glyburide', 'Glipizide', 'Sitagliptin'],
    expiryDate: '2025-01-15',
    price: 199.99,
    inStock: false,
    imageUrl: 'https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg'
  },
  {
    id: 'med-005',
    name: 'Atorvastatin',
    manufacturer: 'LipidCare Pharmaceuticals',
    category: 'Statin',
    description: 'Used to lower cholesterol and reduce the risk of heart disease.',
    dosage: 'Adults: 10-80mg once daily. Start with lower dose and adjust as needed.',
    sideEffects: [
      'Muscle pain',
      'Liver problems',
      'Digestive issues',
      'Headache',
      'Insomnia'
    ],
    usedFor: [
      'High cholesterol',
      'Prevention of heart disease',
      'Stroke prevention',
      'Coronary artery disease'
    ],
    alternatives: ['Rosuvastatin', 'Simvastatin', 'Pravastatin'],
    expiryDate: '2024-11-30',
    price: 399.99,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/3683101/pexels-photo-3683101.jpeg'
  },
  {
    id: 'med-006',
    name: 'Azithromycin',
    manufacturer: 'ZithroCare',
    category: 'Antibiotic',
    description: 'A macrolide antibiotic used to treat various bacterial infections.',
    dosage: 'Adults: 500mg daily for 3 days or 500mg day 1, then 250mg days 2-5.',
    sideEffects: ['Nausea', 'Vomiting', 'Diarrhea', 'Abdominal pain'],
    usedFor: ['Respiratory infections', 'Skin infections', 'Ear infections'],
    alternatives: ['Clarithromycin', 'Erythromycin', 'Amoxicillin'],
    expiryDate: '2025-02-14',
    price: 245.00,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg'
  },
  {
    id: 'med-007',
    name: 'Pantoprazole',
    manufacturer: 'GastroMed',
    category: 'Gastrointestinal',
    description: 'Proton pump inhibitor used to decrease stomach acid.',
    dosage: 'Adults: 40mg once daily before a meal.',
    sideEffects: ['Headache', 'Diarrhea', 'Stomach pain', 'Gas'],
    usedFor: ['GERD', 'Stomach ulcers', 'Acid reflux'],
    alternatives: ['Omeprazole', 'Esomeprazole', 'Lansoprazole'],
    expiryDate: '2025-06-20',
    price: 130.50,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/139398/thermometer-headache-pain-pills-139398.jpeg'
  },
  {
    id: 'med-008',
    name: 'Levothyroxine',
    manufacturer: 'EndoHealth',
    category: 'Hormone',
    description: 'Synthetic thyroid hormone used to treat hypothyroidism.',
    dosage: 'Adults: 50-100mcg once daily on an empty stomach.',
    sideEffects: ['Weight loss', 'Tremors', 'Headache', 'Insomnia'],
    usedFor: ['Hypothyroidism', 'Thyroid cancer', 'Goiter'],
    alternatives: ['Liothyronine', 'Armour Thyroid', 'Nature-Throid'],
    expiryDate: '2025-11-01',
    price: 85.00,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/3683101/pexels-photo-3683101.jpeg'
  },
  {
    id: 'med-009',
    name: 'Cetirizine',
    manufacturer: 'AllergyFree Labs',
    category: 'Antihistamine',
    description: 'Antihistamine used to relieve allergy symptoms.',
    dosage: 'Adults: 10mg once daily.',
    sideEffects: ['Drowsiness', 'Dry mouth', 'Fatigue', 'Dizziness'],
    usedFor: ['Hay fever', 'Allergies', 'Hives'],
    alternatives: ['Loratadine', 'Fexofenadine', 'Levocetirizine'],
    expiryDate: '2024-09-15',
    price: 45.99,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/3683098/pexels-photo-3683098.jpeg'
  },
  {
    id: 'med-010',
    name: 'Amlodipine',
    manufacturer: 'Heart Health Inc.',
    category: 'Blood Pressure',
    description: 'A calcium channel blocker used to treat high blood pressure.',
    dosage: 'Adults: 5-10mg once daily.',
    sideEffects: ['Swelling in legs', 'Fatigue', 'Palpitations', 'Nausea'],
    usedFor: ['Hypertension', 'Chest pain (angina)'],
    alternatives: ['Nifedipine', 'Diltiazem', 'Verapamil'],
    expiryDate: '2024-12-05',
    price: 110.00,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/4021808/pexels-photo-4021808.jpeg'
  },
  {
    id: 'med-011',
    name: 'Losartan',
    manufacturer: 'VascCare',
    category: 'Blood Pressure',
    description: 'An ARB medication used to treat high blood pressure.',
    dosage: 'Adults: 50mg once daily, can be increased to 100mg.',
    sideEffects: ['Dizzy feeling', 'Back pain', 'Cold symptoms', 'Tiredness'],
    usedFor: ['Hypertension', 'Kidney protection in diabetes'],
    alternatives: ['Valsartan', 'Irbesartan', 'Olmesartan'],
    expiryDate: '2025-03-10',
    price: 145.25,
    inStock: false,
    imageUrl: 'https://images.pexels.com/photos/159211/headache-pain-pills-medication-159211.jpeg'
  },
  {
    id: 'med-012',
    name: 'Albuterol',
    manufacturer: 'BreatheEasy',
    category: 'Respiratory',
    description: 'A bronchodilator that relaxes muscles in the airways.',
    dosage: 'Adults: 1-2 puffs every 4-6 hours as needed.',
    sideEffects: ['Nervousness', 'Shaking', 'Headache', 'Heart palpitations'],
    usedFor: ['Asthma attacks', 'COPD', 'Exercise-induced bronchospasm'],
    alternatives: ['Levalbuterol', 'Salmeterol', 'Formoterol'],
    expiryDate: '2025-08-30',
    price: 350.00,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/3683098/pexels-photo-3683098.jpeg'
  },
  {
    id: 'med-013',
    name: 'Omeprazole',
    manufacturer: 'GastroMed',
    category: 'Gastrointestinal',
    description: 'Treats symptoms of gastroesophageal reflux disease (GERD).',
    dosage: 'Adults: 20mg once daily before eating.',
    sideEffects: ['Headache', 'Stomach pain', 'Nausea', 'Diarrhea'],
    usedFor: ['GERD', 'Heartburn', 'Zollinger-Ellison syndrome'],
    alternatives: ['Pantoprazole', 'Lansoprazole', 'Rabeprazole'],
    expiryDate: '2024-10-10',
    price: 120.75,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/139398/thermometer-headache-pain-pills-139398.jpeg'
  },
  {
    id: 'med-014',
    name: 'Gabapentin',
    manufacturer: 'NeuroPharma',
    category: 'Neuropathic Pain',
    description: 'Anti-epileptic medication also used for nerve pain.',
    dosage: 'Adults: 300mg day 1, 300mg twice day 2, 300mg three times day 3.',
    sideEffects: ['Dizziness', 'Drowsiness', 'Weight gain', 'Fatigue'],
    usedFor: ['Nerve pain', 'Seizures', 'Restless legs syndrome'],
    alternatives: ['Pregabalin', 'Amitriptyline', 'Duloxetine'],
    expiryDate: '2025-05-15',
    price: 215.00,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/4021808/pexels-photo-4021808.jpeg'
  },
  {
    id: 'med-015',
    name: 'Sertraline',
    manufacturer: 'MindWellness',
    category: 'Mental Health',
    description: 'SSRI antidepressant used to treat a variety of mental health conditions.',
    dosage: 'Adults: 50mg once daily.',
    sideEffects: ['Nausea', 'Insomnia', 'Diarrhea', 'Dry mouth'],
    usedFor: ['Depression', 'OCD', 'Panic attacks', 'PTSD'],
    alternatives: ['Fluoxetine', 'Escitalopram', 'Citalopram'],
    expiryDate: '2025-07-22',
    price: 180.50,
    inStock: true,
    imageUrl: 'https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg'
  }
] as Medicine[];

export const getMedicineById = (id: string): Medicine | undefined => {
  return medicines.find(med => med.id === id);
};

export const getMedicineByName = (name: string): Medicine | undefined => {
  return medicines.find(med => med.name.toLowerCase() === name.toLowerCase());
};

export const searchMedicines = (query: string): Medicine[] => {
  const searchTerm = query.toLowerCase();
  return medicines.filter(med => 
    med.name.toLowerCase().includes(searchTerm) || 
    med.category.toLowerCase().includes(searchTerm) ||
    med.manufacturer.toLowerCase().includes(searchTerm)
  );
};