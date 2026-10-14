// Advanced Medical NLP Assistant for PharmaVault
import { generateVitalSignsResponse } from './vitalSignsAnalyzer';

export const generateMedicalResponse = (userInput: string): string => {
  const input = userInput.toLowerCase().trim();
  
  // Check if input contains vital signs data
  const vitalSignsPatterns = [
    /(?:heart rate|hr|pulse)[\s:]*\d+/i,
    /(?:blood pressure|bp)[\s:]*\d+\/\d+/i,
    /(?:temperature|temp)[\s:]*\d+(?:\.\d+)?/i,
    /(?:oxygen saturation|o2 sat|spo2)[\s:]*\d+/i,
    /(?:respiratory rate|breathing rate)[\s:]*\d+/i,
    /(?:blood sugar|glucose|bg)[\s:]*\d+/i
  ];

  const hasVitalSigns = vitalSignsPatterns.some(pattern => pattern.test(input));
  
  if (hasVitalSigns) {
    return generateVitalSignsResponse(userInput);
  }

  // Enhanced symptom detection with multiple variations
  const symptomPatterns = {
    headache: [
      'headache', 'head pain', 'head ache', 'migraine', 'head hurts', 
      'pain in head', 'head throbbing', 'head pounding'
    ],
    fever: [
      'fever', 'high temperature', 'hot', 'burning up', 'feverish', 
      'temperature', 'chills', 'sweating'
    ],
    cough: [
      'cough', 'coughing', 'throat clearing', 'hacking', 'dry cough', 
      'wet cough', 'persistent cough'
    ],
    soreThroat: [
      'sore throat', 'throat pain', 'throat hurts', 'scratchy throat', 
      'throat ache', 'swollen throat', 'throat infection'
    ],
    stomachPain: [
      'stomach pain', 'stomach ache', 'belly pain', 'abdominal pain', 
      'tummy ache', 'stomach hurts', 'gastric pain', 'indigestion'
    ],
    dizziness: [
      'dizzy', 'dizziness', 'lightheaded', 'vertigo', 'spinning', 
      'balance problems', 'unsteady'
    ],
    nausea: [
      'nausea', 'nauseous', 'sick to stomach', 'queasy', 'feel like vomiting', 
      'morning sickness', 'motion sickness'
    ],
    fatigue: [
      'tired', 'fatigue', 'exhausted', 'weak', 'no energy', 'sleepy', 
      'worn out', 'drained'
    ],
    backPain: [
      'back pain', 'backache', 'lower back pain', 'spine pain', 
      'back hurts', 'back ache'
    ],
    jointPain: [
      'joint pain', 'arthritis', 'knee pain', 'shoulder pain', 
      'joint ache', 'stiff joints', 'joint stiffness'
    ],
    skinIssues: [
      'rash', 'skin rash', 'itchy skin', 'skin irritation', 'eczema', 
      'dry skin', 'skin allergy', 'hives'
    ],
    sleepIssues: [
      'insomnia', 'can\'t sleep', 'trouble sleeping', 'sleep problems', 
      'difficulty sleeping', 'restless sleep'
    ],
    anxiety: [
      'anxiety', 'anxious', 'panic', 'stress', 'worried', 'nervous', 
      'panic attack', 'restless'
    ],
    coldFlu: [
      'cold', 'flu', 'runny nose', 'stuffy nose', 'congestion', 
      'sneezing', 'blocked nose'
    ]
  };

  // Detect symptoms in user input
  const detectedSymptoms: string[] = [];
  for (const [symptom, patterns] of Object.entries(symptomPatterns)) {
    if (patterns.some(pattern => input.includes(pattern))) {
      detectedSymptoms.push(symptom);
    }
  }

  // Generate comprehensive medical responses
  const medicalResponses = {
    headache: {
      causes: [
        'Dehydration or not drinking enough water',
        'Stress, tension, or anxiety',
        'Lack of sleep or poor sleep quality',
        'Eye strain from screens or bright lights',
        'Sinus congestion or allergies',
        'Low blood sugar or skipping meals',
        'Caffeine withdrawal',
        'Poor posture or neck tension'
      ],
      medicines: [
        'Paracetamol (acetaminophen) - safe and effective for most people',
        'Ibuprofen - helps with pain and inflammation',
        'Aspirin - for adults only, not for children',
        'Plenty of water - often the best first treatment'
      ],
      precautions: [
        'Rest in a quiet, dark room',
        'Apply a cold compress to your forehead',
        'Drink water slowly and steadily',
        'Try gentle neck and shoulder stretches',
        'Avoid bright lights and loud noises',
        'Get some fresh air if possible'
      ],
      doctorAdvice: 'severe headache, persistent pain lasting more than 2 days, headache with fever, vision changes, confusion, or neck stiffness'
    },

    fever: {
      causes: [
        'Viral infections like cold or flu',
        'Bacterial infections',
        'Inflammatory conditions',
        'Heat exhaustion or dehydration',
        'Some medications or vaccines',
        'Autoimmune conditions'
      ],
      medicines: [
        'Paracetamol - effective fever reducer and safe for most ages',
        'Ibuprofen - reduces fever and inflammation',
        'Plenty of fluids to prevent dehydration',
        'Oral rehydration solutions if needed'
      ],
      precautions: [
        'Rest and get plenty of sleep',
        'Drink lots of fluids (water, herbal teas, clear broths)',
        'Wear light, breathable clothing',
        'Use cool compresses on forehead and wrists',
        'Take lukewarm baths or showers',
        'Monitor temperature regularly'
      ],
      doctorAdvice: 'fever above 103°F (39.4°C), persistent fever for more than 3 days, difficulty breathing, severe headache, chest pain, or signs of dehydration'
    },

    cough: {
      causes: [
        'Common cold or flu virus',
        'Allergies or environmental irritants',
        'Dry air or seasonal changes',
        'Throat irritation from talking or singing',
        'Acid reflux or heartburn',
        'Respiratory infections'
      ],
      medicines: [
        'Cough drops or throat lozenges for soothing relief',
        'Honey (natural cough suppressant - not for children under 1 year)',
        'Cough syrups with dextromethorphan for dry coughs',
        'Expectorants to help loosen mucus'
      ],
      precautions: [
        'Stay well hydrated with warm liquids',
        'Use a humidifier or breathe steam from hot shower',
        'Gargle with warm salt water',
        'Avoid smoke, strong perfumes, and irritants',
        'Sleep with your head elevated',
        'Rest your voice when possible'
      ],
      doctorAdvice: 'persistent cough lasting more than 2 weeks, coughing up blood, high fever with cough, difficulty breathing, or chest pain'
    },

    soreThroat: {
      causes: [
        'Viral infections (most common cause)',
        'Bacterial infections like strep throat',
        'Allergies or postnasal drip',
        'Dry air or mouth breathing',
        'Acid reflux',
        'Overuse of voice or shouting'
      ],
      medicines: [
        'Throat lozenges or hard candies for temporary relief',
        'Paracetamol or ibuprofen for pain and inflammation',
        'Throat sprays with numbing agents',
        'Antiseptic gargles or mouthwashes'
      ],
      precautions: [
        'Gargle with warm salt water several times daily',
        'Drink warm fluids like tea with honey',
        'Use a humidifier to add moisture to air',
        'Avoid irritants like cigarette smoke',
        'Rest your voice and avoid whispering',
        'Stay hydrated with plenty of fluids'
      ],
      doctorAdvice: 'severe throat pain, difficulty swallowing, high fever, white patches on throat, swollen lymph nodes, or symptoms lasting more than a week'
    },

    stomachPain: {
      causes: [
        'Indigestion from eating too much or too quickly',
        'Gas, bloating, or trapped wind',
        'Food poisoning or stomach bug',
        'Stress, anxiety, or emotional upset',
        'Acid reflux or heartburn',
        'Menstrual cramps (for women)',
        'Constipation or digestive issues'
      ],
      medicines: [
        'Antacids for acid-related stomach discomfort',
        'Simethicone (Gas-X) for gas and bloating',
        'Loperamide for diarrhea (if present)',
        'Probiotics to support digestive health'
      ],
      precautions: [
        'Eat smaller, more frequent meals',
        'Avoid spicy, fatty, or very acidic foods',
        'Stay hydrated with clear fluids',
        'Apply a warm heating pad to your abdomen',
        'Try gentle walking to aid digestion',
        'Practice relaxation techniques if stress-related'
      ],
      doctorAdvice: 'severe abdominal pain, persistent vomiting, signs of dehydration, high fever, blood in stool, or pain that worsens over time'
    },

    dizziness: {
      causes: [
        'Dehydration or low blood sugar',
        'Inner ear problems or balance disorders',
        'Low blood pressure or sudden position changes',
        'Medication side effects',
        'Anxiety, stress, or panic attacks',
        'Anemia or low iron levels',
        'Vestibular disorders'
      ],
      medicines: [
        'Oral rehydration solutions if dehydrated',
        'Glucose tablets or sweet drinks for low blood sugar',
        'Motion sickness medications if travel-related',
        'Iron supplements if anemic (consult doctor first)'
      ],
      precautions: [
        'Sit or lie down immediately when feeling dizzy',
        'Move slowly and avoid sudden position changes',
        'Stay well hydrated throughout the day',
        'Eat regular, balanced meals',
        'Avoid driving or operating machinery when dizzy',
        'Get up slowly from sitting or lying positions'
      ],
      doctorAdvice: 'frequent or severe dizziness, dizziness with chest pain or shortness of breath, fainting episodes, severe headache with dizziness, or if it significantly affects daily activities'
    },

    nausea: {
      causes: [
        'Stomach flu or food poisoning',
        'Motion sickness or travel',
        'Pregnancy (morning sickness)',
        'Medication side effects',
        'Anxiety or stress',
        'Overeating or eating too quickly',
        'Migraine headaches'
      ],
      medicines: [
        'Ginger supplements or ginger tea (natural anti-nausea)',
        'Dramamine for motion sickness',
        'Antacids if related to stomach acid',
        'Oral rehydration solutions to prevent dehydration'
      ],
      precautions: [
        'Eat small, frequent meals instead of large ones',
        'Choose bland foods like crackers, toast, or rice',
        'Avoid strong smells and greasy foods',
        'Stay hydrated with small sips of clear fluids',
        'Get fresh air and avoid stuffy environments',
        'Rest in a comfortable position'
      ],
      doctorAdvice: 'persistent vomiting, signs of dehydration, severe abdominal pain, high fever, or if you cannot keep fluids down for more than 24 hours'
    },

    fatigue: {
      causes: [
        'Lack of quality sleep or sleep disorders',
        'Stress, anxiety, or depression',
        'Poor diet or nutritional deficiencies',
        'Dehydration or not drinking enough water',
        'Sedentary lifestyle or lack of exercise',
        'Underlying medical conditions',
        'Medication side effects'
      ],
      medicines: [
        'Multivitamins if nutritional deficiency suspected',
        'Iron supplements if anemic (consult doctor first)',
        'Vitamin D supplements if deficient',
        'B-complex vitamins for energy support'
      ],
      precautions: [
        'Establish a regular sleep schedule (7-9 hours nightly)',
        'Eat a balanced diet with regular meals',
        'Stay hydrated throughout the day',
        'Exercise regularly, even light walking helps',
        'Manage stress through relaxation techniques',
        'Limit caffeine and alcohol consumption'
      ],
      doctorAdvice: 'persistent fatigue lasting more than 2 weeks, fatigue with unexplained weight loss, severe fatigue affecting daily activities, or fatigue with other concerning symptoms'
    },

    backPain: {
      causes: [
        'Poor posture or prolonged sitting',
        'Muscle strain from lifting or sudden movements',
        'Sleeping in awkward positions',
        'Stress and muscle tension',
        'Lack of regular exercise',
        'Herniated disc or spinal issues',
        'Arthritis or joint problems'
      ],
      medicines: [
        'Ibuprofen or naproxen for inflammation and pain',
        'Paracetamol for pain relief',
        'Topical pain relief creams or gels',
        'Muscle relaxants (prescription only)'
      ],
      precautions: [
        'Apply ice for first 24-48 hours, then heat',
        'Gentle stretching and movement (avoid bed rest)',
        'Maintain good posture when sitting and standing',
        'Use proper lifting techniques',
        'Sleep on a supportive mattress',
        'Consider gentle yoga or physical therapy exercises'
      ],
      doctorAdvice: 'severe back pain, pain radiating down legs, numbness or tingling, loss of bladder control, or pain following an injury'
    },

    jointPain: {
      causes: [
        'Arthritis (osteoarthritis or rheumatoid)',
        'Overuse or repetitive strain',
        'Injury or trauma to the joint',
        'Autoimmune conditions',
        'Weather changes (barometric pressure)',
        'Age-related wear and tear',
        'Inflammatory conditions'
      ],
      medicines: [
        'Ibuprofen or naproxen for inflammation',
        'Paracetamol for pain relief',
        'Topical anti-inflammatory creams',
        'Glucosamine and chondroitin supplements'
      ],
      precautions: [
        'Apply ice for acute pain, heat for stiffness',
        'Gentle range-of-motion exercises',
        'Maintain a healthy weight to reduce joint stress',
        'Use supportive devices if needed',
        'Avoid activities that worsen pain',
        'Consider low-impact exercises like swimming'
      ],
      doctorAdvice: 'severe joint pain, significant swelling, joint deformity, inability to use the joint, or pain with fever'
    },

    skinIssues: {
      causes: [
        'Allergic reactions to foods, products, or environment',
        'Eczema or dermatitis',
        'Dry skin or weather changes',
        'Insect bites or stings',
        'Contact with irritants',
        'Stress or hormonal changes',
        'Fungal or bacterial infections'
      ],
      medicines: [
        'Antihistamines for allergic reactions and itching',
        'Hydrocortisone cream for inflammation',
        'Moisturizing lotions and creams',
        'Calamine lotion for soothing relief'
      ],
      precautions: [
        'Avoid known triggers and irritants',
        'Keep skin clean and moisturized',
        'Use gentle, fragrance-free products',
        'Avoid scratching affected areas',
        'Wear loose, breathable clothing',
        'Take cool baths with oatmeal or baking soda'
      ],
      doctorAdvice: 'severe rash, signs of infection, rash with fever, difficulty breathing with rash, or rash that doesn\'t improve with treatment'
    },

    sleepIssues: {
      causes: [
        'Stress, anxiety, or racing thoughts',
        'Poor sleep hygiene or irregular schedule',
        'Caffeine or alcohol consumption',
        'Screen time before bed',
        'Uncomfortable sleep environment',
        'Medical conditions or medications',
        'Shift work or jet lag'
      ],
      medicines: [
        'Melatonin supplements (natural sleep aid)',
        'Herbal teas like chamomile or valerian',
        'Magnesium supplements for relaxation',
        'Over-the-counter sleep aids (short-term use only)'
      ],
      precautions: [
        'Establish a consistent bedtime routine',
        'Create a cool, dark, quiet sleep environment',
        'Avoid screens 1 hour before bedtime',
        'Limit caffeine after 2 PM',
        'Exercise regularly, but not close to bedtime',
        'Practice relaxation techniques like deep breathing'
      ],
      doctorAdvice: 'chronic insomnia lasting more than 3 weeks, sleep problems affecting daily life, loud snoring with breathing pauses, or excessive daytime sleepiness'
    },

    anxiety: {
      causes: [
        'Stress from work, relationships, or life changes',
        'Genetic predisposition or family history',
        'Traumatic experiences or PTSD',
        'Medical conditions or hormonal changes',
        'Caffeine or substance use',
        'Perfectionism or overthinking',
        'Social situations or phobias'
      ],
      medicines: [
        'Herbal supplements like chamomile or passionflower',
        'Magnesium supplements for relaxation',
        'L-theanine for calm focus',
        'Prescription medications (consult doctor)'
      ],
      precautions: [
        'Practice deep breathing exercises',
        'Try meditation or mindfulness techniques',
        'Regular exercise to reduce stress hormones',
        'Limit caffeine and alcohol',
        'Maintain social connections and support',
        'Get adequate sleep and nutrition'
      ],
      doctorAdvice: 'severe anxiety affecting daily life, panic attacks, thoughts of self-harm, anxiety with depression, or if anxiety interferes with work or relationships'
    },

    coldFlu: {
      causes: [
        'Viral infections (rhinovirus, influenza)',
        'Weakened immune system',
        'Exposure to infected individuals',
        'Seasonal changes and weather',
        'Stress or lack of sleep',
        'Poor nutrition or dehydration',
        'Crowded environments'
      ],
      medicines: [
        'Paracetamol or ibuprofen for aches and fever',
        'Decongestants for stuffy nose',
        'Cough suppressants or expectorants',
        'Throat lozenges for sore throat',
        'Saline nasal sprays for congestion'
      ],
      precautions: [
        'Get plenty of rest and sleep',
        'Stay hydrated with warm fluids',
        'Use a humidifier or breathe steam',
        'Gargle with salt water for sore throat',
        'Eat nutritious foods to support immunity',
        'Wash hands frequently to prevent spread'
      ],
      doctorAdvice: 'high fever lasting more than 3 days, difficulty breathing, severe headache, chest pain, or if symptoms worsen after initial improvement'
    }
  };

  // Handle multiple symptoms
  if (detectedSymptoms.length > 1) {
    return generateMultiSymptomResponse(detectedSymptoms, medicalResponses, input);
  }

  // Handle single symptom
  if (detectedSymptoms.length === 1) {
    const symptom = detectedSymptoms[0];
    const response = medicalResponses[symptom as keyof typeof medicalResponses];
    
    if (response) {
      return formatMedicalResponse(symptom, response, input);
    }
  }

  // Handle general health questions
  return generateGeneralHealthResponse(input);
};

// Format comprehensive medical response
const formatMedicalResponse = (symptom: string, response: any, originalInput: string) => {
  const symptomName = symptom.replace(/([A-Z])/g, ' $1').toLowerCase();
  
  return `**${symptomName.charAt(0).toUpperCase() + symptomName.slice(1)}** can have several common causes:

**Possible causes:**
${response.causes.map((cause: string) => `• ${cause}`).join('\n')}

**Common medicines that may help:**
${response.medicines.map((medicine: string) => `• ${medicine}`).join('\n')}

**Simple precautions and home remedies:**
${response.precautions.map((precaution: string) => `• ${precaution}`).join('\n')}

**When to consult a doctor:**
Please see a healthcare provider if you experience ${response.doctorAdvice}.

Remember, this is general information only. Your health and safety are important, so don't hesitate to seek professional medical advice when in doubt.`;
};

// Handle multiple symptoms
const generateMultiSymptomResponse = (symptoms: string[], responses: any, input: string) => {
  const symptomNames = symptoms.map(s => s.replace(/([A-Z])/g, ' $1').toLowerCase()).join(' and ');
  
  // Combine causes and advice from all detected symptoms
  const allCauses = new Set<string>();
  const allMedicines = new Set<string>();
  const allPrecautions = new Set<string>();
  const doctorAdvice: string[] = [];

  symptoms.forEach(symptom => {
    const response = responses[symptom];
    if (response) {
      response.causes.forEach((cause: string) => allCauses.add(cause));
      response.medicines.forEach((medicine: string) => allMedicines.add(medicine));
      response.precautions.forEach((precaution: string) => allPrecautions.add(precaution));
      doctorAdvice.push(response.doctorAdvice);
    }
  });

  return `**${symptomNames.charAt(0).toUpperCase() + symptomNames.slice(1)}** can have several common causes:

**Possible causes:**
${Array.from(allCauses).slice(0, 8).map(cause => `• ${cause}`).join('\n')}

**Common medicines that may help:**
${Array.from(allMedicines).slice(0, 6).map(medicine => `• ${medicine}`).join('\n')}

**Simple precautions and home remedies:**
${Array.from(allPrecautions).slice(0, 8).map(precaution => `• ${precaution}`).join('\n')}

**When to consult a doctor:**
Please see a healthcare provider if you experience any of these symptoms severely or if they persist.

Remember, this is general information only. Your health and safety are important, so don't hesitate to seek professional medical advice when in doubt.`;
};

// Handle greetings and basic conversational queries
const handleGreetingsAndBasicQueries = (input: string): string | null => {
  const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings', 'howdy'];
  const howAreYou = ['how are you', 'how are you doing', 'how\'s it going', 'what\'s up', 'whats up'];
  const thanks = ['thanks', 'thank you', 'appreciate it', 'thanks a lot'];
  const bye = ['bye', 'goodbye', 'see you', 'farewell', 'take care'];

  // Check for greetings
  if (greetings.some(greeting => input === greeting || input.startsWith(greeting + ' ') || input.startsWith(greeting + '!'))) {
    return `Hello! I'm your PharmaVault Health Assistant. I'm here to help you with:

• Medicine information and recommendations
• Symptoms analysis and health guidance
• Vital signs monitoring and interpretation
• Prescription assistance
• General health questions

What can I help you with today?`;
  }

  // Check for "how are you" type queries
  if (howAreYou.some(phrase => input.includes(phrase))) {
    return `I'm doing great, thank you for asking! I'm here and ready to help you with any health or medicine-related questions.

What would you like to know about today? I can help with:
• Symptoms and health concerns
• Medicine information
• Vital signs analysis
• General health advice`;
  }

  // Check for thank you
  if (thanks.some(phrase => input.includes(phrase))) {
    return `You're very welcome! I'm happy to help. If you have any other health questions or need medicine information, feel free to ask anytime.

Stay healthy!`;
  }

  // Check for goodbye
  if (bye.some(phrase => input.includes(phrase))) {
    return `Goodbye! Take care of your health. Feel free to come back anytime you have questions about medicines or health concerns.

Stay well!`;
  }

  return null;
};

// Handle general health questions
const generateGeneralHealthResponse = (input: string) => {
  if (input.includes('medicine') && (input.includes('safe') || input.includes('take'))) {
    return `**Medicine Safety Guidelines:**

**General precautions:**
• Always read labels and follow dosage instructions carefully
• Check expiration dates before taking any medicine
• Be aware of potential drug interactions with other medications
• Don't exceed recommended doses
• Store medicines properly in a cool, dry place

**Before taking any medicine:**
• Consult with a pharmacist or doctor if you're unsure
• Inform healthcare providers about all medicines you're currently taking
• Check for known allergies or previous adverse reactions
• Consider your current medical conditions and health status

**When to consult a healthcare professional:**
Always consult a doctor or pharmacist before starting new medications, especially if you have chronic conditions, are pregnant or breastfeeding, or are taking other medicines.

Remember, this is general information only. Your health and safety are important, so don't hesitate to seek professional medical advice when in doubt.`;
  }

  if (input.includes('emergency') || input.includes('urgent') || input.includes('serious')) {
    return `**When to Seek Emergency Medical Care:**

**Call emergency services immediately for:**
• Difficulty breathing or shortness of breath
• Chest pain or pressure
• Severe allergic reactions (swelling, difficulty breathing)
• Loss of consciousness or fainting
• Severe bleeding that won't stop
• Signs of stroke (face drooping, arm weakness, speech difficulty)
• Severe burns or injuries

**Go to urgent care or ER for:**
• High fever with severe symptoms
• Persistent vomiting or signs of dehydration
• Severe abdominal pain
• Head injuries or severe headaches
• Deep cuts requiring stitches

**General health emergencies:**
If you're ever unsure whether a situation is an emergency, it's always better to err on the side of caution and seek immediate medical attention.

Remember, this is general information only. Your health and safety are important, so don't hesitate to seek professional medical advice when in doubt.`;
  }

  // First check for greetings and basic conversational queries
  const conversationalResponse = handleGreetingsAndBasicQueries(input);
  if (conversationalResponse) {
    return conversationalResponse;
  }

  return `Thank you for your health question. I'm here to help with information about common symptoms, vital signs analysis, and general health guidance.

**I can help you with:**
• Common symptoms like headaches, fever, cough, sore throat
• Vital signs analysis (heart rate, blood pressure, temperature, etc.)
• General information about over-the-counter medicines
• Simple home remedies and precautions
• Guidance on when to see a doctor
• Basic health and wellness questions

**For the best assistance, try describing:**
• Your specific symptoms or vital signs
• How long you've been experiencing them
• Any other related concerns

**Vital signs format example:**
Heart rate: 75 bpm, Blood pressure: 120/80 mmHg, Temperature: 98.6°F

**Important reminders:**
• This information is for general guidance only
• Always consult healthcare professionals for serious symptoms
• Don't delay seeking medical care if you're concerned
• Keep emergency numbers handy for urgent situations

Feel free to ask about any specific symptoms, vital signs, or health concerns you may have!

Remember, this is general information only. Your health and safety are important, so don't hesitate to seek professional medical advice when in doubt.`;
};