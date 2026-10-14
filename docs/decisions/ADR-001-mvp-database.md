# ADR 001: Operational MVP Database

## Context
The PharmaVault project must solidify its persistence strategy for the TrustRAG MVP, balancing rapid development, structured JSON contract enforcement, and scalability. Previous iterations used MongoDB as the primary store while Supabase migrations were kept partially configured.

## Decision
MongoDB will remain the operational database for the MVP. Supabase migrations will remain inactive unless a future migration is explicitly approved.

## Alternatives Considered
- **Migrating entirely to Postgres/Supabase immediately:** Requires rewriting existing schemas, API endpoints, and validation rules, risking the MVP timeline.
- **Dual writes (MongoDB + Postgres):** Introduces unnecessary complexity, race conditions, and distributed transactions without immediate benefit.

## Consequences
- **Positive:** Leverages existing Mongoose schemas, allows fast iteration on deeply nested JSON objects (e.g. `EvidenceItem` and `ExtractedField`), and maintains team velocity.
- **Negative:** Lacks native relational joins, which might complicate highly complex structured queries if they arise.

## Security Implications
Tenant isolation will continue to be enforced programmatically at the Mongoose query level.

## Research Implications
Researchers can easily dump collections into analytical data lakes, given the JSON-native structure.
