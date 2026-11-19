# Security policy

PharmaVault TrustRAG is a research prototype that runs on **synthetic data only**. Do not upload real
prescriptions, invoices or personal data.

## Reporting a vulnerability

Please report privately through GitHub: **Security → Report a vulnerability** on this repository
(private vulnerability reporting). Do not open a public issue for security problems.
Include the affected path or endpoint, steps to reproduce with synthetic data, and the impact.
We aim to acknowledge reports within 3 working days.

## What the pipeline checks on every change

CodeQL static analysis, secret scanning (gitleaks + GitHub push protection), dependency review on
pull requests, a production dependency audit, container image scanning (Trivy) with SBOMs, and
hardened container smoke tests. See `docs/version-4.0/CI_CD.md`.
