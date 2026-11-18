/**
 * Showcase data for the final-year demo: ONE synthetic claimant and ONE fictional insurer.
 * All names, emails and policy numbers are invented (".example" domains); no real person or
 * company is represented. Run after `npm run seed:demo`. Refuses to run in production.
 *
 *   npm --prefix backend run seed:showcase
 *
 * Accounts (password: password123)
 *   Claimant          ananya.verma@claimant.example          (patient)
 *   Insurer reviewer  rohit.mehta@sahyog-health.example      (payer_reviewer)
 *   Insurer admin     kavya.iyer@sahyog-health.example       (payer_admin, decides appeals)
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('node:path');
dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/userModel');
const Organization = require('./models/organizationModel');
const Branch = require('./models/branchModel');
const Medicine = require('./models/medicineModel');
const VerificationCase = require('./models/verificationCaseModel');

const INSURER_NAME = 'Sahyog Health Assurance (Demo)';
const PASSWORD = 'password123';

async function upsertUser({ email, name, role, organizationId }) {
  let user = await User.findOne({ email });
  if (!user) user = new User({ email, name, role, password: PASSWORD });
  user.name = name;
  user.role = role;
  user.organizationId = organizationId || undefined;
  user.active = true;
  // Clear any sign-in lockout left from earlier failed attempts.
  user.login = { failedCount: 0, lockedUntil: null, sources: [] };
  await user.save();
  return user;
}

(async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed showcase data when NODE_ENV=production.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pharmavault');
  try {
    const owner = await User.findOne({ email: 'pharmacy@test.com' });
    if (!owner) throw new Error('Run `npm run seed:demo` first (needs the demo pharmacy).');

    let insurer = await Organization.findOne({ name: INSURER_NAME });
    if (!insurer) {
      insurer = await Organization.create({
        name: INSURER_NAME, owner: owner._id, kind: 'payer', plan: 'Enterprise', status: 'active',
        contactEmail: 'claims@sahyog-health.example', contactPhone: '+91 00000 00000',
        address: { street: '4th Floor, Demo Towers', city: 'Pune', state: 'Maharashtra', zip: '411001', country: 'India' }
      });
    }
    // Nearby medicines (Pune): map positions for the demo branch and synthetic pharmacies with
    // their own inventory. Fictional store names; real Pune area coordinates.
    await Branch.updateMany({ name: 'Demo Dispensary - Central Bengaluru Hub' }, { $set: { coordinates: { lat: 18.5150, lng: 73.8780 }, location: 'MG Road, Camp, Pune (demo hub)' } });
    const inOneYear = new Date(Date.now() + 365 * 86_400_000);
    const DOLO = 'Dolo 650mg Tablet', AZEE = 'Azithromycin 500mg (Azee 500)', CTZ = 'Cetirizine 10mg Tablet', PAN = 'Pantoprazole 40mg Tablet', AMOX = 'Amoxicillin 500mg Capsule';
    const pharmacies = [
      { org: 'Shree Sai Medicals (Demo)', branch: 'Shree Sai Medicals - Shivajinagar', location: 'FC Road, Shivajinagar, Pune', lat: 18.5308, lng: 73.8475, license: 'MH-DEMO-21B-2001',
        stock: [[DOLO, 120, 31, 'Micro Labs Limited', 'B-DLO-650', false], [AZEE, 18, 118, 'Cipla Limited', 'B-AZE-500', true], [CTZ, 60, 22, "Dr. Reddy's Laboratories", 'B-CTZ-010', false]] },
      { org: 'Sanjeevani Medical Store (Demo)', branch: 'Sanjeevani Medical Store - Deccan', location: 'JM Road, Deccan Gymkhana, Pune', lat: 18.5167, lng: 73.8411, license: 'MH-DEMO-21B-2002',
        stock: [[DOLO, 45, 30, 'Micro Labs Limited', 'B-DLO-650', false], [AMOX, 30, 72, 'Alkem Laboratories', 'B-AMX-500', true]] },
      { org: 'CareWell Pharmacy (Demo)', branch: 'CareWell Pharmacy - Kothrud', location: 'Karve Road, Kothrud, Pune', lat: 18.5074, lng: 73.8077, license: 'MH-DEMO-21B-2003',
        stock: [[DOLO, 6, 29, 'Micro Labs Limited', 'B-DLO-650', false], [PAN, 40, 95, 'Alkem Laboratories', 'B-PAN-402', false]] },
      { org: 'LifeLine Chemists (Demo)', branch: 'LifeLine Chemists - Koregaon Park', location: 'North Main Road, Koregaon Park, Pune', lat: 18.5362, lng: 73.8940, license: 'MH-DEMO-21B-2004',
        stock: [[DOLO, 80, 32, 'Micro Labs Limited', 'B-DLO-650', false], [CTZ, 25, 24, "Dr. Reddy's Laboratories", 'B-CTZ-010', false]] },
      { org: 'Arogya Pharmacy (Demo)', branch: 'Arogya Pharmacy - Aundh', location: 'ITI Road, Aundh, Pune', lat: 18.5590, lng: 73.8070, license: 'MH-DEMO-21B-2005',
        stock: [[DOLO, 200, 28, 'Micro Labs Limited', 'B-DLO-650', false], [AMOX, 12, 70, 'Alkem Laboratories', 'B-AMX-500', true]] },
      { org: 'NewCare Medicos (Demo)', branch: 'NewCare Medicos - Hadapsar', location: 'Solapur Road, Hadapsar, Pune', lat: 18.5089, lng: 73.9260, license: 'MH-DEMO-21B-2006',
        stock: [[DOLO, 15, 33, 'Micro Labs Limited', 'B-DLO-650', false]] }
    ];
    for (const p of pharmacies) {
      let org = await Organization.findOne({ name: p.org });
      if (!org) org = await Organization.create({ name: p.org, owner: owner._id, kind: 'pharmacy', plan: 'Starter', status: 'active', contactEmail: 'store@pharmacy.example' });
      let branch = await Branch.findOne({ organizationId: org._id, name: p.branch });
      if (!branch) branch = await Branch.create({ organizationId: org._id, name: p.branch, licenseNumber: p.license, location: p.location, coordinates: { lat: p.lat, lng: p.lng } });
      for (const [name, stock, price, manufacturer, batchNumber, prescriptionRequired] of p.stock) {
        await Medicine.updateOne(
          { name, branchId: branch._id },
          { $set: { name, category: 'General', description: `${name} (synthetic inventory)`, price, stock, manufacturer, prescriptionRequired, expiryDate: inOneYear, batchNumber, organizationId: org._id, branchId: branch._id } },
          { upsert: true }
        );
      }
    }

    const claimant = await upsertUser({ email: 'ananya.verma@claimant.example', name: 'Ananya Verma', role: 'patient' });
    const reviewer = await upsertUser({ email: 'rohit.mehta@sahyog-health.example', name: 'Rohit Mehta', role: 'payer_reviewer', organizationId: insurer._id });
    const admin = await upsertUser({ email: 'kavya.iyer@sahyog-health.example', name: 'Kavya Iyer', role: 'payer_admin', organizationId: insurer._id });

    // Ananya needs pharmacist-verified cases to submit claims in a live demo.
    const pharmacyOrg = await Organization.findOne({ name: 'Demo Health Pharmacy Network (synthetic)' });
    const pharmacyBranch = pharmacyOrg ? await Branch.findOne({ organizationId: pharmacyOrg._id }) : null;
    const showcaseCases = [
      { caseReference: 'PV-DEMO-ANANYA-001', subjectReference: 'Ananya Verma · Dolo 650 + Azithromycin 500 (synthetic)', status: 'VERIFIED' },
      { caseReference: 'PV-DEMO-ANANYA-002', subjectReference: 'Ananya Verma · Pantoprazole 40 (synthetic)', status: 'VERIFIED' },
      { caseReference: 'PV-DEMO-ANANYA-003', subjectReference: 'Ananya Verma · Cetirizine 10 (synthetic)', status: 'NEEDS_REVIEW' }
    ];
    for (const c of showcaseCases) {
      await VerificationCase.updateOne(
        { caseReference: c.caseReference },
        { $setOnInsert: { ...c, reviewRequired: c.status !== 'VERIFIED', organizationId: pharmacyOrg?._id, branchId: pharmacyBranch?._id, createdBy: claimant._id } },
        { upsert: true }
      );
    }

    console.log(JSON.stringify({
      insurer: { id: String(insurer._id), name: insurer.name },
      accounts: [
        { role: 'claimant', name: claimant.name, email: claimant.email },
        { role: 'insurer reviewer', name: reviewer.name, email: reviewer.email },
        { role: 'insurer admin (appeals)', name: admin.name, email: admin.email }
      ],
      password: PASSWORD,
      cases: showcaseCases.map((c) => `${c.caseReference} (${c.status})`),
      note: 'Synthetic showcase data only. Fictional people and company.'
    }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error('Showcase seed failed:', error.message);
  process.exit(1);
});
