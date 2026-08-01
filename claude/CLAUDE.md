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

## Update log

Newest first. One entry per notable change — what changed and why, not a
line-by-line diff (git history already has that).

- **2026-08-01** — Initialized this `claude/CLAUDE.md` reference file. No
  code changes; repo already contained the release-notes standard
  (script + reusable workflow) from prior sessions.
