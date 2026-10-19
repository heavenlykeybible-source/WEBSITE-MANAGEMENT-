/**
 * Read-only release configuration preflight.
 * GitHub repository and environment secrets are different scopes; never guess which
 * Cloudflare account an unrelated token belongs to, or create replacement storage.
 * This normalizes copied "Bearer " prefixes and whitespace without rotating secrets.
 */
import {appendFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const required = Object.freeze({
  '1': ['CLOUDFLARE_API_TOKEN'],
  '2': ['ACCOUNT_2_TOKEN'],
  '3': ['CLOUDFLARE_ACCOUNT3_API_TOKEN', 'CLOUDFLARE_ACCOUNT3_ACCOUNT_ID', 'ACCOUNT3_PROTECTED_D1_ID', 'ACCOUNT3_PROTECTED_SESSIONS_KV_ID'],
  '4': ['ACCOUNT_4_TOKEN', 'ACCOUNT_4_ACCOUNT_ID', 'ACCOUNT4_PROTECTED_D1_ID']
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const accountId = /^[0-9a-f]{32}$/i;
const kvId = /^[0-9a-f]{32}$/i;
const safeToken = /^[a-zA-Z0-9_.~\-]{10,512}$/;

export function normalizeCloudflareToken(raw) {
  return String(raw ?? '').trim().replace(/^bearer\s+/i, '').replace(/[\r\n]/g, '').trim();
}

export function checkDeploymentCredentials(account, env) {
  if (!Object.hasOwn(required, account)) throw Error('Unsupported account number.');
  const names = required[account];
  const rawToken = env.RAW_CLOUDFLARE_API_TOKEN ?? env.CLOUDFLARE_API_TOKEN;
  if (!rawToken) throw Error('Account ' + account + ': missing GitHub secret ' + names[0] + ' in this workflow environment. Restore the EXISTING secret value, not a new password or token.');
  const token = normalizeCloudflareToken(rawToken);
  if (!safeToken.test(token)) throw Error('Account ' + account + ': Cloudflare API token has invalid formatting. Check ' + names[0] + ' without printing or replacing its value.');
  if (!accountId.test(String(env.CLOUDFLARE_ACCOUNT_ID || '')))
    throw Error('Account ' + account + ': invalid/missing Cloudflare account ID. Check ' + (account === '3' || account === '4' ? names[1] : 'the pinned workflow account ID') + '.');
  if (account === '3') {
    if (!uuid.test(String(env.ACCOUNT3_EXPECTED_D1_ID || '')))
      throw Error('Account 3: original D1 ID not pinned. Restore repository/environment secret ACCOUNT3_PROTECTED_D1_ID after verifying the EXISTING D1; never create a replacement.');
    if (!kvId.test(String(env.ACCOUNT3_EXPECTED_KV_ID || '')))
      throw Error('Account 3: original sessions KV ID not pinned. Restore ACCOUNT3_PROTECTED_SESSIONS_KV_ID after verifying the EXISTING namespace.');
  }
  if (account === '4' && !uuid.test(String(env.ACCOUNT4_EXPECTED_D1_ID || '')))
    throw Error('Account 4: ACCOUNT4_PROTECTED_D1_ID is absent or invalid. Find the UUID of EXISTING heavenlykey-recovery-control-db in Cloudflare Account 4 and set this exact GitHub Actions repository secret. Never create or substitute a database.');
  return {token, account};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const result = checkDeploymentCredentials(process.argv[2], process.env);
    // Mask the normalized token (which may differ from the original stored text).
    process.stdout.write('::add-mask::' + result.token + '\n');
    if (process.env.GITHUB_ENV)
      appendFileSync(process.env.GITHUB_ENV, 'CLOUDFLARE_API_TOKEN=' + result.token + '\n', {mode: 0o600});
    console.log('Account ' + result.account + ' credential contract validated. Existing Cloudflare credentials and protected resources will not be rotated or created.');
  } catch (error) {
    console.error('::error::' + String(error.message || error));
    process.exitCode = 1;
  }
}
