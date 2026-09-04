# Licensing standard

**Every public tkforgeworks repo is Apache-2.0 for code, all rights reserved
for image assets.** Decided 2026-09-03; this doc is the standard and the
rollout runbook.

## Why Apache-2.0

The org's stated purpose is tinkering and learning with no customers, which
is a permissive-license profile — copyleft (GPL/AGPL/MPL) solves a problem
these projects don't have and would block reuse of the code in anything not
under the same license. Between the permissive options, Apache-2.0 was chosen
over MIT because it adds three things at zero cost:

- **Explicit patent grant** (Section 3) — contributors can't later assert
  patents against users of their own contribution. Matters as soon as anyone
  other than the owner contributes, which `CONTRIBUTING.md` invites.
- **Trademark exclusion** (Section 6) — nothing in the license lets a fork
  call itself a TK ForgeWorks product. MIT is silent on this.
- **NOTICE mechanism** (Section 4(d)) — any attribution or exclusion placed in
  `NOTICE` must be preserved by every redistribution. That's what carries the
  image-asset carve-out below.

Every toolchain in the org is compatible: Electron (itself MIT), Flutter on
Play Store and App Store (GPL is awkward on the App Store; Apache is not),
Python, and the Cloudflare-hosted website.

## Image assets are not code

Logos, wordmarks, app icons, illustrations, and screenshots — every `.svg`,
`.png`, `.jpg`, `.gif`, `.webp`, `.ico`, `.icns` — are **all rights reserved**,
not Apache-2.0. Without this, a permissive license would let anyone reuse the
brand mark. The exclusion lives in `NOTICE`, never in `LICENSE`:

- **`LICENSE` must be the verbatim Apache-2.0 text** — the ASF requires the
  text be unmodified, and GitHub's license detection (`licensee`) only
  recognises the file if it matches. Any edit turns the repo's license badge
  into "Other".
- `NOTICE` is the Apache-sanctioned place for additional notices, and
  Section 4(d) obliges downstream redistributors to keep it.

Two exceptions are built into the wording so it doesn't over-claim: a file or
directory can declare a different license for specific assets, and
third-party assets (icon sets, fonts) keep their own licenses.

**Not covered by this standard:** `AetherGears_r1`. Game art, audio, and
story assets will get their own licensing decision when the repo goes
public. Don't apply the org default there without revisiting.

## What each repo carries

| File | Source | Notes |
|---|---|---|
| `LICENSE` | this repo's root `LICENSE`, byte-for-byte | Never edit. `sha256` of the canonical text: `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`. |
| `NOTICE` | `templates/NOTICE` | Replace `<Repo Name>` and `<YEAR>` (year of first publication; leave it alone afterwards). |
| README "License" section | snippet below | So a reader doesn't have to open two files to learn the asset rule. |
| Manifest license field | per toolchain, below | Keeps registry/package metadata consistent with the file. |

README snippet:

```markdown
## License

Apache-2.0 — see [`LICENSE`](LICENSE). Image assets (logos, icons,
illustrations, screenshots) are **not** covered and are all rights reserved;
see [`NOTICE`](NOTICE).
```

Manifest fields:

| Toolchain | Where | Value |
|---|---|---|
| Node / Electron | `package.json` | `"license": "Apache-2.0"` |
| Python (uv) | `pyproject.toml` `[project]` | `license = "Apache-2.0"` (PEP 639 SPDX string) |
| Flutter / Dart | none | `pubspec.yaml` has no license field; pub reads the `LICENSE` file. |

Per-file license headers (the appendix boilerplate at the bottom of
`LICENSE`) are **optional** and not required by this standard. Add them only
if a repo already uses them.

## Rollout

`scripts/add-license.sh` opens one PR per repo that adds `LICENSE` and
`NOTICE` (it does not touch README or manifests — those are small enough to
do by hand in the same PR or a follow-up). It uses `gh api` only, so it works
under the no-bypass ruleset: a branch is created from the target base, both
files are committed via the Contents API, and a PR is opened. Repos that
already have a `LICENSE` at the base branch are skipped; empty repos (no
default branch) are skipped with a message.

```bash
# default base = each repo's default branch
scripts/add-license.sh anvil claude-observability-gui TKForgeWorks_website lazy-sleeper cheesy-scribe

# repos on the release-branch flow: PR into the current vX.Y.Z/main instead
scripts/add-license.sh lazy-sleeper-app:v0.1.0/main
```

The commit subject is `Add Apache-2.0 LICENSE and NOTICE` and the branch is
`chore/apache-2-license`, so the change shows up under *Changes* in generated
release notes. Repos whose ruleset requires a CI check will run it on the PR
as usual.

After the PRs merge, confirm GitHub detects the license:

```bash
gh repo list tkforgeworks --visibility public --json name,licenseInfo \
  --jq '.[] | "\(.name)\t\(.licenseInfo.key // "NONE")"'
```

Every public repo should read `apache-2.0`.

## Adopters

- `.github` (this repo) — source of truth for `LICENSE`, 2026-09-03.
- Others: see the PRs opened by the rollout script; update this list as they
  merge.
