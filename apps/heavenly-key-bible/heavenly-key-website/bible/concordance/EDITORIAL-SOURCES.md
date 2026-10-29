# Editorial sources and publication controls

## Primary ministry foundation

Read on 2026-10-29 from the repository snapshot at `c6acd28429eb5d2ba77e03c71432ab19acdb8efb`:

`heavenly-key-accounts/account-01-main-website/source/pages/what-we-believe.html`

The ministry page is titled Statement of Faith. It affirms Scripture as final authority; the Father, Son and Holy Ghost; Christ's virgin birth, sinless life, death and resurrection; repentance and salvation by grace through faith producing obedience; restitution and holy living; the Holy Spirit's baptism, work and power for witness; prayer for healing; evangelism; and readiness for Christ's return. This is the actual repository source used, not a newly invented creed. Its presence does not constitute human approval of these commentary drafts. Do not import extra positions into the ministry statement from a secondary ministry.

## Secondary doctrinal reference

Deeper Christian Life Ministry, official [What We Believe](https://dclm.org/about/what-we-believe/) page, consulted 2026-10-29. The official source was retrieved to verify the requested holiness-focused tradition, including repentance, salvation and sanctification. No sermon or study Bible commentary was copied; no draft is attributed to Pastor W. F. Kumuyi, and no DCLM endorsement or review is claimed. Where the ministry's verified statement does not resolve an interpretive issue, defer to its authorized human reviewer.

## Verse-level evidence

The primary source for the new Genesis 46–50 and Exodus 1–4 notes is the repository KJV JSON. Historical/cultural fields are limited to details explicitly supported by the biblical narrative and named cross-references. No external dates, dynasties, archaeological identifications or original-language etymologies are asserted. Each new record preserves the exact local verse text and its SHA-256 to detect later source drift; a matching hash is not proof of semantic interpretation or of independent transcription accuracy.

All new entries start `pending`. Only an authorized human may approve doctrinal publication. Flagged numerical, textual and ethical questions additionally carry `publicationHold: true`; the application withholds their explanations in every tab, including copy/share output. `needs_revision` is also withheld. Unreviewed legacy notes now receive a visible pending warning. No database, separate Dictionary, production Worker or live site is changed by these scripts.

## Repeatable authoring workflow

1. Run `node scripts/concordance-prepare-queue.mjs --size 500 --out /tmp/concordance-work`. It reads all 66 books and produces missing-only packets, the exact canonical manifest and progress. Genesis 1:1–3 are explicitly deferred for legacy audit, never counted as drafted.
2. Author original verse-specific records against those actual texts. New fields: `ref`, `kjvText`, `kjvTextHash`, `explanation`, `context`, `historicalContext`, `crossReferences`, `application`, `reviewStatus`, `reviewFlags`; add `publicationHold: true` for any flagged issue. Contextual cross-references are not necessarily doctrinal proof texts.
3. Before copying intake into `drafts`, run `node scripts/concordance-batches.mjs validate /tmp/concordance-work/canon.json /path/to/intake.json`. It refuses overlapping saved references and exact duplicate explanations, altered text, invalid targets and automatic approvals. Smaller checkpoints are explicitly labelled partial, never reported as 500 completed.
4. Preserve chapter JSON as the source, then run `node scripts/concordance-build-notes.mjs` to regenerate the existing browser bundle; no second application is created.
5. Run draft audit, validation tests, DOM integration tests, bundle parity check and, where Chromium is available, browser tests. Run `node tests/run.mjs` before publishing changes. That suite regenerates `control-room-worker.js` and a temporary `tests/worker-test.mjs`; do not include unrelated generated artifacts in a concordance commit.
6. Commit to a development branch, update this handover and request human review before any approved production release. No unattended provider-based commentary generator has been configured: a work packet is not authored commentary. The `--allow-1000` option is a deliberate operator override, not evidence of demonstrated editorial reliability.

## Limits of automation

Automation checks structure, exact duplicates, target existence, exact verse-text binding and registration parity. It cannot certify historical truth, meaningful semantic alignment, absence of copying from all external sources or doctrinal acceptability. The new 35-word explanation floor is a rejection heuristic, not a quality certificate. Near-duplicate and semantic review remain editorial obligations. Existing 1,384 records are preserved with schema warnings because they lack the new explicit historical-context/text-binding fields; they have not been retroactively reviewed.
