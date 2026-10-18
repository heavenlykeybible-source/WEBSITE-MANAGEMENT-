# WordPress and Blogger follow-up audit

18 October 2026. This records the second audit and its limitations. The current package also includes advanced release controls; read ADVANCED-RELEASE-GUIDE.md for their required migration and approval workflow. Nothing was deployed or published externally.

## User experience now implemented

Users can connect their own WordPress or Blogger site in the dashboard. They can list, read and edit post/page titles and HTML content, create content, submit it for approval, and save to the original site when their role permits. A member's connections and export requests are scoped to that member's account. Editors submit changes for review; agents cannot publish directly. Staff admins and independent member owners can use the human direct-save action, subject to the existing platform's credentials and permissions.

This manages content. It does not manage WordPress themes, plugins, menus, page-builder layouts, site-wide settings, comments, category assignments or media uploads. WordPress block markup is retained as HTML text; it is not a Gutenberg visual editor. Existing media references remain URLs.

## Export buttons

- Export JSON: downloads the saved title, complete HTML body, status, item ID, source site URL, modification stamp and source link.
- Export HTML: downloads the saved title and body as an HTML document, with a restrictive script policy. Embedded image URLs remain links to their original locations. HTML bodies are not a general-purpose sanitization product; the JSON format is preferable for processing untrusted content.
- Export this batch (JSON): sequentially fetches the displayed items and downloads their content together. It has a 10 MB content limit and aborts on failure. It does not silently claim to export the entire blog. Use Next batch to reach older items.
- Download my unsaved text (JSON): saves the current editor text without publishing it. Saved-item exports fetch the original site and do not include unsaved edits.

These are Control Room content exports, not WordPress WXR/XML files or Blogger Atom backups. They do not include downloaded image files, themes, plugins, revisions, comments, all metadata, or a native import/restore workflow. For a complete native backup, use the original platform's export/backup tools.

## Confirmed issues fixed

| Finding | Result |
| --- | --- |
| Only the first 20 posts appeared | WordPress uses page counts; Blogger posts use continuation tokens. Both dashboard and AI listing tools expose the next cursor. |
| Blogger pages were sent post-only pagination parameters | Pages use their own documented list parameters; summaries are paginated locally in groups of 20. |
| Blogger reads could omit status or draft content | Use ADMIN view. Missing editable status produces an error instead of treating a published item as draft. |
| Scheduled/private/pending states could silently become draft | Preserve existing statuses in the editor and reject unknown statuses. WordPress preserves existing scheduling; creating a new scheduled item still belongs in WordPress. |
| Blogger pages called unsupported /publish and /revert endpoints | Page title/body edits use page PATCH. Existing page status is preserved. Change page publication status in Blogger itself; new pages created here are explicitly published. |
| Scheduled Blogger posts could not be reverted correctly | Explicit draft changes use the post revert endpoint, including from scheduled status. |
| Approval submission used the latest server revision instead of the revision the editor read | Existing items require base_stamp. Reject stale submissions and stale direct saves; approval still checks again before writing. |
| No post download feature | Added scoped JSON/HTML exports and browser-side batch/unsaved-content downloads. Export response headers disable caching. |
| Blogger authorization state could be reused and was not browser-bound | Store a one-use state nonce with account, connection, expiry and password version. Require the matching HttpOnly callback cookie. |
| Blogger connection only looked up a public blog URL | Require Blogger administrator access before marking the connection ready. Reader-only or author-only accounts are insufficient for this full-site management flow. |

## Connecting

WordPress: use the site's HTTPS base address, username and a WordPress Application Password. The REST API must be enabled, and the WordPress account needs permission for the content you intend to edit. A successful login check does not grant additional publishing capabilities. The existing integration targets self-hosted WordPress REST endpoints; WordPress.com OAuth is not implemented.

Blogger: configure a Google OAuth web client with the displayed callback URL and Blogger API access. Use an administrator Google account for that blog. Google's consent-screen verification/testing restrictions still apply. If cookies are blocked, authorization was started in another browser, a password changed, or state expires, restart the authorization flow. Starting another Blogger authorization in the same browser replaces its callback nonce cookie.

The second-audit changes use the existing settings table for temporary OAuth state. No additional tables or schema migration are required. Old pending sign-in links must be restarted after deploying this version.

## Verification and remaining limits

The complete local suite passes: the original 11 checks, two SQLite workflow/quota checks, and 14 additional remote-edit/export checks. Remote API tests use mocked HTTP responses and a real local SQLite database. They cover pagination, provider-specific requests, status preservation, stale submissions, cross-account export denial, JSON/HTML content and headers, and browser-bound single-use Blogger sign-in.

No live WordPress/Blogger account, live OAuth consent flow, browser download on Android, Cloudflare CPU budget or external publishing action has been tested. Test with disposable posts before connecting important sites. Provider writes and local approval records are still not one transaction; an external timeout can leave an uncertain outcome. Inspect the destination before retrying a failed publication. WordPress/Blogger do not provide an atomic compare-and-swap through these endpoints, so an edit occurring between the final revision check and the write can still race.

## Official references checked

- https://developer.wordpress.org/rest-api/reference/posts/
- https://developers.google.com/blogger/docs/3.0/reference/posts/list
- https://developers.google.com/blogger/docs/3.0/reference/posts/get
- https://developers.google.com/blogger/docs/3.0/reference/pages/list
- https://developers.google.com/blogger/docs/3.0/reference/pages/insert
- https://developers.google.com/blogger/docs/3.0/reference/pages/patch
- https://developers.google.com/blogger/docs/3.0/reference/blogUserInfos/get
