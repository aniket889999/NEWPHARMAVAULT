# PharmaVault version-4.0 — local demo guide

All data is synthetic. Password for every demo account: `password123`.

## Start (3 terminals → 2)

```bash
git fetch && git checkout version-4.0 && git pull
npm install && npm --prefix backend install
npm --prefix backend run mongo:local          # terminal 1 — keep open (data is in memory)
npm run seed:all                              # terminal 2 — demo + pharmacy hub + showcase, in the right order
npm run dev:all                               # then open http://localhost:5173
```

Restarting terminal 1 wipes the data: run `npm run seed:all` again.

## Accounts

| Login tab | Who | Email |
| --- | --- | --- |
| Patient | Ananya Verma (also claimant) | `ananya.verma@claimant.example` |
| Patient | Demo patient | `patient@test.com` |
| Claimant | Ananya Verma → opens Insurance Claims | `ananya.verma@claimant.example` |
| Pharmacy | Demo Pharmacy Hub (Pune Camp) | `pharmacy@test.com` |
| Reviewer & Insurer → Staff role *Pharmacist* | case review | `pharmacist@test.com` |
| Reviewer & Insurer → Staff role *Insurer claims reviewer* | approve / reject claims | `rohit.mehta@sahyog-health.example` |
| Reviewer & Insurer → Staff role *Insurer administrator* | appeals, team | `kavya.iyer@sahyog-health.example` |

## Demo script

**Patient 1 — prescription**
1. Patient → *Prescriptions* → *Load Demo Prescription* → run the OCR scan. The local reader shows Dolo 650, Amoxicillin 500, Azithromycin 500 with dose times, duration and doctor.
2. *Set Reminders* → one reminder per dose time (1-0-1 → 08:00 and 20:00).
3. *Save* → appears in *Health Records* (doctor, date, medicines).
4. *Find nearby* on a medicine → 5 nearest Pune pharmacies with price and stock → *Add to Cart*.

**Patient 4 — order**
5. *Cart* → choose the saved prescription → *Confirm & Place Order*. Prescription-only items without a prescription are refused; prices and stock are checked by the server.
6. *My Orders* → status *Awaiting Pharmacist* (prescription items) or *Pending*.

**Pharmacy**
7. Pharmacy → *Prescription Queue* → select the patient → *Authorize & Approve* / *Clarify with Doctor* / *Reject* (note required). The patient's *My Orders* updates and a notification arrives.
8. *Dashboard* (stock value, low stock), *Expiry Risk* (*Markdown* 30% / *Recall*), *Stock Risk* (*Reorder*), *Workflow Center*, *Blockchain Ledger*.

**Patient 2 — authenticity**
9. *Authenticity* → batch `B-DLO-650`, manufacturer `Micro Labs Limited` → **Verified**; any made-up batch → **Suspicious**.

**Patient 3 — Health Assistant**
10. Ask "What is Paracetamol used for?", "Does Cetirizine cause drowsiness?" (local evidence), "What is Telma used for?" / "What is fever?" (MedlinePlus web search, links shown), "Recommend the best medicine for my fever" (refers to a doctor).

**Patient 5 — nearby in Pune**
11. *Nearby medicines* → Dolo 650 → 5 nearest pharmacies, price, units.

**Claims**
12. Claimant → *New Claim* → case `PV-DEMO-ANANYA-001`, insurer *Sahyog Health Assurance (Demo)*, consent → submit.
13. Reviewer & Insurer (insurer reviewer) → *Claims Queue* → *Start Review* → raise a query / *Approve* / *Partial* / *Reject* with a note.
14. Claimant sees the decision; can appeal once; an insurer admin decides the appeal.

*Doctor consultation* shows **Coming soon** (future work).

## Measured (CI, synthetic)

- Browser tests: every screen of every portal, both claim journeys, the order → pharmacy approval flow, reminders, nearby, authenticity.
- Health Assistant demo evaluation (`tests/chat-eval`, 30 developer-labelled questions, web search off): outcome matched the label for 18/30; safety questions referred 5/5 with 0 unsafe answers; 7/19 answerable questions answered from local evidence alone — most of the rest need the MedlinePlus web search, which is on in `dev:all`. Labels are not pharmacist-reviewed.

## Known limits

- OCR reads printed prescriptions; handwriting is weak.
- Authenticity uses the PharmaVault ledger and a small CDSCO reference list; no FDA dataset is included.
- Health Assistant answers are cited source notes (no external AI); "What is Dolo 650 used for?" asks to clarify instead of answering.
- Payment is "pay at pharmacy"; no returns flow; doctor consultation is future work.
