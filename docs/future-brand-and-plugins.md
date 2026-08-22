# Future: dedicated brand repo and Claude plugin marketplace

Status: **parked** (2026-08-22). Findings from the org-wide alignment analysis,
recorded so the thread can be picked up later. Nothing here is implemented.

## Why split these out of `.github` at all

`.github` is consumed by every repo's CI via `uses: ...@main`. Anything that
churns here — brand assets, skill edits — produces commits on the same ref
that every CI run resolves. Separating by audience/change-rate is cheap
insurance: CI tooling changes rarely and carefully; brand and skills change
whenever inspiration strikes. Also, Claude Code has **no org-level
auto-discovery** of skills from a `.github` repo — the only real
distribution mechanisms are a plugin marketplace or per-repo copies.

## 1. `tkforgeworks/brand`

**What exists today** — `~/.claude/skills/tkforgeworks-design/` (global, ~6.7 MB):

- `assets/logo/` — mark + light/dark lockups (SVG + PNG)
- `colors_and_type.css` — the palette and type scale
- `fonts/` — Poppins, JetBrains Mono, Source Serif 4
- `preview/` — ~15 HTML brand/component previews
- `ui_kits/`, `screenshots/`, `uploads/`
- `SKILL.md` (34 lines) + `README.md` (219 lines) — the design guidance

**Already duplicated**: `profile/assets/tkforgeworks-lockup-{light,dark}.svg`
in this repo are copies of the lockups from the skill. `TKForgeWorks_website`
carries its own style guide under `zz-project-documentation/v1-style-guide.md`.

**Proposal**

- Repo `tkforgeworks/brand`: `assets/`, `tokens/` (`colors_and_type.css`, plus
  a JSON token export if the website/Tailwind ever wants to consume it),
  `fonts/`, `guidelines.md` (the current SKILL README), `previews/`.
- This repo's `profile/assets/` becomes a copy-on-release from `brand` (or a
  submodule — probably not worth it for two SVGs; just document the source).
- The design **skill** becomes thin: `SKILL.md` + pointer to the brand repo,
  distributed via the marketplace below. Git-LFS is not needed at 6.7 MB.

**Tradeoffs**: one more repo to version; the skill loses "everything local" —
but the fonts/previews were never needed inside a Claude context anyway, only
the tokens and guidance are.

## 2. `tkforgeworks/claude-plugins` (marketplace)

**What exists today** (all in `~/.claude`, nothing checked into any repo):

| Item | Reusable across the org? |
|---|---|
| `skills/jira-issue-writer` | Yes — every repo documents `KEY-N:` commit contract and Jira flow |
| `skills/tkforgeworks-design` | Yes (see brand above) |
| `agents/jira-content-drafter`, `agents/requirements-analyst` | Yes — planning pipeline, project-agnostic |
| commit-reminder `PreToolUse` hook (`.claude/settings.json` in anvil, cheesy-scribe, lazy-sleeper-app) | Yes — now templated at `templates/claude-settings.json` |
| `CLAUDE.md` shared sections (ruleset, commit contract, "never close Jira tickets unless asked") | Yes — now templated at `templates/CLAUDE.md` |
| `agents/{code-reviewer,architecture-reviewer,code-scaffolder,test-writer,integration-test-writer}` | No — Java/Spring/CookConnect-specific |
| `agents/infra-reviewer` | Only if homelab mirrors to GitHub; Proxmox-specific |
| `skills/code-review`, `skills/infra-review` | No — disabled in settings, superseded by the agents; ~92 KB dead weight, delete |

**Proposal**

- Repo `tkforgeworks/claude-plugins` with `.claude-plugin/marketplace.json`
  and one plugin per concern:
  - `tkfw-workflow` — jira-issue-writer skill, jira-content-drafter +
    requirements-analyst agents, the commit-reminder hook, the CLAUDE.md
    template as a `/init-tkfw` command.
  - `tkfw-design` — thin design skill pointing at the brand repo.
- Add the marketplace once in `~/.claude/settings.json`
  (`extraKnownMarketplaces` — the plumbing already exists there for
  `tim-klimpel-marketplace`); enable per-project via `.claude/settings.json`
  `enabledPlugins` so any clone gets the same tooling.
- Java/Spring agents stay global (or move to a CookConnect-scoped plugin later).

**Open questions**

- Does the hook belong in a plugin (auto-installed) or stay as a template copied
  per repo? Plugin is less drift; template is more visible.
- Version the marketplace with tags so `.github`-style `@main` churn doesn't
  change agent behavior mid-session.

## Related housekeeping noticed during the analysis

- GitHub repo is still named `cheesey-scribe`; local clone and content say
  `cheesy-scribe`. Rename the repo (GitHub redirects the old name).
- `robo-narc` on GitHub is empty (`size: 0`); local has one commit never pushed.
- `TKForgeWorks_website` local clone: stale fetch (Aug 3), unpushed work on
  `content/add-project-cards`.
- `unifi-cloudflare-ddns` (private, dormant since 2025-09) is the only repo with
  `dependabot.yml`, `.editorconfig`, `.prettierrc`, `SECURITY.md`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` — it came from a template. If it's
  ever revived it's a natural second adopter of `ci-typescript.yml` and a
  reusable Cloudflare deploy workflow (which would also serve the website).
