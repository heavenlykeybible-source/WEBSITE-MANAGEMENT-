# Heavenly Key app platform and audio stage — 12 October 2026

## Scope and source

Only `aoemeta247-cell/heavenly-key-mobile-app` is edited. Community website and My Walk with God Calculator work remain with the other AI. Voice calling is excluded.

The earlier app work is recovered from `aoemeta247-cell/All-Nations-For-Christ-Outreach`, PR #32, commit `9a16d9dfaff160562da1a966033fdff6e333222b`. The original reader, reviewed hymn excerpts, daily reading plan and audio players are retained and adapted for Account 5. No Community APIs, user databases or website bootstrap are copied.

## Working draft features

- All 66 KJV books, 1,189 chapters and 31,102 verses. Source Git blob fingerprints are recorded in `kjv-source-snapshot.json`; tests verify every book is unchanged apart from a possible trailing newline.
- Existing reader controls: book/chapter navigation, adjustable reading font, saved chapters, resume reading, in-book search and explicit book downloads. Only requested books load; the whole Bible is not automatically downloaded.
- The original 365-day selected-chapter programme and morning/evening devotional readings. This is not described as reading every Bible verse in one year.
- Reviewed historic hymn text excerpts, with original source/provenance notices retained.
- Audio Bible and hymn players, approved-recording gates, playback speed, optional instrumental mix, playlist options, explicit offline saving and feature-detected lock-screen controls. No autoplay or audio prefetch. Recorded audio stays disabled when no approved track exists.
- Fixed reading/listening links for numbered books such as 1 Samuel. Invalid chapter query values resolve safely; loaded and saved Bible data is checked before use.
- Android/desktop PNG manifest icons and a separate Apple touch icon; user-triggered platform installation instructions.
- Wider tablet/laptop layout, mobile safe-area support, larger touch controls, keyboard focus handling, reduced-motion and forced-colour support.
- Connection feedback and offline download cleanup. App updates wait for the user to choose reload rather than interrupting an active session.
- Offline shell includes all required study modules, not full Bible books or media. Public reading query links work offline after shell installation. Member endpoints and token-bearing URLs remain excluded from caching.

## Audio blocker

The inherited Audio Bible manifest has `publicationApproved:false` and `tracks:{}`. There are **zero published narrated chapters**. Hymn and background-music manifests also lack approved recording masters. The source audit explicitly states that the planned Nigerian ministry-narrator audiobook was not generated or aurally reviewed.

This stage makes the player available inside the app; it does not invent narration, upload a recording, declare music approved or substitute another person's voice. To complete audible playback, the approved recording masters/authorised voice source and production pipeline need to supply tracks to the catalogue and audio host. Actual listening fidelity, CDN/CORS, mobile playback and optional offline replay then need testing. There is no voice-generation tool available in this workspace.

## Comparison references

Review used the official YouVersion Bible App and Bible App Lite descriptions as benchmarks for reading, listening, offline access and lightweight use: https://www.youversion.com/bible-app and https://www.youversion.com/bible-app-lite.

Installation and progressive enhancement were checked against https://web.dev/learn/pwa/installation and https://web.dev/learn/pwa/app-design. User-started playback is consistent with https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay. These are feature/architecture comparisons, not evidence that this draft equals another app's production quality.

## Validation and limits

`npm run build` checks every JavaScript file, relative module dependency and local HTML link. `npm test` passes 43 local tests: original member/security checks plus complete corpus fingerprints/counts, reading-plan references, navigation boundaries, audio availability, zero initial playback, chapter switching, media-session cleanup, icon sizes and offline-shell dependency/privacy checks. Audio UI tests use simulated recordings and DOM elements.

Chromium is unavailable locally. No physical Android, iPhone, iPad, laptop, assistive-technology or locked-screen playback test is claimed. Native store packages, Face ID/fingerprint, authenticated live integration and remote build failures remain unresolved. The KJV source licence and regional distribution notice are retained from the original work.

## Device acceptance matrix before release

| Device/browser | Required checks | Current evidence |
|---|---|---|
| Android Chrome/Samsung Internet | Install, touch navigation, reading size, offline book, recorded playback | Code and simulated tests; physical test pending |
| iPhone Safari/installed app | Home-screen icon, safe areas, selectors, audio gesture and volume behaviour | Code and simulated tests; physical test pending |
| iPad Safari | Portrait/landscape layout, keyboard/touch, installation, reading | Responsive CSS; physical test pending |
| Windows/macOS browsers | Keyboard focus, resizing, install where supported, audio controls | Code checks; browser test pending |
| Slow/offline connection | Saved-book recovery, uncached-book message, no private API caching | Automated privacy/dependency checks; network test pending |

Keep the app PR draft and unmerged until the website is complete, integration is analysed and release testing is passed. No manual deployment is initiated in this stage.
