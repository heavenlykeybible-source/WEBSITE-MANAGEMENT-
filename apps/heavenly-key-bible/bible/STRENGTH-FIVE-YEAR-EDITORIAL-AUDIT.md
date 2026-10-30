# STRENGTH FOR TODAY — five-year doctrinal and editorial examination

**Status: NOT APPROVED.** This document is a mandatory editorial standard and an initial source-based audit, not an assertion that every daily entry has been manually reviewed.

## Authority and comparison
1. Primary binding authority: Heavenly Key Evangelistic Movement, [What We Believe](https://heavenlykey.org/what-we-believe/). The Bible is final authority.
2. Comparison for holiness, repentance, sanctification, and doctrinal clarity: [Deeper Christian Life Ministry — What We Believe](https://dclm.org/about/what-we-believe/) and its Daily Manna devotional *approach*, never copied text.
3. Comparison for prayer, holiness, and dependence on God: [Mountain of Fire and Miracles Ministries](https://mountainoffire.org/). Its public site describes prayer and deliverance ministries; do not attribute a specific Daily Manna title to MFM without verification.

## Mandatory 22-article review of Heavenly Key's Statement of Faith
Every manuscript must remain consistent with these articles, and the editorial calendar must cover them without forcing every article into every day:
1. Holy Bible: inspired and final authority.
2. Godhead: Father, Son, Holy Ghost.
3. Virgin birth of Jesus, atoning death and bodily resurrection.
4. Human sinfulness and need of salvation.
5. Genuine repentance.
6. Restitution.
7. Justification by faith in Christ's blood, not personal merit.
8. Water baptism.
9. Lord's Supper.
10. **Entire sanctification:** a definite work of grace after the new birth, received by faith, not achieved through a process of personal works. Distinguish this doctrine from ongoing obedient conduct.
11. **Holy Ghost baptism:** the statement teaches purity before power and the initial evidence of tongues as given by the Spirit; never teach mechanical coaching of tongues.
12. Redemption, healing and health: do not assert an individual cure or discourage medical treatment.
13. Personal evangelism and compassionate soul-winning.
14. Biblical marriage: sensitive pastoral application required, never simplistic or shaming advice to people in unsafe situations.
15. Rapture: pre-tribulation teaching and readiness without predicting a date.
16. Resurrection of the dead.
17. Great Tribulation.
18. Second Coming of Christ.
19. Millennial reign.
20. Great White Throne judgment.
21. New Heaven and New Earth.
22. Hell and judgment: seriousness alongside the gospel call to repentance and grace.

## Audit findings and corrections required
- All five years were assembled as daily dated drafts with 12 repeated theme headings. **Twelve headings are not equivalent to all 22 articles of the faith.**
- The existing validation source expects **one fixed verse/reference per theme across every day**, creating 12 repeated verse anchors for the entire library. This is a serious editorial weakness: varied daily KJV passages and context-specific explanation are needed, but changing these requires a planned schema and validation update.
- Automated no-exact-duplicate checks cannot ensure originality or spiritual substance. Reordered generic sentences, repeated prayers with swapped situations, and mismatches between devotional title and teaching require individual rewriting.
- Doctrinal-risk items requiring human review: sanctification as grace versus works, salvation by faith, Holy Ghost baptism, restitution, healing claims, end-time date setting, and warnings framed without the gospel.
- KJV quotations currently appear copied from existing project source records. They have not all been independently checked verse by verse against a reliable KJV edition.
- Direct public access to unpublished or future-dated JSON is a separate unresolved access-control risk. UI hiding alone is not sufficient.
- Editorial hold MUST remain in effect. Do not approve any batch because a script passes.

## Per-day approval gate
For **each of 1,826 dates**, the responsible reviewer must:
1. Read all 12 topic entries aloud for coherence, grammar, distinctiveness and spiritual substance.
2. Verify KJV references and quoted verses individually, including context.
3. Check the relevant Heavenly Key faith articles, handling comparison references without copying.
4. Rewrite repetitive, shallow, awkward or mechanically varied reflection/prayer text.
5. Ensure the title, lead Scripture, devotional reflection and prayer align.
6. Check for harmful unsupported promises or unnecessarily shaming language.
7. Verify no future devotional can be downloaded or accessed through direct URL before midnight Africa/Lagos on its scheduled day.
8. Record reviewer identity, date, notes, revision identifier, and explicit approval. A software-generated status is never an editorial sign-off.

## Current release decision
**Hold.** Existing batches stay `draft-not-published`; `strength-publication-status.json` stays `editorial-hold` with an empty approved allowlist. No direct GitHub or Cloudflare production deployment is authorized by this audit.

## Audit scripts
- `tests/validate-strength-year1.mjs` — structural, date and text checks across five years (historical filename).
- `tests/audit-strength-five-years.mjs` — corpus-wide risk and repetition flags, counts and manual review criteria.
- `tests/strength-publication-gate.mjs` — prevents launch while unapproved or repetitive content remains.
- `.github/workflows/heavenly-key-bible-manual-launch-audit.yml` — manual audit workflow, not auto-deployment.
