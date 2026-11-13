# Orchestrator lessons: tkforgeworks/.github

## Standing brief context
- No package.json, no test suite. Scripts run under plain `node` 22 in CI with no `npm install`:
  briefs must forbid new dependencies and ask for a throwaway fixture script in the scratchpad.
- The repo's reference/update log is `claude/CLAUDE.md` (not `.claude/CLAUDE.md`). Never
  delegated; the orchestrator writes its section updates and update-log entries.
- Parallel tickets get a git worktree each under `.claude/worktrees/<KEY>` (in
  `.git/info/exclude`), branch `feature/<KEY>-topic` off `main`.

## Tier calibration
- 2026-11-13 T-001 (TKFW-92, script + workflow input + docs, design fixed in brief): Codex at T2
  was right; done in one pass, fixture covered the ACs.
- 2026-11-13 T-002 (TKFW-94, docs-only decision record, facts listed in brief): one pass, no
  invented content. Listing the facts verbatim plus a grep for dates was enough guard.

## Herdr / Codex gotchas
- `~/.codex/config.toml` defaults to `sandbox_mode = "read-only"`: start workers with
  `-- --sandbox workspace-write --add-dir <scratchpad>`.
- Even in workspace-write, Node's `execSync('git …')` in another repo's clone fails with EPERM,
  so Codex asks to run unsandboxed and blocks. Cross-repo checks (e.g. re-rendering another
  repo's release notes) are cheaper for the orchestrator to run itself: mark them
  "orchestrator runs this" in the brief instead of asking the worker.
- `agent start` can return `agent_not_ready` while Codex is still loading; `agent wait` until
  idle, then prompt. Point the prompt at the brief file rather than pasting it.

## Never delegate (beyond the global list)
- Edits to `claude/CLAUDE.md` or another repo's `.claude/CLAUDE.md`.
