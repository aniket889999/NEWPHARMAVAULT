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

const INSURER_NAME = 'Sahyog Health Assurance (Demo)';
const PASSWORD = 'password123';

async function upsertUser({ email, name, role, organizationId }) {
  let user = await User.findOne({ email });
  if (!user) user = new User({ email, name, role, password: PASSWORD });
  user.name = name;
  user.role = role;
  user.organizationId = organizationId || undefined;
  user.active = true;
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
    const claimant = await upsertUser({ email: 'ananya.verma@claimant.example', name: 'Ananya Verma', role: 'patient' });
    const reviewer = await upsertUser({ email: 'rohit.mehta@sahyog-health.example', name: 'Rohit Mehta', role: 'payer_reviewer', organizationId: insurer._id });
    const admin = await upsertUser({ email: 'kavya.iyer@sahyog-health.example', name: 'Kavya Iyer', role: 'payer_admin', organizationId: insurer._id });

    console.log(JSON.stringify({
      insurer: { id: String(insurer._id), name: insurer.name },
      accounts: [
        { role: 'claimant', name: claimant.name, email: claimant.email },
        { role: 'insurer reviewer', name: reviewer.name, email: reviewer.email },
        { role: 'insurer admin (appeals)', name: admin.name, email: admin.email }
      ],
      password: PASSWORD,
      note: 'Synthetic showcase data only. Fictional people and company.'
    }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error('Showcase seed failed:', error.message);
  process.exit(1);
});
