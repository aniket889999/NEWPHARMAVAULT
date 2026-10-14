const asyncHandler = require('../middleware/asyncHandler');

// Mock CDSCO Database
const cdscoDatabase = {
  'paracetamol': { status: 'Approved', license: 'DL-IND-8821', note: 'Standard OTC Painkiller' },
  'dolo': { status: 'Approved', license: 'DL-IND-8822', note: 'Standard Antipyretic' },
  'azithromycin': { status: 'Approved', license: 'DL-IND-9910', note: 'Prescription Antibiotic' },
  'ranitidine': { status: 'Suspended', license: 'DL-IND-5050', note: 'Suspended pending NDMA impurities review' },
  'nimesulide': { status: 'Banned', license: 'REVOKED', note: 'Banned for pediatric use due to hepatotoxicity' },
};

// @desc    Get CDSCO status for a medicine
// @route   GET /api/regulatory/cdsco/:medicine
// @access  Public
const getCDSCOStatus = asyncHandler(async (req, res) => {
  const medicineName = req.params.medicine.toLowerCase();
  
  // Find substring match in mock DB
  let match = null;
  for (const [key, val] of Object.entries(cdscoDatabase)) {
    if (medicineName.includes(key)) {
      match = val;
      break;
    }
  }

  if (match) {
    res.json({
      verified: true,
      status: match.status,
      licenseNumber: match.license,
      notes: match.note
    });
  } else {
    // Default fallback for demo
    res.json({
      verified: true,
      status: 'Approved',
      licenseNumber: 'DL-IND-GENERIC-' + Math.floor(Math.random() * 10000),
      notes: 'General Approval'
    });
  }
});

// @desc    Get Pharmacy NABH Status
// @route   GET /api/regulatory/pharmacy-status
// @access  Public
const getPharmacyStatus = asyncHandler(async (req, res) => {
  res.json({
    nabhCertified: true,
    licenseNumber: 'NABH-PH-2024-8911',
    validTill: '2027-12-31',
    status: 'Active'
  });
});

// @desc    Check Insurance Coverage
// @route   POST /api/regulatory/insurance-check
// @access  Public
const checkInsurance = asyncHandler(async (req, res) => {
  const { providerName, policyNumber, medicines } = req.body;
  
  if (!providerName || !policyNumber || !medicines) {
    res.status(400); throw new Error('Missing insurance details');
  }

  // Mock logic: some expensive or chronic meds are covered (e.g., Pan 40, Metformin, Amlodipine)
  const coveredKeywords = ['pantoprazole', 'metformin', 'amlodipine', 'pan 40', 'glycomet', 'amlokind'];
  
  const results = medicines.map(med => {
    const isCovered = coveredKeywords.some(keyword => med.name.toLowerCase().includes(keyword));
    return {
      medicineId: med.medicine,
      name: med.name,
      covered: isCovered,
      coveragePercentage: isCovered ? 80 : 0 // 80% coverage
    };
  });

  const totalDiscount = results.reduce((acc, item) => {
    if (item.covered) {
       const itemTotal = medicines.find(m => m.medicine === item.medicineId).price * medicines.find(m => m.medicine === item.medicineId).qty;
       return acc + (itemTotal * 0.8);
    }
    return acc;
  }, 0);

  res.json({
    validPolicy: true,
    provider: providerName,
    coverageDetails: results,
    totalDiscountAmount: totalDiscount
  });
});

module.exports = {
  getCDSCOStatus, getPharmacyStatus, checkInsurance
};
