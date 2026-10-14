const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const Medicine = require('./models/medicineModel');

dotenv.config();
connectDB();

const sampleMedicines = [
  {
    name: "Paracetamol 500mg (Crocin)",
    category: "Analgesic",
    description: "Used to treat mild to moderate pain and reduce fever.",
    price: 15.00,
    stock: 500,
    manufacturer: "GSK Pharmaceuticals",
    prescriptionRequired: false,
    expiryDate: new Date("2026-12-31"),
    batchNumber: "B-CRO-101"
  },
  {
    name: "Dolo 650mg",
    category: "Analgesic",
    description: "Effective antipyretic for high fever and body ache.",
    price: 30.50,
    stock: 800,
    manufacturer: "Micro Labs",
    prescriptionRequired: false,
    expiryDate: new Date("2025-10-15"),
    batchNumber: "B-DLO-650"
  },
  {
    name: "Azithromycin 500mg (Azee)",
    category: "Antibiotic",
    description: "Macrolide antibiotic used to treat bacterial infections like throat infections.",
    price: 119.00,
    stock: 120,
    manufacturer: "Cipla",
    prescriptionRequired: true,
    expiryDate: new Date("2025-08-15"),
    batchNumber: "B-AZE-500"
  },
  {
    name: "Pantoprazole 40mg (Pan 40)",
    category: "Gastrointestinal",
    description: "Proton pump inhibitor used for acid reflux and ulcers.",
    price: 155.00,
    stock: 200,
    manufacturer: "Alkem Laboratories",
    prescriptionRequired: true,
    expiryDate: new Date("2025-11-20"),
    batchNumber: "B-PAN-040"
  },
  {
    name: "Metformin 500mg (Glycomet)",
    category: "Antidiabetic",
    description: "First-line medication for the treatment of type 2 diabetes.",
    price: 45.00,
    stock: 350,
    manufacturer: "USV Private Limited",
    prescriptionRequired: true,
    expiryDate: new Date("2026-06-10"),
    batchNumber: "B-GLY-500"
  },
  {
    name: "Amoxycillin + Clavulanic Acid (Augmentin 625 Duo)",
    category: "Antibiotic",
    description: "Combination antibiotic used to treat severe bacterial infections.",
    price: 200.00,
    stock: 80,
    manufacturer: "GSK Pharmaceuticals",
    prescriptionRequired: true,
    expiryDate: new Date("2025-09-05"),
    batchNumber: "B-AUG-625"
  },
  {
    name: "Amlodipine 5mg (Amlokind)",
    category: "Cardiovascular",
    description: "Calcium channel blocker used to treat high blood pressure.",
    price: 28.50,
    stock: 400,
    manufacturer: "Mankind Pharma",
    prescriptionRequired: true,
    expiryDate: new Date("2026-02-15"),
    batchNumber: "B-AML-005"
  },
  {
    name: "Cetirizine 10mg (Okacet)",
    category: "Allergy",
    description: "Antihistamine used to relieve allergy symptoms like runny nose.",
    price: 18.00,
    stock: 300,
    manufacturer: "Cipla",
    prescriptionRequired: false,
    expiryDate: new Date("2027-01-20"),
    batchNumber: "B-OKA-010"
  },
  {
    name: "ORS (Electral Powder)",
    category: "Supplement",
    description: "Oral Rehydration Salts to restore body fluids and electrolytes.",
    price: 21.00,
    stock: 600,
    manufacturer: "FDC Limited",
    prescriptionRequired: false,
    expiryDate: new Date("2026-05-12"),
    batchNumber: "B-ELE-ORS"
  },
  {
    name: "Levocetirizine 5mg (Montair LC)",
    category: "Allergy & Respiratory",
    description: "Combination medicine used to relieve allergic rhinitis and asthma.",
    price: 185.00,
    stock: 150,
    manufacturer: "Cipla",
    prescriptionRequired: true,
    expiryDate: new Date("2026-04-30"),
    batchNumber: "B-MON-TLC"
  }
];

const importData = async () => {
  try {
    await Medicine.deleteMany();
    await Medicine.insertMany(sampleMedicines);
    console.log('✅ Data Imported Successfully!');
    process.exit();
  } catch (error) {
    console.error(`❌ Error with import: ${error}`);
    process.exit(1);
  }
};

importData();
