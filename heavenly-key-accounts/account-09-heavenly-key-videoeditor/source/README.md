# Account 9 VideoEditor source import target

This directory is reserved for the complete Heavenly Key VideoEditor source package for Account 9.

Status:
- Import: pending actual deployment package upload
- Deployment target: GitHub-managed Cloudflare Pages / staging workflow
- Production status: not ready

Important:
- Do not deploy from this directory until the full source package is copied here and verified.
- Preserve any newer development work already present in the supplied package.
- Keep the existing production Cloudflare bindings, D1 database, R2 media storage, and Workers AI configuration unchanged until staging verification succeeds.

Required follow-up before deployment:
1. Upload the extracted release package into this directory.
2. Run `npm run check` from the imported app root.
3. Verify Cloudflare Pages project `heavenlykey-studio` output directory is `public` and Pages Functions are retained.
4. Validate D1, R2, Workers AI, and Owner/Admin authentication in the live staging environment.
5. Activate AI services only after staging pass.

Do not treat this as production-ready until staging verification succeeds.
