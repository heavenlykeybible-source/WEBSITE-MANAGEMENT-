# Personal review and reactivation message

## Files changed

- `global-community/src/stewardship.ts`
- `global-community/src/content-screening.ts`
- `global-community/src/safety.ts`
- `global-community/public/app.js`
- `global-community/public/active-content.css`
- `global-community/test/stewardship.checks.mjs`
- `global-community/test/content-screening.checks.mjs`
- `global-community/review/REACTIVATION-MESSAGE-REVIEW.md`
- `global-community/public/profile.html`
- `global-community/public/spaces.html`
- `global-community/public/missions.html`
- `global-community/public/safety.html`
- `global-community/public/index.html`
- `global-community/public/messages.html`
- `global-community/public/account.html`
- `global-community/public/grow.html`
- `global-community/public/prayer.html`
- `global-community/public/groups.html`
- `global-community/public/salvation.html`
- `global-community/public/fellowship.html`

HTML changes only update the existing shared script/style cache versions.

## What changed

After an administrator personally lifts an account restriction, the member receives an in-platform notification and a readable message card in Safety & privacy. The full restoration message is:

> A message from Global Christian Community
>
> We are pleased to inform you that, following our personal review, your account has been reactivated. Welcome back! Please continue to follow our Community guidelines as we grow together in Christ.
>
> Together we take Christ to the nations of the world.

A shared server helper selects wording using the actual post-review user status, remaining manual restrictions and any active strike-based restriction. If another restriction remains, the message says this review was resolved favourably but a separate restriction still applies. It does not falsely claim full reactivation. A content approval for an account that was never restricted receives a submission/appeal approval message instead.

The same helper is used for manual account unlocking, held-content approval, contextual-screening approval and successful screening appeals. Event-specific notification links prevent duplicate messages when a completed action is retried. Unlock notifications and appeal-restoration notices are written in the corresponding database transaction. Account button wording is now Reactivate account; the completion message confirms that the member received a review update. Safety cards preserve paragraph spacing and use restrained navy/wine presentation. Notification links identify the matching card.

## Existing functionality preserved

Administrator-only account controls, role protections, account/strike decisions, appeal independence, expiry, manual locks, moderation and all other Community functionality remain unchanged. No public/private content is rewritten and no email or external message is sent.

## Tests performed

Full Community buildcheck passed (28 tests). Extended SQLite tests verify the welcome wording/motto after manual unlock, no duplicate on repeated unlock, correct partial-restoration wording when a timed restriction remains, and the account-reactivated notification after a successful strike appeal. Final notification-link field/UI identifier changes passed frontend syntax; existing authorization and moderation tests remain passing.

## Unfinished / limits

Rendered browser/mobile inspection and integrated release checks remain outstanding. This is saved source only; notifications will operate when this draft is deployed and its relevant features are configured. The earlier contextual moderation provider/migration activation requirements remain.

## Database migration

No additional migration for these messages. Existing notifications and prior review/strike tables are reused. No production SQL, merge or deployment performed.
