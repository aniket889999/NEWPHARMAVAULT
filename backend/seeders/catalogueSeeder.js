/**
 * Idempotent Academic Medicine Catalogue Seeder
 *
 * IMPORTANT ACADEMIC BOUNDARY:
 * Curated academic reference catalogue — not live regulatory verification.
 * Do not scrape the web or claim live CDSCO / NHCX / AB-PMJAY authority.
 *
 * This command is explicit and idempotent: running it once or multiple times
 * produces the identical database state without duplicate records or runtime side-effects.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const CanonicalMedicine = require('../models/canonicalMedicineModel');
const {
  ACADEMIC_CATALOGUE_VERSION,
  ACADEMIC_SOURCE_NOTE,
  ACADEMIC_MEDICINE_CATALOGUE
} = require('../data/academicMedicineCatalogue');

dotenv.config();

/**
 * Seed the canonical medicine catalogue idempotently.
 * @param {Object} options
 * @param {boolean} [options.silent=false]
 * @returns {Promise<{ total: number, catalogueVersion: string }>}
 */
async function seedCanonicalCatalogue({ silent = false } = {}) {
  let seededCount = 0;

  for (const med of ACADEMIC_MEDICINE_CATALOGUE) {
    await CanonicalMedicine.findOneAndUpdate(
      {
        brandName: med.brandName,
        strength: med.strength,
        dosageForm: med.dosageForm
      },
      {
        $set: {
          brandName: med.brandName,
          genericName: med.genericName,
          strength: med.strength,
          strengthUnit: med.strengthUnit,
          dosageForm: med.dosageForm,
          manufacturer: med.manufacturer,
          aliases: med.aliases,
          regulatoryIdentifiers: med.regulatoryIdentifiers,
          sourceVersion: med.sourceVersion,
          catalogueVersion: med.catalogueVersion,
          sourceNote: med.sourceNote
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );
    seededCount++;
  }

  const totalInDb = await CanonicalMedicine.countDocuments();

  if (!silent) {
    console.log(`[CatalogueSeeder] Successfully seeded ${seededCount} academic medicine records.`);
    console.log(`[CatalogueSeeder] Total catalogue records in database: ${totalInDb}`);
    console.log(`[CatalogueSeeder] Version: ${ACADEMIC_CATALOGUE_VERSION}`);
    console.log(`[CatalogueSeeder] Source Note: "${ACADEMIC_SOURCE_NOTE}"`);
  }

  return {
    total: totalInDb,
    catalogueVersion: ACADEMIC_CATALOGUE_VERSION,
    sourceNote: ACADEMIC_SOURCE_NOTE
  };
}

// Direct CLI execution
if (require.main === module) {
  (async () => {
    try {
      const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/pharmavault';
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(mongoUri);
      }
      await seedCanonicalCatalogue({ silent: false });
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error('[CatalogueSeeder] Seeding failed:', err);
      process.exit(1);
    }
  })();
}

module.exports = {
  seedCanonicalCatalogue,
  ACADEMIC_CATALOGUE_VERSION,
  ACADEMIC_SOURCE_NOTE
};
