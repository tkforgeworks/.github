# COG Flutter plan and accepted advisories

## Decision and status

Decided 2026-11-03 during claude-observability-gui (COG)'s 2.0.0 release
close-out, [CGUI-148](https://tkforgeworks.atlassian.net/browse/CGUI-148):
COG app builds are planned to move from Electron to Flutter. Because of
that plan, the Electron 42 upgrade and react-router v7 migration were declined.
COG is deliberately staying on Electron 41 and react-router 6.x with the
advisories below accepted for its current usage.

**Not decided:** the timeline, the scope of the Flutter move, and whether
the Electron app is retired or kept in parallel. This decision sets no
migration date or retirement commitment.

## Accepted advisories

| Package | Version held | Why the advisories do not reach COG's current usage | Fixed-in version where known |
|---|---|---|---|
| Electron | 41 (the line ends at 41.10.7) | COG makes almost no network requests. This is the basis for accepting the current advisories. | 42.11.16+ |
| react-router | 6.x (updated to 6.30.6 at close-out) | The advisories require attacker-controlled navigation paths or server-side rendering; COG has neither. | No patched 6.x release exists. The react-router 7 migration was declined. |

This acceptance applies to the known advisories and current usage; it is
not a blanket acceptance of future findings.

## When to reopen

- A new high/critical advisory reaches COG's actual usage, including local
  file parsing, IPC, or the renderer.
- COG starts making network requests.
- The Flutter move is dropped or deferred indefinitely; then plan Electron
  42+ and react-router 7 upgrades.

## Audit coverage gap

`npm audit --omit=dev` never reports Electron: `electron` is in
`devDependencies` even though it is the shipped runtime. Audits of Electron
repos should run the full `npm audit` or check `electron` separately.

The org's `ci-typescript.yml` runs
`npm audit --omit=dev --audit-level=high`, so CI will not surface Electron
advisories. A passing CI audit does not establish that the shipped Electron
runtime has no advisories. Review findings against the acceptance above and
the reopen triggers.

## History

At the CGUI-148 release close-out, bundled-library advisories were fixed in
adm-zip (updated to 0.6.1), lodash, fast-uri, and react-router (updated to
6.30.6). The react-router v7 migration and Electron 42 upgrade were declined
because of the planned Flutter move.
