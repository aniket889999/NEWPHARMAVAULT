# ADR 004: Human Review Escalation

## Context
AI-driven medical and claims decisions carry high liability and potential harm if incorrect. Autonomous acceptance or rejection of critical health claims without oversight is unacceptable.

## Decision
High-risk medical or claim decisions (as defined by severity thresholds or lack of trusted evidence) explicitly require human review.

## Alternatives Considered
- **Fully Autonomous Processing:** Rejected due to regulatory and ethical concerns in the healthcare domain.
- **Manual Review for Every Case:** Rejected because it defeats the efficiency gains of TrustRAG.

## Consequences
- **Positive:** Provides a safety net, ensures compliance with clinical and financial regulations, and builds user trust.
- **Negative:** Introduces asynchronous wait times in the case processing lifecycle.

## Security Implications
Human review actions must be durably audited and appended to an unalterable `AuditEvent` log, tracking exactly who made the decision and when.

## Research Implications
The Human-in-the-Loop (HITL) overrides and corrections form a high-quality RLHF (Reinforcement Learning from Human Feedback) dataset for future model fine-tuning.
