# TK ForgeWorks

One mans dream to make it out, and build the things he wants.  No deadlines, no customers, no pressure.  A place to make and tinker, to create and learn.  Mechanical, electrical, software, whatever it may be - This is the place to find it and to build it.

## Shared Standards

### Branching model

See [`docs/branching-and-release.md`](docs/branching-and-release.md). Every repo, with or without a release pipeline: `main` is the released state; work accumulates on a `vX.Y.Z/main` release branch named for the version it will ship; topic branches are `vX.Y.Z/<KEY>-N-topic` and PR into the release branch; the release branch reaches `main` via a release PR. RCs are cut from the release branch, the stable release on merge. The doc covers how X.Y.Z is chosen, what the manifest version means per toolchain, and why release branches get only force-push/deletion protection (a required check would reject the scripts' direct bump pushes).

Adopters: `lazy-sleeper-app` (`v0.1.0/main`, first on the full flow).

### Release notes generation

`scripts/generate-release-notes.js` + the `release-notes.yml` reusable workflow build release bodies from commit subjects since the previous tag: version-bump and merge commits filtered, subjects split into Changes vs Bug Fixes (bug-fix subjects start with `Fix` or `<KEY>-N: Fix ...`), Jira ticket keys auto-linked. Stable releases diff against the previous *stable* tag so final notes span all release candidates. Works whether the release tag already exists (tag-triggered) or is created after notes generation (push-triggered — pass `release-version`).

Consume from any repo''s release workflow:

```yaml
jobs:
  release-notes:
    uses: tkforgeworks/.github/.github/workflows/release-notes.yml@main
    with:
      ticket-prefix: CGUI   # your Jira project key

  build:
    needs: release-notes
    # ...
      - uses: softprops/action-gh-release@v3
        with:
          body: ${{ needs.release-notes.outputs.body }}
```

Set a `JIRA_BASE_URL` repo (or org) variable, e.g. `https://tkforgeworks.atlassian.net/browse`. Commit-subject discipline is the contract: subjects become changelog lines, and `Fix ...` prefixes drive the Bug Fixes section.

Adopters: `claude-observability-gui` (tag-push releases), pattern originated in `anvil` (push-to-master releases — pass `release-version` explicitly there).

### Branch protection (repository ruleset)

See [`docs/branch-protection-ruleset.md`](docs/branch-protection-ruleset.md) for the standard: a repository ruleset (not classic branch protection) that blocks force-pushes and deletion of the default branch, requires PRs with a passing named CI check, and disallows all bypass — including admins. A second, lighter ruleset covers release branches (`v*/main`): no force-push or deletion, nothing else. Includes the replication `gh api` commands for both, per-repo adaptation notes (CI job name, multiple required checks), an update flow for existing rulesets (`PUT`, not `PATCH` — the latter 404s), and verification steps.

Adopters: `anvil` (source of truth), `claude-observability-gui` (first mirror), `lazy-sleeper-app` (ruleset 21023856, required check `ci / ci`).

### CI / validation (TypeScript & Electron)

See [`docs/ci-standards.md`](docs/ci-standards.md) for the standard: two composable reusable workflows, `ci-typescript.yml` (generic lint/typecheck/test/audit/build for any TS/Node repo) and `ci-electron.yml` (layers electronegativity, native-module rebuild check, and an `electron-builder --dir` packaging dry-run on top). Requires a fixed `lint`/`typecheck`/`test`/`build` npm script contract in the caller. `lint` and the Electron-specific checks are intentionally non-blocking for now — see the doc for why and the per-repo adoption checklist.

Not yet adopted by any repo — `anvil`, `claude-observability-gui`, and `TKForgeWorks_website` (plain TS, a 1:1 fit for `ci-typescript.yml`) are the intended first adopters (see the doc's adoption checklist for what each needs first).

### CI / validation (Python)

`ci-python.yml` — uv + ruff + pytest for any Python repo with a committed `uv.lock`. Optional `postgres-image` input starts a Postgres container and exports `DATABASE_URL`; optional `post-test-command` runs extra validation after tests (e.g. an alembic upgrade/downgrade round-trip). Lint is **blocking** here (unlike the TS workflow) because the first adopter already gates on ruff. Intended first adopter: `lazy-sleeper`.

```yaml
jobs:
  ci:
    uses: tkforgeworks/.github/.github/workflows/ci-python.yml@main
    with:
      postgres-image: postgres:16-alpine
      postgres-user: lazysleeper
      postgres-password: lazysleeper
      postgres-db: lazysleeper
      post-test-command: |
        uv run alembic upgrade head
        uv run alembic downgrade base
        uv run alembic upgrade head
```

### CI / validation (Flutter)

`ci-flutter.yml` — `flutter pub get` → `dart format` → `flutter analyze` → `flutter test`. Pin `flutter-version` in the caller. `dart format` does not honour `analysis_options.yaml` excludes, so every `.dart` file in the repo (including any under `docs/`) must be formatted. Also used as the release gate by `release-flutter.yml` (nested reusable), so a repo's `ci.yml` and `release.yml` should pass the same `flutter-version`.

Adopters: `lazy-sleeper-app` (first adopter, LS-39 PR #1, 2026-08-28 — passed unchanged, ~1m25s–2m05s on `ubuntu-latest` with `flutter-version: '3.47.2'`).

### Release pipeline

Tagless RC → stable model shared by every toolchain: version bumps are ordinary commits made by a vendored script, the release workflow self-gates on whether `v{version}` already exists and on branch/version legality (RCs only from `vX.Y.Z/main` release branches, stable only from the default branch), and the tag is created server-side when the release is published — so it works under a no-bypass ruleset. Both workflows consume `release-notes.yml` internally. Never hand-edit the version or push tags.

#### Electron — `release-electron.yml` + `scripts/release/{rc-tag,release-tag}.js`

`release-electron.yml` — extracted from `claude-observability-gui` (CGUI-65, originally anvil): `check-release` → `release-notes` + `gate` (typecheck/test) → `build` matrix over `runs-on-json` → `publish` (draft, then published). Script contract: `typecheck`/`test`/`build`/`dist` (+ optional `rebuild`). `rc-tag.js <patch|minor|major>` bumps to `X.Y.Z-rc.N` on the release branch; `release-tag.js final` bumps to `X.Y.Z` and opens the release PR (run from the default branch it creates `vX.Y.Z/main` first). Vendor the two scripts into the caller's `scripts/release/` and wire the `rc:*` / `release:*` npm scripts. See the workflow header for the caller wrapper.

Not yet adopted — `claude-observability-gui` is the intended first adopter (its `release.yml` is the source). Note CGUI-79 (Linux targets) is served by `runs-on-json: '["windows-latest","ubuntu-latest"]'`.

#### Flutter — `release-flutter.yml` + `scripts/release/bump-version.{ps1,sh}`

`release-flutter.yml` — job for job the Electron twin: `check-release` (reads `pubspec.yaml` `version:`, strips `+BUILD`) → `release-notes` + `gate` (`uses: ci-flutter.yml` — the PR check *is* the release gate) → `build-windows` (Inno Setup installer + zip, `windows-latest`) and `build-android` (keystore-signed APK, `ubuntu-latest`) → `publish` (draft → upload → publish; a platform switched off via input is skipped without blocking publish, a failed one still blocks). Inputs: `ticket-prefix`, `flutter-version` (both required — pin the SDK), `default-branch`, `flutter-channel`, `java-version`, `build-windows` / `build-android`. Secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` via `secrets: inherit`. Script contract in the caller: `scripts/release/build-windows.ps1` → `release/*.exe` (+ `*.zip`), `scripts/release/build-android.sh` → `release/*.apk`, `release/` gitignored. See the workflow header for the caller wrapper.

`bump-version.ps1` / `bump-version.sh` (identical behaviour; vendor both into the caller's `scripts/release/`) are the pubspec adapter for `rc-tag.js` / `release-tag.js`, with one deliberate difference: **the base version comes from the release-branch name** (`vX.Y.Z/main`), because `pubspec.yaml` carries the *upcoming* version from the moment the branch is cut, whereas `package.json` holds the *last shipped* one. So there is no `patch|minor|major` — the CLI is `rc` | `final` (optional `X.Y.Z` override). `rc` → `X.Y.Z-rc.N+BUILD`, commits `Release candidate X.Y.Z-rc.N`, pushes; `final` → `X.Y.Z+BUILD`, commits `X.Y.Z`, pushes, opens the release PR. `+BUILD` (Android `versionCode`) increments on every bump. Refuses to run on the default branch; `final` refuses if `vX.Y.Z` already exists. Flutter repos do not need Node.

Adopters: `lazy-sleeper-app` (source, LS-73 PR #14; validated end to end by `v0.1.0-rc.1`, run `33223651283` — Windows installer + zip + signed APK, ~9 min for the full run).

### Community health files & templates

Files at this repo's root / `.github/` are **inherited by every public org repo that lacks its own**: `SECURITY.md`, `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/`. All are deliberately short stubs — refine as needed.

Files GitHub does **not** inherit live under [`templates/`](templates/) and must be copied into each repo: `dependabot.yml` (grouped weekly, delete unused ecosystems), `CODEOWNERS`, `.gitattributes` (LF/CRLF policy for Windows + WSL, promoted from homelab), `.editorconfig`, `claude-settings.json` (the "CLAUDE.md CHECK REQUIRED" pre-commit hook used in anvil/cheesy-scribe/lazy-sleeper-app), and `CLAUDE.md` (skeleton with the org-standard process sections; convention is `<repo>/.claude/CLAUDE.md`).

### Parked: brand repo & Claude plugin marketplace

See [`docs/future-brand-and-plugins.md`](docs/future-brand-and-plugins.md) — findings and a proposal for splitting the design system into `tkforgeworks/brand` and distributing shared Claude skills/agents/hooks via a plugin marketplace. Not started.

### Node 20 Actions runtime deprecation

See [`docs/node20-action-deprecation.md`](docs/node20-action-deprecation.md) — GitHub is removing the Node 20 Actions runtime; `actions/checkout`/`actions/setup-node` need v5+ and `softprops/action-gh-release` needs v3 to stay on Node 24. Fixed here in `release-notes.yml`, `ci-typescript.yml`, and `ci-electron.yml` (bumped to the latest stable majors). anvil's and claude-observability-gui's own `ci.yml`/`release.yml` pin these actions independently and still need the same bump directly in each repo — see the doc for the exact per-repo version list.
