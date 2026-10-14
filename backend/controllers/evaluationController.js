const path = require('path');
const fs = require('fs');

// @desc    Get the latest evaluation results
// @route   GET /api/evaluation/results
// @access  Public (for research purposes)
const getEvaluationResults = async (req, res) => {
  try {
    const resultsPath = path.join(__dirname, '../evaluation/results/latestResults.json');
    const rawData = fs.readFileSync(resultsPath, 'utf-8');
    const results = JSON.parse(rawData);
    res.status(200).json(results);
  } catch (error) {
    console.error("Evaluation Controller Error:", error);
    res.status(500).json({ message: "Failed to load evaluation results", error: error.message });
  }
};

module.exports = {
  getEvaluationResults
};
