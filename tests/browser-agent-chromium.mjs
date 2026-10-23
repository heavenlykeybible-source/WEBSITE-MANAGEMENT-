import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import https from 'node:https';import {execFileSync} from 'node:child_process';
import puppeteer from '@cloudflare/puppeteer/internal/puppeteer-core.js';import {chromium} from 'playwright';import {createDriver} from '../browser-agent/driver.js';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hk-browser-fixture-'));let browser,server;
try{
 const key=path.join(dir,'key.pem'),cert=path.join(dir,'cert.pem');execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=fixture.example.org'],{stdio:'ignore'});
 server=https.createServer({key:fs.readFileSync(key),cert:fs.readFileSync(cert)},(req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>Browser test fixture</title><form onsubmit="event.preventDefault();document.querySelector(\'output\').textContent=\'Submitted\'"><input name="displayName" placeholder="Display name"><input name="password" type="password"><select name="plan"><option value="free">Free</option><option value="basic">Basic</option></select><button>Submit signup</button></form><output></output>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 browser=await puppeteer.launch({executablePath:chromium.executablePath(),headless:true,args:['--no-sandbox','--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP fixture.example.org:443 127.0.0.1:'+port]});
 const endpoint=browser.wsEndpoint(),adapter={async launch(){const b=await puppeteer.connect({browserWSEndpoint:endpoint});b.sessionId=()=> 'fixture-session';return b;},async connect(){return this.launch();}};
 const run=createDriver(adapter,async h=>h==='fixture.example.org'),job={hosts:['fixture.example.org'],expires:Date.now()+120000};
 let state=await run({},job,{type:'navigate',url:'https://fixture.example.org/'});job.session=state.session;assert.ok(state.screenshot.length>1000);assert.equal(state.elements.length,4);
 const field=n=>state.elements.find(e=>e.label===n).id;
 await assert.rejects(run({},job,{type:'fill',element:field('Display name'),value:'Wrong',snapshot:'stale'}));
 state=await run({},job,{type:'fill',element:field('Display name'),value:'Emmanuel',snapshot:state.snapshot});assert.ok(!JSON.stringify(state.elements).includes('Emmanuel'));
 await assert.rejects(run({},job,{type:'fill',element:field('password'),value:'private-fixture-value',snapshot:state.snapshot}));
 state=await run({},job,{type:'fill',element:field('password'),value:'private-fixture-value',snapshot:state.snapshot,ownerInput:true});assert.ok(!JSON.stringify(state.elements).includes('private-fixture-value'));
 state=await run({},job,{type:'select',element:field('plan'),value:'basic',snapshot:state.snapshot});
 state=await run({},job,{type:'click',element:field('Submit signup'),snapshot:state.snapshot});
 const [page]=await browser.pages();assert.equal(await page.$eval('output',e=>e.textContent),'Submitted');assert.equal(await page.$eval('[name=displayName]',e=>e.value),'Emmanuel');assert.equal(await page.$eval('select',e=>e.value),'basic');
 await assert.rejects(run({},job,{type:'navigate',url:'https://unapproved.example.org/'}));
 assert.equal((await run({},job,{type:'close'})).closed,true);browser=null;
 console.log('PASS real Chromium: navigate, screenshot, stale observation denial, form filling, secret handoff, selection, signup submission, host restriction and close');
}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
