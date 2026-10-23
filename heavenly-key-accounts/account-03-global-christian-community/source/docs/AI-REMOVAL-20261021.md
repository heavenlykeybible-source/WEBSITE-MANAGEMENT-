# Community AI removal — 21 October 2026

Scope: the active Global Christian Community implementation, including every executable frontend/backend source, shared runtime loaded by its pages, Worker configuration, headers, and package commands. Preserved historical snapshots and other ministry applications were not changed.

## Removed

- The embedded CMS AI chat, launcher, conversation UI, knowledge-file request, and external assistant inference request.
- Unused AI writing/search/dialog styles, footer chat positioning, and obsolete AI-related exclusions.
- The homepage disclaimer about generated prophecy; the existing reflections remain explicitly labelled prepared reflections.

All 13 shared-footer entry points now use versioned cleaned assets. The small app-promotion script is a reviewed local copy rather than externally executable JavaScript. CMS content loading, visual editing, sharing, and ministry footer behavior remain in place. Content Security Policy now limits the CMS service connection to its published-content endpoint instead of permitting its assistant endpoint.

The backend already rejects /api/community-ai with HTTP 404, has no model binding, and has no inference client. Kept that explicit denial and tested GET, POST, PATCH and DELETE against the actual Worker with a model accessor that throws if invoked.

The standalone ministry navigation guide contains fixed responses and links, with no model calls. It is not an AI service and was not removed. Ordinary member search, Design Cards, prepared encouragement, and deterministic moderation rules remain functional. User posts, original artwork, and reference assets were not erased.

## Checks

- Inspected the complete non-truncated Git implementation manifest (157 previously tracked entries); all runtime source was available for scanning. The only unmaterialized public asset was a WebP portrait, which is not executable code.
- Static checks scan runtime JS/TS/HTML/CSS, scripts and migrations for AI widget code, model clients and inference destinations. No matches remain for those features.
- Executed the cleaned CMS runtime in guest and editor modes: published content/share controls work, the editor preserves its authenticated handoff and draft/publish controls, and no chat or inference request is created.
- Verified local footer references across every page and the constrained content-service policy.
- TypeScript and all frontend syntax checks passed.
- All 47 relevant regression tests passed, including the five new no-AI checks and existing registration, ACTIVE, feed, Design Card, Groups, Spaces and authorization tests.

Existing shared-ecosystem tests reference legacy code outside this implementation; they do not ship AI features in this application. Previously reported full-build/Community Care and local API-audit runtime blockers remain separate and unresolved.

This is a verified source change, not a production deployment or live-browser claim. The cleaned version must be released through the owner's existing approval process before it changes the live site.
