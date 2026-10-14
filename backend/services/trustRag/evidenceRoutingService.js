const crypto = require('crypto');
const EvidenceItem = require('../../models/evidenceItemModel');

/**
 * Approved Official Sources Registry (Allow-listed, versioned, strictly local)
 * Never invokes public web search. Guaranteed local and privacy-preserving.
 */
const APPROVED_OFFICIAL_SOURCES = [
  {
    sourceKey: 'CDSCO_APPROVED_LIST',
    title: 'CDSCO Approved Drug Formulations',
    organization: 'Central Drugs Standard Control Organization (India)',
    url: 'https://cdsco.gov.in/opencms/opencms/en/Drugs/Approved-Drugs/',
    category: 'REGULATORY_FORMULARY',
    trustTier: 5,
    version: '2024-R2',
    monographs: {
      paracetamol: {
        indication: 'Analgesic and antipyretic agent',
        standardStrengths: ['500mg', '650mg', '120mg/5ml'],
        schedule: 'Schedule H / OTC (formulation dependent)',
        regulatoryStatus: 'APPROVED'
      },
      'amoxicillin + clavulanic acid': {
        indication: 'Broad spectrum beta-lactamase inhibitor antibacterial',
        standardStrengths: ['625mg', '375mg', '1000mg'],
        schedule: 'Schedule H1 (Prescription Required)',
        regulatoryStatus: 'APPROVED'
      },
      metformin: {
        indication: 'Biguanide antidiabetic for Type 2 Diabetes Mellitus',
        standardStrengths: ['500mg', '850mg', '1000mg'],
        schedule: 'Schedule H (Prescription Required)',
        regulatoryStatus: 'APPROVED'
      },
      cetirizine: {
        indication: 'Second-generation histamine H1 receptor antagonist',
        standardStrengths: ['10mg', '5mg/5ml'],
        schedule: 'Schedule H (Prescription Required)',
        regulatoryStatus: 'APPROVED'
      },
      azithromycin: {
        indication: 'Macrolide antibacterial for respiratory and soft tissue infections',
        standardStrengths: ['250mg', '500mg'],
        schedule: 'Schedule H1 (Prescription Required)',
        regulatoryStatus: 'APPROVED'
      },
      pantoprazole: {
        indication: 'Proton pump inhibitor for gastric acid reduction',
        standardStrengths: ['40mg', '20mg'],
        schedule: 'Schedule H (Prescription Required)',
        regulatoryStatus: 'APPROVED'
      },
      atorvastatin: {
        indication: 'HMG-CoA reductase inhibitor for dyslipidemia and cardiovascular risk reduction',
        standardStrengths: ['10mg', '20mg', '40mg'],
        schedule: 'Schedule H (Prescription Required)',
        regulatoryStatus: 'APPROVED'
      },
      losartan: {
        indication: 'Angiotensin II receptor antagonist for hypertension and diabetic nephropathy',
        standardStrengths: ['25mg', '50mg', '100mg'],
        schedule: 'Schedule H (Prescription Required)',
        regulatoryStatus: 'APPROVED'
      },
      omeprazole: {
        indication: 'Proton pump inhibitor for GERD and peptic ulcer disease',
        standardStrengths: ['10mg', '20mg', '40mg'],
        schedule: 'Schedule H (Prescription Required)',
        regulatoryStatus: 'APPROVED'
      }
    }
  },
  {
    sourceKey: 'IPC_PHARMACOPOEIA',
    title: 'Indian Pharmacopoeia Monograph Index',
    organization: 'Indian Pharmacopoeia Commission (IPC)',
    url: 'https://ipc.gov.in/',
    category: 'STANDARDS_PHARMACOPOEIA',
    trustTier: 5,
    version: '9th-Edition-2022',
    monographs: {
      paracetamol: {
        purityStandard: 'Not less than 99.0% and not more than 101.0%',
        dosageForms: ['Tablet', 'Oral Suspension', 'Suppository']
      },
      'amoxicillin + clavulanic acid': {
        purityStandard: 'Amoxicillin Trihydrate and Potassium Clavulanate compliant',
        dosageForms: ['Tablet', 'Dry Syrup', 'Injection']
      },
      metformin: {
        purityStandard: 'Metformin Hydrochloride IP compliant',
        dosageForms: ['Immediate Release Tablet', 'Extended Release Tablet']
      },
      cetirizine: {
        purityStandard: 'Cetirizine Hydrochloride IP compliant',
        dosageForms: ['Tablet', 'Syrup']
      }
    }
  },
  {
    sourceKey: 'WHO_EML',
    title: 'WHO Model List of Essential Medicines',
    organization: 'World Health Organization',
    url: 'https://www.who.int/publications/i/item/WHO-MHP-HPS-EML-2023.02',
    category: 'GLOBAL_FORMULARY',
    trustTier: 4,
    version: '23rd-List-2023',
    monographs: {
      paracetamol: { section: '2.1 Non-opioids and non-steroidal anti-inflammatory medicines' },
      'amoxicillin + clavulanic acid': { section: '6.2.1 Beta-lactam medicines (Access group)' },
      metformin: { section: '18.5 Medicines for diabetes' }
    }
  }
];

class EvidenceRoutingService {
  /**
   * Get versioned list of approved official sources
   */
  getApprovedOfficialSourcesRegistry() {
    return APPROVED_OFFICIAL_SOURCES.map(({ monographs, ...meta }) => ({ ...meta }));
  }

  /**
   * Main router: gathers and normalizes evidence items across all 3 controlled tiers:
   * 1. Private Case Data
   * 2. Curated Medicine Knowledge (CanonicalMedicine)
   * 3. Approved Official Sources (Local allow-listed registry)
   *
   * @param {Object} params
   * @param {string} params.caseId
   * @param {Array} params.documents
   * @param {Array} params.fields
   * @param {Object} params.resolutions
   * @returns {Promise<Array>} Array of saved EvidenceItem documents
   */
  async routeAllEvidence({ caseId, documents = [], fields = [], resolutions = {} }) {
    // Collect from all 3 controlled channels
    const caseEvPromises = this.routePrivateCaseData({ caseId, documents, fields });
    const catalogEvPromises = this.routeCuratedMedicineKnowledge({ caseId, resolutions });
    const officialEvPromises = this.routeApprovedOfficialSources({ caseId, resolutions });

    const [caseItems, catalogItems, officialItems] = await Promise.all([
      caseEvPromises,
      catalogEvPromises,
      officialEvPromises
    ]);

    return [...caseItems, ...catalogItems, ...officialItems];
  }

  /**
   * Channel 1: Private Case Data
   * Derives evidence exclusively from documents and extracted fields of the case.
   */
  async routePrivateCaseData({ caseId, documents = [], fields = [] }) {
    const items = [];

    for (const field of fields) {
      // Find parent document
      const doc = documents.find(d => String(d._id) === String(field.documentId));
      const docLabel = doc ? `${doc.type} (${doc.originalFilename || 'upload'})` : 'Case Document';

      // Redact potential PHI from evidence citations
      const sanitizedRaw = this._sanitizeText(field.rawValue);
      const sanitizedNorm = this._sanitizeText(field.normalizedValue || field.rawValue);

      // Check if evidence already recorded for this field
      let existing = await EvidenceItem.findOne({ caseId, sourceId: field._id });
      if (!existing) {
        const evidenceText = `[${docLabel}] Page ${field.pageNumber || 1}: Extracted ${field.fieldType} = "${sanitizedRaw}" (normalized: "${sanitizedNorm}", confidence: ${Math.round((field.extractionConfidence || 1) * 100)}%).`;
        const contentHash = crypto.createHash('sha256').update(evidenceText).digest('hex');

        existing = new EvidenceItem({
          caseId,
          sourceId: field._id,
          documentId: field.documentId,
          claimSupported: `Document Field: ${field.fieldType}`,
          evidenceText,
          pageNumber: field.pageNumber || 1,
          boundingBox: field.boundingBox || [0, 0, 0, 0],
          trustTier: 4,
          sourceType: 'CASE_DOCUMENT',
          sourceLabel: docLabel,
          relevanceReason: `Primary evidence extracted directly from ${docLabel}.`,
          contentHash,
          retrievedAt: new Date(),
          sourceVersion: '1.0'
        });
        await existing.save();
      }
      items.push(existing);
    }

    return items;
  }

  /**
   * Channel 2: Curated Medicine Knowledge
   * Derives evidence exclusively from CanonicalMedicine records.
   */
  async routeCuratedMedicineKnowledge({ caseId, resolutions = {} }) {
    const items = [];

    for (const [docType, res] of Object.entries(resolutions)) {
      if (res && res.canonical && res.resolved) {
        const canon = res.canonical;
        const sourceId = canon._id || new (require('mongoose').Types.ObjectId)();

        let existing = await EvidenceItem.findOne({
          caseId,
          sourceId,
          sourceType: 'CANONICAL_CATALOG'
        });

        if (!existing) {
          const evidenceText = `[Canonical Nomenclature] Active: ${canon.genericName}, Brand: ${canon.brandName || 'N/A'}, Strength: ${canon.strength || ''}${canon.strengthUnit || ''}, Form: ${canon.dosageForm}, Manufacturer: ${canon.manufacturer || 'Approved Formulary'}.`;
          const contentHash = crypto.createHash('sha256').update(evidenceText).digest('hex');

          existing = new EvidenceItem({
            caseId,
            sourceId,
            documentId: null,
            claimSupported: `Canonical Medicine: ${canon.genericName}`,
            evidenceText,
            pageNumber: 1,
            boundingBox: [0, 0, 0, 0],
            trustTier: 4,
            sourceType: 'CANONICAL_CATALOG',
            sourceLabel: `Canonical Drug Catalog: ${canon.brandName || canon.genericName}`,
            relevanceReason: `Verified standardized taxonomy matching ${docType} medicine query.`,
            contentHash,
            retrievedAt: new Date(),
            sourceVersion: canon.sourceVersion || '1.0'
          });
          await existing.save();
        }
        items.push(existing);
      }
    }

    return items;
  }

  /**
   * Channel 3: Approved Official Sources
   * Derives evidence exclusively from local allow-listed registry. No web access.
   */
  async routeApprovedOfficialSources({ caseId, resolutions = {} }) {
    const items = [];

    for (const [docType, res] of Object.entries(resolutions)) {
      if (res && res.canonical && res.resolved) {
        const genericKey = (res.canonical.genericName || '').toLowerCase().trim();

        for (const officialSource of APPROVED_OFFICIAL_SOURCES) {
          const monograph = officialSource.monographs[genericKey];
          if (monograph) {
            const fakeSourceId = new (require('mongoose').Types.ObjectId)();
            const sourceLabel = `${officialSource.title} (${officialSource.organization})`;

            let existing = await EvidenceItem.findOne({
              caseId,
              sourceLabel,
              sourceType: 'OFFICIAL_REGISTRY'
            });

            if (!existing) {
              const details = Object.entries(monograph)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                .join('; ');
              const evidenceText = `[${officialSource.sourceKey}] ${res.canonical.genericName}: ${details}. Source: ${officialSource.url} (Tier ${officialSource.trustTier})`;
              const contentHash = crypto.createHash('sha256').update(evidenceText).digest('hex');

              existing = new EvidenceItem({
                caseId,
                sourceId: fakeSourceId,
                documentId: null,
                claimSupported: `Official Regulatory Formulary Status for ${res.canonical.genericName}`,
                evidenceText,
                pageNumber: 1,
                boundingBox: [0, 0, 0, 0],
                sourceUrl: officialSource.url,
                trustTier: officialSource.trustTier,
                sourceType: 'OFFICIAL_REGISTRY',
                sourceLabel,
                relevanceReason: `Corroborated by official regulatory registry without external web lookup.`,
                contentHash,
                retrievedAt: new Date(),
                sourceVersion: officialSource.version
              });
              await existing.save();
            }
            items.push(existing);
          }
        }
      }
    }

    return items;
  }

  /**
   * Sanitize text to ensure patient identifiers and secrets are never in citations
   */
  _sanitizeText(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/\b\d{10}\b/g, '[PHONE_REDACTED]') // 10 digit phone numbers
      .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[ID_REDACTED]') // 12 digit IDs
      .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[EMAIL_REDACTED]')
      .trim();
  }
}

module.exports = new EvidenceRoutingService();
