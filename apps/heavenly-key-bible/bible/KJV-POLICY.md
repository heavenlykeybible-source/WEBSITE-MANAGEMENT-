# King James (Authorized) Version only

The owner has explicitly required KJV only. Do not add alternative Bible translations or a translation selector.

- Reading and search use only the bundled eBible.org eng-kjv2006 KJV text.
- The dedicated Bible chapter API serves the same validated KJV assets. It does not return upstream chapter text as Scripture.
- Device narration and scripture images use the selected verse from that KJV bundle.
- Study backups explicitly identify KJV. A backup marked with any other translation is rejected. Older Heavenly Key backups without a translation field are reconstructed from KJV references; imported verse text is never trusted or displayed as Scripture.
- Bible recordings require explicit KJV edition metadata. The existing media service's sourceLabel must be exactly KJV, King James (Authorized) Version or King James Version (case-insensitive). A conflicting translation field is rejected. Unknown, NKJV, mixed-version and other translation labels are not offered for Bible playback.
- Ministry administrators must review the actual recording before publishing it with a KJV label. Metadata filtering does not establish the contents of an unreviewed recording.

Hymn lyrics and gospel songs remain separate media collections, not Bible translations.

Tests cover complete KJV assets, KJV chapter responses, rejection of other translation labels and backup reconstruction from canonical scripture.
