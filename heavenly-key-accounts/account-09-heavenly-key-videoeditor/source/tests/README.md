# Tests for Account 9 VideoEditor

Run `npm test` (Node.js 22 or later recommended) from the `heavenlykey-studio` folder. The included backend SQLite/R2/AI stand-in harness currently passes 46/46 checks locally. These are not production Cloudflare tests.

The older Python browser test scripts are development fixtures and require generated sample media plus a working Chromium/Playwright environment. They do not automatically run from this archive. The browser smoke attempt in the present sandbox was blocked/timed out; live video import and export remain unverified.

Before production launch, test registration, Owner/Admin provisioning, uploads, editing, captions, browser export, deletion, and deployment bindings on private Cloudflare staging.
