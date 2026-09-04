# TK ForgeWorks CI/Validation Standard

Reviewed against the actual current state of `tkforgeworks/anvil` and
`tkforgeworks/claude-observability-gui` (both Electron + React + TypeScript,
npm, Node 22) on 2026-08-01, rather than designed in the abstract.

## Mechanism

Two composable reusable workflows in this repo:

- **`.github/workflows/ci-typescript.yml`** — generic TS/Node validation.
  Usable standalone by any future plain TS/Node repo.
- **`.github/workflows/ci-electron.yml`** — calls `ci-typescript.yml` as a
  nested job, then adds Electron-specific checks on top. This is why the
  full `owner/repo/path@ref` form is used for the nested `uses:` even though
  both files live in this same repo — relative (`./...`) references only
  resolve against the repo that *initiated* the workflow run (the adopter),
  not the repo the reusable workflow itself lives in.

Consume from an Electron repo:

```yaml
jobs:
  ci:
    uses: tkforgeworks/.github/.github/workflows/ci-electron.yml@main
```

Or from a plain TS/Node repo:

```yaml
jobs:
  validate:
    uses: tkforgeworks/.github/.github/workflows/ci-typescript.yml@main
```

(A plain TS/Node repo doesn't need the quick/full split described below —
there's no heavier second tier to defer to PR time, `ci-typescript.yml` is
the whole check set either way. The split only pays off for Electron
adopters, where `ci-electron.yml` is a genuinely more expensive superset.)

## Trigger & concurrency envelope (canonical, required in the caller)

A `workflow_call` reusable workflow can't declare its own top-level `on:` —
the caller's wrapper file owns the trigger and concurrency config. That part
was previously left as "whatever the repo already had," which baked in real
drift rather than fixing it: anvil's `ci.yml` fires on every push to a topic
branch *and* on PR events (with a concurrency group deduping the two), while
claude-observability-gui's only fired on pushes to `main` itself — which,
since the branch-protection ruleset blocks direct pushes to the default
branch, effectively meant no CI feedback existed until a PR was opened. That
wasn't a deliberate choice on either side, just independent drift between
when each repo's `ci.yml` was written.

anvil's version is the better pattern — earlier feedback, no loss of
dedup safety — so it's the canonical envelope for every adopter, substituting
the repo's actual default branch name.

**Split into a light job and a full job**, rather than running the same full
set of checks on both events. A push to a topic branch and the PR-sync event
for that same commit both used to trigger the identical full job — for
Electron adopters that means electronegativity, the native rebuild check,
and the packaging dry-run all ran twice for one commit, on `windows-latest`
(2x the billed-minute rate of Linux runners), for zero extra signal. The
composable workflow split already made for a different reason (generic vs.
Electron-specific) maps directly onto this: `push` events call
`ci-typescript.yml` only (fast lint/typecheck/test/audit/build feedback
while iterating pre-PR); `pull_request` events targeting the default branch
call the full `ci-electron.yml` (adds electronegativity/rebuild/packaging —
checks that only matter at merge-gate time, not on every WIP commit).
Neither job needs an explicit `runs-on` override for this split to work:
`ci-typescript.yml` already defaults to `ubuntu-latest` (cheaper, and the
light job never touches native rebuild/packaging so there's no ABI reason to
pay for Windows there) and `ci-electron.yml` already defaults to
`windows-latest`.

```yaml
on:
  push:
    branches-ignore: [<default-branch>]
  pull_request:
    branches: [<default-branch>, 'v*/main']

concurrency:
  group: ci-${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.number) || github.ref }}
  cancel-in-progress: true

jobs:
  quick:
    if: github.event_name == 'push'
    uses: tkforgeworks/.github/.github/workflows/ci-typescript.yml@main

  full:
    if: github.event_name == 'pull_request'
    uses: tkforgeworks/.github/.github/workflows/ci-electron.yml@main
```

`'v*/main'` in the `pull_request` list is what makes the org branching model
(`docs/branching-and-release.md`) work: topic branches PR into a release
branch, so the merge-gate check has to run on PRs *into* `vX.Y.Z/main`, not
only on the release PR into the default branch. Without it, a PR into a
release branch gets only the `push` job — or nothing, in a repo with no
`push` job — and the first real gate is after every topic branch is already
in. lazy-sleeper-app's `ci.yml` is the worked example of this envelope.

Merge commits landing on `vX.Y.Z/main` also fire the `push` job (it is not
the default branch, so `branches-ignore` doesn't exclude it). That is
intended — it re-checks the merged result — don't "fix" it by adding
`v*/main` to `branches-ignore`.

The branch-protection ruleset only needs `full`'s checks as required
context — `quick` never runs on a `pull_request` event (its `if:` excludes
it), so it can't satisfy or block a PR either way.

## Script-name contract (required in the caller's `package.json`)

| Script | Purpose |
|---|---|
| `lint` | ESLint (or equivalent) |
| `typecheck` | `tsc --noEmit`, across all project references if more than one |
| `test` | test runner, any framework |
| `build` | production build |

This is the same kind of contract as the release-notes standard's
commit-subject discipline: the workflow is generic *because* callers conform
to fixed script names rather than the workflow taking per-repo script-name
inputs. `rebuild` (native module rebuild) is invoked via
`npm run rebuild --if-present` — not part of the required contract, it's a
genuine no-op if absent.

Electron packaging itself (`electron-builder --dir`) is invoked directly via
`npx` in `ci-electron.yml` rather than through a contract script name, since
adopters currently use inconsistent names for it (anvil: `package`,
claude-observability-gui: `pack`) and `electron-builder` is already a
devDependency in both.

## What's blocking vs. non-blocking, and why

| Check | Blocking? | Reason |
|---|---|---|
| `typecheck`, `test`, `build` | Yes | Already real, established practice (anvil's current CI) |
| `npm audit --omit=dev --audit-level=high` | Yes | Cheap, low false-positive rate, already established in anvil |
| `lint` | **No** (`continue-on-error`) | Net-new — neither adopter has ESLint/Prettier configured yet |
| electronegativity | **No** | Net-new — no adopter has this configured |
| native module rebuild check | **No** | Net-new as a CI step (the `rebuild` script exists but was never run in CI) |
| packaging dry-run (`electron-builder --dir`) | **No** | Net-new as a CI step |

Deliberate choice: land the checks now so they're visible (warnings in the
Actions UI) without turning them into a merge-blocker before the underlying
configs exist. Revisit promoting `lint` (and the others) to blocking once
configs are actually authored and stable — do this deliberately, one check
at a time, not as a silent side effect of an unrelated change.

## Python: `ci-python.yml`

Same philosophy, different toolchain. Contract in the caller:

- uv project with a committed `uv.lock` (the workflow runs
  `uv sync --locked --dev` — an out-of-date lock fails fast, by design)
- ruff configured in `pyproject.toml`; both `ruff check` and
  `ruff format --check` run and are **blocking** (lazy-sleeper, the first
  adopter, already gates on them — no transition period needed)
- pytest discoverable from the repo root (`test-command` overrides)

Database-backed tests: set `postgres-image` and the `postgres-*` inputs; the
workflow starts the container with `docker run` (a `services:` block can't
be conditional inside a reusable workflow), waits for `pg_isready`, and
exports `DATABASE_URL` built from `database-url-driver` (default
`postgresql+psycopg`). Anything that must run after tests — alembic
upgrade/downgrade/upgrade round-trips — goes in `post-test-command`.

The job is named `ci` so a repo whose ruleset already requires `ci` (as
lazy-sleeper's does) migrates without a ruleset update.

## Flutter: `ci-flutter.yml`

Runs `flutter pub get`, `dart format --set-exit-if-changed`,
`flutter analyze`, `flutter test` via `subosito/flutter-action@v2`. No
platform builds — those live in `release-flutter.yml`. Job is named `ci`
(ruleset context `ci / ci` when called from a caller job also named `ci`).

Validated by `lazy-sleeper-app` (LS-39 PR #1, 2026-08-28): passed unchanged,
~1m25s–2m05s on `ubuntu-latest` with `flutter-version: '3.47.2'`. Adopter
notes:

- **Pin `flutter-version`.** Empty means latest stable, which drifts.
- `dart format` does **not** honour `analysis_options.yaml` excludes — every
  `.dart` file in the repo (including any under `docs/`) must be formatted
  or the format step fails.
- `release-flutter.yml` calls this workflow as its `gate` job (nested
  reusable, depth 3 counting `release-notes.yml`), so the PR check *is* the
  release gate. Keep the `flutter-version` in a repo's `ci.yml` and
  `release.yml` identical, or the release can gate on a different SDK than
  the one the PR was checked with. Observed: ~1m25s as a PR check; the full
  release run with both platform builds ~9 minutes.

## Agent Adoption Runbook

Adopting either workflow is a change made **inside the consuming repo**
(anvil or claude-observability-gui), not this one — this repo only hosts the
standard. The steps below are written for an agent session that starts with
no memory of the design discussion that produced this doc: it opens with
"why" pointers back into this repo, then gives an ordered, concrete
procedure. Read `docs/branch-protection-ruleset.md` too before step 6 in
either runbook — it owns the ruleset update (`PUT`) mechanics referenced there.

Before starting either repo, skim this file's "Script-name contract" and
"What's blocking vs. non-blocking" sections above for the reasoning — the
steps below assume that context.

### Adopting in anvil

1. Add lint tooling as devDependencies:
   `npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-react-hooks eslint-config-prettier prettier`
2. Add a flat `eslint.config.js` covering the actual source layout (inspect
   `tsconfig.main.json` / `tsconfig.renderer.json` for the real paths rather
   than assuming — main and renderer likely need different `env`/global
   settings, e.g. renderer gets browser + React globals, main gets Node).
   Add a minimal `.prettierrc` (defaults are fine; don't invent style
   opinions this doc doesn't have evidence for).
3. Add to `package.json` scripts: `"lint": "eslint . && prettier --check ."`
   — satisfies the contract in one script per the "one contract script"
   design; don't split lint/format into two scripts the workflow doesn't call.
4. Run `npx prettier --write .` once locally to normalize existing files.
   This produces a large, purely-mechanical diff — commit it separately from
   the CI/config changes so the history stays reviewable.
5. Replace the entire contents of `.github/workflows/ci.yml` with:
   ```yaml
   name: CI

   on:
     push:
       branches-ignore: [master]
     pull_request:
       branches: [master, 'v*/main']

   concurrency:
     group: ci-${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.number) || github.ref }}
     cancel-in-progress: true

   jobs:
     quick:
       if: github.event_name == 'push'
       uses: tkforgeworks/.github/.github/workflows/ci-typescript.yml@main
       with:
         build-env-json: '{"VITE_TELEMETRY_ENABLED":"true"}'

     full:
       if: github.event_name == 'pull_request'
       uses: tkforgeworks/.github/.github/workflows/ci-electron.yml@main
       with:
         build-env-json: '{"VITE_TELEMETRY_ENABLED":"true"}'
   ```
   (The `on:`/`concurrency:` block here is anvil's current `ci.yml` plus
   `'v*/main'` in the `pull_request` list — the one-line change that gates
   PRs into release branches; see the envelope section above. The `jobs:`
   section is new: `quick`
   runs on every topic-branch push — lint/typecheck/test/audit/build only,
   on `ci-typescript.yml`'s default `ubuntu-latest` — while `full` only runs
   on PRs targeting `master` and adds electronegativity/rebuild/packaging on
   `ci-electron.yml`'s default `windows-latest`. Neither job needs an
   explicit `runs-on` override. `build-env-json` goes on both — both run
   `npm run build`, and both need `VITE_TELEMETRY_ENABLED` for it to behave
   the same as it does today.)
6. Push, open a PR, and read the actual Actions run to find `full`'s real
   check names (something like `full / typescript / validate` and
   `full / electron-checks` — **do not guess these in advance**, they depend
   on the job id chosen above). Use those exact names to update (`PUT`)
   anvil's ruleset (`docs/branch-protection-ruleset.md`), replacing the
   current required context `validate`. Add the release-branch ruleset from
   the same doc while there. `quick`'s checks are not required context —
   it never runs on a `pull_request` event, so it can't report on a PR
   either way.
7. If `npm audit --omit=dev --audit-level=high` fails on the PR (it's
   blocking), resolve the advisory or explicitly flag it to the repo owner —
   don't silently loosen the audit level to make CI pass.
8. Confirm the PR shows `lint` as a warning (not a failure) if it finds
   issues, and that `typecheck`/`test`/`audit`/`build` genuinely gate merge.

### Adopting in claude-observability-gui

1. Rename the `compile` script to `typecheck` in `package.json` (same
   command: `tsc -p tsconfig.main.json --noEmit && tsc -p tsconfig.renderer.json --noEmit`).
   Check for any other reference to `npm run compile` in the repo (docs,
   other scripts) and update those too.
2. Add lint tooling as devDependencies:
   `npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-react-hooks eslint-config-prettier prettier`
3. Add a flat `eslint.config.js` covering this repo's actual layout (main via
   `tsconfig.main.json`, renderer via `tsconfig.renderer.json` — same
   main/renderer global-split reasoning as anvil's step 2). Add a minimal
   `.prettierrc`.
4. Add to `package.json` scripts: `"lint": "eslint . && prettier --check ."`
5. Run `npm audit --omit=dev --audit-level=high` locally **before** wiring up
   the new CI — this repo has never run it. If it reports high/critical
   advisories, resolve or upgrade them now; don't let the first CI run on
   this repo be the first time anyone sees them.
6. Run `npx prettier --write .` once, commit that mechanical diff separately.
7. Replace `.github/workflows/ci.yml` with:
   ```yaml
   name: CI

   on:
     push:
       branches-ignore: [main]
     pull_request:
       branches: [main, 'v*/main']

   concurrency:
     group: ci-${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.number) || github.ref }}
     cancel-in-progress: true

   jobs:
     quick:
       if: github.event_name == 'push'
       uses: tkforgeworks/.github/.github/workflows/ci-typescript.yml@main

     full:
       if: github.event_name == 'pull_request'
       uses: tkforgeworks/.github/.github/workflows/ci-electron.yml@main
   ```
   Deliberate changes versus this repo's current `ci.yml`, all fixes, not
   oversights:
   - **`on:`/`concurrency:` block replaced**, not carried over. The current
     `push: branches: [main]` only fires on pushes to `main` itself — which
     the branch-protection ruleset already blocks except via PR-merge
     commits — so there's no CI feedback on a topic branch until a PR is
     opened. `branches-ignore: [main]` (matching anvil's canonical envelope
     above) fixes that. `'v*/main'` gates PRs into release branches.
   - **`jobs:` split into `quick` (push) and `full` (PR)** rather than one
     job for both. `quick` stays on `ci-typescript.yml`'s default
     `ubuntu-latest` — no change from today for that path.
   - **`full` runs on `windows-latest`** (the `ci-electron.yml` default),
     which *is* a change from this repo's current single `ubuntu-latest` job
     — this repo ships an NSIS-only installer with a native module
     (`better-sqlite3`), so the checks that actually matter for merge
     (native rebuild, packaging dry-run) should run against the ABI/OS it
     ships on, not Linux. `quick` never touched those checks anyway, so it
     staying on Linux costs nothing.
8. Push, open a PR, read the actual Actions run for `full`'s real check
   names (e.g. `full / typescript / validate`, `full / electron-checks` —
   again, don't guess), and update (`PUT`) this repo's ruleset (current
   required context: `typecheck-and-test`) to match. Add the release-branch
   ruleset from `docs/branch-protection-ruleset.md` while there. `quick`'s checks aren't required
   context — it doesn't run on `pull_request` events.
9. Confirm `lint` shows as a warning if it finds issues, while
   `typecheck`/`test`/`audit`/`build` genuinely gate merge — on both `quick`
   (push) and `full` (PR), since both call `ci-typescript.yml`.

### Adopting in TKForgeWorks_website

Plain Next.js static-export repo — `ci-typescript.yml`, not the Electron one.

1. `package.json` already has `lint`, `typecheck`, `build`. Add a `test`
   script. There is no test framework installed; `"test": "echo \"no tests yet\" && exit 0"`
   is acceptable as the first increment so the contract is satisfied — do
   not skip `test` in the workflow.
2. Replace the body of `.github/workflows/ci.yml` with the canonical trigger/
   concurrency envelope above plus
   `uses: tkforgeworks/.github/.github/workflows/ci-typescript.yml@main`.
   Keep the top-level job id `ci` if you want to preserve the job name for
   the ruleset; the shared job is named `validate`, so the reported check
   becomes `ci / validate`.
3. `npm audit --omit=dev --audit-level=high` is blocking — run it locally
   first and resolve anything it flags before opening the PR.
4. The repo's ruleset ("Branch Protection Rules") differs from the org
   standard: one bypass actor, no required check. Align it with
   `docs/branch-protection-ruleset.md` and require the new check name once
   it has reported on a PR.

### Adopting in lazy-sleeper

1. Replace `.github/workflows/ci.yml` body with the envelope plus
   `uses: tkforgeworks/.github/.github/workflows/ci-python.yml@main` and
   the inputs shown in the README (`postgres-image: postgres:16-alpine`,
   lazysleeper user/password/db, the alembic `post-test-command`).
2. Job name stays `ci` → ruleset needs no change. Verify on the PR that the
   required check reports under the same name before merging.
3. `daily-pull.yml` is unrelated to validation and stays hand-rolled.

## Verification

Once a repo adopts, confirm the Actions run shows: `lint` step flagged
yellow/warning (not red/failing) if lint errors exist since it's
`continue-on-error`; `typecheck`/`test`/`audit`/`build` genuinely fail the
job (and therefore the required check) if broken. Also confirm the
push/PR split actually behaves as intended: a push to a topic branch runs
only `quick` (no electronegativity/rebuild/packaging steps in the run at
all — they shouldn't even appear), and opening or updating a PR against the
default branch runs only `full`. If both jobs show up on the same event,
the `if:` conditions are wrong.
