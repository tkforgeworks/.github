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

## Agent Adoption Runbook

Adopting either workflow is a change made **inside the consuming repo**
(anvil or claude-observability-gui), not this one — this repo only hosts the
standard. The steps below are written for an agent session that starts with
no memory of the design discussion that produced this doc: it opens with
"why" pointers back into this repo, then gives an ordered, concrete
procedure. Read `docs/branch-protection-ruleset.md` too before step 6 in
either runbook — it owns the ruleset PATCH mechanics referenced there.

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
       branches: [master]

   concurrency:
     group: ci-${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.number) || github.ref }}
     cancel-in-progress: true

   jobs:
     ci:
       uses: tkforgeworks/.github/.github/workflows/ci-electron.yml@main
       with:
         build-env-json: '{"VITE_TELEMETRY_ENABLED":"true"}'
   ```
   (`runs-on` defaults to `windows-latest` in `ci-electron.yml`, matching
   anvil's current runner — no override needed. The `build-env-json` input
   replaces anvil's current inline `env:` on its build step; carrying that
   value forward is required, not optional — confirm with the repo owner if
   its purpose is unclear before dropping it.)
6. Push, open a PR, and read the actual Actions run to find the real check
   names (something like `ci / typescript / validate` and
   `ci / electron-checks` — **do not guess these in advance**, they depend on
   the job id chosen above, here `ci`). Use those exact names to PATCH
   anvil's ruleset (`docs/branch-protection-ruleset.md`), replacing the
   current required context `validate`.
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
       branches: [main]
     pull_request:
       branches: [main]

   jobs:
     ci:
       uses: tkforgeworks/.github/.github/workflows/ci-electron.yml@main
   ```
   Note this **changes the runner from `ubuntu-latest` to `windows-latest`**
   (the `ci-electron.yml` default) deliberately — this repo ships an
   NSIS-only installer with a native module (`better-sqlite3`), so its native
   rebuild and packaging checks should run against the ABI/OS it actually
   ships on, not Linux. This is an intentional fix, not an oversight to
   preserve.
8. Push, open a PR, read the actual Actions run for the real check names
   (e.g. `ci / typescript / validate`, `ci / electron-checks` — again, don't
   guess), and PATCH this repo's ruleset (current required context:
   `typecheck-and-test`) to match.
9. Confirm `lint` shows as a warning if it finds issues, while
   `typecheck`/`test`/`audit`/`build` genuinely gate merge.

## Verification

Once a repo adopts, confirm the Actions run shows: `lint` step flagged
yellow/warning (not red/failing) if lint errors exist since it's
`continue-on-error`; `typecheck`/`test`/`audit`/`build` genuinely fail the
job (and therefore the required check) if broken.
