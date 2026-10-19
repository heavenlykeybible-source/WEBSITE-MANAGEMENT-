# Control Panel mobile app and approval-only mode

The header offers Download the Control Panel app. This is a lightweight installable web app, not an APK or App Store binary. On supported Android browsers, the button opens the available native install prompt; otherwise it shows Chrome menu instructions. On iPhone, open in Safari, Share, Add to Home Screen, Add. Layout adapts to the actual viewport, including safe-area insets, rather than assuming a fixed phone model or pixel size. Browser/OS installation remains a user action. AI and hosting quotas still apply.

The app uses the existing plain JavaScript interface with no new framework, external fonts or chat libraries. The service worker handles only main-page navigation over the network, with an explicit offline message if disconnected. It does not cache private API responses, keys, chats or approvals, and never queues offline writes. Chats currently remain in runtime memory, not durable conversation history; refreshing closes that local conversation. Server-side connections and keys remain in encrypted persistent storage.

Assistant has message bubbles, Lagos timestamps, a compact model selector, a message composer, and collapsed attachment/destination options. Failed sends restore the draft instead of silently losing it. No voice/video messaging is implemented.

Waiting is a table of collapsed review rows. Expand a row for its lazy preview, then open full review. CMS page/design saves, page-version restores, legacy blog/GitHub save endpoints, AI actions and file uploads all create Waiting proposals. CMS title/status changes are included in the hashed candidate. New pages create only an empty unpublished draft until approval. Full publication retains owner password confirmation, exact staged version, live revision checks and preview requirements. File recovery creates a new review proposal instead of immediate undo.

Direct Worker deletion, legacy immediate undo and cache purges are disabled. Read-only inspection/status checks remain available within existing connection/agent permissions. External edits performed directly in WordPress, Blogger, GitHub or Cloudflare cannot be prevented by this application; manage external permissions separately. Administrative account changes and connection setup do not publish website content.

Validation: 115 local checks including real SQLite, mocked providers/DOM, strict save-to-proposal checks and PWA manifest/PNG/offline behavior. Actual phone installation must be completed and checked on the owner's device.
