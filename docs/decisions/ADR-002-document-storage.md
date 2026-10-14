# ADR 002: Document Storage Strategy

## Context
Users will upload sensitive medical documents (Prescriptions, Invoices, Claim Forms) for AI extraction and evidence lineage. Previously, naive implementations sometimes attempted to store Base64 string representations of images directly within MongoDB documents.

## Decision
Original documents must use encrypted object storage (e.g., AWS S3, Google Cloud Storage, or MinIO). The main document database record in MongoDB will only store metadata and the `objectStorageKey`.

## Alternatives Considered
- **Base64 in MongoDB:** Violates BSON document size limits (16MB), degrades database performance, and inflates backup costs.
- **Local File System:** Breaks statelessness and horizontal scaling requirements for containerized deployments.

## Consequences
- **Positive:** Preserves database performance, allows easy tiering to cold storage, and supports large files seamlessly.
- **Negative:** Introduces a dependency on an external blob storage provider.

## Security Implications
- Raw files are never stored in the database.
- Object storage buckets must be strictly encrypted at rest and deny public access. Access to files must require signed URLs or authenticated proxy streams.

## Research Implications
Enables batch downloading of document datasets for offline model tuning without impacting the operational database.
