import {spawnSync} from 'node:child_process';
const email=(process.env.OWNER_EMAIL??'').trim().toLowerCase();
if(!/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(email)||email.length>254)throw new Error('Provide the email of your registered website account.');
console.log('::add-mask::'+email);
function execute(sql){const r=spawnSync('npx',['--yes','wrangler@4.145.0','d1','execute','heavenlykey-db','--remote','--json','--command',sql],{encoding:'utf8',env:process.env,maxBuffer:1024*1024});if(r.status!==0)throw new Error('Administrator setup database command failed.');return JSON.parse(r.stdout)[0];}
const found=execute(`SELECT user_id FROM users WHERE email='${email}' AND status='active'`).results;
if(found.length!==1)throw new Error('Create your website account first. No active account matches that email.');
const id=Number(found[0].user_id);if(!Number.isSafeInteger(id))throw new Error('Invalid account id');
const updated=execute(`UPDATE users SET role_id=(SELECT role_id FROM roles WHERE role_name='Super Administrator') WHERE user_id=${id} AND NOT EXISTS(SELECT 1 FROM users JOIN roles ON roles.role_id=users.role_id WHERE roles.role_name='Super Administrator')`);
if(updated.meta.changes!==1)throw new Error('An owner administrator already exists. This one-time setup cannot grant another account owner access.');
console.log('Owner administrator activated. Sign in through the website admin dashboard.');
