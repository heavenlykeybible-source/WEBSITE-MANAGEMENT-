# Account 4: Central GitHub Connections and one-click project installation

## Purpose
One GitHub identity connection should serve multiple repositories and destinations. No token per website or per Cloudflare account. Support multiple independent GitHub identities when the owner authorizes them.

## Security and scope
- Prefer a GitHub App installation with selected or all repositories under an explicitly authorized account/organization. Installation access is bounded by GitHub permissions; organization authorization is not implied by personal account authorization.
- A fine-grained PAT may be used where supported, but must never be assumed to grant access to every repository or organization. Encrypt credentials server-side; never return tokens in JSON, logs, or client HTML.
- Keep identity connection and repository/project registration separate. A repository is selected from the accessible list, not granted by arbitrary text input.
- Require owner approval for credential installation, expanding scopes, GitHub writes, Cloudflare destination changes, and production deployment. Use narrowly scoped credentials and audit actions.
- An AI agent cannot approve its own requests, widen its GitHub scope, or override the deployment lock.

## Target workflow
1. Owner authorizes a GitHub identity once using an OAuth/GitHub App flow.
2. Control Room lists accessible repositories with pagination and explicit organization/account selection.
3. Owner selects repository, branch, project root and target Cloudflare account/Worker.
4. Installer validates manifest, dependencies, path traversal, size, symlinks, secrets, source revision, and required Cloudflare bindings.
5. Build and preview in an isolated, non-production environment; show visual preview and test results.
6. Owner approves the exact reviewed artifact and destination.
7. Deployment verifies the approved commit is current and respects Account 4 forward-only lineage and binding preservation. Never silently downgrade.
8. Store install record, source commit, artifact hash, target, release status and rollback procedure; report verified live result.

## Current implementation vs. outstanding work
Existing workspace/github/reuse copies an existing authorized encrypted GitHub credential into a repository connection and verifies the selected repository/branch with GitHub. It is not yet a GitHub App identity-level repository browser or an unrestricted account connector.

Outstanding: installation-based identity authorization; paginated repository discovery; identity-to-repository mapping without duplicating credential ciphertext; revoke/rotate flow; audited repository file proposals; isolated preview/install wizard; full integration and CI tests. Preserve existing features during migration and do not deploy unverified changes.
