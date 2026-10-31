# Heavenly Key Studio: Final Audit and Launch Readiness

**Verdict: NOT ready for public launch.** It is a tested working prototype of the editor plus a first account backend. It is suitable for a private staging deployment on Cloudflare. The items under "Launch blockers" must be done first.

## 1. What was tested (automated, Chromium and Node, local stand-ins for D1, R2, Whisper)
| Area | Checks | Result |
|---|---|---|
| Backend API (auth, projects, media, ownership, limits, account deletion, transcription) | 46 | all pass |
| Video editor (animated text, captions, looks, aspect ratios, export) and audio studio | 34 | all pass |
| Voice studio (recording, enhancement, voice changer, text to speech) | 9 | 8 pass, 1 fails (see 3) |
| Accounts and media library in the browser | 11 | all pass |
| Auto-captions | 3 | all pass (Whisper was a stand-in) |
| Clip sequence with crossfades | 10 | all pass |
| Editing assistant | 16 | all pass |
| Green screen, logo overlay, logo assets | 13 | all pass |
| Motion and templates | 12 | all pass |
| Accessibility and mobile (labels, overflow, tap size) | manual script | fixed this round |
Total: 154 checks, 153 pass, 1 known failure. Not tested: real Cloudflare D1/R2/Workers AI, Safari, Firefox, real microphones, real green-screen footage, large files, real devices.

## 2. Fixed during audit
| Finding | Fix |
|---|---|
| SVG upload could run scripts (stored XSS) | Upload type allowlist; downloads sandboxed |
| Unlimited password guessing | 10 failures per email per 15 minutes |
| No security headers | `_headers` added |
| Unlimited AI use | 120 transcription pieces per user per day |
| No account deletion | Password-confirmed deletion incl. R2 files |
| 26 form controls had no accessible name | Names added for all |
| Nav buttons under 44 px tall on phones | Fixed |
| Home page listed finished features as Planned | Table now matches reality |

## 3. Known defects and weak spots
| Severity | Item |
|---|---|
| Medium | Voice enhancement is basic filtering. A noise-gate test gave about 10 dB speech-to-noise improvement on a synthetic tone; the check that wanted a 6 dB absolute noise drop fails (5 dB). It is not AI-grade denoising. |
| Medium | Export is real-time, WebM only, produced by the browser. Long videos take as long as they play. No MP4. |
| Medium | Auto-captions: accuracy unmeasured (especially Nigerian-accented English); only works on a single video, not a sequence. |
| Medium | Green screen tested only on a flat synthetic clip. Only plain colour backgrounds. Not available in sequence mode. |
| Medium | Safari lacks canvas filters, so looks and brightness may not display or export there. |
| Low | Projects save text layers and look settings only, not logos, sequences, or the video itself. |
| Low | Page uses Google Fonts (sends visitor IPs to Google). Self-host fonts for privacy. |
| Low | No Content-Security-Policy on pages (inline scripts). |
| Low | Text templates cannot be dragged on the video. |

## 4. Launch blockers (cannot be done by code alone)
1. **Deploy to staging and re-run every test against real Cloudflare.** Not yet done. Needs the owner's approval and login (see DEPLOY.md).
2. **Email verification and password reset.** Needs an email service.
3. **Payments and subscriptions.** Needs a payment provider account. Currently none: no billing, credits, or paid limits.
4. **Terms of service, privacy policy, and data-protection review.** Needs the owner and legal advice, especially for user uploads and any voice features.
5. **Per-IP rate limiting** (Cloudflare rules) and abuse reporting.
6. **Storage quota race** (two uploads at once can pass 500 MB): add an atomic usage counter.
7. **Cross-browser and real-device testing** (Safari, Firefox, Android, iPhone).

## 5. Features in the directive that do not exist
Layered multi-track timeline, keyframe editing beyond the slow zoom and pan, masks, stabilization, LUTs, MP4/MOV export, 4K guarantees, picture-in-picture video, AI that understands ordinary sentences, silence removal and highlight detection, speech and music separation, AI voice cloning with consent records, saved AI voices, text-to-video and image-to-video, script-to-video, templates library beyond five text layouts, admin tools, native apps. Voice cloning and video generation need a GPU host and a licence review of the models; they must not ship without the consent and abuse controls described in the directive.

## 6. Recommended order
Deploy to staging, fix what real Cloudflare breaks, add email and payments, add legal pages, then decide on the GPU host for voice and video generation.


---

## Current security and release review — 31 October 2026

This section supersedes any older status above where it conflicts with the current source. The repository has since received additional changes; the historical test counts above are not evidence that the latest commit has passed the full suite.

### Verified source changes in the current review
- Inline editor JavaScript and CSS were moved to same-origin external assets.
- Enforced CSP now blocks inline scripts, script event attributes, inline styles, and style attributes; `base-uri 'none'` is set.
- Offline core caching includes the external editor assets.
- Backend test syntax was repaired after a duplicate top-level `const` declaration was found.
- Password storage was strengthened from 100,000 to 600,000 PBKDF2-HMAC-SHA-256 iterations for new registrations and Owner/Admin provisioning.
- Sessions now enforce a 30-minute inactivity timeout and 30-day absolute lifetime, with activity timestamps refreshed at five-minute intervals and regression coverage. A versioned database migration preserves legacy hash parameters and upgrades existing accounts after successful login.
- External AI gateway attempts are reserved atomically at a 30-attempt daily limit; the test fixture and preflight assertion were aligned.
- Preflight now syntax-checks backend and test modules before the test suite.

### Security controls observed in source
- Authenticated, per-user media ownership checks and private R2 object keys.
- Media type/extension allowlists, signature checks, upload size and storage quotas, and bounded request streaming.
- Private media response headers, sandbox CSP, and `nosniff`.
- Atomic per-user attempt limits for several sensitive operations.
- R2 deletion retries and ownership-conditioned database deletion.

### Unresolved release blockers
1. **Malware scanning is not implemented.** Signature checks are not antivirus scanning. Do not treat unscanned uploads as malware-cleared. Integrate and verify a real scanner or quarantine workflow before public release.
2. Run `npm run check` from this exact source directory on Node 22+; the latest source changes have not been run through the complete suite in this review.
3. Perform staging tests against the real Cloudflare D1, R2 and Workers AI bindings, including concurrent uploads and cleanup.
4. Complete real Chrome, Firefox, Safari/iOS and Android testing, including long exports, microphones, camera permissions and offline behavior.
5. Complete independent security testing, monitoring/alerting, privacy/terms review, account recovery, and production sign-off.
6. Apply and verify migrations `0005_password_hash_iterations.sql` and `0006_session_inactivity_timeout.sql` on an existing D1 database after backup; confirm fresh databases use the updated `schema.sql`.
7. Confirm the active production hostname, Worker routing, secrets, D1 migrations, bucket privacy and backup/restore procedure with the authorized Cloudflare owner.

### Product capability limits
The editor must not be marketed as a full desktop nonlinear editor until multi-track composition, advanced keyframes, robust MP4 export, stabilization, LUTs and the other missing features listed above are implemented and tested. Current browser export and AI features have documented limitations.

**Current disposition: NOT production launch-certified.** Source-level changes are committed; the full test suite, live infrastructure, malware scanning and cross-device verification remain outstanding.
