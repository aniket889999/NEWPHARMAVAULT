const mongoose = require('mongoose');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

const User = require('./models/userModel');
const Organization = require('./models/organizationModel');
const Branch = require('./models/branchModel');
const Subscription = require('./models/subscriptionModel');
const Medicine = require('./models/medicineModel');
const Order = require('./models/orderModel');
const Prescription = require('./models/prescriptionModel');
const BlockchainLedger = require('./models/blockchainModel');
const VerificationCase = require('./models/verificationCaseModel');
const WorkflowAudit = require('./models/workflowAuditModel');

const calculateHash = (data) => {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
};

const seedPharmacyHub = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed synthetic demo data when NODE_ENV=production.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pharmavault');
    console.log('Connected to MongoDB for Pharmacy Hub seeding...');

    // 1. Get or create Users
    let pharmacyUser = await User.findOne({ email: 'pharmacy@test.com' });
    if (!pharmacyUser) {
      pharmacyUser = await User.create({
        name: 'Demo Metro Pharmacy Hub',
        email: 'pharmacy@test.com',
        password: 'password123',
        role: 'pharmacy'
      });
    }

    let patientUser = await User.findOne({ email: 'patient@test.com' });
    if (!patientUser) {
      patientUser = await User.create({
        name: 'Rahul Sharma',
        email: 'patient@test.com',
        password: 'password123',
        role: 'patient'
      });
    }

    // 2. Organization & Branch Setup
    let org = await Organization.findOne({ name: 'Demo Health Pharmacy Network (synthetic)' });
    if (!org) {
      org = await Organization.create({
        name: 'Demo Health Pharmacy Network (synthetic)',
        owner: pharmacyUser._id,
        plan: 'Enterprise',
        status: 'active',
        contactEmail: 'central.pharmacy@example.org',
        contactPhone: '+91-80-2559-0011',
        address: {
          street: '45/2 Hosur Road, Koramangala',
          city: 'Bengaluru',
          state: 'Karnataka',
          zip: '560034',
          country: 'India'
        }
      });
    }

    let subscription = await Subscription.findOne({ organizationId: org._id });
    if (!subscription) {
      const renewalDate = new Date();
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      subscription = await Subscription.create({
        organizationId: org._id,
        planName: 'Enterprise',
        maxBranches: 25,
        maxUsers: 100,
        aiUsageLimit: 50000,
        renewalDate
      });
    }

    let branch = await Branch.findOne({ organizationId: org._id });
    if (!branch) {
      branch = await Branch.create({
        organizationId: org._id,
        name: 'Demo Dispensary - Central Bengaluru Hub',
        location: 'Ground Floor, Medical Arts Building, Bengaluru',
        licenseNumber: 'KA-BNG-CDSCO-2024-8849',
        managerId: pharmacyUser._id,
        status: 'active'
      });
    }

    // Update pharmacy user with org and branch IDs
    pharmacyUser.organizationId = org._id;
    pharmacyUser.branchId = branch._id;
    await pharmacyUser.save();

    // Staff accounts must belong to an organization (tenant scoping fails closed without one).
    const staffAccounts = [
      { email: 'reviewer@test.com', name: 'Clinical Claims Reviewer', role: 'claims_reviewer' },
      { email: 'pharmacist@test.com', name: 'Demo Pharmacist', role: 'pharmacist' },
      { email: 'orgadmin@test.com', name: 'Demo Organization Admin', role: 'org_admin' }
    ];
    for (const account of staffAccounts) {
      let staff = await User.findOne({ email: account.email });
      if (!staff) staff = new User({ ...account, password: 'password123' });
      staff.role = account.role;
      staff.organizationId = org._id;
      staff.branchId = branch._id;
      await staff.save();
    }
    console.log('Linked demo staff accounts to the demo organization.');

    // 3. Clear and Seed Medicines for Pharmacy Hub
    await Medicine.deleteMany({});
    
    const now = new Date();
    const doloExp = new Date(now.getTime() + 540 * 24 * 60 * 60 * 1000); // 18 months
    const azeExp = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 12 months
    const amxExp = new Date(now.getTime() + 240 * 24 * 60 * 60 * 1000); // 8 months
    const coughExp = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 DAYS (CRITICAL EXPIRY RISK)
    const cefixExp = new Date(now.getTime() + 22 * 24 * 60 * 60 * 1000); // 22 DAYS (HIGH EXPIRY RISK)
    const pantExp = new Date(now.getTime() + 400 * 24 * 60 * 60 * 1000); 

    const sampleMedicines = [
      {
        name: 'Dolo 650mg Tablet',
        category: 'Analgesics & Antipyretics',
        description: 'First line paracetamol formulation for acute fever, viral headaches, and post-vaccination discomfort.',
        price: 30.50,
        stock: 450,
        manufacturer: 'Micro Labs Limited',
        prescriptionRequired: false,
        expiryDate: doloExp,
        batchNumber: 'B-DLO-650',
        organizationId: org._id,
        branchId: branch._id
      },
      {
        name: 'Azithromycin 500mg (Azee 500)',
        category: 'Antibiotics & Antimicrobials',
        description: 'Broad-spectrum macrolide antibiotic for upper and lower respiratory bacterial infections.',
        price: 119.00,
        stock: 120,
        manufacturer: 'Cipla Limited',
        prescriptionRequired: true,
        expiryDate: azeExp,
        batchNumber: 'B-AZE-500',
        organizationId: org._id,
        branchId: branch._id
      },
      {
        name: 'Amoxicillin + Clavulanic Acid 625mg (Augmentin)',
        category: 'Antibiotics & Antimicrobials',
        description: 'Potentiated penicillin antibiotic effective against beta-lactamase producing strains.',
        price: 185.00,
        stock: 18, // LOW STOCK RISK
        manufacturer: 'GlaxoSmithKline (GSK)',
        prescriptionRequired: true,
        expiryDate: amxExp,
        batchNumber: 'B-AUG-625',
        organizationId: org._id,
        branchId: branch._id
      },
      {
        name: 'Benadryl Cough Relief Syrup (100ml)',
        category: 'Respiratory & Cold',
        description: 'Diphenhydramine formulation for dry cough relief and allergic throat irritation.',
        price: 125.00,
        stock: 22,
        manufacturer: 'Johnson & Johnson Ltd',
        prescriptionRequired: false,
        expiryDate: coughExp, // 14 DAYS RISK!
        batchNumber: 'B-BND-110',
        organizationId: org._id,
        branchId: branch._id
      },
      {
        name: 'Cefixime 200mg (Taxim-O 200)',
        category: 'Antibiotics & Antimicrobials',
        description: 'Third-generation cephalosporin for severe respiratory tract and urinary infections.',
        price: 165.00,
        stock: 15,
        manufacturer: 'Alkem Laboratories',
        prescriptionRequired: true,
        expiryDate: cefixExp, // 22 DAYS RISK!
        batchNumber: 'B-TAX-901',
        organizationId: org._id,
        branchId: branch._id
      },
      {
        name: 'Pantoprazole 40mg (Pan-40)',
        category: 'Gastroenterology',
        description: 'Proton pump inhibitor (PPI) for GERD, gastric hyperacidity, and peptic ulcer prophylaxis.',
        price: 95.00,
        stock: 14, // LOW STOCK RISK
        manufacturer: 'Alkem Laboratories',
        prescriptionRequired: true,
        expiryDate: pantExp,
        batchNumber: 'B-PAN-402',
        organizationId: org._id,
        branchId: branch._id
      },
      {
        name: 'Metformin 500mg PR (Glycomet 500)',
        category: 'Endocrinology & Diabetes',
        description: 'Prolonged release biguanide for type 2 diabetes glycemic control.',
        price: 42.00,
        stock: 650,
        manufacturer: 'USV Private Limited',
        prescriptionRequired: true,
        expiryDate: doloExp,
        batchNumber: 'B-GLY-880',
        organizationId: org._id,
        branchId: branch._id
      },
      {
        name: 'Atorvastatin 10mg (Atorva 10)',
        category: 'Cardiovascular',
        description: 'HMG-CoA reductase inhibitor for hypercholesterolemia and cardiovascular risk mitigation.',
        price: 110.00,
        stock: 320,
        manufacturer: 'Zydus Lifesciences',
        prescriptionRequired: true,
        expiryDate: azeExp,
        batchNumber: 'B-ATR-334',
        organizationId: org._id,
        branchId: branch._id
      },
      {
        name: 'Cetirizine 10mg (Cetzine)',
        category: 'Antihistamines',
        description: 'Second-generation H1 antagonist for allergic rhinitis, urticaria, and skin allergies.',
        price: 18.00,
        stock: 580,
        manufacturer: 'Dr. Reddy Laboratories',
        prescriptionRequired: false,
        expiryDate: doloExp,
        batchNumber: 'B-CTZ-551',
        organizationId: org._id,
        branchId: branch._id
      },
      {
        name: 'Insulin Glargine 100 IU/ml (Lantus Solostar)',
        category: 'Endocrinology & Diabetes',
        description: 'Long-acting recombinant human insulin analog pen for once-daily basal insulin.',
        price: 650.00,
        stock: 9, // CRITICAL LOW STOCK!
        manufacturer: 'Sanofi India',
        prescriptionRequired: true,
        expiryDate: amxExp,
        batchNumber: 'B-LAN-003',
        organizationId: org._id,
        branchId: branch._id
      }
    ];

    const insertedMeds = await Medicine.insertMany(sampleMedicines);
    console.log(`Inserted ${insertedMeds.length} medicines into pharmacy inventory.`);

    // 4. Seed Orders
    await Order.deleteMany({});
    const sampleOrders = [
      {
        user: patientUser._id,
        orderItems: [
          {
            name: 'Azithromycin 500mg (Azee 500)',
            qty: 2,
            price: 119.00,
            medicine: insertedMeds[1]._id
          },
          {
            name: 'Dolo 650mg Tablet',
            qty: 1,
            price: 30.50,
            medicine: insertedMeds[0]._id
          }
        ],
        totalPrice: 268.50,
        status: 'Pending',
        prescriptionUrl: 'https://images.pexels.com/photos/5998499/pexels-photo-5998499.jpeg'
      },
      {
        user: patientUser._id,
        orderItems: [
          {
            name: 'Pantoprazole 40mg (Pan-40)',
            qty: 1,
            price: 95.00,
            medicine: insertedMeds[5]._id
          }
        ],
        totalPrice: 95.00,
        status: 'Processing',
        prescriptionUrl: 'https://images.pexels.com/photos/5998499/pexels-photo-5998499.jpeg'
      },
      {
        user: patientUser._id,
        orderItems: [
          {
            name: 'Cetirizine 10mg (Cetzine)',
            qty: 3,
            price: 18.00,
            medicine: insertedMeds[8]._id
          }
        ],
        totalPrice: 54.00,
        status: 'Ready'
      },
      {
        user: patientUser._id,
        orderItems: [
          {
            name: 'Metformin 500mg PR (Glycomet 500)',
            qty: 2,
            price: 42.00,
            medicine: insertedMeds[6]._id
          }
        ],
        totalPrice: 84.00,
        status: 'Delivered'
      }
    ];
    await Order.insertMany(sampleOrders);
    console.log(`Inserted ${sampleOrders.length} patient orders.`);

    // 5. Seed Prescription Queue
    await Prescription.deleteMany({});
    const samplePrescriptions = [
      {
        user: patientUser._id,
        doctorName: 'Dr. Ramesh Kulkarni, MD',
        patientName: 'Rahul Sharma',
        prescriptionDate: new Date().toISOString().split('T')[0],
        overallConfidence: 0.94,
        status: 'Pending Review',
        extractedText: 'Rx: Tab Azithromycin 500mg 1 OD x 3 days. Tab Dolo 650mg SOS fever. Dr. Ramesh Kulkarni MCI-2014-9988',
        detectedMedicines: [
          {
            medicineName: 'Azithromycin 500mg',
            dosage: '500mg',
            frequency: '1 OD (Once Daily)',
            duration: '3 Days',
            instructions: 'Post dinner with water',
            confidence: 0.96,
            price: 119.00,
            stock: 120
          },
          {
            medicineName: 'Dolo 650mg',
            dosage: '650mg',
            frequency: 'SOS (When needed)',
            duration: 'As required',
            instructions: 'Max 3 tablets in 24 hours',
            confidence: 0.92,
            price: 30.50,
            stock: 450
          }
        ],
        notes: 'Clinical verification required for antibiotic dosage duration.'
      },
      {
        user: patientUser._id,
        doctorName: 'Dr. Priya Sundaram, MBBS DNB',
        patientName: 'Meera Nambiar',
        prescriptionDate: new Date().toISOString().split('T')[0],
        overallConfidence: 0.88,
        status: 'Pending Review',
        extractedText: 'Rx: Augmentin 625mg BD x 5 days, Pan-40 1 OD before breakfast x 7 days.',
        detectedMedicines: [
          {
            medicineName: 'Augmentin 625mg',
            dosage: '625mg',
            frequency: '1 BD (Twice Daily)',
            duration: '5 Days',
            instructions: 'After meals',
            confidence: 0.89,
            price: 185.00,
            stock: 18
          },
          {
            medicineName: 'Pan-40',
            dosage: '40mg',
            frequency: '1 OD',
            duration: '7 Days',
            instructions: 'Empty stomach in morning',
            confidence: 0.93,
            price: 95.00,
            stock: 14
          }
        ],
        notes: 'Low inventory alert for Augmentin 625mg (18 left).'
      },
      {
        user: patientUser._id,
        doctorName: 'Dr. Ananya Roy, MD',
        patientName: 'Vikram Joshi',
        prescriptionDate: new Date().toISOString().split('T')[0],
        overallConfidence: 0.97,
        status: 'Approved',
        extractedText: 'Rx: Glycomet 500mg 1 BD x 30 days. Atorva 10mg 1 HS x 30 days.',
        detectedMedicines: [
          {
            medicineName: 'Glycomet 500mg',
            dosage: '500mg',
            frequency: '1 BD',
            duration: '30 Days',
            instructions: 'After breakfast and dinner',
            confidence: 0.98,
            price: 42.00,
            stock: 650
          }
        ],
        pharmacistNotes: 'Verified against electronic patient profile. Approved for dispensing.'
      }
    ];
    await Prescription.insertMany(samplePrescriptions);
    console.log(`Inserted ${samplePrescriptions.length} prescriptions.`);

    // 6. Seed Blockchain Ledger
    await BlockchainLedger.deleteMany({});
    let prevHash = '0'.repeat(64);
    const ledgerData = [
      {
        medicineName: 'Paracetamol 650mg (Dolo 650)',
        genericName: 'Paracetamol',
        batchNumber: 'B-DLO-650',
        manufacturer: 'Micro Labs Limited',
        manufacturingDate: new Date('2024-06-10'),
        expiryDate: doloExp,
        distributor: 'Apollo Central Logistics Depot',
        pharmacyName: 'Demo Dispensary Metro Hub',
        pharmacyLocation: 'Bengaluru, KA',
        supplyChainStage: 'Dispensary Stocked',
        verificationStatus: 'Verified',
        verificationAttempts: 142,
        suspiciousAttempts: 0
      },
      {
        medicineName: 'Azithromycin 500mg (Azee 500)',
        genericName: 'Azithromycin',
        batchNumber: 'B-AZE-500',
        manufacturer: 'Cipla Limited',
        manufacturingDate: new Date('2024-05-15'),
        expiryDate: azeExp,
        distributor: 'Cipla Certified Supply Logistics',
        pharmacyName: 'Demo Dispensary Metro Hub',
        pharmacyLocation: 'Bengaluru, KA',
        supplyChainStage: 'Verified In-Store',
        verificationStatus: 'Verified',
        verificationAttempts: 88,
        suspiciousAttempts: 0
      },
      {
        medicineName: 'Amoxicillin Clavulanate 625mg (Augmentin)',
        genericName: 'Amoxicillin + Clavulanate',
        batchNumber: 'B-AUG-625',
        manufacturer: 'GlaxoSmithKline',
        manufacturingDate: new Date('2024-07-01'),
        expiryDate: amxExp,
        distributor: 'Medreich Pharma Wholesalers',
        pharmacyName: 'Demo Dispensary Metro Hub',
        pharmacyLocation: 'Bengaluru, KA',
        supplyChainStage: 'Dispensary Stocked',
        verificationStatus: 'Verified',
        verificationAttempts: 34,
        suspiciousAttempts: 0
      },
      {
        medicineName: 'Counterfeit Flagged Test Batch',
        genericName: 'Unknown Compound',
        batchNumber: 'B-FAKE-999',
        manufacturer: 'Unlicensed Third Party Vendor',
        manufacturingDate: new Date('2024-01-01'),
        expiryDate: new Date('2025-01-01'),
        distributor: 'Unverified Freight Route',
        pharmacyName: 'Demo Dispensary Metro Hub',
        pharmacyLocation: 'Bengaluru, KA',
        supplyChainStage: 'Quarantined at Inbound Inspection',
        verificationStatus: 'Flagged / Counterfeit',
        verificationAttempts: 9,
        suspiciousAttempts: 9
      }
    ];

    for (const item of ledgerData) {
      const blockContent = { ...item, previousHash: prevHash, timestamp: new Date().toISOString() };
      const currentHash = calculateHash(blockContent);
      await BlockchainLedger.create({
        ...blockContent,
        blockchainHash: currentHash,
        registeredBy: pharmacyUser._id
      });
      prevHash = currentHash;
    }
    console.log(`Inserted ${ledgerData.length} immutable blockchain blocks.`);

    // 7. Seed Verification Cases
    await VerificationCase.deleteMany({});
    const sampleCases = [
      {
        caseReference: 'PV-CASE-2024-001',
        subjectReference: 'PAT-99120: Rahul Sharma',
        status: 'VERIFIED',
        reviewRequired: false,
        organizationId: org._id,
        branchId: branch._id,
        createdBy: pharmacyUser._id
      },
      {
        caseReference: 'PV-CASE-2024-002',
        subjectReference: 'PAT-88143: Meera Nambiar',
        status: 'NEEDS_REVIEW',
        reviewRequired: true,
        organizationId: org._id,
        branchId: branch._id,
        createdBy: pharmacyUser._id
      },
      {
        caseReference: 'PV-CASE-2024-003',
        subjectReference: 'BAT-999: Counterfeit Intercept',
        status: 'REJECTED',
        reviewRequired: true,
        organizationId: org._id,
        branchId: branch._id,
        createdBy: pharmacyUser._id
      }
    ];
    await VerificationCase.insertMany(sampleCases);
    console.log(`Inserted ${sampleCases.length} verification cases.`);

    // 8. Seed Workflow Audits
    await WorkflowAudit.deleteMany({});
    const sampleWorkflows = [
      {
        workflowId: 'WF-DISP-001',
        workflowName: 'Prescription Auto-Verification Pipeline',
        trigger: 'PATIENT_UPLOAD',
        riskLevel: 'Low',
        approvalRequired: false,
        approvalStatus: 'approved',
        approvedBy: pharmacyUser._id,
        actionsExecuted: [
          { action: 'OCR Optical Extraction', status: 'completed' },
          { action: 'CDSCO Database Consistency Check', status: 'completed' }
        ]
      },
      {
        workflowId: 'WF-SEC-002',
        workflowName: 'Counterfeit Batch Interception & CDSCO Reporting',
        trigger: 'BARCODE_TAMPER_DETECTED',
        riskLevel: 'Critical',
        approvalRequired: true,
        approverRole: 'pharmacy',
        approvalStatus: 'pending',
        actionsExecuted: [
          { action: 'Quarantine Protocol Initiated', status: 'escalated' }
        ],
        escalationEvents: [
          { reason: 'Genesis hash mismatch on batch B-FAKE-999', targetRole: 'super_admin' }
        ]
      },
      {
        workflowId: 'WF-EXP-003',
        workflowName: 'FEFO Stock Expiry Markdown Rotation',
        trigger: 'SCHEDULED_EXPIRY_SCAN',
        riskLevel: 'Medium',
        approvalRequired: true,
        approverRole: 'pharmacy',
        approvalStatus: 'pending',
        actionsExecuted: [
          { action: 'Flagged Benadryl Syrup (14 days remaining)', status: 'pending' }
        ]
      }
    ];
    await WorkflowAudit.insertMany(sampleWorkflows);
    console.log(`Inserted ${sampleWorkflows.length} workflow audits.`);

    console.log('✅ Pharmacy Hub Database successfully seeded with all realistic operations data!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedPharmacyHub();
