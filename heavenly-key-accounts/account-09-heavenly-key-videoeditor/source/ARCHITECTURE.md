# Heavenly Key Studio: Architecture (as built)

## Overview
One static web app plus one serverless API, deployed together on Cloudflare Pages.
- **Browser (index.html):** all editing runs on the user's device. Canvas draws video, filters and animated text. MediaRecorder exports WebM. Web Audio handles audio, voice enhancement, and WAV export.
- **API (functions/api/[[path]].js):** one Pages Function. Routes: register, login, logout, me, projects, media, transcribe.
- **D1 (SQLite):** users, sessions, projects, media metadata, audit log (schema.sql).
- **R2:** media files, stored under `userId/mediaId`.
- **Workers AI:** Whisper for auto-captions only.

## Data flow
1. Sign-in sets an HttpOnly cookie. Only a SHA-256 hash of the session token is stored.
2. Projects save text layers and look settings as JSON (max 1 MB). The video file itself is not stored inside a project.
3. Uploads stream straight to R2 (50 MB per file, 500 MB per user). Downloads go through the API so ownership is checked each time.
4. Auto-captions: the browser extracts audio, resamples to 16 kHz mono, sends 50-second WAV pieces. The API calls Whisper and returns timed words.

## Security controls
PBKDF2-SHA256 (100,000 iterations, the Workers maximum), per-user salt, constant-work login, CSRF header on all writes, ownership checks on every query, upload type allowlist (SVG blocked), sandboxed downloads, login throttle (10 failures per 15 minutes), daily transcription cap, security headers (`_headers`), audit log.

## Not built (needs outside resources)
| Area | Why it is blocked |
|---|---|
| Voice cloning, saved AI voices | Needs a GPU host, consent verification, abuse process |
| Text-to-video, image-to-video | Needs a GPU host and a licence review of the model (for example the Wan family) |
| Billing, credits | Needs a payment provider account and webhook keys |
| Email verification, password reset | Needs an email sending service |
| MP4 export, server rendering | Needs a server with FFmpeg; Workers cannot run it |
| Native mobile apps | Later phase; the API is already separate from the UI |

## Recommended next architecture
Add a GPU worker (queue plus job table in D1, results to R2) for voice and video generation. Keep the browser editor as is. Add a rendering worker with FFmpeg for MP4 and long exports.
