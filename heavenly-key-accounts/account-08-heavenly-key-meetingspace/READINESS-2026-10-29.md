# MeetingSpace audit — 29 October 2026

Status: the tested source passes the checks below. This is not a production deployment or a claim that every external integration is configured.

## Validation

| Check | Result |
|---|---|
| Application Node tests | 86 passed; worker test also reports 142 internal checks passed |
| Existing browser account/media smoke test | Passed |
| Expanded bundled-app browser audit | 20 scenarios passed, no JavaScript page errors |
| Responsive layouts | All 13 tabs checked at 1440, 768, 390 and 320 pixels; guest controls checked at phone width |
| Icons and public assets | Manifest PNG icons, images and styles load; visible button names checked |
| Control Room build and required suite | Passed |
| Workflow syntax and dependency structure | Validated; deployment requires backend and browser jobs |

The browser audit serves the actual application bundle against disposable SQLite data and the actual MeetingRooms admission/signalling class with a local WebSocket transport adapter. It verifies guest admission, connected peers and video frames in both directions, audience entry without camera/microphone requests, hand raising, promotion, demotion, room locking, moderation, reaction icons, screen-track replacement, recording export, images, snapshots, groups, programs and account flows. Cameras and microphones are synthetic. Screen sharing uses a test capture track, not a physical operating-system picker. Cloudflare upgrades/hibernation are covered separately by unit tests, not by this adapter.

## Corrections

- Clearing title/ticker fields now clears the displayed text.
- Failed group sends retain the draft and allow retry; repeated send clicks are guarded.
- Transient account-service failures preserve the saved sign-in and leave the account screen reachable with feedback.
- Private/public registration controls follow the server's explicit configuration; default registration remains closed.
- Malformed reset links and disabled browser storage no longer break account controls.
- Failed program deletion, group role changes and group meeting-end requests now report errors instead of silently proceeding.
- Failed sign-out-all no longer claims other devices were signed out.
- Logout closes the host room, stops guest media, clears private group/program state and drafts, and discards responses belonging to the previous sign-in.
- Camera, microphone and room actions explicitly resume audio processing.
- Recording handles repeated stop clicks and unsupported browsers; exported recording URLs are released after download.
- A host's unmute invitation no longer sends another mute command to the guest. The guest decides when to unmute.
- Fixed the old smoke-test server's CSS content type and added executable-path support.

## Release checks and remaining live work

Browser tests are reproducible with `npm ci`, `npx playwright install chromium`, and `npm run test:browser` in `source/`. The release workflow calls the browser audit and requires it before deployment. It does not deploy automatically.

Production was not modified. The connector's latest Account 8 maintenance check returned no active permission for this agent. Real-device and cross-network calls, TURN traversal, the operating-system screen picker, external RTMP broadcasting, YouTube/Facebook authorization, email, payments and production AI service calls were not verified live. Their missing-configuration failure paths were checked where applicable. The existing public-release preflight also still requires finalized privacy/terms content. These dependencies have not been invented or bypassed.

The separate Radio feature remains intentionally on hold, as labelled in the interface.
