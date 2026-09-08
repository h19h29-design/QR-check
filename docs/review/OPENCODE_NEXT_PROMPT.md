# OpenCode next prompt (safe, 2026-09-08)

Continue local work on branch `work/school-owned-web` without clone/reset/overwrite. Do not push, merge, deploy, reissue QR, change places, change sharing, or delete real data. Read `docs/review/CODEX_OPENCODE_HANDOFF.md`, `HOMEPAGE_VALIDATION_REPORT.md`, and `../operator/MAIN_SITE_DEPLOY.md` first.

## Model and data boundaries

- Exact model only: `opencode/muse-spark-1.3-contributor-free`; fallback none.
- Public/synthetic only; no real IDs, accounts, tokens, or deployment URLs in prompts, logs, or reports.
- Do not send auth material, live QR URLs, authenticated browser/account access, or real sheet/drive content to the model.
- `liveProviderAttested` remains false.

## Required safe order

1. First obtain explicit deployment/OAuth/DNS approval and the confirmed hostname; stop if missing.
2. Then configure OAuth client ID and allowed origins with no secrets in repo; maker stays blocked until this is done.
3. Make a clean reviewed commit so runtime dirty becomes false.
4. Rebuild runtime and site (20-file allowlist; unpublished update has no action).
5. Run live maker only on a disposable test-school account; verify Drive-about token email, reject mismatch, keep tokens memory-only, retry by current state, reuse IDs, do not fake completion.
6. Execute live E/F/G2/I and mobile QR checks; keep local versus live results separate.
7. Only then seek separate deploy/push/clasp approval; do not assume it.

See handoff for recorded local evidence and the full NOT_TESTED list.
