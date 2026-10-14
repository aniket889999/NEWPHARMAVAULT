# ADR 003: Evidence Routing and Retrieval Scope

## Context
TrustRAG requires retrieving medical evidence to validate claims, invoices, and prescriptions. External web searches can leak Patient Health Information (PHI) if not strictly controlled.

## Decision
External retrieval uses approved allow-listed sources only. Patient-identifying data cannot be included in external searches. The current in-memory graph remains a prototype and cannot be claimed as production GraphRAG.

## Alternatives Considered
- **Unrestricted Web Search Agent:** Rejected due to unacceptable privacy risks (leaking patient data to public search engines) and unverified medical hallucination risks.
- **Fully Local Knowledge Graph Only:** The in-memory prototype is currently insufficient for comprehensive production medical lookups.

## Consequences
- **Positive:** Ensures absolute data privacy for PHI. Guarantees that only medically approved sources (e.g., CDSCO, FDA, PubMed) influence the verification process.
- **Negative:** AI might fail to resolve novel or obscure medicines if the allow-listed sources do not contain them.

## Security Implications
Zero risk of accidental PHI leakage via query strings to third-party APIs like Google Search or Bing.

## Research Implications
Sets a strict boundary for measuring model hallucination rates, as the context window is deterministically populated by known, safe sources.
