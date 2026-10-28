# Account 8 — Heavenly Key MeetingSpace

This is the Account 8 entry alongside the other Heavenly Key accounts.

| Item | Location |
|---|---|
| Complete current application source | [zoom-studio](../../zoom-studio/) |
| App and deployment guide | [README](../../zoom-studio/README.md) |
| Public website | https://meeting.heavenlykey.org |
| Worker | `heavenly-key-meetingspace` |
| Database | `heavenly-key-meetingspace-db` |
| Deployment workflow | [Zoom Studio](../../.github/workflows/zoom-studio.yml) |
| Automated tests | [Account 8 checks](../../.github/workflows/account8-meetingspace-tests.yml) |

`zoom-studio/` is the existing build directory for MeetingSpace, not another account. Maintain that single source; do not copy it into a second independently editable app. Existing workflows and relative imports use that location.

Account 7 is Radio. Connector connection numbers are not project account numbers. Verify Cloudflare identity before deployment. Preserve all existing databases, bindings and secrets.

Run `npm test --prefix zoom-studio` and `node tests/run.mjs` from the repository root. Passing local tests does not establish that live media, provider integrations or production deployment work.
