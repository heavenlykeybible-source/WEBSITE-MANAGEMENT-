# Offline learning

This change extends the existing app shell and book/audio download tools rather than replacing the app.

After the public learning assets finish downloading on an HTTPS origin, visitors can reopen:

- `/creation-to-eternity.html`: 35 illustrated lessons, KJV excerpts, responses and device-local study progress.
- `/walk-offline.html`: the existing reviewed daily curriculum and Bible quizzes, with a separate device notebook for personal goals and prayer drafts.
- Existing downloaded Bible books and approved audio through their original readers.

Full passages linked to Bible Gateway need internet; the displayed KJV excerpts are bundled. The app's Bible reader can read previously downloaded books offline. Existing audio licensing and download gates are unchanged.

The offline notebook is **separate from Account 3**. It does not mirror private server records or queue writes. Saving is explicit, with AES-256-GCM encryption and a separate passphrase-derived key (PBKDF2/SHA-256, 210,000 iterations). Passphrases are cleared after operations and never stored. The notebook can be locked, backed up as ciphertext, restored and removed. A forgotten passphrase cannot be recovered. Clearing browser data can remove saved lessons and notebook files; the encrypted backup is portable.

Only allowlisted public shell/learning assets are cached. Signed-in API calls, private community activity and live broadcasts continue to require a connection. Cached private HTTP responses and arbitrary URLs are excluded.

The status banner reports offline readiness only after all core public learning files are present. These files use external scripts and styles compatible with the app's existing strict CSP. The update message activates the reviewed worker when opening a public offline learning page.

Validation: app syntax/dependency checks; existing app suite; offline worker fallbacks; cipher round-trip/wrong-key/tampering; full 66-book survey preservation; CSP checks. Device/browser installation and deployed airplane-mode QA must be run after publication. This is source work, not evidence of a production deployment.

## Owner-required update protection

Build commands run offline-preservation tests. Contributor instructions prohibit silently removing offline features, reciprocal entry points, encryption or existing data keys. The ministry site's saved public pages/assets have stable cache names; old release caches migrate only reviewed public entries before cleanup. Failed migration retains old copies. App cleanup is limited to app shells and leaves book/audio caches alone.

These protections cover normal application updates. A user clearing browser data, browser eviction under storage pressure, device loss or an intentional authorized removal can still remove local data. Keep encrypted backups for important notes.
