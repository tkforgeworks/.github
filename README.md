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

Not yet adopted by any repo — `anvil` and `claude-observability-gui` are the intended first adopters (see the doc's adoption checklist for what each needs first).

### Node 20 Actions runtime deprecation

See [`docs/node20-action-deprecation.md`](docs/node20-action-deprecation.md) — GitHub is removing the Node 20 Actions runtime; `actions/checkout`/`actions/setup-node` need v5+ and `softprops/action-gh-release` needs v3 to stay on Node 24. Fixed here in `release-notes.yml`, `ci-typescript.yml`, and `ci-electron.yml` (bumped to the latest stable majors). anvil's and claude-observability-gui's own `ci.yml`/`release.yml` pin these actions independently and still need the same bump directly in each repo — see the doc for the exact per-repo version list.
