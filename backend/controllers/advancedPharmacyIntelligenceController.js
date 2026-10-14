const asyncHandler = require('../middleware/asyncHandler');
const demandForecastService = require('../intelligence/pharmacy/demandForecastService');
const deadStockService = require('../intelligence/pharmacy/deadStockService');
const reorderEngine = require('../intelligence/pharmacy/reorderEngine');
const supplierIntelligenceService = require('../intelligence/pharmacy/supplierIntelligenceService');
const inventoryMovementService = require('../intelligence/pharmacy/inventoryMovementService');
const substituteRankingService = require('../intelligence/pharmacy/substituteRankingService');

// @desc    Get demand forecasts
// @route   GET /api/pharmacy-intelligence/forecast
// @access  Private (Pharmacy)
const getForecasts = asyncHandler(async (req, res) => {
  const pharmacyId = req.user ? req.user._id : "mock_pharmacy";
  const data = await demandForecastService.getForecasts(pharmacyId);
  res.status(200).json(data);
});

// @desc    Get dead stock alerts
// @route   GET /api/pharmacy-intelligence/dead-stock
// @access  Private (Pharmacy)
const getDeadStock = asyncHandler(async (req, res) => {
  const pharmacyId = req.user ? req.user._id : "mock_pharmacy";
  const data = await deadStockService.getDeadStock(pharmacyId);
  res.status(200).json(data);
});

// @desc    Get smart reorder suggestions
// @route   GET /api/pharmacy-intelligence/reorder
// @access  Private (Pharmacy)
const getReorder = asyncHandler(async (req, res) => {
  const pharmacyId = req.user ? req.user._id : "mock_pharmacy";
  const data = await reorderEngine.getReorderSuggestions(pharmacyId);
  res.status(200).json(data);
});

// @desc    Get supplier reliability intelligence
// @route   GET /api/pharmacy-intelligence/suppliers
// @access  Private (Pharmacy)
const getSuppliers = asyncHandler(async (req, res) => {
  const pharmacyId = req.user ? req.user._id : "mock_pharmacy";
  const data = await supplierIntelligenceService.getSuppliers(pharmacyId);
  res.status(200).json(data);
});

// @desc    Get ranked substitutes
// @route   GET /api/pharmacy-intelligence/substitutes/:medicine
// @access  Private (Pharmacy)
const getSubstitutes = asyncHandler(async (req, res) => {
  const pharmacyId = req.user ? req.user._id : "mock_pharmacy";
  const data = await substituteRankingService.getRankedSubstitutes(pharmacyId, req.params.medicine);
  res.status(200).json(data);
});

// @desc    Get seasonal trends
// @route   GET /api/pharmacy-intelligence/seasonal
// @access  Private (Pharmacy)
const getSeasonal = asyncHandler(async (req, res) => {
  const pharmacyId = req.user ? req.user._id : "mock_pharmacy";
  const data = await inventoryMovementService.getSeasonalTrends(pharmacyId);
  res.status(200).json(data);
});

module.exports = {
  getForecasts,
  getDeadStock,
  getReorder,
  getSuppliers,
  getSubstitutes,
  getSeasonal
};
