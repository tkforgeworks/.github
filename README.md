# TK ForgeWorks

One mans dream to make it out, and build the things he wants.  No deadlines, no customers, no pressure.  A place to make and tinker, to create and learn.  Mechanical, electrical, software, whatever it may be - This is the place to find it and to build it.

## Shared Standards

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

See [`docs/branch-protection-ruleset.md`](docs/branch-protection-ruleset.md) for the standard: a repository ruleset (not classic branch protection) that blocks force-pushes and deletion of the default branch, requires PRs with a passing named CI check, and disallows all bypass — including admins. Includes the replication `gh api` command, per-repo adaptation notes (CI job name, multiple required checks), an update/PATCH flow for existing rulesets, and verification steps.

Adopters: `anvil` (source of truth), `claude-observability-gui` (first mirror).

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

### CI / validation (Flutter) — stub

`ci-flutter.yml` — `flutter pub get` → `dart format` → `flutter analyze` → `flutter test`. **Unvalidated**: authored ahead of `lazy-sleeper-app` (the org's first Flutter project) so its first story lands on the shared workflow; expect to adjust once `flutter create` fixes the real layout.

### Electron release pipeline

`release-electron.yml` + `scripts/release/{rc-tag,release-tag}.js` — the tagless RC → stable release model extracted from `claude-observability-gui` (CGUI-65, originally anvil): version bumps are ordinary commits, the workflow self-gates on whether `v{version}` already exists and on branch/version legality (RCs only from `v*/main`, stable only from the default branch), builds installers on a per-OS matrix (`runs-on-json`), and publishes a draft-then-published release whose tag is created server-side — so it works under a no-bypass ruleset. Consumes `release-notes.yml` internally. Script contract: `typecheck`/`test`/`build`/`dist` (+ optional `rebuild`). Vendor the two scripts into the caller's `scripts/` and wire the `rc:*` / `release:*` npm scripts. See the workflow header for the caller wrapper.

Not yet adopted — `claude-observability-gui` is the intended first adopter (its `release.yml` is the source). Note CGUI-79 (Linux targets) is served by `runs-on-json: '["windows-latest","ubuntu-latest"]'`.

### Community health files & templates

Files at this repo's root / `.github/` are **inherited by every public org repo that lacks its own**: `SECURITY.md`, `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/`. All are deliberately short stubs — refine as needed.

Files GitHub does **not** inherit live under [`templates/`](templates/) and must be copied into each repo: `dependabot.yml` (grouped weekly, delete unused ecosystems), `CODEOWNERS`, `.gitattributes` (LF/CRLF policy for Windows + WSL, promoted from homelab), `.editorconfig`, `claude-settings.json` (the "CLAUDE.md CHECK REQUIRED" pre-commit hook used in anvil/cheesy-scribe/lazy-sleeper-app), and `CLAUDE.md` (skeleton with the org-standard process sections; convention is `<repo>/.claude/CLAUDE.md`).

### Parked: brand repo & Claude plugin marketplace

See [`docs/future-brand-and-plugins.md`](docs/future-brand-and-plugins.md) — findings and a proposal for splitting the design system into `tkforgeworks/brand` and distributing shared Claude skills/agents/hooks via a plugin marketplace. Not started.

### Node 20 Actions runtime deprecation

See [`docs/node20-action-deprecation.md`](docs/node20-action-deprecation.md) — GitHub is removing the Node 20 Actions runtime; `actions/checkout`/`actions/setup-node` need v5+ and `softprops/action-gh-release` needs v3 to stay on Node 24. Fixed here in `release-notes.yml`, `ci-typescript.yml`, and `ci-electron.yml` (bumped to the latest stable majors). anvil's and claude-observability-gui's own `ci.yml`/`release.yml` pin these actions independently and still need the same bump directly in each repo — see the doc for the exact per-repo version list.
