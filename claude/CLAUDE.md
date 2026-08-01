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
  Both workflows also take a `build-env-json` input (JSON object, default
  `'{}'`) merged into the build step's `env` — added specifically because
  anvil's current build passes `VITE_TELEMETRY_ENABLED: 'true'` and the
  first workflow draft had no passthrough mechanism for that.
- `docs/ci-standards.md` — the standard doc: full rationale for what's
  blocking vs. not, plus an **"Agent Adoption Runbook"** section with
  ordered, concrete steps per repo (anvil, claude-observability-gui) —
  written to be followed by a fresh agent session with no memory of this
  design discussion, running inside the target repo itself. Covers exact
  ESLint/Prettier setup, script renames, the full replacement `ci.yml`
  content per repo (including `build-env-json` for anvil), the runner-OS fix
  for claude-observability-gui, and the reminder that adopting changes CI
  check names — the branch-protection ruleset's required context needs a
  PATCH update read from the actual Actions run, never guessed in advance.

**Designed against real state, not abstractly:** reviewed both repos' actual
`ci.yml` and `package.json` on 2026-08-01 before drafting — neither had
ESLint/Prettier/electronegativity configured at all; anvil already used
`typecheck` while claude-observability-gui used `compile` for the same
purpose (hence the contract requiring a rename there).

**Trigger/concurrency envelope is now part of the standard too**, not just
the `jobs:` block — see `docs/ci-standards.md`'s "Trigger & concurrency
envelope" section. anvil's `push: branches-ignore` + PR trigger + concurrency
dedup is canonical; claude-observability-gui's plain `push: branches: [main]`
(no concurrency block) was unintentional drift, not a deliberate choice —
its runbook step now replaces that block instead of preserving it.

**Push and PR now run different jobs — `quick` vs `full`.** Both used to run
the identical full check set (a topic-branch push and its PR-sync event both
triggered the same job for the same commit), which meant electronegativity/
native-rebuild/packaging-dry-run ran twice per commit on `windows-latest`
(2x-billed runner). Now: `quick` (`if: github.event_name == 'push'`) calls
`ci-typescript.yml` only; `full` (`if: github.event_name == 'pull_request'`)
calls `ci-electron.yml`. Neither needs a `runs-on` override — the reusable
workflows' own defaults (`ubuntu-latest` / `windows-latest`) already match.
The branch-protection ruleset only needs `full`'s check names as required
context. This was the user's idea, prompted by noticing the earlier
single-job design didn't distinguish light pre-PR feedback from the full
merge-gate check set.

**Not yet adopted anywhere.** anvil and claude-observability-gui are the
intended first adopters; see `docs/ci-standards.md`'s Agent Adoption Runbook
before doing that work in either repo.

### Node 20 Actions runtime deprecation fix

- `docs/node20-action-deprecation.md` — source: Jira
  [CGUI-55](https://tkforgeworks.atlassian.net/browse/CGUI-55). GitHub is
  removing the Node 20 Actions runtime; confirmed via each action's own
  `action.yml` (not assumed) that `actions/checkout`/`actions/setup-node`
  need v5+ and `softprops/action-gh-release` needs v3 for Node 24. Bumped to
  latest stable majors (v7 / v7 / v3) in this repo's `release-notes.yml`,
  `ci-typescript.yml`, `ci-electron.yml`, and the README's
  `action-gh-release` example — reviewed each major's release notes between
  minimum-Node24 and latest to confirm no breaking change applies to how
  they're used here.
- **anvil and claude-observability-gui's own `ci.yml`/`release.yml` are NOT
  fixed by this** — they pin these actions independently, not through this
  repo's reusable workflows for their build/release steps. The doc records
  the exact per-repo version bumps still needed there (including
  `actions/upload-artifact`→v7 and `actions/download-artifact`→v8, both
  anvil-only), so a future session doesn't have to re-derive them from
  CGUI-55's audit again.

## Update log

Newest first. One entry per notable change — what changed and why, not a
line-by-line diff (git history already has that).

- **2026-08-01** — Fixed GitHub Actions Node 20 runtime deprecation
  (Jira CGUI-55) in this repo's reusable workflows: bumped
  `actions/checkout`, `actions/setup-node` (v4→v7), and the README's
  `softprops/action-gh-release` example (v2→v3) across `release-notes.yml`,
  `ci-typescript.yml`, `ci-electron.yml`. Verified via each action's actual
  `action.yml` `runs:` field which major introduced `node24`, rather than
  guessing from version numbers. Also audited (but did not fix — separate
  repos) anvil's and claude-observability-gui's own `ci.yml`/`release.yml`,
  recording the exact remaining bumps in `docs/node20-action-deprecation.md`.
- **2026-08-01** — Split CI into `quick` (push, `ci-typescript.yml` only) and
  `full` (PR-to-default, `ci-electron.yml`) jobs per repo, per user request,
  eliminating the double-run-on-every-commit waste of the single-job design.
  Updated the canonical trigger envelope, both repos' runbook `ci.yml`
  blocks, and the ruleset-context guidance (only `full`'s checks are
  required context) accordingly.
- **2026-08-01** — User caught that the runbook silently preserved each
  repo's existing `on:`/`concurrency:` block instead of reconciling them —
  anvil fires CI on every topic-branch push (fast feedback pre-PR) while
  claude-observability-gui only fired on pushes to `main` itself (no
  feedback until a PR exists, since the ruleset blocks direct pushes
  anyway). Added a canonical "Trigger & concurrency envelope" section
  (anvil's pattern) and fixed claude-observability-gui's runbook step to
  replace its block rather than carry the weaker one forward.
- **2026-08-01** — Added an "Agent Adoption Runbook" to `docs/ci-standards.md`
  (step-by-step, per repo, written for a fresh agent session) and fixed a
  gap found while drafting it: neither reusable workflow had a way to pass
  per-repo build env vars, which anvil's build actually needs
  (`VITE_TELEMETRY_ENABLED`). Added a `build-env-json` input to both
  `ci-typescript.yml` and `ci-electron.yml` to carry it through.
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
