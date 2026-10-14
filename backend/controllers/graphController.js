const asyncHandler = require('../middleware/asyncHandler');
const graphAdapter = require('../graph/graphAdapter');
const graphTraversalService = require('../graph/graphTraversalService');
const graphExplainabilityService = require('../graph/graphExplainabilityService');

// @desc    Get medicine traversal paths
// @route   GET /api/graph/medicine/:name
// @access  Public
const getMedicineGraph = asyncHandler(async (req, res) => {
  const { name } = req.params;
  const results = graphAdapter.getEvidence([name]);
  
  if (results.length === 0) {
    return res.status(404).json({ message: "Node not found in Knowledge Graph" });
  }
  
  const explanation = graphExplainabilityService.generateExplanation(results);
  
  res.status(200).json({
    data: results[0],
    explanation
  });
});

// @desc    Traverse symptoms to medicines
// @route   POST /api/graph/traverse
// @access  Public
const traverseGraph = asyncHandler(async (req, res) => {
  const { symptom } = req.body;
  if (!symptom) return res.status(400).json({ message: "Symptom is required" });
  
  const medicines = graphTraversalService.findMedicinesForSymptom(symptom);
  res.status(200).json({ symptom, treats: medicines });
});

// @desc    Patient Graph Extensions (simulated)
// @route   GET /api/graph/patient/:id
// @access  Private
const getPatientGraph = asyncHandler(async (req, res) => {
  res.status(200).json({
    node: "Patient",
    paths: [
      "Patient → takes → Metformin 500mg",
      "Patient → missed → Reminder (Metformin)",
      "Patient → uploaded → Prescription (OCR)"
    ]
  });
});

// @desc    Pharmacy Graph Extensions (simulated)
// @route   GET /api/graph/pharmacy/:id
// @access  Private
const getPharmacyGraph = asyncHandler(async (req, res) => {
  res.status(200).json({
    node: "Pharmacy",
    paths: [
      "Pharmacy → stocks → Dolo 650",
      "Dolo 650 → supplied_by → Medico Pharma Distributors",
      "Medico Pharma Distributors → trust_score → 98"
    ]
  });
});

module.exports = {
  getMedicineGraph,
  traverseGraph,
  getPatientGraph,
  getPharmacyGraph
};
