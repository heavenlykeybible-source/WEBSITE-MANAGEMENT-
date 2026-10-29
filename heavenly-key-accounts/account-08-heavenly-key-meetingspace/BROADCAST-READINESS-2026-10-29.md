# Public-use and social-broadcast release update — 29 October 2026

## Implemented and tested

- The browser waits for the streaming relay to accept the broadcast before starting media capture. It displays Broadcasting only after encoding progress. Platform previews remain the authority on public visibility.
- Invalid credentials/destinations stop with a useful error. Startup and first-encoding confirmation have deadlines. Reconnect attempts before successful encoding are bounded, and stale sockets cannot overwrite a replacement connection.
- The Node/FFmpeg relay reports readiness and encoding progress, rejects invalid ports and preserves secret redaction. A replacement connection or changed destination set does not silently retain an obsolete broadcast.
- The deployment package supplies a non-root Node/FFmpeg container, secret-file support, HTTPS reverse proxy, origin restriction, health checks and a bounded unattended backup. It does not provision a host or enable billing.
- Public privacy and terms pages now identify Heavenly Key Evangelistic Movement and use its existing published `contact@heavenlykey.org` contact. Retention descriptions follow the application cleanup/deletion code; no court, liability cap, refund deadline or unverified streaming host was invented. Terms version is dated 29 October 2026. The existing placeholder preflight passes; this is not a legal-compliance certification.
- Application health and relay-token issuance reject weak relay secrets and non-secure or credential-bearing relay URLs.

## Results

| Check | Result |
|---|---|
| Application Node tests | 87 passed, including relay readiness checks; worker suite also reports 142 internal checks |
| Existing browser smoke test | Passed |
| Full browser audit | 21 scenarios passed, including relay acceptance/progress/error handling |
| Real FFmpeg/RTMP test | Passed: synthetic audio/video sent over WebSocket through the production encoding path to two local RTMP listeners; both outputs contain H.264 video and AAC audio; stop closes the streams |
| Public notice placeholder preflight | Passed |
| Deployment YAML structure | Validated |

The RTMP test adapts a fixture hostname to local listeners without weakening production destination checks. It does not authenticate to or publish on a real social account. Browser media uses simulated devices. The relay CI additionally builds its container and verifies startup with a mounted test secret before manual app release is permitted.

## Finish the live connection

Use [the relay deployment guide](source/server/deploy/README.md) on the existing authorized streaming host. Set the existing Account 8 Worker's secure `RELAY_URL` and matching private `RELAY_SECRET`, preserving all other production bindings and secrets. The app Worker alone cannot execute FFmpeg. Verify the actual host and each platform preview before opening the service publicly.

One-click YouTube/Facebook channel connections require the operator's configured and approved developer applications and channel/page authorization. Other eligible platforms use the server URL and stream key supplied by their official live dashboards. This app cannot grant a social account streaming eligibility. Public paid plans additionally depend on the configured payment provider; restrictive-network guest calls need the configured TURN service.

Production deployment, DNS changes, host provisioning and real-platform publishing were not performed by this source update. The last Account 8 maintenance check did not grant this agent access to inspect production configuration.

## Source references for the notice update

- Existing ministry contact and terms: `heavenly-key-accounts/account-01-main-website/source/pages/contact.html` and `pages/terms.html`.
- Actual retention and deletion implementation: `source/site/_worker.js`.
- Nigeria Data Protection Commission: https://ndpc.gov.ng/ and its Nigeria Data Protection Act 2023 publication at https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf .
