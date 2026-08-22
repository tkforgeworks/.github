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

- `main` is protected by the org repository ruleset: PR-only, no force-push or
  deletion, **no bypass actors** (not even admins). Required check: `<job name>`.
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
- Branch names: `<KEY>-N-short-topic` (or `vX.Y.Z/<topic>` on release branches
  for repos using the tagless release pipeline).
- Update this file as the last step of closing any ticket that changed
  conventions, architecture, or status.

## Architecture decisions (locked)

- <decision — and the reason, so it isn't relitigated>

## Current status

<Short. Link to Jira for the long version; don't let this become a ticket log.>
