# L2 + L3 — governed sources and complete-sentence support

18 November 2026. Combined engineering batch on `version-3.0`, layered on local
L1 work. **Engineering controls implemented; clinical source approval and
independent gold-standard evaluation remain OPEN. No public-launch approval.**

## L2 controls

- `chatSourceGovernance.json` is a deployment-reviewed policy manifest, currently
  empty: no medical source has been given a fabricated approval. Existing medical
  text, source snapshots, corpus IDs and trained weights are unchanged.
- Production always uses `REVIEWED_ONLY`, even if the demo flag is supplied.
  Non-production defaults to `ACADEMIC_DEMO`; unknown policy values fail closed.
  Demo references are visibly marked not clinically approved in source cards.
- A review entry is tied to the exact source ID, URL, version and content hash.
  It needs distinct reviewer/approver identifiers, review and approval dates,
  future review deadline, jurisdiction, permitted-use basis and a bounded list of
  reviewed question attributes. Expired, changed, invalid, out-of-scope or withdrawn
  references are blocked. Withdrawal also blocks academic-mode use.
- First-party project guides remain available without pretending to be clinical
  references. Patient/case authorization and local-only evidence stay separate.
- Filtering is applied to focused retrieval/composition, public fallback candidate
  retrieval and provider context. A newly fetched official page is not an approved
  medical review record. Reviewed-only gaps cannot silently fall through to web.
- `/api/v1/chat/status` adds `sourceGovernance` counts/mode, not reviewer identities.
  The read-only `backend/scripts/reportChatSources.js` shows a summary or registered
  source fingerprint for preparing a review record. It makes no network calls.
- The container data allow-list now includes the policy manifest. No container
  image build is claimed for this batch.

The manifest is deployment-controlled, not an authenticated clinical review UI,
signature authority or credentials-verification service. Updating/withdrawing a
record requires a reviewed deployment/restart. Source licences, reviewers and
content truth must actually be checked; strings in JSON do not establish them.

## L3 controls

- Optional public generation is now constrained to selecting complete sentences
  verbatim from cited evidence. A real quotation cannot justify arbitrary new
  prose, a reversed negation, fabricated trailing text or an unrelated citation.
  Decimal sentence segmentation is handled by `Intl.Segmenter`.
- Every output sentence must match a complete cited source sentence; every cited
  source must support at least one output sentence. Explicit support quotes must
  cover the selected complete sentences. Partial fragments are not accepted.
- The focused adapter validates the entire response before emitting it. The old
  public fallback also buffers provider paragraphs until this support check passes.
  Validation failure retains the existing source-note fallback, not invented text.
- One older synthetic provider success fixture was changed from a paraphrase to
  its actual source text, reflecting the deliberately stricter output contract.
  Its privacy, provider-boundary and failure assertions were retained.

This rejects valid paraphrases as well as unsupported ones. It is a temporary
conservative support boundary, **not semantic entailment, completeness, source
truth, clinical safety, model fine-tuning or GPT/Claude superiority**. Selection can
still omit relevant context. Relaxing this boundary needs independent evaluation.

## Verification scope

To avoid repeated broad runs, this batch uses only the new governance/generation
tests, three directly affected old adapter tests, and one final frontend build:

```sh
node --test tests/chat-launch/governed-generation.test.cjs
node --test --test-name-pattern='public synthesis|unsupported numbers|unvalidated generated' tests/contextual-chat/precision.test.cjs
npm run build:frontend
node backend/scripts/reportChatSources.js --summary
git diff --check
```

Actual results: new tests **25/25**, affected adapter tests **3/3**. Strict
TypeScript/production build passed; existing large-bundle/Browserslist warnings
remain. The full L1 244-test selection was **not** rerun for L2/L3. Synthetic
provider transport is injected, not a paid live generation test. No private cases
or normal database records are changed by those tests.

Gemini G2 is limited to a 60-line source-review checklist template with blank
approval fields, per the prompt given before implementation. It cannot approve
sources or change app code. A checklist is not proof of source review.
Its delivered template was inspected and retains blank reviewer/approval fields.
The refreshed local API reports the governance policy and zero current medical
review records; a supported demo answer carries `NOT_CLINICALLY_APPROVED` source
metadata. The existing synthetic database was reused without seeding or clearing.

Still open: actual reviewed corpus expansion, source ingestion/review portal,
professional gold labels, semantic/completeness grading, broader language and
medicine scope, paid-provider acceptance and operational/security/privacy gates.
Generation, embeddings and web fallback remain disabled in the local preview.
