import {describe,it,expect} from 'vitest';
import {checkDeploymentCredentials,normalizeCloudflareToken} from '../../scripts/check-deployment-credentials.mjs';

const id='a'.repeat(32),d1='12345678-1234-1234-1234-123456789abc',kv='b'.repeat(32),tok='Abcdef1234_5678-XyZ';
const env={CLOUDFLARE_ACCOUNT_ID:id,RAW_CLOUDFLARE_API_TOKEN:tok};
describe('production credential safety',()=>{
  it('accepts copied token prefix and Windows newline without rotating it',()=>{
    expect(normalizeCloudflareToken('  Bearer '+tok+'\r\n')).toBe(tok);
    expect(checkDeploymentCredentials('2',{...env,RAW_CLOUDFLARE_API_TOKEN:'Bearer '+tok+'\r\n'}).token).toBe(tok);
  });
  it('does not silently use Account 1 token when the Account 2 secret is absent',()=>{
    expect(()=>checkDeploymentCredentials('2',{CLOUDFLARE_API_TOKEN:'' ,CLOUDFLARE_ACCOUNT_ID:id})).toThrow('ACCOUNT_2_TOKEN');
  });
  it('requires original Account 4 D1 pin and never substitutes database IDs',()=>{
    expect(()=>checkDeploymentCredentials('4',env)).toThrow('ACCOUNT4_PROTECTED_D1_ID');
    expect(checkDeploymentCredentials('4',{...env,ACCOUNT4_EXPECTED_D1_ID:d1}).token).toBe(tok);
  });
  it('requires both Account 3 permanent D1 and session KV pins',()=>{
    expect(()=>checkDeploymentCredentials('3',env)).toThrow('ACCOUNT3_PROTECTED_D1_ID');
    expect(()=>checkDeploymentCredentials('3',{...env,ACCOUNT3_EXPECTED_D1_ID:d1})).toThrow('ACCOUNT3_PROTECTED_SESSIONS_KV_ID');
    expect(checkDeploymentCredentials('3',{...env,ACCOUNT3_EXPECTED_D1_ID:d1,ACCOUNT3_EXPECTED_KV_ID:kv}).token).toBe(tok);
  });
  it('rejects injected multiline token payloads and invalid account IDs',()=>{
    expect(()=>checkDeploymentCredentials('2',{...env,RAW_CLOUDFLARE_API_TOKEN:tok+'\nOTHER=1'})).toThrow('invalid formatting');
    expect(()=>checkDeploymentCredentials('1',{...env,CLOUDFLARE_ACCOUNT_ID:'wrong'})).toThrow('account ID');
  });
});
