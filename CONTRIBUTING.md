# Contributing

<!-- STUB — org-wide default inherited by every public tkforgeworks repo that lacks its own CONTRIBUTING.md. Refine later. -->

Thanks for your interest. These are personal projects built for fun and
learning; contributions are welcome but there are no deadlines and no
guarantees of review turnaround.

## Ground rules

- **Open an issue first** for anything larger than a typo fix so the approach
  can be agreed before code is written.
- **All changes land via pull request** to the current release branch
  (`vX.Y.Z/main`); release branches land on the default branch via a release
  PR. Topic branches are `vX.Y.Z/<KEY>-N-topic`. See
  [`docs/branching-and-release.md`](https://github.com/tkforgeworks/.github/blob/main/docs/branching-and-release.md).
  The default branch is protected by a repository ruleset with no bypass;
  release branches by a lighter one — see
  [`docs/branch-protection-ruleset.md`](https://github.com/tkforgeworks/.github/blob/main/docs/branch-protection-ruleset.md).
- **CI must pass.** Repos consume the shared workflows in
  [`tkforgeworks/.github`](https://github.com/tkforgeworks/.github) — see
  [`docs/ci-standards.md`](https://github.com/tkforgeworks/.github/blob/main/docs/ci-standards.md).
- **Commit subjects are the changelog.** Write them in the imperative mood.
  Bug fixes start with `Fix ...` (or `<JIRA-KEY>-N: Fix ...` when a ticket
  exists); everything else lands under *Changes* in the generated release
  notes. Don't leave the codebase half-finished in any single commit.
- **Tests test behavior**, not implementation details.
- **Licensing.** Code is Apache-2.0; by submitting a contribution you agree
  it is licensed under the same terms (Apache-2.0 §5 — no separate CLA).
  Image assets are all rights reserved and are not accepted as contributions
  unless discussed first. See
  [`docs/licensing.md`](https://github.com/tkforgeworks/.github/blob/main/docs/licensing.md).

## Conventions shared across repos

- Electron apps package with **electron-builder**, never Electron Forge.
- Prefer explicit code over framework magic; constructor injection over field
  injection.
