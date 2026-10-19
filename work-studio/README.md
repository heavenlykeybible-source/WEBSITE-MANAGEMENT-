# Work Studio — Account 2 source workspace

Imported from heavenlykeybible-source/onlinebible at immutable source ref 146ecd64321976344b08596beaf605e17e525ee0.

This branch is a source-preservation workspace, not a deployed studio or an approval to migrate resources. The existing Website Management Worker and Online Bible production Workers are unchanged.

## Layout
- source/media-engine/: complete Account 2 backend, package lock, preflight, staging/production configuration and migrations (21 files).
- source/heavenly-key-website/: shared studio interface, public radio/video interface and supporting website files.
- source/src/: shared authenticated APIs and media-engine proxy used by the studio frontend.
- source/migrations/, source/test/, source/scripts/: original shared schema, tests and tooling.
- source/docs/: source architecture, studio and Account 2 notes.
- source/.github/workflows/: reference workflow nested inside the snapshot; it is not an active GitHub Actions workflow in this repository.

## Copy verification
422 of 426 selected source files have exact matching Git blob hashes. All 21 media-engine files and all 388 selected text files are present. See IMPORT-MANIFEST.json for every source hash and status.

All four previously unavailable images now have owner-authorized generated replacements. The 422 exact source copies are preserved. The portrait-named JPEG contains clearly labeled ministry artwork, not an invented photograph. See ASSET-PROVENANCE.md and replacement_sha fields in IMPORT-MANIFEST.json.

Backend validation passed: TypeScript check, preflight (5 migrations and required bindings), and Wrangler deployment dry run. These are build checks, not live integration or broadcast tests.

## Next work
Consolidate the studio frontend and backend into an independent build; resolve old URLs/repository references; preserve existing heavenlykey-media Worker identity and its D1/KV/R2 bindings; prepare staged tests and owner-reviewed deployment. Design verified single sign-on from Account 4 and studio.heavenlykey.org separately. Do not remove authentication.

No production secrets, database contents, media-library objects or live sessions are copied by this source import. Existing source configuration contains original resource identifiers for reference; do not deploy them without checking account ownership. No build, broadcast or domain readiness is claimed by copying source.
