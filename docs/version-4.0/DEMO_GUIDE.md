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

**Claims (main flow)**
12. Claimant → *Insurance Claims*: one finished claim (approved, simulated settlement) is already there as history.
13. *New Claim* → case `PV-DEMO-ANANYA-002 · Pantoprazole 40` → the form shows **Verified pharmacy bill ₹230.00**. Insurer *Sahyog Health Assurance (Demo)*, amount up to ₹230, policy `SYN-POL-24018`, tick consent → *Submit Claim*. A claim above the bill is refused by the server.
14. Reviewer & Insurer → Staff role *Insurer claims reviewer* (`rohit.mehta@…`) → *Claims Queue* → open the claim. Show: **Within the verified bill**, the prescription and invoice images (*View*), extracted fields, the low-confidence signal the claimant confirmed, and the pharmacist's decision note.
15. *Start Review* → raise a query, or *Approve* / *Partial* / *Reject* with a note → claimant sees the decision and the date until which they can appeal (7 days, once; a different insurer user decides the appeal — the original reviewer sees that they cannot decide it).
16. Insurer administrator (`kavya.iyer@…`) → open the approved claim → *Mark Settled (demo)* → claimant sees the settled amount and reference (simulated, no payment). A **partial** approval can be settled only after the claimant clicks *Accept Decision*, appeals, or the 7 days pass.
17. Show the double-claim guard: *New Claim* again → `PV-DEMO-ANANYA-001` and `-002` are greyed out as **already claimed**. One bill is never paid twice: one open claim per case across insurers, an insurer that decided is not asked again, and a second insurer can only be asked for the part of the bill not yet approved.

Live demo tip: each run of `npm run seed:all` resets nothing it already created; to repeat step 13, restart `mongo:local` (fresh in-memory data) and seed again.

*Doctor consultation* shows **Coming soon** (future work).

## Measured (CI, synthetic)

- Browser tests (30, all passing on 19 Nov 2026): every screen of every portal, three claim journeys (including the seeded-evidence demo path with settlement and the bill-limit check), the order → pharmacy approval flow, reminders, nearby, authenticity.
- Health Assistant demo evaluation (`tests/chat-eval`, 30 developer-labelled questions, web search off): outcome matched the label for 18/30; safety questions referred 5/5 with 0 unsafe answers; 7/19 answerable questions answered from local evidence alone — most of the rest need the MedlinePlus web search, which is on in `dev:all`. Labels are not pharmacist-reviewed.

## Known limits

- OCR reads printed prescriptions; handwriting is weak.
- Authenticity uses the PharmaVault ledger and a small CDSCO reference list; no FDA dataset is included.
- Health Assistant answers are cited source notes (no external AI); "What is Dolo 650 used for?" asks to clarify instead of answering.
- Payment is "pay at pharmacy"; no returns flow; doctor consultation is future work.
