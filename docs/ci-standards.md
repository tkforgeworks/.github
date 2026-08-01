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

## Adoption checklist per repo

Adopting either workflow is a change to the *consuming* repo (this repo only
hosts the standard), tracked here so a future session knows what's left.

**anvil:**
- Already has `typecheck`, `test`, `build`, `rebuild` scripts matching the contract — no rename needed
- Needs: add a `lint` script + ESLint config (none exists today)
- Replace its inline `ci.yml` steps with `uses: .../ci-electron.yml@main`
- Its ruleset (`docs/branch-protection-ruleset.md`) requires status check context `validate` today — adopting the nested workflow changes the check names to something like `ci / typescript / validate` and `ci / electron-checks` (exact name depends on the job id chosen in anvil's own workflow). **Update the ruleset's `required_status_checks[].context` via the PATCH flow after adopting, or every PR blocks forever waiting on a check name that no longer exists.**

**claude-observability-gui:**
- Has `compile` where the contract expects `typecheck` — rename (or add `typecheck` as an alias that calls the same tsc invocations)
- Needs: add a `lint` script + ESLint config
- Has never run `npm audit` — first adoption may immediately fail on pre-existing advisories; resolve those or the blocking audit step fails on day one
- Currently runs CI on `ubuntu-latest` despite being an NSIS-only, native-module (`better-sqlite3`) app — should move to `windows-latest` (the `ci-electron.yml` default) so the native rebuild and packaging checks run against the ABI/OS it actually ships on
- Same ruleset-context update as anvil applies (current required context: `typecheck-and-test`)

## Verification

Once a repo adopts, confirm the Actions run shows: `lint` step flagged
yellow/warning (not red/failing) if lint errors exist since it's
`continue-on-error`; `typecheck`/`test`/`audit`/`build` genuinely fail the
job (and therefore the required check) if broken.
