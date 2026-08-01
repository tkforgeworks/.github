# GitHub Actions Node 20 Deprecation — Audit & Fix

Source ticket: [CGUI-55](https://tkforgeworks.atlassian.net/browse/CGUI-55) —
GitHub is removing the Node 20 Actions runtime
([deprecation announcement](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)).
Any action still pinned to a Node-20-runtime major version hard-fails once
that shim is removed — not a self-imposed deadline, a real external one.

## Version audit (confirmed via each action's own `action.yml`, not assumed)

| Action | Node-20 majors | First Node-24 major | Adopted here |
|---|---|---|---|
| `actions/checkout` | v4 and earlier | v5 | **v7** (latest stable) |
| `actions/setup-node` | v4 and earlier | v5 | **v7** (latest stable) |
| `softprops/action-gh-release` | v2.x | v3 | **v3** (latest stable) |
| `actions/upload-artifact` | v4 (floating tag currently still node20) | v7 | not used in this repo — anvil only |
| `actions/download-artifact` | v4 and earlier | v8 | not used in this repo — anvil only |

Went to latest stable major rather than the bare-minimum Node-24 major for
`checkout`/`setup-node`/`action-gh-release` — reviewed each major's release
notes between the minimum and latest (v5→v6→v7 for checkout/setup-node,
v2→v3 for action-gh-release) and none contain a breaking change relevant to
how these are actually used here (plain checkout, `fetch-depth: 0`,
cross-repo checkout via `repository:`, `cache: npm`). Landing on latest now
means this doesn't need revisiting again soon.

## What's fixed in this repo

- `.github/workflows/release-notes.yml` — both `actions/checkout` calls and
  `actions/setup-node` bumped v4→v7
- `.github/workflows/ci-typescript.yml` — `actions/checkout` and
  `actions/setup-node` bumped v4→v7
- `.github/workflows/ci-electron.yml` — same, in the `electron-checks` job
  (the nested `typescript` job inherits the fix from `ci-typescript.yml`)
- `README.md`'s release-notes consumption example — `softprops/action-gh-release`
  bumped v2→v3, so repos copying this snippet don't inherit the problem

Fixing the reusable workflow here is why CGUI-55 scoped it this way: this
one change is inherited by anvil (via `release-notes.yml`) without a
per-repo edit there. Neither anvil's nor claude-observability-gui's own
`ci.yml`/`release.yml` `uses:` this repo for their CI or artifact/release
steps directly, though — those actions are pinned independently in each
repo's own workflow files, so this fix does **not** reach them. That's
tracked separately below.

## Remaining work (separate repos, not covered by this commit)

CGUI-55's audit already names these; recorded here with the exact confirmed
version jumps so a future agent session working in either repo doesn't have
to re-derive them.

**anvil** (`ci.yml` + `release.yml`, both independent of this repo's
workflows except the `release-notes` job):
- `ci.yml`: `actions/checkout@v4` → `v7`, `actions/setup-node@v4` → `v7`
- `release.yml`: `actions/checkout@v4` → `v7` (two places: `check-release`
  and `build` jobs), `actions/setup-node@v4` → `v7`, `actions/upload-artifact@v4`
  → `v7`, `actions/download-artifact@v4` → `v8`, `softprops/action-gh-release@v2`
  → `v3`

**claude-observability-gui** (`ci.yml` + `release.yml`, same independence):
- `ci.yml`: `actions/checkout@v4` → `v7`, `actions/setup-node@v4` → `v7`
- `release.yml`: `actions/checkout@v4` → `v7` (two places: `typecheck-and-test`
  and `build-windows` jobs), `actions/setup-node@v4` → `v7` (same two places),
  `softprops/action-gh-release@v2` → `v3`

Note: if either repo adopts `docs/ci-standards.md`'s `ci-electron.yml`
standard before this Node-20 fix lands separately, the `ci.yml` half of this
list becomes moot for that repo — the reusable workflow (already fixed here)
covers it. `release.yml`'s direct action pins still need the manual bump
either way, since release building isn't part of the CI standard.

## Verification

Per CGUI-55's acceptance bar: "no annotations remain" is the actual
completion criterion, not "versions were bumped." After bumping in a given
repo, a fresh Actions run (CI or a real tag-triggered release) should show
zero Node-20-deprecation warning annotations in the run log — check the logs,
don't just trust the version numbers.
