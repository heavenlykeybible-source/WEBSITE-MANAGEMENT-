# Account 5: direct Cloudflare GitHub deployment

## Repository
- GitHub: https://github.com/aoemeta247-cell/heavenly-key-mobile-app
- Private main branch, source at root (/)
- Worker name in wrangler.toml: `heavenly-key-app`
- Build command: `npm run build` (optional but recommended)
- Deploy command: `npx wrangler deploy`
- Do not expose Account 1–4 secrets, D1, KV or R2 IDs.
- This is an app **starter**. Community sign-in, audio, Bible catalogue and media must be added and tested separately.

## If cloning failed while the repository was empty
The repository has now been initialized with a commit and deployable source files. On Cloudflare Account 5, open Workers & Pages → your Worker → Deployments → failed build → Retry build. If it still fails at `Cloning`, use the full build error (without credentials) to investigate the Cloudflare GitHub app installation/repository access. Do not keep changing API keys.

## Where to find Cloudflare Account 5's Account ID
Cloudflare Account 5 → Workers & Pages → Overview → Account Details → Account ID → Copy.
Or use Cloudflare search (Ctrl/Cmd+K) and search for `Copy account ID`.
The Account ID identifies your account; do not confuse it with a D1 database UUID or a domain Zone ID.

## Where to find the original protected Account 4 D1 ID
Cloudflare **Account 4**, not Account 5 → Storage & databases → D1 SQL database → select **existing** `heavenlykey-recovery-control-db` → copy Database ID (UUID).
Then in the **original project repository** `aoemeta247-cell/All-Nations-For-Christ-Outreach`, open Settings → Secrets and variables → Actions → New repository secret:
- Name: `ACCOUNT4_PROTECTED_D1_ID`
- Value: original Account 4 D1 Database ID

Never create a replacement database or use Account 5's ID to fill Account 4's protected database field.
Do not paste Cloudflare API tokens, passwords, or secret values into chat, documentation or GitHub source.
