#!/usr/bin/env bash
# Open a PR adding the org-standard LICENSE + NOTICE to one or more tkforgeworks repos.
#
# Usage:
#   scripts/add-license.sh <repo>[:<base-branch>] [...]
#
#   <repo>         repo name under the tkforgeworks org (e.g. anvil)
#   <base-branch>  branch the PR targets; defaults to the repo's default branch.
#                  Repos on the release-branch flow should pass their current
#                  vX.Y.Z/main here so the change lands via the release PR.
#
# Uses gh api only (no clone), so it works under the no-bypass ruleset. Skips
# repos that already have a LICENSE at the base branch, and empty repos.
# Run from the root of tkforgeworks/.github (reads ./LICENSE and ./templates/NOTICE).
set -euo pipefail

ORG="tkforgeworks"
BRANCH="chore/apache-2-license"
SUBJECT="Add Apache-2.0 LICENSE and NOTICE"
YEAR="$(date +%Y)"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LICENSE_FILE="$ROOT/LICENSE"
NOTICE_TEMPLATE="$ROOT/templates/NOTICE"

if [[ ! -f "$LICENSE_FILE" || ! -f "$NOTICE_TEMPLATE" ]]; then
  echo "error: run from tkforgeworks/.github — need LICENSE and templates/NOTICE" >&2
  exit 1
fi
if [[ $# -eq 0 ]]; then
  sed -n '2,13p' "$0"
  exit 1
fi

b64() { base64 -w0 "$1" 2>/dev/null || base64 "$1" | tr -d '\n'; }

put_file() { # repo path branch content-file message
  gh api -X PUT "repos/$ORG/$1/contents/$2" \
    -f branch="$3" -f message="$5" -f content="$(b64 "$4")" >/dev/null
}

PR_BODY='Adopts the org licensing standard: Apache-2.0 for code, image assets all rights reserved via `NOTICE`.

See https://github.com/tkforgeworks/.github/blob/main/docs/licensing.md.

Follow-ups for this repo (not in this PR): README "License" section, manifest `license` field.'

for spec in "$@"; do
  repo="${spec%%:*}"
  base=""
  if [[ "$spec" == *:* ]]; then
    base="${spec#*:}"
  fi

  if [[ -z "$base" ]]; then
    base="$(gh api "repos/$ORG/$repo" --jq '.default_branch // empty')"
  fi
  if [[ -z "$base" ]]; then
    echo "-- $repo: no default branch (empty repo?) — skipping"
    continue
  fi

  sha="$(gh api "repos/$ORG/$repo/git/ref/heads/$base" --jq '.object.sha' 2>/dev/null || true)"
  if [[ -z "$sha" ]]; then
    echo "-- $repo: base branch '$base' not found — skipping"
    continue
  fi

  if gh api "repos/$ORG/$repo/contents/LICENSE?ref=$base" >/dev/null 2>&1; then
    echo "-- $repo: LICENSE already present on $base — skipping"
    continue
  fi

  if gh api "repos/$ORG/$repo/git/ref/heads/$BRANCH" >/dev/null 2>&1; then
    echo "-- $repo: branch $BRANCH already exists — skipping (delete it to retry)"
    continue
  fi

  echo "== $repo: $BRANCH -> $base"
  gh api -X POST "repos/$ORG/$repo/git/refs" -f ref="refs/heads/$BRANCH" -f sha="$sha" >/dev/null

  notice="$(mktemp)"
  sed -e "s/<Repo Name>/$repo/" -e "s/<YEAR>/$YEAR/" "$NOTICE_TEMPLATE" > "$notice"

  put_file "$repo" LICENSE "$BRANCH" "$LICENSE_FILE" "$SUBJECT"
  put_file "$repo" NOTICE  "$BRANCH" "$notice"       "$SUBJECT"
  rm -f "$notice"

  url="$(gh pr create --repo "$ORG/$repo" --base "$base" --head "$BRANCH" \
    --title "$SUBJECT" --body "$PR_BODY")"
  echo "   $url"
done
