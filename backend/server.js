const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env') });

const { validateEnv } = require('./config/envValidator');
validateEnv();

const connectDB = require('./config/db');
const PORT = process.env.PORT || 5001;

async function startServer() {
  // Do not accept patient/document requests until the database is connected.
  await connectDB();
  const app = require('./app');
  const server = app.listen(PORT, () => console.log(`PharmaVault API listening on port ${PORT}.`));
  const shutdown = () => {
    const deadline = setTimeout(() => process.exit(1), 15000);
    deadline.unref();
    server.close(() => process.exit(0));
    server.closeIdleConnections();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

startServer().catch(() => {
  console.error('PharmaVault API could not start.');
  process.exit(1);
});
