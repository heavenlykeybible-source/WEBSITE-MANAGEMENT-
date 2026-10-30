import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

test('Meta webhooks require a signed request before storage', () => {
  assert.match(source, /x-hub-signature-256/);
  assert.match(source, /crypto\.subtle\.sign/);
  assert.match(source, /mismatch!==0/);
  assert.match(source, /INSERT OR IGNORE INTO webhook_events/);
});
test('Admin endpoints require configured authentication', () => {
  assert.match(source, /if\(!env\.ADMIN_TOKEN\)/);
  assert.match(source, /Unauthorized/);
});
test('Worker configuration does not contain literal authentication secrets', () => {
  assert.doesNotMatch(config, /^\s*(ADMIN_TOKEN|META_APP_SECRET|META_WHATSAPP_ACCESS_TOKEN)\s*=/m);
});
test('Public health response does not claim readiness', () => {
  assert.match(source, /status:'setup_required'/);
});

test('private media routes require authentication and validate image signatures', () => {
  const auth = source.indexOf("if(provided!==`Bearer ${env.ADMIN_TOKEN}`)");
  const upload = source.indexOf("if(u.pathname==='/api/media'&&req.method==='POST')");
  const retrieval = source.indexOf("if(u.pathname==='/api/media'&&req.method==='GET')");
  assert.ok(auth >= 0 && upload > auth && retrieval > auth, 'media endpoints must follow admin authentication');
  assert.match(source, /env\.MEDIA_BUCKET\.put\(/);
  assert.match(source, /env\.MEDIA_BUCKET\.get\(/);
  assert.match(source, /Media content does not match declared format/);
  assert.match(source, /content-disposition':'attachment/);
});

test('draft deletion cannot remove posts outside draft status', () => {
  assert.match(source, /req\.method==='DELETE'/);
  assert.match(source, /DELETE FROM social_posts WHERE id=\? AND status='draft'/);
  assert.match(source, /Draft not found or not deletable/);
});

test('post media references must exist privately before saving drafts', () => {
  assert.match(source, /MEDIA_BUCKET\.head\('account10\/uploads\/'\+data\.mediaId\)/);
  assert.match(source, /Attached media was not found/);
  assert.match(source, /media_id=CASE WHEN \? THEN \? ELSE media_id END/);
  assert.match(source, /INSERT INTO social_posts\(id,body,platform,status,scheduled_at,media_id\)/);
});

test('All JSON write methods reject oversized or malformed content-length and enforce streamed byte limits', () => {
  assert.match(source, /\['POST','PUT','PATCH'\]\.includes\(req\.method\)/);
  assert.match(source, /Number\.isSafeInteger\(Number\(declaredLength\)\)/);
  assert.match(source, /if\(received>1048576\)/);
  assert.match(source, /reader\.cancel\(\)/);
});

test('Static dashboard assets enforce browser security headers', () => {
  const assetStart=source.indexOf("if((req.method==='GET'||req.method==='HEAD')&&env.ASSETS)");
  const assetEnd=source.indexOf("if(req.method==='OPTIONS')",assetStart);
  assert.ok(assetStart>=0 && assetEnd>assetStart);
  const handler=source.slice(assetStart,assetEnd);
  for (const header of ['x-content-type-options','x-frame-options','referrer-policy','strict-transport-security','permissions-policy','content-security-policy']) {
    assert.ok(handler.includes("headers.set('"+header+"'"), 'Missing asset header: '+header);
  }
  assert.match(handler, /frame-ancestors 'none'/);
});
