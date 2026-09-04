# TK ForgeWorks Branching & Release Flow

The org branching model. It applies to **every** tkforgeworks repo, with or
without a release pipeline — a repo that never cuts a release still branches
this way so the shape is the same everywhere.

## The model

```
<KEY>-N-topic ──PR──▶ vX.Y.Z/main ──release PR──▶ main
   (topic)            (release branch)             (released state)
```

| Branch | Role | Protection |
|---|---|---|
| `main` (or `master`) | The released state. Only ever moves by merging a release PR. | Org ruleset: PR-only, required CI check, no force-push/delete, no bypass — `docs/branch-protection-ruleset.md`. |
| `vX.Y.Z/main` | The release branch: everything that will ship as `X.Y.Z` accumulates here. Cut from the default branch when work on the next version starts. RCs are cut from it; the stable release happens when it merges. | Second ruleset: no force-push/delete. **No** PR rule and **no** required check — see "Why release branches are only lightly protected" below. |
| `vX.Y.Z/<KEY>-N-topic` | Topic branch. One ticket, PR into `vX.Y.Z/main`. Deleted after merge. | None. |

Naming: `vX.Y.Z/` is a literal prefix. The topic segment follows the org
convention `<KEY>-N-short-topic` (Jira key + number + a few words).

### Choosing X.Y.Z

The release branch is named for the version it will ship, decided when the
branch is cut. Bump the segment that matches the biggest change you intend
to land (semver: breaking → major, feature → minor, fix → patch). If the
scope grows, rename the branch (`git branch -m`, push, delete the old one)
before the first RC — after an RC exists the version is public and stays.

An unreleased project starts at whatever its manifest says: lazy-sleeper-app
opened `v0.1.0/main` because `pubspec.yaml` was `0.1.0+1` and nothing had
shipped.

### What the version in the manifest means

The two toolchains differ here, and the release scripts are built around it:

- **Electron / npm** — `package.json` holds the *last shipped* version. The
  scripts (`rc-tag.js <patch|minor|major>`, `release-tag.js`) compute the next
  one from it.
- **Flutter** — `pubspec.yaml` holds the *upcoming* version from the moment
  the branch is cut, so the scripts (`bump-version.{ps1,sh} <rc|final>`)
  take the base version from the **branch name** and there is no
  patch/minor/major to choose.

Either way: **never hand-edit the version or push tags.** Tags are created
server-side by the release workflow when it publishes.

## Day to day

1. **Start a version.** From the default branch: `git switch -c vX.Y.Z/main`,
   push. (For Flutter, set `pubspec.yaml` to `X.Y.Z+<build>` in the first
   topic PR if it isn't already.)
2. **Work.** `git switch -c vX.Y.Z/<KEY>-N-topic` from the release branch.
   Push early — CI runs on every push to a non-default branch. Open the PR
   **into `vX.Y.Z/main`**; the merge-gate check runs on it (the CI trigger
   envelope in `docs/ci-standards.md` includes `'v*/main'` for exactly this).
3. **Cut RCs** from the release branch as often as useful:
   `npm run rc:patch` / `scripts/release/bump-version.sh rc`. The bump is an
   ordinary commit pushed straight to `vX.Y.Z/main`; the release workflow
   publishes a prerelease and creates the `vX.Y.Z-rc.N` tag.
4. **Finalize.** `npm run release:final` / `bump-version.sh final` bumps to
   `X.Y.Z` on the release branch, pushes, and opens the release PR into the
   default branch. Merging it publishes the stable release and creates the
   `vX.Y.Z` tag. Release notes span every RC since the previous stable tag.
5. **Next version.** Cut `vX.Y.(Z+1)/main` (or the next minor) from the
   freshly merged default branch. Delete the old release branch once its tag
   exists.

Repos without a release pipeline follow steps 1, 2, and a plain PR from the
release branch to the default branch in place of steps 3–4. The version is
then just a label for "this batch of work".

## Why release branches are only lightly protected

The org ruleset on the default branch requires a PR and a passing check.
That combination cannot be applied to `vX.Y.Z/main`: a required status check
rejects any direct push whose head commit has not already had the check
pass ("commits must first be pushed to another branch, then merged or pushed
after status checks have passed" — GitHub docs), and the RC/final bump is
exactly such a direct push of a brand-new commit. Requiring the check would
turn every bump into a PR, which the scripts do not do and which adds a
round-trip to every RC.

So the release-branch ruleset carries only `non_fast_forward` and
`deletion`. That stops the two irreversible mistakes (force-push over merged
work, deleting the branch mid-version). It does **not** stop merging a topic
PR whose check is red — that stays manual discipline: the check *reports* on
the PR (the envelope includes `'v*/main'`), it just isn't *required*. A red
merge is caught again at the release PR, where the default-branch ruleset
does require it.

Revisit if the org gains a second maintainer: at that point the fix is to
make the bump scripts open a PR (option C in the original handoff), not to
add the required check without changing the scripts.

## Where this is enforced / referenced

- `docs/branch-protection-ruleset.md` — both rulesets (default branch,
  release branches) with replication commands.
- `docs/ci-standards.md` — trigger envelope (`pull_request: branches:
  [<default-branch>, 'v*/main']`).
- `.github/workflows/release-electron.yml`, `release-flutter.yml` —
  RC-from-`v*/main`, stable-from-default gates.
- `scripts/release/` — `rc-tag.js`, `release-tag.js`, `bump-version.{ps1,sh}`.
- `templates/CLAUDE.md` — the per-repo summary agents read.
- `CONTRIBUTING.md` — the inherited contributor-facing version.

## Adopters

| Repo | Release branch in use | Notes |
|---|---|---|
| lazy-sleeper-app | `v0.1.0/main` | First repo on the full flow (LS-39, 2026-08-28). `v0.1.0-rc.1` cut from it. |
| anvil, claude-observability-gui | — | Release pipeline already expects `v*/main`; need the `'v*/main'` PR trigger in `ci.yml` and the release-branch ruleset. |
| lazy-sleeper, TKForgeWorks_website | — | No release pipeline; adopt the branch shape only. |
