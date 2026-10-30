import fs from 'node:fs';
const target=new URL('../control-room-worker.js',import.meta.url);
let s=fs.readFileSync(target,'utf8');
const changes=[
 ["const backupRequests=[],proposals = [], completedTools=new Map(),taskResults=[];",
  "const latestUserMessage=convo[convo.length-1].content.trim();const actionRequested=/\\b(?:create|build|develop|fix|repair|change|edit|update|upgrade|import|deploy|publish|upload|remove|delete|configure|implement|restore|transfer|add|make|prepare|propose|save)\\b/i.test(latestUserMessage);const continuation=/^(?:continue|proceed|carry on|go ahead)(?:[.! ]*)$/i.test(latestUserMessage)&&!!remembered&&/\\b(?:create|build|develop|fix|repair|change|edit|update|upgrade|import|deploy|publish|upload|remove|delete|configure|implement|restore|transfer|add|make|prepare|propose|save)\\b/i.test(String(remembered.task||''));const mayPropose=policy.mode==='work'&&(actionRequested||continuation);const backupRequests=[],proposals = [], completedTools=new Map(),taskResults=[];"],
 ["const res = await aiLoop(acct, system, convo, tools, async c => {",
  "const safeTools=mayPropose?tools:tools.filter(function(t){return !/^(?:propose_|create_|deploy_|delete_|remove_|import_|write_|update_|upload_|publish_|restore_|execute_)/.test(t.name);});const res = await aiLoop(acct, system, convo, safeTools, async c => {"],
 ["if (!tools.some(t => t.name === c.name)) fail('Tool is not available for your role', 403);",
  "if (!safeTools.some(t => t.name === c.name)) fail('Tool is not available for this request', 403);if(!mayPropose&&/^(?:propose_|create_|deploy_|delete_|remove_|import_|write_|update_|upload_|publish_|restore_|execute_)/.test(c.name))fail('No deployment, import or change was requested in your message.',403);"]
];
for(const [a,b] of changes){if(s.includes(b))continue;if(s.split(a).length!==2)throw Error('Unrecognized AI chat source anchor: '+a.slice(0,70));s=s.replace(a,b);}
if(!process.argv.includes('--check'))fs.writeFileSync(target,s);
console.log('AI conversation action safety '+(process.argv.includes('--check')?'verified':'installed'));
