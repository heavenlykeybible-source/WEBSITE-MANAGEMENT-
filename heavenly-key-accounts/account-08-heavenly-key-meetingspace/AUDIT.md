# Account 8 discovery and release audit — 28 October 2026

## Correct application

The complete MeetingSpace app is `zoom-studio/` in this repository. `config/heavenly-key-accounts.json` identifies it as Account 8. Worker: `heavenly-key-meetingspace`; intended origin: `https://meeting.heavenlykey.org`. No separate repository is required.

## Corrected

- Replaced the obsolete “source not identified” Account 8 manifest entry with the current source, account folder, Worker, website and workflow.
- Added the Account 8 folder beside the other account folders and retained the old folder as a compatibility pointer.
- Added direct navigation from the root README, official registry, source guide and Control Room Apps page.
- Added registry consistency and source existence checks. Corrected the Apps portal test to distinguish independent Worker cards from other application panels.

The existing source directory remains authoritative so relative imports, bundle scripts and workflows keep their established paths. No app source, credentials, data or production bindings were moved.

## Validation

- `npm test --prefix zoom-studio`: 84 Node tests passed; worker test file also reports 142 internal checks passed.
- `node tests/run.mjs`: passed after correcting the portal test's card count.
- `git diff --check`: passed.
- Browser/device/media/provider tests are not established by these local checks.

## Remaining release findings

- Control Room meeting installer and owner-launch routes still target the historical `heavenly-key-zoom-studio` Worker and describe Account 7. They must be reconciled with the dedicated Account 8 Worker and its existing secret before owner launch can be claimed to work. Do not rename or regenerate live secrets as a shortcut.
- `.github/workflows/zoom-studio.yml` sets private preview with the production hostname. `zoom-studio/scripts/deploy.mjs` rejects that combination and also requires the exact approved commit and explicit production approval, which this workflow currently does not supply.
- `node zoom-studio/scripts/legal-preflight.mjs` fails because privacy and terms contain unresolved placeholders. Business, contact, retention and refund facts must not be invented to make a check pass.
- Account 8 maintenance checks through the connector returned no active permission in this session. No production Worker source, bindings or deployment state was inspected through it.
- The earlier live browser test returned an upstream connection failure. It does not establish whether the failure is at the app or the testing network.

## Status

Discovery/navigation fixes saved in source; no production deployment performed. Live joining, camera, microphone, screen sharing, host controls and external broadcast services remain unverified. This audit covers MeetingSpace discovery and the inspected release paths, not every application in the repository.

## Follow-up: source move and launch repairs

The full application has now moved into `heavenly-key-accounts/account-08-heavenly-key-meetingspace/source/`. CI paths, footer packaging, deployment helpers and registry locations were updated. The former `zoom-studio/` folder contains only a redirect README.

The reviewed Control Room upgrade now defaults owner entry to the dedicated MeetingSpace Worker, prefers the named Account 8 connection when the tenant is shared, rejects ambiguous selection, and preserves explicit legacy Worker launch support. Unknown Worker names are rejected; existing encrypted owner-launch secrets are preserved. No production secret has been generated or rotated.

The deployment workflow now accepts an exact approved main revision and uses public-release mode for the public hostname, matching its existing deployment script. Public release notices and TURN readiness remain mandatory. The real browser test could not start in this environment because Chromium is not installed; this is not a passing device/media test. The live browser again returned an upstream connection failure.
