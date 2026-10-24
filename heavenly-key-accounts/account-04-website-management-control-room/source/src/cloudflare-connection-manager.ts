/**
 * Cloudflare Connection Manager — safe API-token verification core.
 * Account 4 integration module. No credentials are persisted or logged.
 * OAuth authorization is intentionally NOT simulated: it must be enabled only
 * after a supported Cloudflare OAuth client and scopes have been verified.
 */
export type ConnectionCheck = {
  ok: boolean;
  tokenActive: boolean;
  accountId?: string;
  accountName?: string;
  capabilities: Record<string, boolean>;
  error?: string;
};

const API = 'https://api.cloudflare.com/client/v4';
const ACCOUNT_ID = /^[a-f0-9]{32}$/i;

async function cfGet(path: string, token: string): Promise<{ success?: boolean; result?: any; errors?: any[] }> {
  const response = await fetch(API + path, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    redirect: 'error',
  });
  if (!response.ok) return { success: false };
  return await response.json();
}

/** A transient test. Never return or store the bearer token. */
export async function verifyCloudflareConnection(
  token: string,
  accountId: string,
): Promise<ConnectionCheck> {
  if (!ACCOUNT_ID.test(accountId)) return { ok: false, tokenActive: false, error: 'Invalid account ID.' };
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096 || /\s/.test(token)) {
    return { ok: false, tokenActive: false, error: 'Invalid token format.' };
  }
  try {
    const verify = await cfGet('/user/tokens/verify', token);
    const tokenActive = verify.success === true && verify.result?.status === 'active';
    if (!tokenActive) return { ok: false, tokenActive: false, error: 'Token is not active or verification was denied.' };
    const account = await cfGet('/accounts/' + accountId, token);
    if (!account.success || account.result?.id !== accountId) {
      return { ok: false, tokenActive: true, error: 'Token cannot read the selected account.' };
    }
    // Endpoint probes check READ capability only; they do not claim edit permission.
    const checks = await Promise.allSettled([
      cfGet('/accounts/' + accountId + '/workers/scripts?per_page=1', token),
      cfGet('/accounts/' + accountId + '/storage/kv/namespaces?per_page=1', token),
      cfGet('/accounts/' + accountId + '/d1/database?per_page=1', token),
      cfGet('/accounts/' + accountId + '/r2/buckets?per_page=1', token),
    ]);
    const names = ['workersRead', 'kvRead', 'd1Read', 'r2Read'];
    const capabilities: Record<string, boolean> = {};
    checks.forEach((r, i) => { capabilities[names[i]] = r.status === 'fulfilled' && r.value.success === true; });
    return { ok: true, tokenActive: true, accountId, accountName: String(account.result.name || ''), capabilities };
  } catch {
    return { ok: false, tokenActive: false, error: 'Cloudflare connection check failed.' };
  }
}

/** Only call from an already authenticated owner-only endpoint with CSRF protection.
 * Do not log request bodies, expose tokens to AI prompts, or send tokens to the browser again.
 * A persistent connection requires encrypted-at-rest storage, revocation, and audit logs.
 */
