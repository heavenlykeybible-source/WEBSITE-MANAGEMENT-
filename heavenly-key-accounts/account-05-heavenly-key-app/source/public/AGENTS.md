# Offline feature preservation — owner requirement

The owner explicitly requires the main ministry website, My Walk with God Calculator, Creation to Eternity Bible-study portal and Heavenly Key App offline features to survive future updates.

- Preserve existing offline entry points, reciprocal links, full reviewed curriculum and device data formats. Do not replace the project or remove features as part of unrelated work.
- Keep notebook storage key `hkem-offline-private-notebook-v1` and study-progress key `hkem-creation-eternity-v1` readable. Any schema/key change needs a tested non-destructive migration; never reset stored user data during release activation.
- Keep downloaded Bible/audio caches separate from release shell cleanup. Preserve previously visited public ministry pages and their assets before deleting old shell caches.
- Never migrate or cache private community/API/account responses. Do not weaken encryption or strict CSP to make offline access work.
- Run the offline-preservation checks during builds. Do not remove/skip these checks or alter their contract to bypass a failure. A future intentional retirement requires explicit owner authorization and a reviewed data-preservation plan.
- Browser/OS storage removal, user-requested deletion and device loss are outside application update guarantees. Do not promise absolute permanence; keep encrypted backup/export available.
