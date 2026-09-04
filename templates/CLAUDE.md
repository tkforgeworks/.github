# <Repo Name> — Claude Reference

<!-- Template — copy to <repo>/.claude/CLAUDE.md (the org convention; keep the
root free of it). Replace every <placeholder>. Delete sections that don't apply. -->

## What this is

<One paragraph: what the project does, who it's for, current phase.>

## Stack & commands

| Task | Command |
|---|---|
| Install | `<npm ci / uv sync --locked --dev / flutter pub get>` |
| Lint | `<npm run lint / uv run ruff check .>` |
| Typecheck | `<npm run typecheck>` |
| Test | `<npm test / uv run pytest>` |
| Build | `<npm run build>` |

## Repo & process conventions (org standard)

- Branching (org standard, `tkforgeworks/.github/docs/branching-and-release.md`):
  `main` is the released state; work accumulates on the current release branch
  `vX.Y.Z/main` (currently `<vX.Y.Z/main>`); topic branches PR **into the
  release branch**, never into `main`; the release branch reaches `main` via a
  release PR.
- `main` is protected by the org repository ruleset: PR-only, no force-push or
  deletion, **no bypass actors** (not even admins). Required check: `<job name>`.
  Release branches (`v*/main`) have a second ruleset: no force-push/deletion,
  no required check (the bump scripts push to them directly).
  Standard: `tkforgeworks/.github/docs/branch-protection-ruleset.md`.
- CI consumes the shared reusable workflow
  `tkforgeworks/.github/.github/workflows/<ci-typescript|ci-electron|ci-python|ci-flutter>.yml@main`.
  Don't hand-roll steps that belong in the shared workflow — change it there.
- **Commit subjects are the changelog.** `<KEY>-N: Imperative summary`.
  Bug fixes: `<KEY>-N: Fix ...`. Release notes are generated from subjects by
  `release-notes.yml`; `ticket-prefix: <KEY>`.
- Jira project **<Project Name>**, key **`<KEY>`**. Move a ticket to *In
  Progress* when its branch opens. **Never close a ticket unless asked** —
  comment "Actions taken" + commit hash and leave it for the human to verify.
- Branch names: `vX.Y.Z/<KEY>-N-short-topic`, cut from and PR'd into
  `vX.Y.Z/main`.
- Releases (tagless pipeline): **never hand-edit the version or push tags.**
  Electron repos: `npm run rc:<patch|minor|major>` / `npm run release:final`
  (vendored `scripts/release/{rc-tag,release-tag}.js`). Flutter repos:
  `scripts/release/bump-version.{ps1,sh} <rc|final>` on the `vX.Y.Z/main`
  branch (the base version comes from the branch name). CI creates the tag
  when it publishes.
- License: **Apache-2.0** (`LICENSE` is the verbatim Apache text — never
  edit it). Image assets (`.svg`/`.png`/etc.) are **all rights reserved** via
  `NOTICE`. Manifest `license` field must say `Apache-2.0`. Standard:
  `tkforgeworks/.github/docs/licensing.md`.
- Update this file as the last step of closing any ticket that changed
  conventions, architecture, or status.

## Architecture decisions (locked)

- <decision — and the reason, so it isn't relitigated>

## Current status

<Short. Link to Jira for the long version; don't let this become a ticket log.>
