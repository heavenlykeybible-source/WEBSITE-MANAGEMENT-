# Bible Champions — cross-account source trace and launch audit
Date: 2026-10-30
Status: ORIGINAL SOURCE FOUND; GAME CONTENT INCOMPLETE; NOT LAUNCH-READY.

## Repository audit
Scanned recursive Git trees of `heavenlykeybible-source/WEBSITE-MANAGEMENT-` (1,966 paths) and `heavenlykeybible-source/onlinebible` (1,197 paths) on `main`, plus targeted directories and selected Bible branches.

**Account 6 / Bible project**
- `apps/heavenly-key-bible/heavenly-key-website/bible/bible-champions-embed.html` — actual embedded game page.
- `apps/heavenly-key-bible/heavenly-key-website/bible/social-bible-champions.js` — game logic and bundled questions (125,386 characters).
- `apps/heavenly-key-bible/heavenly-key-website/bible/social-bible-champions.css` — game styling.
- `apps/heavenly-key-bible/heavenly-key-website/bible/index.html` — Bible sidebar and feature card linking to the game.

**Account 3 / Global Christian Community**
- `heavenly-key-accounts/account-03-global-christian-community/source/public/bible-champions-embed.html` — same embedded page.
- `.../public/social-bible-champions.js` — bundled game logic and questions (124,722 characters).
- `.../public/social-bible-champions.css` and `.../public/social-bible-champions-layout.css`.
- `.../public/global-social-sidebar.js` — GET STARTED, iframe and share controls for Bible Champions.
- `.../public/_headers` — globally denies iframe embedding (`X-Frame-Options: DENY` and `frame-ancestors 'none'`). This conflicts with the sidebar's iframe integration unless overridden in deployment.

**Account 5 / My Walk with God**
- `heavenly-key-accounts/account-05-heavenly-key-app/source/public/bible-quiz.html`
- `.../public/bible-quiz.js` and `.../public/bible-quiz.css` — preexisting copy of game, *distinct from the retired quiz that was formerly in walk-offline.html*.
- Current owner-approved dashboard has an unconnected Bible Champion placeholder. Replace it with a link to the verified game route, not the removed `QUESTIONS` question bank.

## Findings from programmatic question-bank inspection
- 24 topic categories.
- 113 question entries (88 unique question texts across categories).
- Topic sizes: Complete Bible 25; New Testament 14; Old Testament 11; 21 doctrinal subjects with 3 questions each.
- Every topic has fewer than 30 questions. The code's `startTopic` requires at least 30 **distinct valid** questions for a topic and displays 'Course temporarily unavailable' otherwise. Therefore **none of the topics can start in this inspected version**.
- Certificates require completing 30 questions with at least 27 correct, so none can currently be earned.
- Answer selection, sound cues, review feedback, report cards, local best scores, seven-day progress and printable self-generated certificates are implemented in code, but the gating rule prevents exercising full courses.
- No authenticated server-backed progress or public leaderboard is present in this game JavaScript; best scores/history are stored in browser localStorage.
- Verify theological accuracy and KJV references before adding questions; do not invent filler to reach 30.

## Priority fixes before integration
1. Complete editorial-reviewed **30 distinct correct questions per topic** or offer genuinely playable short practice mode while clearly distinguishing it from certificates (requires product approval).
2. Resolve Account 3 iframe security mismatch with an approved same-origin embedding policy or a separate same-tab route; do not remove clickjacking protection globally.
3. Confirm source-version choice, preserve game UI and data keys, and connect the verified game route from My Walk with God and the Bible app.
4. Add automated data validation tests, playthrough tests, mobile, keyboard and screen-reader tests; confirm no unsafe inline scripts or cross-origin sharing of private progress.
5. Verify live routes from actual Cloudflare deployment before any claims that the public game works.

No production merge or deployment is authorized by this audit.
