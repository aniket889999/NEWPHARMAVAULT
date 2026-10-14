const asyncHandler = require('../middleware/asyncHandler');
const Prescription = require('../models/prescriptionModel');

const prescriptionParserService = require('../services/prescriptionParserService');

// @desc    Analyze OCR/Image for Structured Data
// @route   POST /api/prescriptions/analyze
// @access  Private
const analyzePrescription = asyncHandler(async (req, res) => {
  const { rawText, imageBase64 } = req.body;
  if (!rawText && !imageBase64) {
    res.status(400); throw new Error('No prescription text or image provided');
  }

  const structuredData = await prescriptionParserService.parse(rawText, imageBase64);
  res.status(200).json(structuredData);
});

// @desc    Save OCR prescription
// @route   POST /api/prescriptions/save
// @access  Private
const savePrescription = asyncHandler(async (req, res) => {
  const { imageUrl, extractedText, detectedMedicines, doctorName, patientName, prescriptionDate, overallConfidence, notes } = req.body;

  const prescription = new Prescription({
    user: req.user._id,
    imageUrl,
    extractedText,
    detectedMedicines,
    doctorName,
    patientName,
    prescriptionDate,
    overallConfidence,
    notes
  });

  const createdPrescription = await prescription.save();
  res.status(201).json(createdPrescription);
});

// @desc    Get user's saved prescriptions
// @route   GET /api/prescriptions/my-prescriptions
// @access  Private
const getMyPrescriptions = asyncHandler(async (req, res) => {
  const prescriptions = await Prescription.find({ user: req.user._id }).sort('-createdAt');
  res.json(prescriptions);
});

module.exports = {
  analyzePrescription,
  savePrescription,
  getMyPrescriptions
};
