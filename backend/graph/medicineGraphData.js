// Simulated in-memory Knowledge Graph for PharmaVault X

const medicineNodes = [
  {
    id: "dolo_650",
    medicineName: "Dolo 650",
    aliases: ["dolo"],
    genericName: "Paracetamol",
    category: "Analgesic, Antipyretic",
    prescriptionRequired: false,
    manufacturer: "Micro Labs Ltd",
    relations: {
      has_generic: ["paracetamol"],
      treats: ["fever", "headache", "body ache", "mild pain"],
      may_cause: ["nausea", "liver damage (if overdose)", "rash"],
      alternative_to: ["crocin", "calpol"],
      caution_with: ["liver disease", "alcohol"],
      used_for: ["fever reduction", "pain relief"]
    },
    safetyNotes: "Overdose may cause severe liver damage. Do not consume alcohol while taking this medicine."
  },
  {
    id: "crocin",
    medicineName: "Crocin",
    aliases: ["crocin advance"],
    genericName: "Paracetamol",
    category: "Analgesic, Antipyretic",
    prescriptionRequired: false,
    manufacturer: "GSK",
    relations: {
      has_generic: ["paracetamol"],
      treats: ["fever", "headache", "body ache"],
      may_cause: ["nausea", "liver damage (if overdose)"],
      alternative_to: ["dolo 650", "calpol"],
      caution_with: ["liver disease"],
      used_for: ["fever reduction", "pain relief"]
    },
    safetyNotes: "Standard paracetamol safety guidelines apply."
  },
  {
    id: "cetirizine",
    medicineName: "Cetirizine",
    genericName: "Cetirizine",
    category: "Antihistamine",
    prescriptionRequired: false,
    manufacturer: "Various",
    relations: {
      has_generic: ["cetirizine"],
      treats: ["allergy", "runny nose", "sneezing", "hives", "itching"],
      may_cause: ["drowsiness", "dry mouth", "fatigue"],
      alternative_to: ["levocetirizine", "loratadine"],
      caution_with: ["driving", "alcohol", "kidney disease"],
      used_for: ["allergic rhinitis", "urticaria"]
    },
    safetyNotes: "May cause drowsiness. Avoid driving or operating heavy machinery after consumption."
  },
  {
    id: "ibuprofen",
    medicineName: "Ibuprofen",
    genericName: "Ibuprofen",
    category: "NSAID",
    prescriptionRequired: true,
    manufacturer: "Various",
    relations: {
      has_generic: ["ibuprofen"],
      treats: ["pain", "inflammation", "fever", "menstrual cramps"],
      may_cause: ["stomach pain", "heartburn", "ulcers"],
      alternative_to: ["diclofenac", "naproxen"],
      caution_with: ["gastric ulcer", "asthma", "heart disease", "pregnancy"],
      used_for: ["pain relief", "anti-inflammatory"]
    },
    safetyNotes: "Take with food to prevent stomach upset. High risk for patients with history of peptic ulcers."
  },
  {
    id: "metformin",
    medicineName: "Metformin",
    genericName: "Metformin",
    category: "Antidiabetic",
    prescriptionRequired: true,
    manufacturer: "Various",
    relations: {
      has_generic: ["metformin"],
      treats: ["type 2 diabetes"],
      may_cause: ["nausea", "diarrhea", "lactic acidosis (rare)"],
      alternative_to: ["glimepiride", "sitagliptin"],
      caution_with: ["kidney disease", "liver disease"],
      used_for: ["blood sugar control"]
    },
    safetyNotes: "Must be taken with meals. Monitor kidney function regularly."
  },
  {
    id: "amoxicillin",
    medicineName: "Amoxicillin",
    genericName: "Amoxicillin",
    category: "Antibiotic (Penicillin)",
    prescriptionRequired: true,
    manufacturer: "Various",
    relations: {
      has_generic: ["amoxicillin"],
      treats: ["bacterial infection", "throat infection", "ear infection"],
      may_cause: ["diarrhea", "nausea", "allergic rash"],
      alternative_to: ["azithromycin", "cefuroxime"],
      caution_with: ["penicillin allergy"],
      used_for: ["antibacterial treatment"]
    },
    safetyNotes: "Complete the full course even if feeling better. Severe risk if allergic to penicillin."
  },
  {
    id: "pantoprazole",
    medicineName: "Pantoprazole",
    genericName: "Pantoprazole",
    category: "Proton Pump Inhibitor (PPI)",
    prescriptionRequired: true,
    manufacturer: "Various",
    relations: {
      has_generic: ["pantoprazole"],
      treats: ["acid reflux", "gerd", "stomach ulcer", "heartburn"],
      may_cause: ["headache", "diarrhea", "bone fracture (long term)"],
      alternative_to: ["omeprazole", "rabeprazole"],
      caution_with: ["liver disease", "osteoporosis"],
      used_for: ["reducing stomach acid"]
    },
    safetyNotes: "Best taken on an empty stomach in the morning."
  }
];

module.exports = { medicineNodes };
