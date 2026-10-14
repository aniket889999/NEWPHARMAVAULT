# TrustRAG MVP Scope

## The Golden Workflow

The MVP focuses on one fundamental, explainable flow from ingestion to output:

1. **Create case**
2. → **Upload documents**: prescription, pharmacy invoice, and/or health-claim form
3. → **Extract structured fields**: using AI extraction models
4. → **Human-in-the-loop**: User corrects any uncertain fields
5. → **Identity resolution**: Resolve medicine identities to standard nomenclature
6. → **Retrieve trusted evidence**: Fetch approved data strictly from allow-listed sources
7. → **Run checks**: Execute consistency and risk-signal evaluations
8. → **Escalate**: Send uncertain/high-risk cases to human review
9. → **Produce explainable result**: Expose reasons and evidence citations
10. → **Generate bundle**: Generate FHIR/NHCX-aligned evidence bundle

## Primary Users

- Patient or document submitter
- Pharmacist
- Claims reviewer
- Organization administrator
- Research evaluator

## Supported Documents

**MVP Scope:**
- Prescription
- Pharmacy invoice
- Health-claim form

**Future (Not MVP):**
- Discharge summary
- Diagnostic report
- Laboratory report
- Insurance preauthorization
- Medicine package image

## Frozen Capabilities

The following features are explicitly frozen for the MVP and must not be implemented:
- Shopping cart expansion
- Medicine delivery
- Video consultation
- Blockchain development
- Nearby pharmacy expansion
- Advanced forecasting
- General health tracker expansion
- 3D dashboards
- Production CDSCO authenticity claims

## Measurable Success Criteria

The MVP is considered complete only when one de-identified case successfully completes the entire golden workflow, satisfying the following:

- All three document types (Prescription, Invoice, Claim) are accepted.
- Every extracted field includes its source location (bounding box / page) and AI confidence score.
- Users can manually correct uncertain fields.
- Medicine attributes (brand, generic, strength, form) can be normalized.
- Every consistency signal strictly references an underlying `EvidenceItem`.
- High-risk or insufficient-evidence cases explicitly require and trigger human review.
- Reviewer actions are durably audited.
- The final result can be exported as standards-aligned JSON.
- **Strict Privacy constraint:** No patient-identifying data is ever sent to external web searches.

*(Note: We do not claim numerical accuracy metrics until explicit experiments are conducted.)*
