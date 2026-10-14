const express = require('express');
const cors = require('cors');

// Import routes
const medicineRoutes = require('./routes/medicineRoutes');
const userRoutes = require('./routes/userRoutes');
const orderRoutes = require('./routes/orderRoutes');
const chatRoutes = require('./routes/chatRoutes');
const blockchainRoutes = require('./routes/blockchainRoutes');
const regulatoryRoutes = require('./routes/regulatoryRoutes');
const pharmacyRoutes = require('./routes/pharmacyRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');

// Future Phase placeholders
const graphragRoutes = require('./routes/graphragRoutes');
const agentsRoutes = require('./routes/agentsRoutes');
const explainabilityRoutes = require('./routes/explainabilityRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const intelligenceRoutes = require('./routes/intelligenceRoutes');
const advancedPharmacyIntelligenceRoutes = require('./routes/advancedPharmacyIntelligenceRoutes');
const graphRoutes = require('./routes/graphRoutes');
const safetyRoutes = require('./routes/safetyRoutes');
const languageRoutes = require('./routes/languageRoutes');
const workflowRoutes = require('./routes/workflowRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const branchRoutes = require('./routes/branchRoutes');
const trustRagRoutes = require('./routes/trustRagRoutes');

const { protect } = require('./middleware/authMiddleware');
const { tenantMiddleware } = require('./middleware/tenantMiddleware');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { blockLegacyExternalAI, createCorsOptions, getTrustProxySetting, securityHeaders } = require('./config/productionSecurity');
const { rejectQuerySelectors } = require('./config/requestSecurity');
const { configureDatabaseSecurity, isDatabaseReady } = require('./config/db');

const app = express();
configureDatabaseSecurity();

app.disable('x-powered-by');
const trustProxy = getTrustProxySetting();
if (trustProxy) app.set('trust proxy', trustProxy);

app.use(securityHeaders);
app.use(cors(createCorsOptions()));
app.use(blockLegacyExternalAI);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(rejectQuerySelectors);

// Metadata-only request logging. Never record URLs, bodies, authorization
// headers, OCR text, filenames, or identifiers that could be sensitive.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'PharmaVault API is running.' });
});

app.get('/api/ready', (req, res) => {
  const ready = isDatabaseReady();
  res.status(ready ? 200 : 503).json({ status: ready ? 'READY' : 'NOT_READY' });
});

app.use('/api/medicines', tenantMiddleware, medicineRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', protect, tenantMiddleware, orderRoutes);
app.use('/api/chat', protect, tenantMiddleware, chatRoutes);
app.use('/api/blockchain', protect, tenantMiddleware, blockchainRoutes);
app.use('/api/regulatory', protect, tenantMiddleware, regulatoryRoutes);
app.use('/api/pharmacy', protect, tenantMiddleware, pharmacyRoutes);
app.use('/api/reminders', protect, tenantMiddleware, reminderRoutes);
app.use('/api/prescriptions', protect, tenantMiddleware, prescriptionRoutes);

// Phase 2 placeholders
app.use('/api/graphrag', protect, tenantMiddleware, graphragRoutes);
app.use('/api/agents', protect, tenantMiddleware, agentsRoutes);
app.use('/api/explainability', protect, tenantMiddleware, explainabilityRoutes);
app.use('/api/evaluation', protect, tenantMiddleware, evaluationRoutes);
app.use('/api/intelligence', protect, tenantMiddleware, intelligenceRoutes);
app.use('/api/pharmacy-intelligence', protect, tenantMiddleware, advancedPharmacyIntelligenceRoutes);
app.use('/api/graph', protect, tenantMiddleware, graphRoutes);
app.use('/api/safety', protect, tenantMiddleware, safetyRoutes);
app.use('/api/language', protect, tenantMiddleware, languageRoutes);
app.use('/api/workflows', protect, tenantMiddleware, workflowRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/branches', branchRoutes);

// PharmaVault TrustRAG v1 Routes
app.use('/api/v1', protect, tenantMiddleware, trustRagRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
