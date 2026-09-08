# Codex ↔ OpenCode handoff — 2026-09-08 local work

## Current local work

- Date: 2026-09-08, local only.
- Branch: `work/school-owned-web`.
- No push, no merge, no deploy.
- Public/synthetic inputs only; no real IDs, accounts, tokens, or deployment URLs in this doc.

## Static installer site (implemented, unpublished)

- Pages: main, maker, demo, guide, help, update.
- Explicit 20-file build allowlist enforced.
- Unpublished update page has no action.
- Site status: unpublished, 20 files.
- Local preview `http://127.0.0.1:57917/` was ephemeral unpublished preview only.

## Maker (still blocked pending operator setup)

- Blocked until operator sets OAuth client ID and allowed origin.
- Now verifies actual Drive-about token email and rejects mismatch.
- Tokens kept memory-only.
- Retries partial install by current state.
- Reuses script/deployment IDs; does not fake completion.

## Demo (local-only)

- In-memory only; no network, no persistent storage.
- Korean sample copy.
- Formula-safe CSV.
- Responsive table.

## Local synthetic results

- E local synthetic: `observed_at` and same-length attachment-content changes now conflict; identical payload remains idempotent.
- F local synthetic: rename/reprint/reissue tests remain PASS.
- G2 local synthetic: `google_only` and `token_compat` reject empty/unregistered identity; bad setup key causes no seed mutation.
- I local code boundary: runtime build independent; site release/update remains optional/unpublished. Live I still NOT_TESTED.

## Final evidence (local)

- Node 172/172 PASS.
- Python 16/16 PASS.
- Runtime version 0.1.0, dirty true; public 12/admin 18.
- Site unpublished 20 files.
- `git diff --check` clean.
- Secret scan no matches.

## Browser validation

- Homepage 360/390/768/1440: no overflow.
- CTA and blocked maker checked.
- Demo banner checked.
- Later in-app input API failure means final demo submit/batch click NOT_COMPLETED.
- See `HOMEPAGE_VALIDATION_REPORT.md` for detail.

## Live Google status (not changed / not revalidated)

- Actual Google live status from older report was not changed or revalidated.
- Still NOT_TESTED: printed/mobile QR, live E/F/G2/I, education Workspace, real rollback, live maker OAuth/resource creation, public homepage deployment.

## Historical live evidence (preserved, identifiers redacted)

- Prior live run used fixed active Apps Script version with existing deployment retained.
- Prior checks covered canonical exec health build marker, admin submit-to-sheet-to-admin record match, synthetic PNG attachment case, and owner-only Drive attachment behavior.
- Prior local regression baseline was Apps Script/client plus Windows admin suites PASS with runtime public/admin file checks PASS.
- No live QR tokens, OAuth tokens, admin tokens, or full deployment/script/sheet/drive identifiers are recorded here.

## New docs

- `HOMEPAGE_VALIDATION_REPORT.md`.
- `../operator/MAIN_SITE_DEPLOY.md`.

## Executor and boundaries

- Executor exact model: `opencode/muse-spark-1.3-contributor-free`.
- Fallback: none.
- `liveProviderAttested` remains false.
- Tests run by this worker: NONE (shell/test execution disabled; evidence above is recorded local status, not a new test claim).
