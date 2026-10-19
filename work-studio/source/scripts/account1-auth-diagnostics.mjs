/** Read-only Account 1 owner and password-storage diagnostics. NEVER prints passwords or hashes. */
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const w=(args)=>{
 const p=spawnSync('npx',['--yes','wrangler@4.145.0',...args],{encoding:'utf8',env:process.env,maxBuffer:1_000_000});
 if(p.status!==0)throw Error('Account 1 read-only database/secret inspection failed: '+args.slice(0,2).join(' '));
 return p.stdout;
};
const secrets=JSON.parse(w(['secret','list','--format','json']));
const needed=['PASSWORD_PEPPER','SESSION_SECRET','ENCRYPTION_KEY'];
const missing=needed.filter(n=>!secrets.some(x=>x.name===n));
const report=JSON.parse(w(['d1','execute','heavenlykey-db','--remote','--json','--command',
"SELECT u.user_id, u.name, u.email, u.status, r.role_name, CASE WHEN a.user_id IS NULL THEN 0 ELSE 1 END AS has_login FROM users u JOIN roles r ON r.role_id=u.role_id LEFT JOIN auth a ON a.user_id=u.user_id WHERE r.role_name IN ('Super Administrator','Deputy Super Administrator','Administrator') ORDER BY CASE r.role_name WHEN 'Super Administrator' THEN 0 WHEN 'Deputy Super Administrator' THEN 1 ELSE 2 END, u.user_id LIMIT 30;"
]));
const entries=report?.[0]?.results||report?.results||[];
const owners=entries.filter(x=>x.role_name==='Super Administrator'&&x.status==='active');
const status=owners.length===1&&owners[0].has_login===1&&missing.length===0?'admin_account_ready':'owner_needs_review';
const userVisible={status,login_url:'https://heavenlykey.alldaywow247.workers.dev/pages/admin.html',username_type:'Registered email address (not Account 4 admin)',owner_accounts:owners.map(x=>({name:x.name,email:x.email,role:x.role_name,has_login:Boolean(x.has_login)})),other_admin_count:entries.length-owners.length,secret_bindings:{expected:needed,present:needed.filter(n=>!missing.includes(n)),missing}};
if(process.env.GITHUB_WORKSPACE){
 writeFileSync(process.env.GITHUB_WORKSPACE+'/Account1-Administrator-Identity.json',JSON.stringify(userVisible,null,2)+'\n',{mode:0o600});
}
console.log(JSON.stringify({diagnostic:status,active_owners:owners.length,other_administrators:entries.length-owners.length,missing_secret_names:missing,has_login:owners.length===1?Boolean(owners[0].has_login):null}));
if(missing.length)process.exitCode=1;
