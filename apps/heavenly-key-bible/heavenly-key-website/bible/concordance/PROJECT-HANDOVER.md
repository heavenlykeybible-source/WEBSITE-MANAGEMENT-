# HEAVENLY KEY BIBLE — KJV CONCORDANCE & COMMENTARY

## Canonical project and policy
- Repository: heavenlykeybible-source/WEBSITE-MANAGEMENT-; branch: main.
- Application: apps/heavenly-key-bible/heavenly-key-website/bible/
- This directory: apps/heavenly-key-bible/heavenly-key-website/bible/concordance/
- DO NOT deploy to production without explicit owner approval. GitHub source is the development source of truth; preserve existing work.
- Scripture edition: Authorised King James Version (66 books; 31,102 verses).
- Project mission: a connected Bible reader, searchable word/topic concordance, verse-specific commentary and linked Bible dictionary. A concordance finds passages; commentary explains verses; dictionary defines terms. Keep functions distinct and navigable within one coherent study system.

## Current implementation (2026-10-29)
- index.html: integrated heading, navigation links for Concordance, Commentary, Bible; KJV word/phrase search interface and book/chapter/verse selectors.
- search.js: existing word/phrase search across the KJV books. This is NOT yet a comprehensive curated topical concordance.
- concordance.js: existing verse selector, KJV text loader, detail tabs, sharing/copying and legacy commentary. Newly registered study notes take priority; pending drafts display a visible unreviewed notice and practical application.
- study-notes-matthew-5.js and study-notes-matthew-5b.js: existing Matthew 5 study material; preserve.
- drafts/genesis-1-04-18.json (15), drafts/genesis-1-19-31.json (13), drafts/genesis-2-3.json (50), drafts/genesis-4-5.json (58): 136 NEW original verse-specific Genesis drafts, all reviewStatus=pending. Genesis 1:1–3 and other earlier notes already exist in concordance.js; do not count them as new drafts.
- study-notes-genesis-drafts.js: browser-compatible copy of those 136 drafts, loaded by index.html. It must be regenerated whenever draft JSON changes. It does NOT mean these drafts have passed doctrinal review.
- scripts/concordance-existing-audit.mjs, scripts/concordance-plan.mjs, scripts/concordance-batches.mjs: pre-existing inventory/planning/validation scripts. Inspect and extend rather than replace.
- Total NEW drafts created in this workstream: 136. 31,102 - 136 = 30,966 verses outside this new-draft set; that number is NOT an audited count of missing commentary because older commentary exists. No global complete coverage has been established.
- Latest relevant commits: 5b5546a48fb41d35d316812c787c733f32130fec (Genesis 4–5); 9bd976ec543fb7cc154bc3df18bb6e5c558b6815 (combined page); 3cac1e75758f809d1966d61e99a18e0fde7b0d31 (136-entry browser data); 157d52be20ff68ff016fd4d001a3f071e726916a (load data); 61208a09daee4b39e385416453ff5b09c6c9ad0d (draft display and application).

## Required content standard
For each verse: unique reference, original specific explanation, biblical context, historical context only when supported, verified KJV cross-references, appropriate Christian application, review status. Maintain doctrinal consistency with Heavenly Key Evangelistic Movement statement of faith: salvation, repentance, holiness, sanctification, Holy Spirit and readiness for Christ's return. Use the holiness-focused biblical teaching tradition associated with Deeper Christian Life Ministry as reference; never falsely attribute text to Pastor Kumuyi. No invented history, fabricated references, duplicated generic paragraphs or false claims of human review. Identify disputed interpretations fairly and flag for review. Do not auto-publish unreviewed drafts as approved material.

## NEXT TASKS — do these in order and commit after each successful step
1. Verify browser load order and commentary behavior on actual local build: 136 Genesis drafts appear with prominent pending-review notice; ensure legacy notes remain and cross-reference navigation works. Check that no existing content is accidentally overridden.
2. Add automated tests for Genesis draft count, unique refs, valid reference targets, duplicate explanations, required fields, script synchronization and missing coverage. Execute tests and record real pass/fail results.
3. Establish canonical 31,102-verse manifest and full existing-note inventory to report actual coverage, reviewed vs draft and gaps; reconcile Genesis legacy overlaps.
4. Build proper alphabetical/topical concordance index and direct navigation from its results to the matching verse commentary. Existing KJV full-text search should remain.
5. Connect Bible Dictionary terms with concordance and commentary using safe links and distinct dictionary content.
6. Build scalable, controlled 500–1,000-verse authoring batches with original verse-specific writing, reference verification, deduplication, review workflow, reliable resumability and GitHub checkpoints. Never fill a batch with generic auto-generated filler. Track actual newly written counts.
7. Complete systematic content creation for all verses, followed by human doctrinal review, comprehensive functional/security/accessibility/mobile testing, and explicit owner approval before deployment.

## Reporting requirements for every future AI session
- Start by reading this file and checking the latest GitHub commits; do not work from outdated live website or onlinebible repository.
- After each action: state exactly what changed, commit SHA, number of new verse explanations actually added, what remains, tests performed and whether deployment occurred.
- Never confuse a planning target (500–1,000 verses per batch) with completed content; never claim tests passed without running them.
- Keep this handover updated as work progresses, so another AI can resume without repeating completed work.

## Progress update
- Search module now reads Bible book options from its selector. Commit: 1425527d2fdcc9b380dbcefb86d066d503700b14.
- Added scripts/concordance-draft-check.mjs for structural and bundle consistency checks. Commit: 40c2b0474ed95bbf8504db3ba28a06f5075a1adc. Not yet executed; tests not claimed passed.
- 136 Genesis drafts still pending doctrinal review; zero newly authored verses this session.
- Next: run tests, validate references against canonical KJV, add topical concordance and dictionary links, expand commentary, test browser. No deployment.

## Continuation checkpoint — topical index
- Read-only connector inspection of the four Genesis draft JSON files: 136 records, 136 distinct verse references, no missing required text fields, no identical explanation strings, all reviewStatus=pending; browser bundle contains all 136 reference strings. This is NOT an executed Node audit or full browser test.
- New topics.js: 15 curated starter topics with 75 listed Scripture references and verse deep links. Source commits 6ad0fa0282f8469821448c025b37b4d7f5be198c and 07ef7400fbfeea133c2f01c0f0e7c1d450da2b7c. Integrated into index.html in commit 25d044b21266d0107138334b42fa98dfa6aab919.
- Topical index is explicitly partial; Scripture reference validity and runtime navigation are not yet verified. New verse explanations this continuation: zero. Total Genesis drafts remains 136, all unreviewed.
- NEXT: Execute Node and browser smoke tests, validate references against complete KJV canon, link dictionary terms, and implement further original commentary batches with accurate coverage reporting. Preserve manual deployment approval.

## Latest checkpoint — Bible Dictionary integration
- Added dictionary.js: 15 original starter definitions, each with 3 Scripture-reference links (45 reference entries). Commit 62af20df06ecd56a7d870828fab390570d31da2b.
- Integrated Bible Dictionary navigation, search field and results into index.html. Commit 62224b072641bd6f329ddb4bb505c0ab0917fac5.
- The Bible Dictionary, topical Concordance and Commentary now have distinct sections on the same source page. They are starter implementations; runtime/browser QA and full reference validation remain outstanding.
- Verified by connector inspection only: Genesis JSON has 136 distinct drafts, no empty required fields or identical explanation strings, all pending review. Node audit script has not been run; no claims of test pass.
- New verse explanations this continuation: 0; 136 new Genesis drafts remain. No production deployment.
- NEXT: execute audit scripts and browser tests, verify reference validity against all 31,102 KJV verses, ensure correct deep links, create comprehensive dictionary/topic entries, expand verse-specific commentary in reviewed batches, update this handover after each successful commit.
