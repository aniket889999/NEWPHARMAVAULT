const asyncHandler = require('../middleware/asyncHandler');
const patientTimelineService = require('../intelligence/patient/patientTimelineService');
const adherenceService = require('../intelligence/patient/adherenceService');
const refillPredictionService = require('../intelligence/patient/refillPredictionService');
const insightEngine = require('../intelligence/patient/insightEngine');
const { medicineNodes } = require('../graph/medicineGraphData');

// @desc    Get patient medication timeline
// @route   GET /api/intelligence/timeline
// @access  Private
const getTimeline = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user._id : "mock_user";
  const timeline = await patientTimelineService.getTimeline(userId);
  res.status(200).json(timeline);
});

// @desc    Get patient adherence score
// @route   GET /api/intelligence/adherence
// @access  Private
const getAdherence = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user._id : "mock_user";
  const score = await adherenceService.calculateScore(userId);
  res.status(200).json(score);
});

// @desc    Get refill risk predictions
// @route   GET /api/intelligence/refill-risk
// @access  Private
const getRefillRisk = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user._id : "mock_user";
  const risks = await refillPredictionService.getRefillRisks(userId);
  res.status(200).json(risks);
});

// @desc    Get personalized AI insights
// @route   GET /api/intelligence/insights
// @access  Private
const getInsights = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user._id : "mock_user";
  const adherence = await adherenceService.calculateScore(userId);
  const refills = await refillPredictionService.getRefillRisks(userId);
  const timeline = await patientTimelineService.getTimeline(userId);
  
  const insights = await insightEngine.generateInsights(adherence, refills, timeline);
  res.status(200).json(insights);
});

// @desc    Get patient health graph
// @route   GET /api/intelligence/patient-graph
// @access  Private
const getPatientGraph = asyncHandler(async (req, res) => {
  // Extending GraphRAG to include patient node and relationships
  const graphData = {
    nodes: [
      { id: "patient_1", label: "Patient Profile", type: "patient" },
      { id: "metformin", label: "Metformin 500mg", type: "medicine" },
      { id: "diabetes", label: "Type 2 Diabetes", type: "condition" },
      { id: "adherence_risk", label: "Low Adherence", type: "risk" }
    ],
    edges: [
      { source: "patient_1", target: "metformin", label: "takes" },
      { source: "patient_1", target: "diabetes", label: "chronic_condition" },
      { source: "patient_1", target: "adherence_risk", label: "has_flag" },
      { source: "metformin", target: "diabetes", label: "treats" }
    ]
  };
  
  res.status(200).json(graphData);
});

module.exports = {
  getTimeline,
  getAdherence,
  getRefillRisk,
  getInsights,
  getPatientGraph
};
