# tkforgeworks/.github — Reference & Update Log

This is the **org-wide `.github` repo** for tkforgeworks. Its purpose is to hold
standards, reusable workflows, and shared tooling that other tkforgeworks repos
consume — not application code. `profile/README.md` renders as the org's public
GitHub profile page; the root `README.md` mirrors it with a "Shared Standards"
section documenting what's available.

This file is a working reference for Claude sessions: what's currently shared,
where it lives, and a log of notable changes made in this repo. Keep it in
sync when shared items are added, changed, or adopted elsewhere.

## Repo layout

- `README.md` — repo-facing docs, includes the "Shared Standards" catalog
- `profile/README.md` — org profile page (GitHub renders this on the org homepage)
- `.github/workflows/` — reusable workflows (`workflow_call`), consumed via
  `uses: tkforgeworks/.github/.github/workflows/<name>.yml@main`
- `scripts/` — canonical scripts backing the reusable workflows

## Shared items currently available

### Release notes generation

- `scripts/generate-release-notes.js` — canonical generator, builds Markdown
  release notes from commit subjects since the previous tag
- `.github/workflows/release-notes.yml` — reusable `workflow_call` wrapper;
  checks out this repo alongside the caller, runs the script, exposes a
  `body` output

Behavior: version-bump and merge commits are filtered out; subjects split into
**Changes** vs **Bug Fixes** (fix subjects start with `Fix` or
`<TICKET>-N: Fix ...`); Jira ticket keys auto-link when `JIRA_BASE_URL` +
`ticket-prefix` are set. Stable releases diff against the previous *stable*
tag so final notes span all RCs. Supports both tag-triggered (tag exists
already) and push-triggered (pass `release-version` explicitly) callers.

Consume from a repo's release workflow:

```yaml
jobs:
  release-notes:
    uses: tkforgeworks/.github/.github/workflows/release-notes.yml@main
    with:
      ticket-prefix: CGUI   # Jira project key

  build:
    needs: release-notes
    # ...
      - uses: softprops/action-gh-release@v2
        with:
          body: ${{ needs.release-notes.outputs.body }}
```

Requires a `JIRA_BASE_URL` repo/org variable (e.g.
`https://tkforgeworks.atlassian.net/browse`) for ticket linking. The contract
is commit-subject discipline: subjects become changelog lines.

**Adopters:** `claude-observability-gui` (tag-push releases), `anvil`
(push-to-master releases, pattern originated here — passes `release-version`
explicitly).

### Branch protection (repository ruleset)

- `docs/branch-protection-ruleset.md` — standard for locking down a repo's
  default branch via a **repository ruleset** (not classic branch
  protection): no force-push/deletion, PRs required with a passing named CI
  check, zero bypass actors (not even admins). Includes the replication
  `gh api` POST command, per-repo adaptation (CI job name must match exactly,
  how to require multiple checks), a PATCH flow for updating an existing
  mirrored ruleset, prerequisites (CI must exist and have reported on a PR
  first, or the required check blocks merges forever), and a plan-requirement
  note (private repos need GitHub Team/Enterprise for rulesets).

Source of truth: `tkforgeworks/anvil` (ruleset id 16447467, "master").
**Adopters:** `claude-observability-gui` (ruleset id 20203739, "main",
created 2026-08-01).

### CI / validation (TypeScript & Electron)

- `.github/workflows/ci-typescript.yml` — generic TS/Node CI: lint (non-
  blocking), typecheck, test, audit, build. Requires the caller to have
  `lint`/`typecheck`/`test`/`build` npm scripts (fixed contract, no per-repo
  script-name inputs).
- `.github/workflows/ci-electron.yml` — calls `ci-typescript.yml` as a nested
  job, adds Electron-specific checks on top: native module rebuild
  (`npm run rebuild --if-present`, genuinely optional), electronegativity
  (Electron security misconfig lint), and an `electron-builder --dir`
  packaging dry-run. All three Electron-specific checks are non-blocking.
- `docs/ci-standards.md` — the standard doc: full rationale for what's
  blocking vs. not, and a **per-repo adoption checklist** for anvil and
  claude-observability-gui (script renames needed, missing lint config,
  runner OS fix for claude-observability-gui, and the reminder that adopting
  changes CI check names — the branch-protection ruleset's required context
  needs a PATCH update when a repo switches over, or PRs block forever).

**Designed against real state, not abstractly:** reviewed both repos' actual
`ci.yml` and `package.json` on 2026-08-01 before drafting — neither had
ESLint/Prettier/electronegativity configured at all; anvil already used
`typecheck` while claude-observability-gui used `compile` for the same
purpose (hence the contract requiring a rename there).

**Not yet adopted anywhere.** anvil and claude-observability-gui are the
intended first adopters; see `docs/ci-standards.md`'s adoption checklist
before doing that work in either repo.

## Update log

Newest first. One entry per notable change — what changed and why, not a
line-by-line diff (git history already has that).

- **2026-08-01** — Added `ci-typescript.yml` / `ci-electron.yml` reusable
  workflows + `docs/ci-standards.md`. Pulled anvil's and
  claude-observability-gui's actual `ci.yml`/`package.json` via `gh api`
  first to design against reality: found neither had lint/electronegativity
  configured, script names diverged (`typecheck` vs `compile`), and
  claude-observability-gui's CI runs on `ubuntu-latest` despite shipping an
  NSIS-only native-module app. User decided: (1) fixed script-name contract
  (lint/typecheck/test/build) rather than per-repo inputs — a rename he'd
  already meant to do; (2) all net-new checks (lint, electronegativity,
  rebuild check, packaging dry-run) land non-blocking until he has time to
  actually author lint configs. Also added a cross-reference note in
  `docs/branch-protection-ruleset.md` about nested-workflow check naming.
  On branch `claude/init-memory-reference`, pending PR.
- **2026-08-01** — Added `docs/branch-protection-ruleset.md`: repository
  ruleset standard mirrored from `anvil`, folded in review gaps (update/PATCH
  flow, multiple required checks, CI-must-exist-first prerequisite, private
  repo plan requirement, ref-list trimming note) before committing. Linked
  from root `README.md`. On branch `claude/init-memory-reference`, pending PR.
- **2026-08-01** — Initialized this `claude/CLAUDE.md` reference file. No
  code changes; repo already contained the release-notes standard
  (script + reusable workflow) from prior sessions.
