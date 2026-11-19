# Gemini: three isolated preparation tasks

Workspace: `/Users/aniket/Documents/Codex/2026-07-26/y/NEWPHARMAVAULT-v3`.
Own only `docs/chatbot-next/gemini/`. Application integration belongs to Codex.

1. Create `medicine-evidence.json`: up to 30 original primary-source summaries for the ten existing generic-name routes. Records: key, topicId, attribute (USES/SIDE_EFFECTS/STORAGE), title, text (<=90 words), sourceUrl, publisher, jurisdiction, checkedAt, licenceBasis, reviewStatus=`ACADEMIC_SOURCE_CHECKED_NOT_CLINICAL_APPROVAL`. No doses, substitution or Indian regulatory approval claims. Prefer uses/possible side effects; preserve gaps rather than inventing material.
2. Create three prominently synthetic academic HTML documents plus `demo-facts.json`: prescription Paracetamol 500 mg quantity 10, invoice Paracetamol 650 mg quantity 10, optional claim form; consistent fictional identifiers, no real identities/logos/signatures. Expected document discrepancy needs human review, not automated adjudication.
3. Read the v1 reference-standard source catalogue/README/answer key only; write a <=40-line `SOURCE_AUDIT.md`. Flag unsupported claims, caveats, licensing and jurisdiction limits. AI audit only; do not invent human/clinical approval or edit frozen data/results.

No repository scan, environment access, installs, Git, paid model requests, bulk downloads or broad tests. Primary-source browsing and validation of owned JSON/HTML only. Report outputs/counts/checks/blockers in `REPORT.md`, then stop.

Ten topics: paracetamol, metformin, cetirizine, amoxicillin, ibuprofen, atorvastatin, losartan, omeprazole, pantoprazole, azithromycin.
