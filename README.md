# TK ForgeWorks

One mans dream to make it out, and build the things he wants.  No deadlines, no customers, no pressure.  A place to make and tinker, to create and learn.  Mechanical, electrical, software, whatever it may be - This is the place to find it and to build it.

## Shared Standards

### Release notes generation

`scripts/generate-release-notes.js` + the `release-notes.yml` reusable workflow build release bodies from commit subjects since the previous tag: version-bump and merge commits filtered, subjects split into Changes vs Bug Fixes (bug-fix subjects start with `Fix` or `<KEY>-N: Fix ...`), Jira ticket keys auto-linked. Stable releases diff against the previous *stable* tag so final notes span all release candidates. Works whether the release tag already exists (tag-triggered) or is created after notes generation (push-triggered — pass `release-version`).

Consume from any repo''s release workflow:

```yaml
jobs:
  release-notes:
    uses: tkforgeworks/.github/.github/workflows/release-notes.yml@main
    with:
      ticket-prefix: CGUI   # your Jira project key

  build:
    needs: release-notes
    # ...
      - uses: softprops/action-gh-release@v2
        with:
          body: ${{ needs.release-notes.outputs.body }}
```

Set a `JIRA_BASE_URL` repo (or org) variable, e.g. `https://tkforgeworks.atlassian.net/browse`. Commit-subject discipline is the contract: subjects become changelog lines, and `Fix ...` prefixes drive the Bug Fixes section.

Adopters: `claude-observability-gui` (tag-push releases), pattern originated in `anvil` (push-to-master releases — pass `release-version` explicitly there).
