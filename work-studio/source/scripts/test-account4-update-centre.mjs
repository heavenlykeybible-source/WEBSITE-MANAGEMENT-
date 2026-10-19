import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('update dashboard notification and temporary preview UI are syntactically valid',()=>{
 const s=get('recovery-control/src/index.ts');
 const m=s.match(/const page = ("(?:\\.|[^"\\])*");/);
 assert.ok(m,'Dashboard HTML must be a safely encoded string');
 const html=JSON.parse(m[1]);
 const js=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(js,'Dashboard script missing');
 new vm.Script(js[1]);
 for(const key of ['Website Update Centre','New update ready','Open Preview Website','Approve & Publish','/api/status','/api/preview-link']) assert.ok(html.includes(key),key+' missing');
});
test('preview Workers open normally without Cloudflare Access or an extra token',()=>{
 const code=get('review/gate.ts');
 assert.ok(!code.includes('getIdentity'));
 assert.ok(!code.includes('PREVIEW_SIGNING_SECRET'));
 assert.ok(!code.includes('authorized('));
 assert.ok(code.includes('env.ASSETS.fetch(request)'));
 assert.ok(code.includes('X-Robots-Tag'));
});
test('Account 4 dashboard uses its own password login with secure sessions',()=>{
 const code=get('recovery-control/src/index.ts'),auth=get('recovery-control/src/local-auth.ts');
 assert.ok(code.includes('renderLogin()'));
 assert.ok(code.includes('authenticated(req,env)'));
 assert.ok(!code.includes('accessIdentity(req,env)'));
 assert.ok(code.includes("u.pathname === '/api/login'"));
 assert.ok(code.includes('sameOrigin(req)'));
 assert.ok(auth.includes('CONTROL_PASSWORD_HASH'));
 assert.ok(auth.includes('HttpOnly; Secure; SameSite=Strict'));
 assert.ok(auth.includes('hkem-account4-cookie-v2:'));
 assert.ok(auth.includes('Too many attempts'));
 const workflow=get('.github/workflows/cloudflare-recovery-control.yml');
 assert.ok(workflow.includes('secret list'),'Release must verify stable login secrets');
 assert.ok(!workflow.includes('configure-account4-login.mjs'),'Release must never regenerate login password');
 assert.ok(workflow.includes('account4-permanence-gate.mjs'),'Credential permanence gate is mandatory');
});
test('password field supports accessible show/hide without changing authentication credentials',()=>{
 const source=get('recovery-control/src/local-auth.ts');
 const html=source.slice(source.indexOf('const loginPage=`')+'const loginPage=`'.length,source.indexOf('`;\nexport async function verifyOwnerPassword'));
 assert.ok(html.includes('type="password"'),'Password hidden by default');
 assert.ok(html.includes('id="show-password"'),'Show/hide button exists');
 assert.ok(html.includes('type="button" id="show-password"'),'Toggle must not submit the login form');
 assert.ok(html.includes('aria-pressed="false"'),'Accessible toggle state');
 assert.ok(html.includes("pass.type=visible?'text':'password'"),'Toggle switches text visibility');
 assert.ok(html.includes("toggle.textContent=visible?'Hide':'Show'"),'Button label updates');
 const script=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(script,'Login script must exist');
 new vm.Script(script[1]);
 assert.ok(source.includes('CONTROL_PASSWORD_HASH'),'Account 4 password stored as independent Worker secret');
});
test('owner approval requires correct account, exact SHA and unexpired signature',()=>{
 const secret='test-only-private-signing-key',sha='a'.repeat(40),exp=String(Math.floor(Date.now()/1000)+600);
 const proof=exp+'.'+createHmac('sha256',secret).update('hkem-account4-owner-approval-v1:1:'+sha+':'+exp).digest('hex');
 const verify=(account,token)=>spawnSync(process.execPath,['scripts/verify-account4-approval.mjs',account],{
  env:{...process.env,TARGET_REF:sha,APPROVAL_SECRET:secret,APPROVAL_PROOF:token},encoding:'utf8'});
 assert.equal(verify('1',proof).status,0,'Correct owner approval accepted');
 assert.notEqual(verify('2',proof).status,0,'Other account rejected');
 assert.notEqual(verify('1',exp+'.'+'0'.repeat(64)).status,0,'Forged signature rejected');
});
test('no unreviewed production promotion in legacy one-time workflow',()=>{
 const src=get('.github/workflows/owner-approved-release-2026-10-08.yml');
 assert.ok(src.includes('Automatic production promotion has been retired'));
 for(const p of ['.github/workflows/cloudflare-production.yml','.github/workflows/cloudflare-media-engine.yml','.github/workflows/cloudflare-global-community.yml']){
  const y=get(p);
  assert.ok(y.includes('approval_proof'),p+' must require owner proof');
  assert.ok(y.includes('verify-account4-approval.mjs'),p+' must verify signature');
 }
});

test('Account 4 welcome banner stays compact with small right-aligned indicator',()=>{
 const source=get('recovery-control/src/index.ts');
 const match=source.match(/const page = ("(?:\\.|[^"\\])*");/);
 assert.ok(match,'Account 4 dashboard HTML must exist');
 const html=JSON.parse(match[1]);
 assert.ok(html.includes('class="header-bottom"'),'Smaller welcome/banner controls');
 assert.ok(html.includes('class="header-meta"'),'Header indicator below title and right aligned');
 assert.ok(html.includes('font-size:10px;padding:1px 5px'),'Update indicator must remain small');
 assert.ok(html.includes('font-size:9px;letter-spacing'),'Owner marker must remain subtle');
 assert.ok(html.includes('id="badge" hidden'),'Badge only appears when there are updates');
});
test('new device browser navigation reaches login without weakening JSON API authentication',()=>{
 const source=get('recovery-control/src/index.ts');
 assert.ok(source.includes("u.pathname.startsWith('/api/')"),'Guard only API link browsing');
 assert.ok(source.includes("req.headers.get('Sec-Fetch-Mode')==='navigate'"),'Distinguish browser navigation');
 assert.ok(source.includes("req.headers.get('Accept')||''"),'Support browser Accept header');
 assert.ok(source.includes("if(browserNavigation)return new Response(null,{status:303"),'Browser receives login redirect');
 assert.ok(source.includes("return j({error:'Administrator login required."),'API callers continue receiving HTTP 401 JSON');
});

test('Account 4 welcome and update notices are calm, compact and motion-free',()=>{
 const src=get('recovery-control/src/index.ts');
 const match=src.match(/const page = ("(?:\\.|[^"\\])*");/);
 assert.ok(match,'Dashboard HTML must remain encoded safely');
 const html=JSON.parse(match[1]);
 assert.ok(html.includes('Welcome to your Website Update Centre. No unread updates.'),'Neutral welcome replaces warning');
 assert.ok(html.includes('<p class="quiet-notice"><strong>New update ready</strong>'),'Update visibility retained without alarm box');
 assert.ok(html.includes('tested update(s) ready for your approval below'),'Approval updates remain visible');
 assert.ok(!html.includes('class="alert-banner"'),'Large yellow warning box removed');
 assert.ok(!html.includes(".card.alert"),'Red warning card border removed');
 assert.ok(!html.includes("animation:pulse"),'No flashing/rotating header notification');
 assert.ok(!html.includes("c.className='card'+(s.newUpdate?' alert':'')"),'Update cards no longer turn red');
 assert.ok(html.includes('id="badge" hidden'),'Small update indicator retained when needed');
});

test('Account 5 app remains independently listed and no cross-account publishing is possible',()=>{
 const dashboard=get('recovery-control/src/index.ts');
 const app=get('recovery-control/src/account5-portal.ts');
 assert.ok(dashboard.includes("'/api/account5/status'")||dashboard.includes('"/api/account5/status"'));
 assert.ok(dashboard.includes('Account 5 — Heavenly Key Mobile App'));
 assert.ok(dashboard.includes('Independent GitHub repository and Cloudflare project'));
 assert.ok(app.includes('aoemeta247-cell/heavenly-key-mobile-app'));
 assert.ok(app.includes('APP5_GITHUB_READ_TOKEN'));
 assert.ok(app.includes('deploymentVerified:false'));
 assert.ok(app.includes('releaseMode:"independent-cloudflare-builds"'));
 assert.ok(app.includes('method:"GET"'));
 assert.ok(!app.includes('method:"POST"'));
 const existing=dashboard.slice(dashboard.indexOf('const accounts = {'),dashboard.indexOf('} as const;'));
 assert.ok(!existing.includes('"5":'), 'Account 5 must not inherit Accounts 1-3 approval/prod/restore workflows');
 const route=dashboard.indexOf('if (u.pathname === "/api/account5/status"');
 const ownerGuard=dashboard.indexOf('if(!owner)');
 assert.ok(route>ownerGuard,'Account 5 status must be owner-login protected');
});

test('Waiting Room timestamps distinguish arrival, owner request and verified deployment',()=>{
 const source=get('recovery-control/src/index.ts');
 const match=source.match(/const page = ("(?:\\.|[^"\\])*");/);
 assert.ok(match,'Account 4 dashboard HTML is safely encoded');
 const html=JSON.parse(match[1]);
 assert.ok(html.includes('Waiting Room arrival:'),'Owner must see when the exact staged SHA arrived');
 assert.ok(html.includes('Preview tests completed:'),'Stage completion differs from arrival');
 assert.ok(html.includes('Owner approval / publish requested:'),'Owner approval is a separate timestamp');
 assert.ok(html.includes('This version deployed successfully:'),'Only successful GitHub release is deployment evidence');
 assert.ok(html.includes('candidateSha&&s.liveRelease?.sha===candidateSha'),'Earlier live deployment cannot be displayed as the latest staged version');
 assert.ok(source.includes("approval_requested:'+a+':'+sha"),'Approval dispatch must record its own date');
 assert.ok(source.includes("const approvalRequestedAt=latestSha?"),'Approval timestamp must be reported for the exact version');
 assert.ok(source.includes("arrivalAt: latestRaw.created_at"),'Arrival time comes from the real staging workflow');
 assert.ok(source.includes("reviewArrivalAt:recorded||null"),'Account 5 review arrival is explicit, not fabricated');
 assert.ok(source.includes("candidate.checks!=='success'"),'Account 5 cannot register an untested source');
 assert.ok(source.includes("stagedOnCloudflare:false,productionDeployed:false"),'Review registration never claims app deployment');
 assert.ok(html.includes('App production deployment:'),'Account 5 includes a distinct deployment milestone');
 assert.ok(html.includes('Not independently verified'),'Unverified Account 5 deployment time is never invented');
 assert.ok(html.includes('Account 4 deploys independently'),'Account 4 does not fake a staging-room event');
 assert.ok(!source.includes("await dispatch(env, c.prod, {\n            target_ref: sha,\n            release_note:\n              \"Explicitly reviewed and approved by owner from Account 4 Website Update Centre\",\n            confirm_production: \"PROMOTE\",\n            approval_proof\n          });\n          await env.RECOVERY_STATE.put('account5:review_arrival:'"),'App review cannot dispatch Account 1-3 release');
});
test('Account 5 independent build dates are read-only and not confused with live deployment',()=>{
 const s=get('recovery-control/src/account5-portal.ts');
 for(const key of ['sourceCommittedAt','buildArrivedAt','buildCompletedAt','deployedAt'])assert.ok(s.includes(key),'Missing Account 5 event '+key);
 assert.ok(s.includes('deploymentVerified:false'),'No unverified Cloudflare completion time');
 assert.ok(s.includes('result.buildArrivedAt=typeof run?.created_at'),'CI arrival must use real workflow run start');
 assert.ok(!s.includes('result.deployedAt=run?.updated_at'),'CI completion must never be treated as deployment');
});
