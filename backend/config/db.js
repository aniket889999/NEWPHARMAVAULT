const mongoose = require('mongoose');

function configureDatabaseSecurity() {
  mongoose.set('strictQuery', true);
  // Request selector objects are rejected by requestSecurity.js before routes.
  // Global sanitizeFilter would rewrite trusted $in/$gt server queries into $eq.
  mongoose.set('sanitizeFilter', false);
}

const connectDB = async () => {
  try {
    configureDatabaseSecurity();

    const timeout = Number.parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || '10000', 10);
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: process.env.NODE_ENV !== 'production',
      connectTimeoutMS: Number.isInteger(timeout) && timeout > 0 ? timeout : 10000,
      serverSelectionTimeoutMS: Number.isInteger(timeout) && timeout > 0 ? timeout : 10000
    });
    console.log('MongoDB connected.');
  } catch (error) {
    // Do not print a MongoDB URI: it can contain credentials.
    console.error(`❌ MongoDB connection failed: ${error.name || 'ConnectionError'}`);
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.configureDatabaseSecurity = configureDatabaseSecurity;
module.exports.isDatabaseReady = () => mongoose.connection.readyState === 1;
