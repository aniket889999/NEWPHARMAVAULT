const asyncHandler = require('../middleware/asyncHandler');
const orchestrator = require('../agents/orchestrator');

// @desc    Run Multi-Agent Orchestration
// @route   POST /api/agents/orchestrate
// @access  Public (or Private depending on userRole)
const runOrchestrator = asyncHandler(async (req, res) => {
  const { query } = req.body;
  
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized for agent orchestration');
  }
  
  const userId = req.user._id;
  const userRole = req.user.role;

  if (!query) {
    res.status(400);
    throw new Error('Query is required for agent orchestration');
  }

  const result = await orchestrator.run(query, userRole, userId, req.tenantContext);
  res.status(200).json(result);
});

module.exports = { runOrchestrator };
