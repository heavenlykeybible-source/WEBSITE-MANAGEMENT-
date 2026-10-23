import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const file=new URL('./permissions-browser-worker.mjs',import.meta.url);fs.writeFileSync(file,fs.readFileSync('control-room-worker.js','utf8')+'\nexport {UI};');
const {UI}=await import(file.href);let saved=null,decision=null;
const server=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{},path=new URL(req.url,'http://test').pathname;res.setHeader('content-type','application/json');let value={};
if(path==='/'){res.setHeader('content-type','text/html');res.end(UI);return;}
if(path.endsWith('/me'))value={user:{id:1,username:'owner',role:'owner',kind:'staff'}};
else if(path.endsWith('/summary'))value={waiting:0};
else if(path.endsWith('/ai/permissions')){if(req.method==='POST')saved=body;value={policy:{mode:'work',max_tools:12,connections:[],expires_at:0},connections:[{id:4,label:'Account 4 Control Room',account_id:'private-id'},{id:7,label:'Account 7 Radio',account_id:'private-id'}]};}
else if(path.endsWith('/passkeys'))value={credentials:[]};
else if(path.endsWith('/ai/history'))value={conversations:[]};
else if(path.endsWith('/ai/access-requests/decide')){decision=body;value={ok:true};}
else if(path.endsWith('/ai/access-requests'))value={requests:[{id:'12345678-1234-1234-1234-123456789012',reason:'Repair the Radio Worker',accounts:[{id:7,label:'Account 7 Radio'}],hours:24,conversation:''}]};
else if(path.endsWith('/ai'))value={enabled:true,accounts:[{id:'cloudflare',label:'Cloudflare AI',model:'test'},{id:2,label:'ChatGPT',model:'test'}]};
else if(path.endsWith('/connections'))value={connections:[{id:4,label:'Account 4 Control Room'},{id:7,label:'Account 7 Radio'}]};
else if(path.endsWith('/sites')||path.endsWith('/github')||path.endsWith('/remote'))value={sites:[]};
else if(path.endsWith('/proposals'))value={proposals:[]};res.end(JSON.stringify(value));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({args:['--no-sandbox']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof aiPermissions==='function');
for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.evaluate(()=>aiPermissions());await page.getByRole('heading',{name:'AI permissions and device verification',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow at '+width);assert.equal(await page.getByRole('checkbox',{name:'Account 7 Radio',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Register Face ID / passkey',exact:true}).count(),1);}
await page.getByRole('checkbox',{name:'Account 7 Radio',exact:true}).check();await page.getByRole('combobox',{name:'Account permission duration',exact:true}).selectOption('720');await page.getByRole('button',{name:'Save and verify permissions',exact:true}).click();await page.getByPlaceholder('Current password',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'Confirm with password',exact:true}).click();await page.waitForFunction(()=>document.body.textContent.includes('Saved. Selected account'));assert.deepEqual(saved.connections,[7]);assert.equal(saved.hours,720);
await page.evaluate(()=>claude());await page.getByRole('heading',{name:'AI requests your permission',exact:true}).waitFor();await page.getByRole('button',{name:'Decline',exact:true}).click();await page.getByText('Access declined. No permission granted.',{exact:true}).waitFor();assert.equal(decision.decision,'decline');assert.equal(decision.password,undefined);assert.deepEqual(errors,[]);console.log('PASS Chromium: responsive permission page at 320/390/768/1440px, 30-day exact-account save, password modal, in-chat access request and decline');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.unlinkSync(file);}
