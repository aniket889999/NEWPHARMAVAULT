# ADR 005: API Versioning and Explainability

## Context
The TrustRAG platform involves multiple clients (React, SwiftUI, B2B Integrations). Breaking changes to AI outputs or schemas can cause severe disruptions. Furthermore, AI decisions must be transparent.

## Decision
1. API endpoints use the `/api/v1` namespace.
2. Every domain contract (JSON payload) must include a `schemaVersion` field.
3. AI explanations must expose evidence and decision reasons to the client, but must **not** expose private chain-of-thought, internal prompts, or raw model traces.

## Alternatives Considered
- **Header-based versioning:** Harder to debug and often ignored by simple client implementations.
- **Opaque AI Results:** Sending only "Pass/Fail" with no reasoning. Rejected because it violates the core premise of TrustRAG (explainable AI).

## Consequences
- **Positive:** Enables safe backward compatibility. Protects intellectual property (internal prompts) while satisfying user requirements for transparency.
- **Negative:** Slightly increases the verbosity of JSON payloads.

## Security Implications
Prevents prompt-injection extraction attacks from succeeding, as the internal chain-of-thought is structurally stripped from the response payload before reaching the client.

## Research Implications
Forces the creation of structured, deterministic mapping between underlying reasoning and user-facing explanations.
