# PharmaVault version-4.0 — local demo guide

All data is synthetic. Password for every demo account: `password123`.

**Integrated-workspace note (18 November):** the running Codex preview preserves its existing synthetic database. Do not run `seed:all` against existing data: the setup below is for a fresh, disposable demo database only. See `INTEGRATION_CHECKPOINT_2026-11-18.md` for the actual local checks, differences and remaining limits.

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
10. Ask "What is Paracetamol used for?", "Does Cetirizine cause drowsiness?" (local evidence), "What is fever?" (MedlinePlus web evidence when available), "What is Telma used for?" (asks for label confirmation), "Recommend the best medicine for my fever" (refers rather than recommending treatment). Source cards distinguish stored, cached and newly retrieved evidence.

**Patient 5 — nearby in Pune**
11. *Nearby medicines* → Dolo 650 → 5 nearest pharmacies, price, units.

**Claims (main flow)**
12. Claimant → *Insurance Claims*: one finished claim (approved, simulated settlement) is already there as history.
13. *New Claim* → case `PV-DEMO-ANANYA-002 · Pantoprazole 40` → the form shows **Verified pharmacy bill ₹230.00**. Insurer *Sahyog Health Assurance (Demo)*, amount up to ₹230, policy `SYN-POL-24018`, tick consent → *Submit Claim*. A claim above the bill is refused by the server.
14. Reviewer & Insurer → Staff role *Insurer claims reviewer* (`rohit.mehta@…`) → *Claims Queue* → open the claim. Show: **Within the verified bill**, the prescription and invoice images (*View*), extracted fields, the low-confidence signal the claimant confirmed, and the pharmacist's decision note.
    - **Evidence Assistant** (right column): click *Compare the prescription and the invoice* → a cited answer from both documents (click a citation to open the document). Ask *Should I approve this claim?* → it refuses: humans decide. It uses only the evidence the claimant consented to share; nothing goes to web search or an external AI.
15. *Start Review* → raise a query, or *Approve* / *Partial* / *Reject* with a note → claimant sees the decision and the date until which they can appeal (7 days, once; a different insurer user decides the appeal — the original reviewer sees that they cannot decide it).
16. Insurer administrator (`kavya.iyer@…`) → open the approved claim → *Mark Settled (demo)* → claimant sees the settled amount and reference (simulated, no payment). A **partial** approval can be settled only after the claimant clicks *Accept Decision*, appeals, or the 7 days pass.
17. Show the double-claim guard: *New Claim* again → `PV-DEMO-ANANYA-001` and `-002` are greyed out as **already claimed**. One bill is never paid twice: one open claim per case across insurers, an insurer that decided is not asked again, and a second insurer can only be asked for the part of the bill not yet approved.

Live demo tip: each run of `npm run seed:all` resets nothing it already created; to repeat step 13, restart `mongo:local` (fresh in-memory data) and seed again.

*Doctor consultation* shows **Coming soon** (future work).

## Measured (CI, synthetic)

- Teammate-reported browser tests (30 passing on 19 Nov 2026): every screen of every portal, three claim journeys (including the seeded-evidence demo path with settlement and the bill-limit check), the order → pharmacy approval flow, reminders, nearby, authenticity. Not independently rerun as part of the chatbot push.
- Upstream Health Assistant demo snapshot: 18/30 outcome matches, 7/19 expected answers and 5/5 safety referrals. The 18 November local integration measured 23/30 outcome matches, 14/19 expected answers with cited on-topic content and 5/5 safety referrals (0 unsafe direct answers on those five scenarios), with web/model disabled and the same developer labels. Brand-label clarification causes three policy differences; evidence and phrasing gaps also remain. These labels are not pharmacist-reviewed or an unseen gold standard. See the integration checkpoint rather than presenting either snapshot as clinical accuracy.
- 19 November public RAG technical acceptance: two actual authenticated answers passed with dense-vector + lexical retrieval, cited Gemini generation, and account-bound contextual follow-up. Exactly two embedding batches and four generation/review requests, no retries or private data. See [the current checkpoint](../chatbot-next/GAPS_345_CHECKPOINT_2026-11-19.md). This is not a 30-question rerun or clinical evaluation.

## Known limits

- OCR reads printed prescriptions; handwriting is weak.
- Authenticity uses the PharmaVault ledger and a small CDSCO reference list; no FDA dataset is included.
- Default local Health Assistant answers remain cited source notes; the explicit public-chat launcher can enable bounded external generation and semantic retrieval using a privately configured credential. Private case data is never exported. "What is Dolo 650 used for?" asks for ingredient confirmation rather than assuming a brand formulation.
- Payment is "pay at pharmacy"; no returns flow; doctor consultation is future work.
