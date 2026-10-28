# Account 8 — Heavenly Key MeetingSpace

This is the Account 8 entry alongside the other Heavenly Key accounts.

| Item | Location |
|---|---|
| Complete current application source | [source](source/) |
| App and deployment guide | [README](source/README.md) |
| Public website | https://meeting.heavenlykey.org |
| Worker | `heavenly-key-meetingspace` |
| Database | `heavenly-key-meetingspace-db` |
| Deployment workflow | [Zoom Studio](../../.github/workflows/zoom-studio.yml) |
| Automated tests | [Account 8 checks](../../.github/workflows/account8-meetingspace-tests.yml) |

The complete application now lives in `source/` in this Account 8 folder, beside the other account applications. The former root `zoom-studio/` directory is only a redirect guide. Workflows and relative imports use this new location.

Account 7 is Radio. Connector connection numbers are not project account numbers. Verify Cloudflare identity before deployment. Preserve all existing databases, bindings and secrets.

Run `npm test --prefix heavenly-key-accounts/account-08-heavenly-key-meetingspace/source` and `node tests/run.mjs` from the repository root. Passing local tests does not establish that live media, provider integrations or production deployment work.

## Owner entry

The Control Room menu is **MeetingSpace · Account 8**. It selects the saved Account 8 connection and dedicated `heavenly-key-meetingspace` Worker. If multiple connections share the Cloudflare tenant, it refuses ambiguous selection. The earlier Worker remains available only through its explicit Worker action. Existing app secrets are never replaced to make single sign-on work.
