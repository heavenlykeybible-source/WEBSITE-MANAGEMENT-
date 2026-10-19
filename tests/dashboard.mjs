// Runs the actual dashboard JavaScript against a minimal DOM and mocked HTTP.
// This checks interaction logic; it is not a browser rendering or sandbox test.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {UI} from './worker-test.mjs';
class Node {
 constructor(tag,text=''){this.tag=tag;this.text=text;this.children=[];this.attributes={};this.style={};this.listeners={};this.value='';this.checked=false;this.disabled=false}
 appendChild(n){if(!(n instanceof Node))throw Error('Invalid DOM child');if(n.parent)n.remove();this.children.push(n);n.parent=this;return n}
 setAttribute(k,v){this.attributes[k]=String(v);if(k==='value')this.value=String(v);if(k==='type')this.type=String(v);if(k==='id')this.id=String(v)}
 addEventListener(k,fn){this.listeners[k]=fn}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null}
 showModal(){this.open=true} close(){this.open=false} focus(){}
 set innerHTML(v){this.children=[];this.text=String(v)} get innerHTML(){return this.textContent}
 set textContent(v){this.children=[];this.text=String(v)} get textContent(){return this.text+this.children.map(c=>c.textContent).join('')}
}
const body=new Node('body'),app=new Node('main');app.id='app';body.appendChild(app);
function find(root,predicate){if(predicate(root))return root;for(const c of root.children){const n=find(c,predicate);if(n)return n}return null}
const document={body,createElement:t=>new Node(t),createTextNode:t=>new Node('#text',String(t)),getElementById:id=>find(body,n=>n.id===id)};
let publications=0,restores=0,lastLogin=null,addedUser=null;const alerts=[];let chatSent=null;
const fetch=async(input,init={})=>{
 const url=new URL(input,'https://room.test'),p=url.pathname;let data;
 if(p==='/api/owner/users'){if(init.method==='POST'){addedUser=JSON.parse(init.body);data={ok:true,status:'active',username:addedUser.username}}else data={users:[{id:1,username:'owner',role:'owner',status:'active',kind:'staff',has_password:true}]};}
 else if(p==='/api/owner/ai'){if(init.method==='POST'){chatSent=JSON.parse(init.body);data={reply:'Submitted to Waiting.',proposals:[3],account:'Cloudflare AI'}}else data={enabled:true,accounts:[{id:'cloudflare',label:'Cloudflare AI',model:'test-model'}]};}
 else if(p==='/api/owner/sites')data={sites:[{slug:'demo',name:'Demo',files:0}]};
 else if(p==='/api/owner/github'||p==='/api/owner/remote')data={sites:[]};
 else if(p==='/api/owner/attachments'){if(init.method==='PUT')data={attachment:{id:'11111111-1111-4111-8111-111111111111',name:'example.html',size:18,kind:'text'}};else data={ok:true};}
 else if(p==='/api/public/info')data={signup:false};
 else if(p==='/api/login'){lastLogin=JSON.parse(init.body);data={ok:true}}
 else if(p==='/api/owner/me')data={user:{id:1,role:'owner',kind:'staff',username:'owner'}};
 else if(p==='/api/owner/summary')data={waiting:1};
 else if(p==='/api/owner/proposals')data={proposals:[{id:1,title:'Update',kind:'page',status:'waiting',agent:'AI'}]};
 else if(p==='/api/owner/proposals/1'||p==='/api/owner/proposals/2')data={proposal:{id:p.endsWith('/2')?2:1,title:p.endsWith('/2')?'Recovery':'Update',kind:'page',status:'waiting',agent:'AI'},before:[],after:[{type:'text',text:'Reviewed wording'}]};
 else if(p.endsWith('/stage'))data={candidate_hash:'a'.repeat(64),review_token:'version-token',expires_at:Date.now()+100000,checks:['Valid payload'],warnings:['Structural checks only'],before:{content_json:'[]'}};
 else if(p.endsWith('/decide')){const b=JSON.parse(init.body);assert.equal(b.reviewed,true);assert.equal(b.password,'confirm-password');assert.equal(b.review_token,'version-token');publications++;data={ok:true}}
 else if(p==='/api/owner/releases')data={releases:[{id:'11111111-1111-4111-8111-111111111111',title:'Release',kind:'page',status:'succeeded',created_at:'2026-10-18',candidate_hash:'a'.repeat(64),recoverable:true}]};
 else if(p==='/api/owner/locks')data={locks:[]};
 else if(p.endsWith('/restore')){assert.equal(JSON.parse(init.body).password,'confirm-password');restores++;data={proposal_id:2}}
 else throw Error('Unexpected dashboard request: '+p);
 return Response.json(data);
};
const context={document,fetch,URL,URLSearchParams,TextEncoder,Blob,Date,JSON,location:{origin:'https://room.test',search:''},history:{replaceState(){}},window:{},alert:t=>alerts.push(t),confirm:()=>true,setInterval:()=>0,setTimeout,clearTimeout,console};
vm.createContext(context);vm.runInContext(UI.match(/<script>([\s\S]*?)<\/script>/)[1],context);
async function flush(){for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r))}
await flush();await context.openP(1);
const button=text=>find(body,n=>n.tag==='button'&&n.textContent===text);
button('Approve this version').onclick();await flush();assert.equal(publications,0);assert.match(alerts.at(-1),/tick the confirmation/);
find(body,n=>n.tag==='input'&&n.type==='checkbox').checked=true;
find(body,n=>n.attributes.placeholder==='Your current password to approve').value='confirm-password';
button('Approve this version').onclick();await flush();assert.equal(publications,1);
await context.releaseHistory();button('Prepare recovery proposal').onclick();await flush();
const dialog=find(body,n=>n.tag==='dialog');assert.equal(dialog.open,true);assert.equal(find(dialog,n=>n.tag==='input').type,'password');find(dialog,n=>n.tag==='input').value='confirm-password';find(dialog,n=>n.tag==='button'&&n.textContent==='Confirm').onclick();await flush();assert.equal(restores,1);assert.equal(find(body,n=>n.tag==='h3'&&n.textContent==='Recovery')?.textContent,'Recovery');
console.log('PASS dashboard interaction flow: staged review, acknowledgement, masked password, approval, release history and recovery proposal (mock DOM)');

context.login();assert.equal(document.getElementById('login-user').value,'owner');button('Admin').onclick();assert.equal(document.getElementById('login-user').value,'admin');const password=document.getElementById('login-password');password.value='simplelowercase2468';button('Show password').onclick();assert.equal(password.type,'text');assert.equal(password.value,'simplelowercase2468');button('Hide password').onclick();assert.equal(password.type,'password');const form=find(body,n=>n.tag==='form');let prevented=false;await form.onsubmit({preventDefault(){prevented=true}});await flush();assert.equal(prevented,true);assert.equal(lastLogin.user,'admin');assert.equal(lastLogin.pass,'simplelowercase2468');
console.log('PASS simple login controls: Owner/Admin shortcuts, Show/Hide password and form submission');

await context.users();find(body,n=>n.attributes.placeholder==='Username (letters, numbers)').value='helper';find(body,n=>n.attributes.placeholder==='Initial password (optional)').value='helperpassword2468';find(body,n=>n.tag==='select').value='editor';button('Add user').onclick();await flush();assert.equal(addedUser.username,'helper');assert.equal(addedUser.password,'helperpassword2468');assert.equal(addedUser.role,'editor');assert.ok(body.textContent.includes('User added. They can sign in'));assert.equal(find(body,n=>n.attributes.placeholder==='Initial password (optional)').value,'');console.log('PASS Team Add user accepts a password and confirms the new login is ready');

assert.match(context.lagosTime('2026-10-18 23:30:00'),/19 Oct 2026, 12:30 am WAT/);
assert.equal(context.lagosTime('2026-10-18 23:30:00'),context.lagosTime('2026-10-18T23:30:00Z'));
assert.equal(context.lagosTime(null),'Not recorded');
await context.waiting();const queueRow=find(body,n=>n.tag==='details'&&n.className==='queue-row');assert.ok(queueRow);assert.ok(body.textContent.includes('Review version'));assert.ok(body.textContent.includes('P-1'));const beforePreview=publications;queueRow.open=true;await queueRow.listeners.toggle();assert.ok(body.textContent.includes('General preview'));assert.equal(publications,beforePreview);
console.log('PASS expandable queue rows load previews without publishing and format timestamps in Lagos time');

await context.claude();const fileInput=find(body,n=>n.tag==='input'&&n.attributes.type==='file');assert.ok(fileInput);fileInput.files=[{name:'example.html',size:18}];await fileInput.onchange();assert.equal(context.CHAT_FILES.length,1);assert.ok(body.textContent.includes('example.html'));const destination=find(body,n=>n.tag==='select'&&n.attributes['aria-label']==='Attachment destination');destination.value='static:demo';find(body,n=>n.tag==='textarea').value='Send this file unchanged for approval.';button('Send').onclick();await flush();assert.equal(chatSent.attachments.length,1);assert.equal(chatSent.attachments[0],context.CHAT_FILES[0].id);assert.match(chatSent.messages.at(-1).content,/static:demo/);assert.ok(body.textContent.includes('Sent to Waiting'));await button('Clear private uploads').onclick();assert.equal(context.CHAT_FILES.length,0);console.log('PASS assistant attachment picker uploads privately, sends selected IDs/destination and clears originals');
