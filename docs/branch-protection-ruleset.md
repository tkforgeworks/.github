# TK ForgeWorks Branch Protection Standard (Repository Ruleset)

Source of truth: `tkforgeworks/anvil` ruleset id 16447467 ("master"), read 2026-08-01.
First mirrored to: `tkforgeworks/claude-observability-gui` ruleset id 20203739 ("main"), created 2026-08-01.

## Mechanism

Protection is implemented as a **repository ruleset** (`POST /repos/{owner}/{repo}/rulesets`), NOT classic branch protection (`PUT /repos/.../branches/.../protection`). Anvil has no classic protection configured — do not use that API when replicating.

**Plan requirement:** repository rulesets on **private/internal** repos require GitHub Team or Enterprise Cloud — they are not available on the Free plan for private repos (public repos get rulesets on any plan). If a future tkforgeworks repo is private on Free, the `POST` below will fail on permissions/plan, not on anything in this doc. Confirm org plan before assuming this standard applies as-is.

## What the ruleset enforces (on the default branch)

| Rule | Setting | Effect |
|---|---|---|
| `deletion` | — | Default branch cannot be deleted |
| `non_fast_forward` | — | Force pushes blocked |
| `pull_request` | 0 required approvals; stale-review dismissal off; no code-owner review; no last-push approval; no review-thread resolution; merge methods: merge, squash, rebase (all) | All changes must arrive via PR, but a solo maintainer can merge their own PR without a reviewer |
| `required_status_checks` | strict policy on; `do_not_enforce_on_create` off; one check from GitHub Actions (`integration_id: 15368`) | The named CI job must pass AND the branch must be up to date with the base before merge |
| `bypass_actors` | `[]` (empty) | Nobody can bypass, including admins (`current_user_can_bypass: never`) |
| `enforcement` | `active` | Live immediately |

Ref condition: `include: ["refs/heads/master", "refs/heads/main"]`, `exclude: []` — covers either default-branch name so the same ruleset JSON works in repos that use `master` (anvil) or `main` (claude-observability-gui). **New repos should trim this to their actual default branch name** rather than cargo-culting both — including a branch name that doesn't exist is harmless, but it's noise, and if a repo's default branch is neither `main` nor `master` (e.g. `develop`, `trunk`), the ruleset silently protects nothing until the include list is corrected.

Release branches (`vX.Y.Z/main`) are intentionally NOT protected — topic-branch → release-branch merges stay frictionless; protection applies at the release-merge into the default branch.

## Prerequisite: CI must already exist and have reported on a PR

Apply this ruleset only **after** the repo's CI workflow exists, runs on `pull_request`, and has reported at least once against the default branch. A required status check that has never reported for that ref sits "expected" indefinitely and blocks every PR — this is not just the wrong-context failure mode below, it's the same dead-end for a check that's merely never run yet. Applying the ruleset before CI exists locks the repo out of merging via PR entirely (and since `bypass_actors` is empty, there's no bypass — see Operational consequences below for the disable/re-enable escape hatch).

## Per-repo adaptation (the ONLY thing that changes)

The `required_status_checks[].context` must equal the repo's CI **job name** (job-level `name:` if set, else the job key in the workflow YAML):

| Repo | CI job / context |
|---|---|
| anvil | `validate` |
| claude-observability-gui | `typecheck-and-test` |

A wrong context blocks every PR forever (the required check never reports). Verify with:
`grep -A2 "^jobs:" .github/workflows/ci.yml`

Also verify the CI workflow actually runs on PRs targeting the default branch (`on.pull_request.branches` must include it), or the required check never fires.

**Nested reusable workflows change the check name.** Adopting a nested reusable workflow (see `docs/ci-standards.md` — `ci-electron.yml` calls `ci-typescript.yml` as a sub-job) produces check names like `ci / typescript / validate` rather than a single flat job name. Update `required_status_checks[].context` to match via the PATCH flow below whenever a repo switches its CI to one of these standards, or the ruleset waits forever on a context that no longer reports.

**Multiple required checks:** the examples above assume one CI job gates merge. If a repo has separate jobs that should all be required (e.g. `lint`, `test`, `build` as independent jobs rather than steps in one job), add one entry per job to the `required_status_checks` array:

```json
"required_status_checks": [
  { "context": "lint", "integration_id": 15368 },
  { "context": "test", "integration_id": 15368 },
  { "context": "build", "integration_id": 15368 }
]
```

Each entry is independently subject to the same "must have reported at least once" prerequisite above.

## Replication command

```sh
gh api repos/tkforgeworks/<REPO>/rulesets --method POST --input - <<'JSON'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["refs/heads/main", "refs/heads/master"], "exclude": [] }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "required_reviewers": [],
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["merge", "squash", "rebase"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "<CI_JOB_NAME>", "integration_id": 15368 }
        ]
      }
    }
  ],
  "bypass_actors": []
}
JSON
```

`integration_id: 15368` is the GitHub Actions app — it pins the check to Actions so a differently-sourced check with the same name can't satisfy the rule. Keep it as-is.

## Updating an existing ruleset

The command above is a `POST` (create) — re-running it against a repo that already has a ruleset named `main` will fail on the duplicate name rather than update it. To change a mirrored ruleset (new CI job name, added check, adjusted parameters):

1. Find the ruleset id: `gh api repos/tkforgeworks/<REPO>/rulesets` (look for `"name": "main"`, note its `"id"`)
2. `PATCH` it with the full desired body (partial updates are not merged — send the complete rule set):
   ```sh
   gh api repos/tkforgeworks/<REPO>/rulesets/<ID> --method PATCH --input - <<'JSON'
   { ...same shape as the POST body... }
   JSON
   ```
3. Re-run the verification steps below to confirm the change took.

## Operational consequences to document for future repos

1. **No more direct pushes to the default branch** — including release merges. `git push origin main` is rejected; everything lands via PR.
2. **Version-bump flow changes:** `npm version` + `git push --follow-tags` from the default branch no longer works as a direct push. Bump on the release branch (or a PR branch), merge via PR, then push the tag (tag pushes are unaffected — the ruleset targets branches).
3. **Strict up-to-date policy:** if the default branch moves after a PR's last CI run, the PR must be updated (merge/rebase the base in) before merging.
4. **Admins cannot bypass.** Emergency changes require editing the ruleset (set `enforcement: "disabled"`, act, re-enable) — deliberate friction.

## Verification

- Read back: `gh api repos/tkforgeworks/<REPO>/rulesets` → confirm `enforcement: "active"`.
- Live check: `gh api repos/tkforgeworks/<REPO>/rules/branches/main` lists the effective rules on the branch.
- Negative test: a direct `git push origin main` with a trivial commit should be rejected with a rules violation.
