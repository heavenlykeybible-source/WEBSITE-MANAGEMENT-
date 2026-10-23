# Heavenly Key — Absolute No-Advertising Policy
Approved by the owner on 23 October 2026.

## Policy
No commercial advertisements, paid sponsored posts, boosted posts, ad banners, ad interstitials, programmatic ad networks, sponsored search placements, promoted videos or advertising tracking pixels are permitted on any official Heavenly Key app, website, Bible, Kingdom Quest, radio, community or other managed platform.

This policy is owner-controlled and applies to future features. Do not introduce ad SDKs or advertising-related API routes. Acknowledgments or neutral ministry information, voluntary partnership information and event announcements must not be disguised paid advertisements.

## Implementation completed in this review branch
- Community backend: public `GET /api/adverts` always returns no items; routes under `/api/admin/adverts` and `/api/adverts/images` return HTTP 410. This blocks new advertising publishing and delivery.
- Community frontend: removed advert card rendering and fetch function from three public app copies.
- Advert-related database tables and migration files remain preserved so migrations and unrelated operations are not broken, and for future owner-directed safe cleanup. They are not used to deliver advertisements.

## Follow-up and verification needed
- Review all other platform applications, externally embedded content, assets, service workers and marketing SDK dependencies for sponsored material and tracking scripts.
- Some third-party embedded players (such as publicly hosted video) may display advertising under their own service policies, outside the first-party website's control. Replace with a compliant ad-free player/source or avoid embedding if a literal zero-ad experience is required.
- Deploy only after tests and owner approval; nothing in this branch changes the live apps.
- Do not run destructive production data deletion without a verified migration and backup.
