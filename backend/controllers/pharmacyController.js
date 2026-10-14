const asyncHandler = require('../middleware/asyncHandler');

// Mock Database of Pharmacies
const MOCK_PHARMACIES = [
  { id: 'p1', name: 'Apollo Pharmacy', lat: 19.0760, lng: 72.8777, address: 'Main Street, Mumbai', rating: 4.5, openStatus: true, nabhCertified: true },
  { id: 'p2', name: 'Wellness Forever', lat: 19.0800, lng: 72.8800, address: 'Station Road, Mumbai', rating: 4.8, openStatus: true, nabhCertified: true },
  { id: 'p3', name: 'MedPlus', lat: 19.0700, lng: 72.8700, address: 'Market Square, Mumbai', rating: 4.2, openStatus: false, nabhCertified: false },
  { id: 'p4', name: 'Noble Chemist', lat: 19.0850, lng: 72.8650, address: 'West End, Mumbai', rating: 4.0, openStatus: true, nabhCertified: true },
  { id: 'p5', name: 'Local Medico', lat: 19.0720, lng: 72.8850, address: 'East View, Mumbai', rating: 3.8, openStatus: true, nabhCertified: false }
];

// Helper to calculate distance in km using Haversine formula
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

// @desc    Get nearby pharmacies for a specific medicine
// @route   GET /api/pharmacies/nearby?medicine=...&lat=...&lng=...
// @access  Public
const getNearbyPharmacies = asyncHandler(async (req, res) => {
  const { medicine, lat, lng } = req.query;
  const userLat = parseFloat(lat) || 19.0750;
  const userLng = parseFloat(lng) || 72.8750;
  
  // In a real app, you would query Google Places API here.
  // We use our mock database and dynamically generate stock and price for the demo.
  
  const basePrice = Math.floor(Math.random() * 100) + 50;

  let results = MOCK_PHARMACIES.map(pharm => {
    // Generate mock stock & price variations
    const stock = Math.floor(Math.random() * 50); // 0 to 50
    const priceVariance = (Math.random() * 20) - 10; // -10 to +10
    const finalPrice = Math.max(10, basePrice + priceVariance);
    
    // Calculate Distance
    const distanceKm = getDistanceFromLatLonInKm(userLat, userLng, pharm.lat, pharm.lng);
    const estimatedTimeMins = Math.round(distanceKm * 15); // Rough estimate: 15 mins per km

    return {
      ...pharm,
      distance: distanceKm,
      estimatedTime: estimatedTimeMins,
      medicineStock: stock,
      medicinePrice: parseFloat(finalPrice.toFixed(2)),
      searchedMedicine: medicine || 'Selected Medicine'
    };
  });

  // Sort by nearest by default
  results.sort((a, b) => a.distance - b.distance);

  res.json({
    success: true,
    count: results.length,
    data: results
  });
});

module.exports = {
  getNearbyPharmacies
};
