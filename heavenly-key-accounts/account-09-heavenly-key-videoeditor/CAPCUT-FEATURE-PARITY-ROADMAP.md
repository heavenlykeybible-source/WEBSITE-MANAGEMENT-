# Heavenly Key VideoEditor — CapCut-style capability roadmap

Goal: provide an original, legally distinct, professional video editor with comparable categories of features. Do not copy CapCut branding, proprietary assets, code, or paid templates.

## Current source audit (2026-10-23)
Existing: browser video preview, simple filters, titles, manual SRT captions, WebM capture, audio trim/WAV export, cloud account/projects/media API, AI writing gateway, local voice noise-gate enhancement, consent-gated TTS backend.
Not proven: complete end-to-end browser tests, production deployment, reliable cross-device exports, API keys/credits, media pipeline at scale.
Do not mark anything below complete without tests.

## Priority 0 — dependable core editor
- Multi-track timeline (video/audio/text/overlays), drag-and-drop import, clip split/trim/merge/reorder, undo/redo, snapping, zoom, playhead scrubbing.
- Crop, rotate, resize, aspect ratios, speed/reverse/freeze, keyframes, transitions, opacity, blending, chroma key.
- Export MP4 (H.264/AAC where available), WebM fallback, presets for 720p/1080p/4K, fps and bitrate, progress/cancel; mobile memory constraints.
- Local autosave, project recovery, accessible controls and phone/tablet/desktop testing.

## Priority 1 — creator suite
- Templates, text animations, fonts, captions styles, stickers, graphics, masks, filters, LUTs, effects and transitions.
- Voice-over recorder, audio mixer, EQ, compression, noise reduction, voice enhancement, fades, ducking, music/SFX library with licensed assets.
- Automatic subtitles (transcription, word-level timing, subtitle editor), translation and multilingual subtitle exports.
- Media library, proxy media, uploads and cloud sync, project collaboration and version history.

## Priority 2 — advanced AI
- Consent-based voice profile enrollment, deletion, voice synthesis, and text-to-speech with provider authorization.
- AI image generation (actual rendered images, not only prompts), background removal, object tracking, stabilization, AI cut detection, highlight clips, reframing and image/video enhancement.
- AI scriptwriting, storyboard, titles, descriptions and thumbnail generation.
- Multi-provider, multiple saved authorized API connections; per-connection usage, rate limits, clear error reporting. Never rotate accounts to evade quotas.

## Priority 3 — publishing
- Official OAuth connections and scoped permissions for supported social platforms.
- Drafts, scheduled posts, per-platform media validation, thumbnails/captions, approval before first publication, retry history, revocation and audit logs.
- No password scraping, unofficial social automation, or posting without user authorization.

## Architecture
- Account 9: editor UX, local processing, uploads, project management.
- Account 4: central permissions, secure provider connections, workflow orchestration and audit.
- Server workers/queues for long-running transcodes and AI jobs. Cloudflare Pages Functions alone are insufficient for full professional transcoding.
- R2 for media, D1 for metadata, encrypted server-side secrets for API access.
- Clear disclosure of paid/free API credits; no promise of unlimited free service.

## Release gates
1. Test API and browser UI on mobile and desktop.
2. Verify original and enhanced audio A/B output, subtitles timing, export playback and saved-project restoration.
3. Verify authorization, consent, key protection, file-size and abuse controls.
4. Deploy staging, test real media files, then approve production.
