# Visual CMS for Account 4

This release adds visual editing to HTML websites stored in the Control Room. It builds on the existing page, design, menu, footer, media, roles, version history and owner-approval system. It preserves existing D1/R2 resources, secrets, users and connections; no schema reset or new production binding is required.

## Editing a website

1. Open **Visual CMS** and choose the managed website.
2. Choose **Visual edit** next to an HTML page. Click text, an image, a link, the header, footer or a section to select it.
3. Use the inspector to edit words, image/alt text, links, colours, size, alignment or padding. Select **Parent** for the enclosing section. Duplicate, remove, reorder, undo and redo are available.
4. Add headings, paragraphs, images, buttons, sections, a hero, responsive columns, a header/footer or spacing. Original styles and application scripts are preserved; scripts stay inactive while editing.
5. Choose existing media or upload PNG, JPEG, GIF or WebP images. New images travel in the same proposal as the edited page, up to 500 KB of new images per edit. Larger media can use Files / Upload.
6. Check Desktop, Tablet and Phone widths. Save a private draft or let the editor autosave after a change. Page title and search description are editable.
7. **Send to Waiting for approval** creates an immutable proposal. Open the proposal preview, review the exact version and approve as owner with your password. Saving drafts or proposals never publishes directly.

The page manager also creates HTML pages, edits existing CSS files, proposes deletion, lists media and provides access to ZIP and GitHub imports. Built-in structured pages and global design/menu/footer retain their existing editors and restore flow.

## Integrity and access

CMS editing requires staff editor access. Member accounts cannot access the shared static-site CMS. Drafts belong to the current staff user. The editor refuses truncated reads, protected infrastructure paths and stale revisions. If the live page changes after an edit begins, reload it before proposing changes. New pages and media, edits and deletions retain the existing Waiting Room, review token, owner-password, audit, backup and recovery controls.

The visual canvas uses a sandboxed iframe without same-origin access, pauses original application scripts/inline events, blocks forms and checks editor message sources/channels. Export removes editor metadata and restores the website's original scripts, event handlers, base tags and HTTP metadata.

## Supported scope

This is a visual CMS for managed static HTML pages, including imported built websites. It does not install PHP WordPress themes/plugins, run npm builds, edit application database records or expose authentication/server infrastructure to a page editor. WordPress/Blogger connections keep their existing content workflows. GitHub repositories retain their separate reviewed code workflow. Application screens generated entirely by JavaScript require their source or data editor rather than the static canvas.

ZIP scanning checks archive integrity, allowed paths/types and size limits; it is not an antivirus service. Use a built static website package with index.html. ZIPs support 200 files, 2 MB each and 25 MB expanded. Direct GitHub import supports 40 files; larger sites can use ZIP. Drive ZIP import uses the already connected, read-only project folder.

## Build and verification

Run `node cms/build.mjs` after editing cms/frame.js or cms/editor.js. It embeds those files into the single deployable Worker. No runtime npm dependency is added to the Worker.

Run `node tests/run.mjs` on Node 24 for the required regression suite, including SQLite website-package and CMS draft/proposal/publication lifecycle checks.

For DOM interaction checks: install dev dependencies then run `npm run test:cms-dom`. For browser interaction checks: install Playwright and Chromium in the test environment and run `npm run test:cms-browser`. A browser test failure caused by missing Chromium does not count as a passed browser test.

Deploy the generated control-room-worker.js through the existing separate maintenance path for Worker website-management. Keep wrangler.toml resource IDs, D1 data, R2 content, VAULT_KEY, SESSION_SECRET, owner identity and all other production secrets unchanged. The protected control-plane Worker cannot update itself through an ordinary website proposal.

## Expanded dashboard assistant

The assistant now uses conversational instructions and retained task summaries so ordinary chat does not need to become a page proposal. Per-conversation context includes the actual requested work, completed tool results and proposal IDs; user roles, attachment ownership and target checks still apply. Provider quality and service limits remain relevant.

Open **AI permissions** as owner. Choose Chat only, Inspect, or Work, and a budget of 4–20 tool steps per message. Work can search filenames, read static files and attachments in chunks, inspect connected Worker source, prepare code changes, import an attached static website ZIP, prepare an attached Worker for a named account, and turn an attached HTML file into a WordPress/Blogger content proposal.

Cloudflare deployment/resource proposals need express owner permission for the exact saved accounts, lasting 1–24 hours. Expired or unselected accounts are denied by the server, including model-generated calls. Only a person can approve publication. Existing maintenance grants are still separate. The assistant cannot grant itself access, expose stored credentials, replace protected control-plane Workers, install PHP themes/plugins on static hosting, or bypass a connected provider's permissions.

Private chat uploads are limited to 2 MB each. Static ZIP uploads through the site installer retain the separate 25 MB compressed/expanded package limits. Attached Worker code retains the existing 1.4 MB limit. Connected services must be configured before their tools can work.
