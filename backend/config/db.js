const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoMemoryServerInstance = null;

function configureDatabaseSecurity() {
  mongoose.set('strictQuery', true);
  mongoose.set('sanitizeFilter', false);
}

async function seedDefaultUsers() {
  try {
    const User = require('../models/userModel');
    const demoAccounts = [
      { name: 'Demo Patient', email: 'patient@test.com', password: 'password123', role: 'patient' },
      { name: 'Apex Pharmacy Hub', email: 'pharmacy@test.com', password: 'password123', role: 'pharmacy' },
      { name: 'Certified Pharmacist', email: 'pharmacist@test.com', password: 'password123', role: 'pharmacist' },
      { name: 'TrustRAG Claims Reviewer', email: 'reviewer@test.com', password: 'password123', role: 'claims_reviewer' },
      { name: 'SaaS Super Admin', email: 'admin@test.com', password: 'password123', role: 'super_admin' },
    ];
    for (const acc of demoAccounts) {
      const exists = await User.findOne({ email: acc.email });
      if (!exists) {
        await User.create(acc);
      }
    }
    console.log('✅ Demo accounts seeded (patient, pharmacy, pharmacist, reviewer, admin).');
  } catch (e) {
    console.warn('Demo accounts seeding note:', e.message);
  }
}

async function seedDefaultMedicines() {
  try {
    const Medicine = require('../models/medicineModel');
    const count = await Medicine.countDocuments();
    if (count === 0) {
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
          expiryDate: new Date("2026-10-15"),
          batchNumber: "B-DLO-650"
        },
        {
          name: "Augmentin 625 Duo",
          category: "Antibiotic",
          description: "Broad spectrum penicillin antibiotic containing Amoxicillin and Clavulanic acid.",
          price: 210.00,
          stock: 140,
          manufacturer: "GSK Pharmaceuticals",
          prescriptionRequired: true,
          expiryDate: new Date("2027-05-30"),
          batchNumber: "B-AUG-625"
        },
        {
          name: "Azithromycin 500mg (Azee)",
          category: "Antibiotic",
          description: "Macrolide antibiotic used to treat bacterial and respiratory infections.",
          price: 119.00,
          stock: 120,
          manufacturer: "Cipla",
          prescriptionRequired: true,
          expiryDate: new Date("2026-08-15"),
          batchNumber: "B-AZE-500"
        },
        {
          name: "Pantoprazole 40mg (Pan 40)",
          category: "Gastrointestinal",
          description: "Proton pump inhibitor used for acid reflux and peptic ulcers.",
          price: 155.00,
          stock: 200,
          manufacturer: "Alkem Laboratories",
          prescriptionRequired: true,
          expiryDate: new Date("2026-11-20"),
          batchNumber: "B-PAN-040"
        },
        {
          name: "Metformin 500mg (Glycomet)",
          category: "Antidiabetic",
          description: "First-line medication for glycemic control in type 2 diabetes.",
          price: 45.00,
          stock: 350,
          manufacturer: "USV Private Limited",
          prescriptionRequired: true,
          expiryDate: new Date("2027-03-10"),
          batchNumber: "B-GLY-500"
        },
        {
          name: "Cetirizine 10mg (Cetzine)",
          category: "Antihistamine",
          description: "Relieves allergy symptoms like watery eyes, runny nose, and sneezing.",
          price: 22.00,
          stock: 400,
          manufacturer: "Dr. Reddy's Laboratories",
          prescriptionRequired: false,
          expiryDate: new Date("2027-01-25"),
          batchNumber: "B-CET-010"
        },
        {
          name: "Montair LC (Montelukast + Levocetirizine)",
          category: "Respiratory",
          description: "Prevents asthma attacks and manages persistent allergic rhinitis.",
          price: 185.00,
          stock: 190,
          manufacturer: "Cipla",
          prescriptionRequired: true,
          expiryDate: new Date("2026-09-18"),
          batchNumber: "B-MON-020"
        }
      ];
      await Medicine.insertMany(sampleMedicines);
      console.log('✅ Demo medicines catalogue seeded (8 active medicines).');
    }
  } catch (e) {
    console.warn('Medicine seeding note:', e.message);
  }
}

const connectDB = async () => {
  configureDatabaseSecurity();

  const timeout = Number.parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || '2000', 10);
  const targetUri = process.env.MONGO_URI;

  try {
    if (targetUri) {
      console.log(`Connecting to MongoDB at ${targetUri}...`);
      await mongoose.connect(targetUri, {
        serverSelectionTimeoutMS: timeout,
        connectTimeoutMS: timeout
      });
      console.log('MongoDB connected successfully.');
      await seedDefaultUsers();
      await seedDefaultMedicines();
      return;
    }
  } catch (error) {
    console.warn(`Local MongoDB at ${targetUri} not reachable (${error.message}).`);
  }

  // Fallback to in-memory MongoDB for local development if local service is not running
  try {
    console.log('Starting In-Memory MongoDB Server for local demo...');
    mongoMemoryServerInstance = await MongoMemoryServer.create();
    const memoryUri = mongoMemoryServerInstance.getUri();
    await mongoose.connect(memoryUri);
    console.log(`✅ In-Memory MongoDB connected: ${memoryUri}`);
    await seedDefaultUsers();
    await seedDefaultMedicines();
  } catch (memError) {
    console.error('❌ Failed to start In-Memory MongoDB:', memError);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
module.exports.configureDatabaseSecurity = configureDatabaseSecurity;
module.exports.isDatabaseReady = () => mongoose.connection.readyState === 1;
