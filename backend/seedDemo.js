const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/userModel');

dotenv.config();

const seed = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed synthetic demo accounts when NODE_ENV=production.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Create Demo Patient
    const patientExists = await User.findOne({ email: 'patient@test.com' });
    if (!patientExists) {
      await User.create({
        name: 'Demo Patient',
        email: 'patient@test.com',
        password: 'password123',
        role: 'patient'
      });
      console.log('✅ Demo Patient created');
    }

    // Create Demo Pharmacy
    const pharmacyExists = await User.findOne({ email: 'pharmacy@test.com' });
    if (!pharmacyExists) {
      await User.create({
        name: 'Demo Pharmacy Hub',
        email: 'pharmacy@test.com',
        password: 'password123',
        role: 'pharmacy'
      });
      console.log('✅ Demo Pharmacy User created');
    }

    // Create Demo Reviewer
    const reviewerExists = await User.findOne({ email: 'reviewer@test.com' });
    if (!reviewerExists) {
      await User.create({
        name: 'Clinical Claims Reviewer',
        email: 'reviewer@test.com',
        password: 'password123',
        role: 'claims_reviewer'
      });
      console.log('✅ Demo Reviewer User created');
    }

    console.log('🎉 Demo Setup Complete!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
