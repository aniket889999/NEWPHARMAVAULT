const explainabilityService = require('../services/explainabilityService');

// @desc    Generate explanation for a specific response
// @route   POST /api/explainability/reason
// @access  Public
const generateExplanation = async (req, res) => {
  try {
    const { query, orchestratorOutput } = req.body;
    
    if (!orchestratorOutput) {
      return res.status(400).json({ message: "orchestratorOutput is required" });
    }

    const explanation = explainabilityService.generateExplanation({
      query,
      ...orchestratorOutput
    });

    res.status(200).json({
      explanation: explanation,
      confidenceBreakdown: explanation.confidenceBreakdown,
      hallucinationRisk: explanation.hallucinationRisk,
      evidenceGraph: orchestratorOutput.graphEvidence || []
    });

  } catch (error) {
    console.error("Explainability Error:", error);
    res.status(500).json({ message: "Failed to generate explanation", error: error.message });
  }
};

module.exports = {
  generateExplanation
};
