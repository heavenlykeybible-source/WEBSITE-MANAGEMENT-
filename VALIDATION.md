# Validation

The Node 24 regression suite passes, including ZIP integrity and import lifecycle, CMS private drafts and owner-approved publication, exact AI account scopes, permission expiry, multi-step tool execution and retained conversation context. External model/provider requests use test responses in these checks.

The visual editor also passes DOM interaction checks and an actual headless Chromium browser flow: original scripts remain inactive while editing, text/footer edits work, sections insert correctly, undo/redo works, phone preview changes width, drafts save, source/visual round-trip preserves original code, and submitting sends a proposal to Waiting.

Production deployment has not completed. The authenticated Cloudflare dashboard was accessible, but the connected browser automation could not read or replace the Monaco editor source. No deployment success is claimed.
