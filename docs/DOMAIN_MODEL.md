# PharmaVault TrustRAG Domain Model

This document defines the core entities, their properties, enums, and exact workflows for the TrustRAG MVP.

## Core Entities

### VerificationCase
The top-level container for a specific verification instance.
- `id`
- `caseReference`
- `organizationId`
- `branchId`
- `createdBy`
- `subjectReference`
- `status`
- `documentIds`
- `reviewRequired`
- `schemaVersion`
- `createdAt`
- `updatedAt`

### Document
Represents an uploaded file. Never stores raw Base64 content directly in the database.
- `id`
- `caseId`
- `type`
- `objectStorageKey`
- `originalFilename`
- `mimeType`
- `sizeBytes`
- `sha256`
- `pageCount`
- `uploadStatus`
- `processingStatus`
- `uploadedBy`
- `createdAt`

### ExtractedField
A single piece of data extracted from a document by the AI.
- `id`
- `documentId`
- `fieldType`
- `rawValue`
- `normalizedValue`
- `pageNumber`
- `boundingBox`
- `extractionMethod`
- `extractionConfidence`
- `needsCorrection`
- `correctedBy`
- `correctedAt`

### PrescriptionRecord
Structured representation of a parsed prescription.
- Prescriber
- Patient reference
- Prescription date
- Medicine lines
- Dosage
- Frequency
- Duration
- Instructions

### InvoiceRecord
Structured representation of a parsed pharmacy invoice.
- Pharmacy
- Invoice number
- Invoice date
- Medicine lines
- Batch
- Quantity
- Unit price
- Total

### ClaimRecord
Structured representation of a parsed health-claim form.
- Claim reference
- Claim type
- Service dates
- Claimed medicine lines
- Claimed amount
- Claim status

### CanonicalMedicine
The source of truth for normalized medical taxonomy.
- `id`
- `brandName`
- `genericName`
- `strength`
- `strengthUnit`
- `dosageForm`
- `manufacturer`
- `regulatoryIdentifiers`
- `sourceVersion`
- `aliases`

### EvidenceSource
A designated, allow-listed source of truth used during retrieval.
- `id`
- `sourceType`
- `name`
- `authority`
- `baseUrl`
- `trustTier`
- `allowed`
- `lastVerifiedAt`
- `version`

**Source types:**
- `PRIVATE_CASE_DOCUMENT`
- `PRIVATE_MEDICINE_DATABASE`
- `CURATED_MEDICAL_KNOWLEDGE`
- `APPROVED_REGULATORY_WEB`

### EvidenceItem
A specific piece of evidence retrieved from an `EvidenceSource` to support a decision.
- `id`
- `caseId`
- `sourceId`
- `documentId`
- `claimSupported`
- `evidenceText`
- `pageNumber`
- `boundingBox`
- `sourceUrl`
- `retrievedAt`
- `contentHash`
- `sourceVersion`
- `trustTier`

### ConsistencyCheck
A deterministic rule or AI-driven evaluation against the extracted data.
- `id`
- `caseId`
- `checkType`
- `status`
- `severity`
- `message`
- `evidenceItemIds`
- `rulesetVersion`
- `reviewRequired`

### RiskSignal
An indicator of potential risk. Not an allegation or proven fraud.
- `id`
- `caseId`
- `signalType`
- `severity`
- `description`
- `evidenceItemIds`
- `detectedBy`
- `rulesetVersion`
- `reviewRequired`

### ReviewDecision
The outcome of a human-in-the-loop review.
- `id`
- `caseId`
- `reviewerId`
- `decision`
- `reasonCode`
- `notes`
- `evidenceItemIds`
- `createdAt`

### AuditEvent
An append-only immutable record of actions taken on a case.
- `id`
- `caseId`
- `actorId`
- `actorRole`
- `action`
- `targetType`
- `targetId`
- `metadata`
- `createdAt`

---

## Enums and Lifecycles

### Case Status
- `DRAFT`
- `DOCUMENTS_PENDING`
- `READY_FOR_PROCESSING`
- `PROCESSING`
- `NEEDS_CORRECTION`
- `NEEDS_REVIEW`
- `VERIFIED`
- `REJECTED`
- `CLOSED`
- `FAILED`

### Document Type
- `PRESCRIPTION`
- `PHARMACY_INVOICE`
- `CLAIM_FORM`

### Check Status
- `PASS`
- `FAIL`
- `INCONCLUSIVE`
- `NOT_APPLICABLE`

### Severity
- `INFO`
- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

### Review Decision
- `APPROVE`
- `REJECT`
- `REQUEST_CLARIFICATION`
- `ESCALATE`

---

## Visual Architecture Diagrams

### 1. Entity Relationship Diagram

```mermaid
erDiagram
    VerificationCase ||--o{ Document : contains
    Document ||--o{ ExtractedField : yields
    VerificationCase ||--o{ EvidenceItem : uses
    EvidenceSource ||--o{ EvidenceItem : provides
    VerificationCase ||--o{ ConsistencyCheck : undergoes
    VerificationCase ||--o{ RiskSignal : triggers
    VerificationCase ||--o{ ReviewDecision : resolved_by
    VerificationCase ||--o{ AuditEvent : logged_in
```

### 2. Case Lifecycle

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> DOCUMENTS_PENDING : Wait for Uploads
    DOCUMENTS_PENDING --> READY_FOR_PROCESSING : All Uploaded
    READY_FOR_PROCESSING --> PROCESSING : Start Extract
    PROCESSING --> NEEDS_CORRECTION : Low Confidence
    NEEDS_CORRECTION --> PROCESSING : Fields Corrected
    PROCESSING --> NEEDS_REVIEW : High Risk / Inconclusive
    PROCESSING --> VERIFIED : Passed All Checks
    NEEDS_REVIEW --> VERIFIED : Approved
    NEEDS_REVIEW --> REJECTED : Rejected
    VERIFIED --> CLOSED
    REJECTED --> CLOSED
```

### 3. Golden-Path Sequence

```mermaid
sequenceDiagram
    participant User
    participant API as API Gateway
    participant Core as TrustRAG Core
    participant OCR as Extraction AI
    participant DB as MongoDB

    User->>API: Create Case
    API->>DB: Save VerificationCase
    User->>API: Upload Documents
    API->>Core: Trigger Processing
    Core->>OCR: Extract Fields
    OCR-->>Core: Extracted JSON
    Core->>Core: Resolve Medicines
    Core->>Core: Retrieve Evidence
    Core->>Core: Run Consistency Checks
    Core->>DB: Save Evidence & Checks
    Core-->>API: Result (Verified or Needs Review)
    API-->>User: Case Status
```

### 4. Evidence-Routing Flow

```mermaid
graph TD
    A[Extracted Field] --> B{Determine Required Proof}
    B -->|Medicine Details| C[PRIVATE_MEDICINE_DATABASE]
    B -->|Clinical Guidelines| D[CURATED_MEDICAL_KNOWLEDGE]
    B -->|Regulatory Status| E[APPROVED_REGULATORY_WEB]
    B -->|Invoice Details| F[PRIVATE_CASE_DOCUMENT]

    C --> G[Create EvidenceItem]
    D --> G
    E --> G
    F --> G

    G --> H[Run ConsistencyCheck]
```

### 5. Human-Review Escalation Flow

```mermaid
graph TD
    A[Processing Complete] --> B{Risk > Threshold?}
    B -->|Yes| C[Set Case to NEEDS_REVIEW]
    B -->|No| D{Checks Failed?}
    D -->|Yes| C
    D -->|No| E[Set Case to VERIFIED]

    C --> F[Reviewer Dashboard Queue]
    F --> G[Reviewer Inspects Evidence]
    G --> H{Decision}
    H -->|Approve| I[Create ReviewDecision]
    I --> E
    H -->|Reject| J[Create ReviewDecision]
    J --> K[Set Case to REJECTED]
```
