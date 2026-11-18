const asyncHandler = require('../middleware/asyncHandler');

const Medicine = require('../models/medicineModel');
const Branch = require('../models/branchModel');
const Organization = require('../models/organizationModel');

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

// @desc    Pharmacies on PharmaVault that stock a medicine, nearest first (real inventory)
// @route   GET /api/pharmacy/nearby?medicine=...&lat=...&lng=...
// @access  Public (no personal data in the response)
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getNearbyPharmacies = asyncHandler(async (req, res) => {
  const medicine = typeof req.query.medicine === 'string' ? req.query.medicine.trim().slice(0, 80) : '';
  const userLat = Number.parseFloat(req.query.lat);
  const userLng = Number.parseFloat(req.query.lng);
  const hasUser = Number.isFinite(userLat) && Number.isFinite(userLng);
  if (medicine.length < 2) {
    res.status(400);
    throw new Error('Enter at least 2 letters of a medicine name.');
  }

  // Sum stock per branch for medicines whose name contains the search text and are not expired.
  const rows = await Medicine.aggregate([
    { $match: { name: { $regex: escapeRegex(medicine), $options: 'i' }, branchId: { $ne: null }, expiryDate: { $gt: new Date() } } },
    { $group: { _id: '$branchId', organizationId: { $first: '$organizationId' }, stock: { $sum: '$stock' }, price: { $min: '$price' }, names: { $addToSet: '$name' } } }
  ]);
  const branches = await Branch.find({ _id: { $in: rows.map((r) => r._id) }, status: { $ne: 'inactive' }, 'coordinates.lat': { $ne: null } }).lean();
  const orgs = await Organization.find({ _id: { $in: branches.map((b) => b.organizationId) } }).select('name kind status').lean();
  const orgById = new Map(orgs.map((o) => [String(o._id), o]));

  const results = branches
    .filter((b) => (orgById.get(String(b.organizationId))?.kind || 'pharmacy') !== 'payer')
    .map((b) => {
      const row = rows.find((r) => String(r._id) === String(b._id));
      const distance = hasUser ? getDistanceFromLatLonInKm(userLat, userLng, b.coordinates.lat, b.coordinates.lng) : null;
      return {
        id: String(b._id),
        name: b.name,
        organization: orgById.get(String(b.organizationId))?.name || null,
        lat: b.coordinates.lat,
        lng: b.coordinates.lng,
        address: b.location || '',
        rating: null,
        openStatus: b.status === 'active',
        nabhCertified: false,
        licenseNumber: b.licenseNumber,
        distance: distance === null ? null : Number(distance.toFixed(2)),
        estimatedTime: distance === null ? null : Math.max(1, Math.round(distance * 15)),
        medicineStock: row.stock,
        medicinePrice: Number(row.price.toFixed(2)),
        matchedMedicines: row.names.slice(0, 5),
        searchedMedicine: medicine
      };
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  res.json({ success: true, count: results.length, source: 'PharmaVault pharmacy inventory', data: results });
});

module.exports = {
  getNearbyPharmacies
};
