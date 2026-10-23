# Community registration draft

Changes: a WhatsApp-inspired soft cream/sage chat pattern, centered white card, responsive form, ministry identity and motto. Guests get the new theme; signed-in Account/security and administrator tools keep their existing layout. No WhatsApp logos or phone-OTP promises.

Three text fields for email registration: name, email and password. Adult and Community-rules consent remain required. Existing password rules, backend registration, privacy, moderation, session handling and email-safe social linking remain unchanged. Fixes existing #register links opening the login form. Social-provider loading no longer delays rendering email registration. Google and Facebook buttons have provider marks and explicit setup-pending labels when unavailable. Configured buttons use the existing secure OAuth start/callback/onboarding flow.

Files changed:
- global-community/public/app.js
- global-community/public/account.html
- global-community/public/account.css (new guest-only styling)
- global-community/review/REGISTRATION-REVIEW.md

Validation: npm run buildcheck passed (TypeScript, frontend syntax, preflight and all 28 existing tests). Additional DOM interaction check passed: #register selection, required fields/consent, guest theme/motto, switching to sign in, disabled unconfigured provider, configured OAuth POST and navigation. No browser/device visual QA or real-provider end-to-end authentication performed.

Unfinished activation: Google/Facebook external application credentials, callback URLs and provider availability must be configured/verified through the existing administrator social-sign-in settings and provider consoles. No credentials were supplied or changed; this draft does not claim external OAuth activation. Provider readiness currently indicates credential presence, not a completed external authentication test. Registration does not support phone/SMS OTP. Social completion retains verified-email protections and required consent. No production changes, deployment or merge performed.

Database migration: none required for this registration change. Existing social-auth tables remain required; the broader draft's moderation migration is separate.
