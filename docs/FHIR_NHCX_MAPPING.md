# FHIR/NHCX Alignment (Draft)

> **IMPORTANT DISCLAIMER**
>
> Draft alignment for academic MVP—not certified NHCX conformance. This document maps TrustRAG domain entities to Fast Healthcare Interoperability Resources (FHIR R4) merely as an academic reference for future standards alignment. No official conformance claims are made.

## Entity Mapping

| TrustRAG Domain Model | Proposed FHIR R4 Resource / Abstraction |
|-----------------------|-----------------------------------------|
| `VerificationCase` | `Task` or `EpisodeOfCare` (workflow abstraction) |
| `Document` | `DocumentReference` |
| `PrescriptionRecord` | `MedicationRequest` |
| `InvoiceRecord` | `Invoice` |
| `ClaimRecord` | `Claim` |
| `ReviewDecision` | `ClaimResponse` or `Task` (output) |
| `EvidenceItem` / Lineage | `Provenance` |
| `AuditEvent` | `AuditEvent` |
| `Validation Failure` | `OperationOutcome` |

## Unresolved Mapping Questions
1. **Consistency Checks & Risk Signals:**
   - FHIR does not have a native first-class resource for "AI Hallucination Checks" or "Risk Signals." Should these be mapped as `Observation` resources with specific LOINC codes, or bundled into a `RiskAssessment`?
2. **Canonical Medicine Normalization:**
   - How should we map India-specific CDSCO/NHCX medicine taxonomies into standard `Medication` resources, which typically rely on RxNorm or SNOMED CT?
3. **Evidence Lineage:**
   - A single AI result (e.g., extracted dosage) might have multiple bounding box `EvidenceItem`s. Can `Provenance.entity` cleanly support bounding box definitions inside a PDF, or do we need a custom extension?
