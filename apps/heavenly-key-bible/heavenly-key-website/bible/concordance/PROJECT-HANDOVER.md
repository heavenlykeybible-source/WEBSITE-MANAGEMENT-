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

## Owner correction: concordance and commentary ONLY
The existing Bible Dictionary is a separate, completed resource. Do not rebuild or integrate it in this workstream. Earlier plans mentioning dictionary integration are superseded. The duplicate dictionary section was removed from the combined page (commit 267fe05c670448546bab549b5b365f5a444344c2) and the duplicate dictionary.js deleted (commit 25b6c82f7ea34ea054bd6884828eb1ab442de65b). Continue exclusively with KJV Concordance word/topic indexing and verse-specific Commentary, tests, review and coverage. Preserve the independent Bible Dictionary. No deployment without owner approval.

## Latest continuation — Concordance and Commentary only
- Reordered index.html so topical Concordance precedes the Commentary heading (commit 7aef87a34c37e284c7f50728860f787ebbb2a936).
- Added reference-links.js and loaded it in index.html (commits a13e872cf21b939d8291580d85d4670dc0800a50 and 4751d04884a422c54f54767d9307712a9971f9e8). It enhances semicolon-separated verse references in the Commentary References tab into KJV deep links. Requires browser verification.
- NO Bible Dictionary work; the existing separate Dictionary must remain untouched. No new commentary verses authored in this continuation; 136 Genesis drafts remain pending review.
- NEXT: browser smoke test all navigation and links; run Node draft audit; canonical KJV reference verification; produce additional detailed Genesis commentary; expand topical concordance; preserve GitHub commits and this handover. No production deployment without owner approval.

## Latest progress and critical accuracy corrections
- Authored 22 original pending-review commentary drafts for Genesis 6:1–22 in drafts/genesis-6.json (commit 94e30b9228a04dbc28d30f4e21a5ef940c338c2f).
- Canonical GEN.json comparison exposed a pre-existing nonexistent Genesis 2:26 entry; removed it from drafts/genesis-2-3.json (commit 90f5b8567609d8385ec9a45fca83488f78fbe6e9). Also corrected Genesis 2:21–25 explanations to match actual KJV verse numbers (commit 78f1fc2244b49836958d752548b334abacbd9712). This demonstrates that remaining existing drafts require verse-by-verse text comparison, not merely unique-reference checks.
- Rebuilt study-notes-genesis-drafts.js from all five draft JSON files (commit bd0e700c1e8233e41513229b8129a19cbfd1c0ca). Correct total is 157 NEW Genesis drafts, all pending review; earlier reports of 158 included the invalid Genesis 2:26.
- Updated scripts/concordance-draft-check.mjs to include chapter 6 and expect 157 drafts (commit 7104e6dfb5ed959d4b70401f7dd15530e3edf53a). Node test has NOT been executed.
- Connector-side inspection before correction found one invalid Genesis reference among 158. Corrections saved; full subsequent reference and content audit remains pending. Cross-references outside Genesis and browser behavior have not been verified.
- No Dictionary changes, no deployment. NEXT: execute tests, compare every draft to its actual KJV verse, verify all cross-references, fix misaligned Genesis 2 and other earlier drafts, then continue systematic commentary and topical concordance expansion.

## Latest Genesis 7 checkpoint
- Added drafts/genesis-7.json with 24 original verse-specific drafts (Genesis 7:1–24), all pending review. Commit e2028fd7cf0a21cc8bcee9da0c159c5957a4c59b.
- Regenerated study-notes-genesis-drafts.js with 181 draft records through Genesis 7, commit 2d010a0fd35bf24d17e22ba8f0313cdf0c73b02d.
- Updated scripts/concordance-draft-check.mjs to expect 181 records and include Genesis 7, commit e7e369d538e417947782063aa56f788e2b332689.
- Connector-side check: 181 unique draft references, all exist in the saved KJV GEN.json; no empty explanation/context/application fields and no identical explanation strings found. This is not a full executed Node/browser test or human doctrinal review; non-Genesis cross-references still need validation.
- Next: review earlier draft accuracy against actual verse text, run Node and browser tests, validate all cross-references, then Genesis 8 onward. Only Concordance and Commentary in scope; leave existing separate Dictionary untouched. No deployment.

## Latest checkpoint — Genesis chapter 8
- Added drafts/genesis-8.json containing 22 original pending-review commentaries for Genesis 8:1–22. Commit fa76bf0ce513d19cf3eec27fa8fa83ef4f97fce9.
- Rebuilt browser study-notes-genesis-drafts.js to 203 draft entries through Genesis 8, commit 795cfd3e309fe4c613c8acf551545dec4ffa613c.
- Updated scripts/concordance-draft-check.mjs to include Genesis 8 and expect 203 entries, commit 0dd3f5d563dec8f817321f36cb1a600ac8fc1a14.
- Connector-side structural check: 203 unique Genesis references, all exist in KJV GEN.json; no empty required fields or identical explanation strings found. Node audit and browser smoke tests NOT run. Verse-to-explanation alignment and non-Genesis cross-references still require careful verification.
- Continue Genesis 9 onward, with the highest priority on semantic accuracy, canonical references, automated QA, and topical concordance. Only Concordance and Commentary; leave separate Dictionary unchanged. No deployment without explicit owner approval.

## Latest checkpoint — Genesis 9
- Added drafts/genesis-9.json: 29 original verse-specific drafts (Genesis 9:1–29), all pending human doctrinal review. Interpretive cautions recorded for disputed and historically misused passages. Commit 7da68f97b44b9a40d2575c257580c5c42527419a.
- Rebuilt browser study-notes-genesis-drafts.js to 232 entries through Genesis 9, commit 0e9fa0cc4075a8ea4ebb77bda17381f264c13dad.
- Updated scripts/concordance-draft-check.mjs to include chapter 9 and 232 entries, commit 8b6d23ad3ad19f0048dd2dbab4f7b93d010a31a0.
- Connector-side structural check found 232 unique draft refs, all existing in GEN.json, and no identical explanations or missing explanation/context/application fields. Not an executed Node or browser test; non-Genesis cross-reference validity and doctrinal approval remain pending.
- NEXT: Genesis 10 onward; more thorough text alignment and cross-reference validation, topical Concordance expansion, Node/browser tests. Separate Bible Dictionary is out of scope. No deployment without approval.

## Latest checkpoint — Genesis 10
- Added drafts/genesis-10.json: 32 original pending-review commentaries for Genesis 10:1–32. Commit 3c0f7ea6f8cc2be96661fbca559985368fef7dcd.
- Regenerated study-notes-genesis-drafts.js from nine draft JSON files: 264 Genesis drafts, all pending doctrinal review. Commit 5a7490e934c6970e17f9e40452bb7fb5f4a553f2.
- Extended scripts/concordance-draft-check.mjs to Genesis 10 and 264 records. Commit a932868cd1adc04fe85505aabab55d57f3730f67.
- Connector-side check: 264 distinct draft refs, all present in GEN.json, no identical explanation strings or empty required fields. This does not constitute executed Node/browser tests, complete semantic alignment or validation of cross-references in other books.
- NEXT: Genesis 11 onward, verify old Genesis 1–5 verse-specific content accuracy, implement robust canonical cross-reference validation and browser QA. Focus only on Concordance and Commentary; independent Bible Dictionary untouched. No deployment without approval.

## Mass-processing infrastructure checkpoint
- User requests scaling toward all 31,102 KJV verses in 500–1,000 verse batches, without generic explanations.
- Added scripts/concordance-prepare-queue.mjs: reads the actual 66-book mapping and local KJV book JSON files; checks exact 31,102 canonical records and draft references; writes up to 1,000 verse-text work packets plus a manifest of drafted/undrafted verses. It prepares work only, and never manufactures commentary or marks it approved. Commits c4c62be63331814d813cb33661cd4bafa267b312 and mapping correction ceea595b29b241ddab5a46ee9bf450a98329166b.
- The new generator has NOT been executed in a local Node checkout. Verify compatibility with all 66 book JSONs before reporting packet output as completed.
- Verified previous total remains 264 saved new Genesis drafts through chapter 10. A Genesis 11 draft create attempt encountered GitHub 409 and was not saved. Retry from a fresh repository head, preserving concurrent changes.
- NEXT: run queue generator and validators; author real reviewed-quality verse-specific commentary in large work packets; avoid fabricated progress. Only Concordance and Commentary; separate Bible Dictionary untouched. Do not deploy without owner approval.

## Latest checkpoint — Genesis 11 and large-batch processing
- Successfully saved drafts/genesis-11.json: 32 original verse-specific drafts for Genesis 11:1–32, all pending doctrinal review. Commit 5332e18db12d7dbae01bd28048ecbe31cdaa031b. This resolves the earlier failed 409 create attempt without overwriting a file.
- Regenerated study-notes-genesis-drafts.js from ten draft files to register 296 drafts, commit edd7227b0e8655fd9a1f2010a5cd94819057480f.
- Updated scripts/concordance-draft-check.mjs for 296 records and Genesis 11, commit c333ae3fcdda83bca790cfcb8ea14e6b518b6200.
- Connector-side structural inspection: 296 unique Genesis verse references present in saved KJV GEN.json, no identical explanation text and no missing required text fields. This does not validate historical or doctrinal correctness or cross-references in other books. Node/browser tests still unexecuted.
- Mass preparation tool scripts/concordance-prepare-queue.mjs saved earlier, designed to create up to 1,000 verse-text packets and a manifest; it has NOT been executed or verified across all books. This is queue infrastructure, not 31,102 written explanations.
- NEXT: validate canonical mapping and all KJV book files; run actual Node scripts, fix findings, continue original content from Genesis 12; expand topical Concordance. Keep Bible Dictionary separate and untouched. No deployment.
