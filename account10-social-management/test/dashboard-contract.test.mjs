import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(Boolean);

test('inline dashboard JavaScript parses successfully', () => {
  assert.ok(scripts.length > 0, 'expected inline dashboard JavaScript');
  for (const source of scripts) assert.doesNotThrow(() => new Script(source));
});
test('dashboard exposes the authenticated media upload interface', () => {
  assert.match(html, /function addMediaLibrary\(\)/);
  assert.match(html, /api\('\/api\/media'/);
  assert.match(html, /image\/png,image\/jpeg,image\/webp/);
  assert.match(html, /chosen\.size>750000/);
});
test('dashboard retains its post draft editor', () => {
  assert.match(html, /socialplus-post-editor-ready/);
  assert.match(html, /\/api\/posts/);
});

test('scheduled draft queue supports reviewing, rescheduling and unscheduling', () => {
  assert.match(html, /function addScheduledQueue\(\)/);
  assert.match(html, /api\('\/api\/posts\/queue'/);
  assert.match(html, /method:'PUT'/);
  assert.match(html, /method:'PATCH'/);
  assert.match(html, /date\.toISOString\(\)/);
  assert.match(html, /Remove schedule/);
  assert.match(html, /Reschedule/);
});

test('private media library has paginated listing controls', () => {
  assert.match(html, /api\('\/api\/media\/list'/);
  assert.match(html, /function addMediaLibrary\(\)/);
  assert.match(html, /Refresh image library/);
  assert.match(html, /Load more/);
  assert.match(html, /Copy ID/);
});

test('saved drafts can be edited without publishing', () => {
  assert.match(html, /function addDraftEditor\(\)/);
  assert.match(html, /Edit saved post drafts/);
  assert.match(html, /method:'PATCH'/);
  assert.match(html, /Save draft edits/);
  assert.match(html, /Draft edited and saved internally/);
});

test('draft manager offers manual copying and safe deletion', () => {
  assert.match(html, /Copy post text/);
  assert.match(html, /manual publishing/);
  assert.match(html, /Delete draft/);
  assert.match(html, /method:'DELETE'/);
});

test('post draft editor supports private image attachments', () => {
  assert.match(html, /Private image ID for post draft/);
  assert.match(html, /Attached image ID/);
  assert.match(html, /mediaId:media\.value\.trim\(\)\|\|null/);
  assert.match(html, /mediaId:mediaId\.value\.trim\(\)/);
});

test('rapid conversation switching cannot display stale Gemini suggestions or history', () => {
  assert.match(html, /const targetConversation=selected,epoch=authEpoch;const message=prompt/);
  assert.match(html, /conversationId:targetConversation,message:message\.trim\(\)/);
  assert.match(html, /if\(selected!==targetConversation\|\|authEpoch!==epoch\)return;if\(result\.suggestion\)/);
  assert.match(html, /const d=await api\('\/api\/conversation\?id='\+encodeURIComponent\(id\)\);if\(selected!==id\|\|authEpoch!==epoch\)return/);
  assert.match(html, /if\(selected!==id\|\|authEpoch!==epoch\)return;renderMessages\(/);
});

test('operator notes are saved only to the conversation selected at submission time', () => {
  assert.match(html, /const targetConversation=selected,epoch=authEpoch;const body=\$\('draftText'\)\.value\.trim\(\)/);
  assert.match(html, /conversationId:targetConversation,body/);
  assert.match(html, /if\(selected===targetConversation&&authEpoch===epoch\)\{\$\('draftText'\)\.value=''/);
});

test('human takeover request preserves its original conversation when operators switch chats', () => {
  assert.match(html, /const targetConversation=selected,epoch=authEpoch,wasHumanRequested=requestedHuman,targetRequestVersion=humanRequestVersion;const targetPaused=!paused/);
  assert.match(html, /conversationId:targetConversation,paused:targetPaused/);
  assert.match(html, /if\(selected===targetConversation&&authEpoch===epoch\)\{await openChat\(targetConversation\)/);
});

test('changing operator credentials clears private messages and drafts', () => {
  assert.match(html, /authEpoch\+\+;token=\$\('token'\)\.value\.trim\(\)/);
  assert.match(html, /\$\('messages'\)\.replaceChildren\(\)/);
  assert.match(html, /\$\('draftText'\)\.value=''/);
  assert.match(html, /\$\('takeover'\)\.disabled=true/);
  assert.match(html, /\$\('suggestReply'\)\.disabled=true/);
});

test('old operator requests cannot populate a new authenticated view', () => {
  assert.match(html, /async function openChat\(id\)\{selected=id;const epoch=authEpoch/);
  assert.match(html, /if\(selected!==id\|\|authEpoch!==epoch\)return/);
  assert.match(html, /async function load\(\)\{const epoch=authEpoch/);
  assert.match(html, /if\(epoch!==authEpoch\)return/);
  assert.match(html, /if\(selected!==targetConversation\|\|authEpoch!==epoch\)return/);
});

test('switching conversations hides the previous customer message before loading', () => {
  assert.match(html, /async function openChat\(id\)\{selected=id;const epoch=authEpoch;\$\('messages'\)\.replaceChildren\(\)/);
  assert.match(html, /\$\('draftText'\)\.value='';\$\('takeover'\)\.disabled=true/);
});

test('WhatsApp send refresh stays in the originating conversation', () => {
  assert.match(html, /send\.onclick=async\(\)=>\{const currentConversation=conversationId;if\(send\.disabled\|\|operatorAccessRole!=='owner'\|\|selected!==currentConversation\|\|authEpoch!==sessionEpoch\)return/);
  assert.match(html, /if\(selected===currentConversation&&authEpoch===sessionEpoch\)\{await openChat\(currentConversation\);if\(selected===currentConversation&&authEpoch===sessionEpoch\)status\(result\.sent/);
  assert.match(html, /await openChat\(currentConversation\)/);
});

test('dashboard has an explicit sign-out that clears authorization and private session state', () => {
  assert.match(html, /id="logout">Sign out</);
  assert.match(html, /\$\('logout'\)\.onclick=\(\)=>\{sessionController\.abort\(\);sessionController=new AbortController\(\);authEpoch\+\+;token='';selected='';paused=false/);
  assert.match(html, /\$\('managementBody'\)\.replaceChildren\(\)/);
  assert.match(html, /\$\('messages'\)\.replaceChildren\(\)/);
  assert.match(html, /status\('Signed out\. Private conversation data cleared from the dashboard\.'\)/);
});

test('operator credential changes and sign-out abort in-flight dashboard requests', () => {
  assert.match(html, /sessionController=new AbortController\(\)/);
  assert.match(html, /signal:sessionController\.signal/);
  assert.match(html, /\$\('connect'\)\.onclick=\(\)=>\{sessionController\.abort\(\);sessionController=new AbortController\(\)/);
  assert.match(html, /\$\('logout'\)\.onclick=\(\)=>\{sessionController\.abort\(\);sessionController=new AbortController\(\)/);
});

test('operator takeover button resolves pending human request before resuming Gemini', () => {
  assert.match(html, /requestedHuman=!!d\.conversation\.requested_human/);
  assert.match(html, /requestedHuman\?'Resolve human request and resume AI'/);
  assert.match(html, /wasHumanRequested&&!confirm\(/);
  assert.match(html, /if\(wasHumanRequested\)\{await api\('\/api\/human-requests\/resolve'/);
  assert.match(html, /resumeAutomation:true/);
  assert.match(html, /else\{await api\('\/api\/takeover'/);
  assert.equal((html.match(/selected='';paused=false;requestedHuman=false/g)||[]).length,2);
});

test('human request queue visibly distinguishes ministry agent and Evangelist handovers', () => {
  assert.match(html, /item\.human_contact_target==='speak_to_evangelist'/);
  assert.match(html, /For Evangelist Emmanuel Ogheneochuko Adiohwo/);
  assert.match(html, /item\.human_contact_target==='ministry_agent'/);
  assert.match(html, /For Heavenly Key Evangelistic Movement agent/);
  assert.match(html, /Human contact target unverified/);
});

test('human requests attention counter shows authenticated pending count and resets on logout', () => {
  assert.match(html,/function updateHumanRequestCount\(items\)/);
  assert.match(html,/api\('\/api\/human-requests'\)\.then\(h=>/);
  assert.match(html,/if\(epoch===authEpoch\)updateHumanRequestCount\(h\.items\)/);
  assert.match(html,/if\(name==='requests'\)updateHumanRequestCount\(d\.items\)/);
  assert.equal((html.match(/selected='';paused=false;requestedHuman=false;humanRequestVersion=0;operatorAccessRole='viewer';activeManagementTab='chats';refreshRoleNavigation\(\);\$\('requestsTab'\)\.textContent='Human Requests';/g)||[]).length,2);
  assert.match(html,/count===100\?'\+':'/);
});

test('management tab requests never restore private data after logout or tab change', () => {
  assert.match(html,/activeManagementTab='chats'/);
  assert.match(html,/function showTab\(name\)\{if\(operatorAccessRole!=='owner'&&\['posts','rules','accounts','diagnostics'\]\.includes\(name\)\)\{status\('This section requires owner authorization\.'\);return;\}activeManagementTab=name;const epoch=authEpoch;/);
  assert.match(html,/if\(epoch!==authEpoch\|\|activeManagementTab!==name\|\|!token\)return;renderManagement\(name,d\)/);
  assert.match(html,/if\(epoch===authEpoch&&activeManagementTab===name&&token\)status\(e.message\)/);
  assert.equal((html.match(/requestedHuman=false;humanRequestVersion=0;operatorAccessRole='viewer';activeManagementTab='chats';refreshRoleNavigation\(\);\$\('requestsTab'\)\.textContent='Human Requests'/g)||[]).length,2);
});

test('nested launch-diagnostics responses never render into a stale operator session', () => {
 assert.match(html,/function renderManagement\(name,d\)\{const epoch=authEpoch;const current=\(\)=>epoch===authEpoch&&activeManagementTab===name&&!!token;/);
 assert.match(html,/api\('\/api\/webhooks\/events\?limit=20'\)\.then\(d=>\{if\(!current\(\)\)return;/);
 assert.match(html,/api\('\/api\/operations\/data-integrity'\)\.then\(result=>\{if\(!current\(\)\)return;/);
 assert.match(html,/Webhook inbox unavailable/);
 assert.match(html,/Integrity check unavailable/);
});

test('operator handover resolution sends the exact request generation', () => {
 assert.match(html,/humanRequestVersion=Number\(d\.conversation\.human_request_version\)\|\|0/);
 assert.match(html,/targetRequestVersion=humanRequestVersion/);
 assert.match(html,/resumeAutomation:true,requestVersion:targetRequestVersion/);
 assert.match(html,/resumeAutomation:false,requestVersion:item\.human_request_version/);
 assert.equal((html.match(/requestedHuman=false;humanRequestVersion=0;operatorAccessRole='viewer';activeManagementTab='chats';/g)||[]).length,2);
});

test('owner can provision, list and revoke expiring staff credentials without displaying hashes', () => {
 assert.match(html,/function addOperatorManagement\(\)/);
 assert.match(html,/api\('\/api\/operator\/session'\)/);
 assert.match(html,/session\.role!=='owner'/);
 assert.match(html,/days\.max='90'/);
 assert.match(html,/api\('\/api\/operators'\)/);
 assert.match(html,/api\('\/api\/operators\/revoke'/);
 assert.match(html,/showOnlyOnce|ONE-TIME TOKEN/);
 assert.match(html,/addAccountForm\(\);addWhatsAppReadiness\(\);addOperatorManagement\(\)/);
});

test('viewer role is read-only in the operator dashboard', () => {
 assert.match(html,/operatorAccessRole='viewer'/);
 assert.match(html,/Promise\.all\(\[api\('\/api\/conversations'\),api\('\/api\/operator\/session'\)\]\)/);
 assert.match(html,/operatorAccessRole=session\.role/);
 assert.match(html,/\$\('takeover'\)\.disabled=operatorAccessRole==='viewer'/);
 assert.match(html,/\$\('saveDraft'\)\.disabled=operatorAccessRole==='viewer'/);
 assert.match(html,/\$\('suggestReply'\)\.disabled=operatorAccessRole==='viewer'/);
});

test('limited operators cannot open owner-only dashboard tools', () => {
 assert.match(html,/function refreshRoleNavigation\(\)/);
 assert.match(html,/\['postsTab','rulesTab','accountsTab','diagnosticsTab'\]/);
 assert.match(html,/\$\(id\)\.hidden=!owner/);
 assert.match(html,/operatorAccessRole=session\.role;refreshRoleNavigation\(\)/);
 assert.match(html,/This section requires owner authorization/);
});

test('Gemini suggestion button remains disabled after role, conversation or session changes', () => {
 assert.match(html, /finally\{button\.disabled=!selected\|\|operatorAccessRole==='viewer'\|\|selected!==targetConversation\|\|authEpoch!==epoch\}/);
});

test('WhatsApp send errors cannot repaint a different conversation or authentication session', () => {
 assert.match(html, /catch\(err\)\{if\(selected===currentConversation&&authEpoch===sessionEpoch\)status\(err\.message\)\}finally\{send\.disabled=false\}/);
});

test('WhatsApp delivery ledger failures do not expose stale status across chats or sessions', () => {
 assert.match(html, /catch\(err\)\{if\(selected===id&&authEpoch===epoch\)status\('WhatsApp delivery ledger unavailable; sending disabled until migrations are applied\.'\)\}/);
});

test('WhatsApp send control is visible only to owners, matching server-side role authorization', () => {
 assert.match(html, /if\(operatorAccessRole==='owner'&&m\.direction==='outbound'&&m\.id&&currentChannel==='whatsapp_business'&&deliveryAttempts&&!attempt\)/);
 assert.match(html, /send\.onclick=async\(\)=>\{const currentConversation=conversationId/);
});

test('human takeover action cannot repaint stale sessions or reenable read-only controls', () => {
 assert.match(html, /catch\(e\)\{if\(selected===targetConversation&&authEpoch===epoch\)status\(e\.message\)\}finally\{if\(selected===targetConversation&&authEpoch===epoch\)button\.disabled=operatorAccessRole==='viewer'\}/);
});

test('operator note failures never update another chat or signed-out session', () => {
 assert.match(html, /catch\(err\)\{if\(selected===targetConversation&&authEpoch===epoch\)status\(err\.message\)\}finally\{if\(selected===targetConversation&&authEpoch===epoch\)saveButton\.disabled=operatorAccessRole==='viewer'\}\};\$\('suggestReply'\)\.onclick/);
});

test('async chat refresh cannot post stale operator success messages after switching sessions', () => {
 assert.match(html, /await openChat\(targetConversation\);if\(selected===targetConversation&&authEpoch===epoch\)status\('Internal note saved\. Not delivered to any provider\.'\)/);
 assert.match(html, /await openChat\(targetConversation\);if\(selected===targetConversation&&authEpoch===epoch\)status\(wasHumanRequested\?/);
});

test('WhatsApp send guard checks owner role and duplicate submission both before and after confirmation', () => {
 assert.match(html, /const currentConversation=conversationId;if\(send\.disabled\|\|operatorAccessRole!=='owner'\|\|selected!==currentConversation\|\|authEpoch!==sessionEpoch\)return/);
 assert.match(html, /if\(operatorAccessRole!=='owner'\|\|selected!==currentConversation\|\|authEpoch!==sessionEpoch\)return;send\.disabled=true;try/);
});

test('WhatsApp send confirmation cannot repaint another chat after asynchronous refresh', () => {
 assert.match(html, /if\(selected===currentConversation&&authEpoch===sessionEpoch\)\{await openChat\(currentConversation\);if\(selected===currentConversation&&authEpoch===sessionEpoch\)status\(result\.sent\?/);
});

test('internal notes block duplicate submissions and viewer form bypass', () => {
 assert.match(html,/\$\('draftForm'\)\.onsubmit=async e=>\{e\.preventDefault\(\);if\(!selected\|\|operatorAccessRole==='viewer'\|\|\$\('saveDraft'\)\.disabled\)return/);
 assert.match(html,/const saveButton=\$\('saveDraft'\);saveButton\.disabled=true;try\{await api\('\/api\/messages'/);
 assert.match(html,/finally\{if\(selected===targetConversation&&authEpoch===epoch\)saveButton\.disabled=operatorAccessRole==='viewer'\}/);
});

test('Gemini suggestion rejects viewer or disabled control and rechecks session after prompt', () => {
 assert.ok(html.includes("$('suggestReply').onclick=async()=>{if(!selected||operatorAccessRole==='viewer'||$('suggestReply').disabled)return"));
 assert.ok(html.includes("selected!==targetConversation||authEpoch!==epoch||operatorAccessRole==='viewer'||$('suggestReply').disabled"));
});

test('takeover refuses viewer and stale confirmation state', () => {
 assert.ok(html.includes("$('takeover').onclick=async()=>{if(!selected||operatorAccessRole==='viewer'||$('takeover').disabled)return"));
 assert.ok(html.includes("if(selected!==targetConversation||authEpoch!==epoch||operatorAccessRole==='viewer'||button.disabled)return;button.disabled=true"));
});

test('webhook import protects against stale or duplicate actions', () => {
 assert.ok(html.includes('process.disabled=true'));
 assert.ok(html.includes("if(!current()||operatorAccessRole==='viewer'||process.disabled)return"));
});

test('webhook ignore action prevents duplicate and stale-session submissions', () => {
 assert.ok(html.includes("btn.onclick=async()=>{if(!current()||operatorAccessRole==='viewer'||btn.disabled)return"));
 assert.ok(html.includes("btn.disabled=true;try{await api('/api/webhooks/events/review'"));
 assert.ok(html.includes("finally{if(current())btn.disabled=operatorAccessRole==='viewer'"));
});
