# Endless feed integration

The home member feed uses the existing `/api/feed` cursor pagination in `app.js` and the continuation sentinel in `community-app-promo.js`.

## Contract

- `mountFeed()` owns API pagination, deduplication, filters, error handling, and the `data-load-more` control.
- The sentinel emits `hk-feed-near-end` when it approaches the viewport.
- The integration listener activates the existing load-more control rather than issuing a second API request.
- The sentinel waits for the feed busy state to settle, then reports whether another page is available.
- Requests are throttled and guarded against concurrent loading.
- The manual Load more control remains available as an accessibility and network fallback.

This avoids duplicate pagination state and keeps automatic scrolling consistent with the same backend cursor used by manual pagination.
