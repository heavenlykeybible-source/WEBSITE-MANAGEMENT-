// Local end-to-end audit of the actual bundle. SQLite and transport adapters are test-only.
// Real browsers use fake camera/microphone devices; no production data or external accounts.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {DatabaseSync}=require('node:sqlite');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {WebSocketServer}=require('ws');
(async()=>{
 const root=path.resolve(__dirname,'..'),raw=new DatabaseSync(':memory:');
 raw.exec(fs.readFileSync(path.join(root,'server/schema.sql'),'utf8'));
 const secret='local-browser-fixture-secret-'.repeat(2),password='LocalFixture123!';
 raw.exec(execFileSync(process.execPath,[path.join(root,'server/setup-accounts.mjs')],{env:{...process.env,AUTH_SECRET:secret,STUDIO_INITIAL_PASSWORD:password},encoding:'utf8'}));
 const DB={async exec(sql){raw.exec(sql);return{}},prepare(sql){const make=args=>({bind:(...a)=>make(a),first:async()=>raw.prepare(sql).get(...args)||null,all:async()=>({results:raw.prepare(sql).all(...args)}),run:async()=>{const r=raw.prepare(sql).run(...args);return{meta:{changes:Number(r.changes)}}}});return make([])},async batch(st){const out=[];for(const s of st)out.push(await s.run());return out}};
 execFileSync(process.execPath,[path.join(root,'scripts/bundle-control-room.mjs')]);
 const {default:app,MeetingRooms}=await import('file://'+path.join(root,'build/meeting-worker.mjs'));
 const env={TEAMDB:DB,AUTH_SECRET:secret,MEETINGSPACE_PRIVATE_PREVIEW:'1',MEETING_ROOMS:{idFromName:x=>x,get:()=>({})}};
 const errors=[],checks=[],rooms=new Map();let browser,server,origin,broadcastBehavior='ready',broadcastStarts=0;
 const socketServer=new WebSocketServer({noServer:true});
 const check=async(name,task)=>{await task();checks.push(name);console.log('PASS browser:',name)};
 try{
  server=http.createServer(async(req,res)=>{try{
   const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);
   const response=await app.fetch(new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,...(body.length?{body}:{})}),env,{});
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){errors.push(String(e));res.writeHead(500);res.end('Fixture server error')}});
  // Exercise the unchanged MeetingRooms admission/signalling class over real Node WebSockets.
  // The adapter emulates attachment persistence; Cloudflare upgrade/hibernation are unit-tested separately.
  server.on('upgrade',(req,socket,head)=>{
   if(req.url==='/broadcast'&&req.headers.origin===origin){socketServer.handleUpgrade(req,socket,head,ws=>{ws.on('message',(data,binary)=>{if(binary){if(broadcastBehavior==='ready')ws.send(JSON.stringify({type:'broadcast-progress',frames:30,destinations:1}));return}const message=JSON.parse(data);if(message.type==='stop'){ws.close();return}if(message.type==='start'){broadcastStarts++;if(broadcastBehavior==='deny'){ws.send(JSON.stringify({type:'relay-error',message:'Fixture rejected this destination.',retryable:false}));ws.close()}else if(broadcastBehavior==='ready')ws.send(JSON.stringify({type:'relay-ready',destinations:1}))}})});return}
   const m=req.url.match(/^\/meeting\/([a-f0-9-]{36})\/room$/i);
   if(!m||req.headers.origin!==origin){socket.destroy();return}
   if(!rooms.has(m[1])){const sockets=[];const state={getWebSockets:()=>sockets,storage:{setAlarm:async()=>{}}};rooms.set(m[1],{room:new MeetingRooms(state,env),sockets});}
   const {room,sockets}=rooms.get(m[1]);socketServer.handleUpgrade(req,socket,head,ws=>{
    let attachment={role:'',room:m[1],until:Date.now()+15000};
    ws.serializeAttachment=d=>attachment=structuredClone(d);ws.deserializeAttachment=()=>structuredClone(attachment);sockets.push(ws);
    ws.on('message',(data,binary)=>room.webSocketMessage(ws,binary?data:data.toString()).catch(e=>errors.push(String(e))));
    ws.on('close',()=>room.webSocketClose(ws));ws.on('error',()=>room.webSocketError(ws));
   });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--allow-loopback-in-peer-connection','--disable-features=WebRtcHideLocalIpsWithMdns','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
  const context=await browser.newContext({permissions:['camera','microphone'],viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>{
   const NativeWebSocket=window.WebSocket;
   window.WebSocket=class extends NativeWebSocket{constructor(url,...args){super(String(url).replace(/^wss:\/\/127\.0\.0\.1:/,'ws://127.0.0.1:'),...args)}};
   window.fixtureMediaRequests=0;const media=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   navigator.mediaDevices.getUserMedia=(...args)=>{window.fixtureMediaRequests++;return media(...args)};
  });
  await context.route(/https?:\/\/(?!127\.0\.0\.1:)/,route=>route.abort());
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push('host: '+e.message));
  const tab=async i=>{await page.locator('[data-t="'+i+'"]').click();assert.equal(await page.locator('main section.a').count(),1)};
  const login=async()=>{await tab(8);await page.locator('#aem').fill('owner');await page.locator('#apw').fill(password);await page.locator('#ali').click();await page.waitForFunction(()=>document.querySelector('#acs').textContent.includes('owner (owner)')).catch(async e=>{console.error('Login feedback:',await page.locator('#acm').innerText(),errors);throw e})};
  await page.goto(origin);
  await check('all public images/icons/styles and install manifest load from the bundle',async()=>{
   await page.waitForFunction(()=>[...document.images].every(i=>i.complete));
   assert.equal(await page.locator('img').evaluateAll(images=>images.every(i=>i.naturalWidth>0)),true);
   const manifest=await(await context.request.get(origin+'/manifest.webmanifest')).json();
   for(const icon of manifest.icons){const response=await context.request.get(new URL(icon.src,origin).href);assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/image\/png/);assert.ok((await response.body()).length>100)}
   assert.match((await context.request.get(origin+'/studio-theme.css')).headers()['content-type'],/text\/css/);
   assert.equal(await page.locator('#asu').isVisible(),false);
  });
  await check('owner login, every navigation tab, and visible controls have accessible names',async()=>{
   await login();await page.locator('#mdb').click();for(let i=0;i<13;i++)await tab(i);
   const unnamed=await page.locator('button').evaluateAll(buttons=>buttons.filter(b=>!b.hidden&&b.getClientRects().length&&!((b.getAttribute('aria-label')||b.textContent||b.title||'').trim())).map(b=>b.id));assert.deepEqual(unnamed,[]);
  });
  await check('title/ticker editing includes clearing; scenes and source icons work',async()=>{
   await tab(0);await page.locator('#qtt').fill('Audit title');await page.locator('#qtk').fill('Audit ticker');await page.locator('#qtt').fill('');
   assert.equal(await page.evaluate(()=>S.find(s=>s.type==='text').text),'');
   await tab(1);await page.locator('[data-a="sadd"]').click();assert.equal(await page.locator('#sl li').count(),2);
   page.once('dialog',d=>d.accept('Audit scene'));await page.locator('#sl [data-a="sren"]').last().click();assert.match(await page.locator('#sl').innerText(),/Audit scene/);
   await page.locator('#sl [data-a="sdel"]').last().click();assert.equal(await page.locator('#sl li').count(),1);
   await tab(2);await page.locator('[data-a="atxt"]').click();await page.locator('[data-a="aticker"]').click();await page.locator('[data-a="ach"]').click();
   await tab(1);const count=await page.locator('#il li').count();await page.locator('#il [data-a="ivis"]').last().click();assert.equal(await page.locator('#il [data-a="ivis"]').last().innerText(),'Show');await page.locator('#il [data-a="ivis"]').last().click();await page.locator('#il [data-a="irm"]').last().click();assert.equal(await page.locator('#il li').count(),count-1);
  });
  await check('camera/microphone sources, mixer mute and removal release tracks',async()=>{
   await tab(2);await page.locator('#nrs').uncheck();await page.locator('[data-a="acam"]').click();await page.waitForFunction(()=>S.some(s=>s.type==='camera'));
   await page.evaluate(()=>AC.suspend());await page.locator('[data-a="amic"]').click();await page.waitForFunction(()=>S.some(s=>s.type==='mic'));assert.equal(await page.evaluate(()=>AC.state),'running');
   await tab(3);await page.locator('#ml [data-a="mute"]').first().click();assert.equal(await page.locator('#ml [data-a="mute"]').first().innerText(),'Unmute');await page.locator('#ml [data-a="mute"]').first().click();
   await tab(2);await page.evaluate(()=>window.fixtureTrack=S.find(s=>s.type==='mic').st.getTracks()[0]);await page.locator('#ul li').filter({hasText:'Microphone'}).getByRole('button',{name:'Delete',exact:true}).click();assert.equal(await page.evaluate(()=>window.fixtureTrack.readyState),'ended');
  });
  await check('image uploads, orientation, drawing, snapshots and recording export',async()=>{
   await tab(2);await page.locator('#fi').setInputFiles(path.join(root,'site/bg/th-gold-stage.jpg'));await page.waitForFunction(()=>S.some(s=>s.type==='image'&&s.img?.complete));
   await tab(0);await page.locator('#ori').selectOption('p');assert.equal(await page.locator('#cv').getAttribute('width'),'720');await page.locator('#ori').selectOption('l');
   await page.locator('#dw').check();await page.locator('#cv').scrollIntoViewIfNeeded();const box=await page.locator('#cv').boundingBox();await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();await page.mouse.move(box.x+60,box.y+60);await page.mouse.up();await page.locator('#dcl').click();await page.locator('#dw').uncheck();
   await tab(6);await page.locator('#pnow').click();await page.waitForFunction(()=>document.querySelector('#pl img')?.complete);assert.ok(await page.locator('#pl img').count());
   const photo=page.waitForEvent('download');await page.locator('#pall').click();assert.match((await photo).suggestedFilename(),/\.jpg$/);
   await tab(4);await page.locator('#rc').click();await page.waitForTimeout(1200);const recording=page.waitForEvent('download');await page.evaluate(()=>{document.querySelector('#rc').click();document.querySelector('#rc').click()});const file=await recording;assert.ok(fs.statSync(await file.path()).size>100);assert.match(file.suggestedFilename(),/\.(webm|mp4)$/);
  });
  await check('unconfigured broadcast and AI services explain their failure',async()=>{
   await tab(4);await page.locator('#gl').click();await page.waitForFunction(()=>document.querySelector('#info').textContent.length>0);assert.equal(await page.locator('#st').innerText(),'Offline');
   await tab(7);await page.locator('#aitp').fill('Prayer meeting');await page.locator('[data-a="ai"][data-m="title"]').click();await page.waitForFunction(()=>document.querySelector('#aio').value!=='Writing...');assert.equal(await page.locator('#aio').inputValue(),'');assert.ok((await page.locator('#ast').innerText()).length>0);
  });
  await check('broadcast waits for relay acceptance, confirms encoding and stops terminal errors',async()=>{
   await tab(4);await page.route('**/api/relay-token',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({url:origin.replace('http:','wss:')+'/broadcast',token:'fixture'})}));
   await page.locator('[data-a="dadd"]').click();await page.locator('#dl input[type=password]').fill('fixture-key');
   broadcastBehavior='hold';let count=broadcastStarts;await page.locator('#gl').click();await page.waitForFunction(()=>document.querySelector('#st').textContent==='Waiting for streaming server');assert.notEqual(await page.locator('#st').innerText(),'Broadcasting');await page.locator('#gl').click();assert.equal(await page.locator('#st').innerText(),'Offline');
   broadcastBehavior='ready';await page.locator('#gl').click();await page.waitForFunction(()=>document.querySelector('#st').textContent==='Broadcasting');await page.locator('#gl').click();assert.equal(await page.locator('#st').innerText(),'Offline');
   broadcastBehavior='deny';await page.locator('#gl').click();await page.waitForFunction(()=>!want&&document.querySelector('#info').textContent==='Fixture rejected this destination.');assert.equal(await page.locator('#gl').innerText(),'Go live');
   await page.unroute('**/api/relay-token');await page.locator('#dl button').click();
  });
  await check('account refresh preserves sign-in on a transient network failure',async()=>{
   const before=await page.evaluate(()=>localStorage.getItem('ls_tok'));await page.route('**/api/me',r=>r.abort());await page.evaluate(()=>refreshMe());assert.equal(await page.evaluate(()=>localStorage.getItem('ls_tok')),before);await page.unroute('**/api/me');
  });
  await check('groups create/send work and failed sends retain the draft',async()=>{
   await tab(11);await page.locator('#tnm').fill('Browser audit team');await page.locator('#tcr').click();await page.waitForFunction(()=>document.querySelector('#tbody').hidden===false);
   await page.locator('#tct').fill('Keep this draft');await page.route('**/api/team/send',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary test outage'})}));await page.locator('#tcs').click();await page.waitForFunction(()=>!document.querySelector('#tcs').disabled);assert.equal(await page.locator('#tct').inputValue(),'Keep this draft');await page.unroute('**/api/team/send');
   await page.locator('#tcs').click();await page.waitForFunction(()=>document.querySelector('#tcl').textContent.includes('Keep this draft'));assert.equal(await page.locator('#tct').inputValue(),'');
  });
  await check('program save/share/edit and failed deletion feedback',async()=>{
   await tab(12);await page.locator('#ptt').fill('Audit prayer program');await page.locator('#pds').fill('Local fixture only');await page.locator('#psv').click();await page.waitForFunction(()=>document.querySelector('#ppl').textContent.includes('Audit prayer program'));
   await page.locator('#ppl [data-a="psel"]').first().click();const url=await page.locator('#psu').innerText();assert.equal((await context.request.get(url)).status(),200);
   await page.route('**/api/program/delete',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Deletion unavailable"}'}));page.once('dialog',d=>d.accept());await page.locator('#ppl [data-a="pdl"]').first().click();await page.waitForFunction(()=>document.querySelector('#pms').textContent==='Deletion unavailable');assert.equal(await page.locator('#psh').isVisible(),true);await page.unroute('**/api/program/delete');
  });
  let guest,audience;
  await check('host starts a real local room; guest consent and admission establish peer media',async()=>{
   await tab(10);await page.locator('#grs').click();await page.waitForFunction(()=>!document.querySelector('#gin').hidden);
   const invite=await page.evaluate(()=>glink);guest=await context.newPage();guest.setDefaultTimeout(15000);guest.on('pageerror',e=>errors.push('guest: '+e.message));await guest.goto(invite);
   await guest.locator('#nr').uncheck();await guest.locator('#go').click();assert.match(await guest.locator('#pm').innerText(),/name/);await guest.locator('#nm').fill('Browser guest');await guest.locator('#go').click();assert.match(await guest.locator('#pm').innerText(),/tick/);await guest.locator('#ok').check();await guest.locator('#go').click();
   await page.locator('#gwl [data-a="gad"]').first().click();await guest.waitForFunction(()=>!document.querySelector('#live').hidden);
   await guest.waitForFunction(()=>pc&&pc.connectionState==='connected',null,{timeout:20000}).catch(async e=>{console.error('Peer debug',await guest.evaluate(()=>({pc:pc&&{ice:pc.iceConnectionState,state:pc.connectionState,sig:pc.signalingState,local:!!pc.localDescription,remote:!!pc.remoteDescription,gathering:pc.iceGatheringState,media:pc.localDescription?.sdp.split('\r\n').filter(l=>l.startsWith('m='))},message:document.querySelector('#dm').textContent,localTracks:local&&local.getTracks().map(t=>t.kind+':'+t.readyState)})),await page.evaluate(()=>({status:document.querySelector('#gst').textContent,guests:[...guests.values()].map(g=>({connection:g.connection,pc:g.pc&&{ice:g.pc.iceConnectionState,state:g.pc.connectionState,sig:g.pc.signalingState,local:!!g.pc.localDescription,remote:!!g.pc.remoteDescription}}))})),errors);throw e});await page.waitForFunction(()=>[...guests.values()].some(g=>g.pc?.connectionState==='connected'));
   await guest.locator('#mic').click();assert.equal(await guest.locator('#mic').innerText(),'Unmute');await guest.locator('#mic').click();await guest.locator('#cam').click();assert.equal(await guest.locator('#cam').innerText(),'Camera on');await guest.locator('#cam').click();
   await page.locator('#gct').fill('Host room message');await page.locator('#gcs').click();await guest.waitForFunction(()=>document.querySelector('#cl').textContent.includes('Host room message'));
  });
  await check('peer media carries frames; screen-track replacement and moderation preserve guest control',async()=>{
   await guest.waitForFunction(()=>document.querySelector('#rv').videoWidth>0);await page.waitForFunction(()=>[...guests.values()].some(g=>g.src?.el.videoWidth>0));
   await guest.evaluate(()=>{navigator.mediaDevices.getDisplayMedia=async()=>new MediaStream([local.getVideoTracks()[0].clone()])});await guest.locator('#shr').click();await guest.waitForFunction(()=>sharing);await guest.evaluate(()=>window.fixtureCapture=shareTrack);await guest.locator('#shr').click();await guest.waitForFunction(()=>!sharing);assert.equal(await guest.evaluate(()=>window.fixtureCapture.readyState),'ended');assert.equal(await guest.evaluate(()=>vsender().track===local.getVideoTracks()[0]),true);
   await page.locator('#gli [data-a="gmute"]').first().click();await guest.waitForFunction(()=>local.getAudioTracks().every(t=>!t.enabled));await page.locator('#gli [data-a="gmute"]').first().click();await guest.waitForFunction(()=>document.querySelector('#nt').textContent.includes('invited you to unmute'));assert.equal(await guest.evaluate(()=>local.getAudioTracks().some(t=>t.enabled)),false);await guest.locator('#mic').click();
   await guest.getByRole('button',{name:'Clap',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#gcl').textContent.includes('👏'));
  });
  await check('audience joins without media access, can raise a hand and receive an invitation',async()=>{
   audience=await context.newPage();audience.setDefaultTimeout(12000);audience.on('pageerror',e=>errors.push('audience: '+e.message));await audience.goto(await page.evaluate(()=>alink));await audience.locator('#nm').fill('Browser audience');await audience.locator('#ok').check();await audience.locator('#go').click();await audience.waitForFunction(()=>!document.querySelector('#live').hidden);
   assert.equal(await audience.evaluate(()=>window.fixtureMediaRequests),0);await audience.locator('#hand').click();await page.locator('#ghl [data-a="gprom"]').first().click();await audience.waitForFunction(()=>!document.querySelector('#invrow').hidden);
  });
  await check('audience promotion/demotion and room locking work through their controls',async()=>{
   await audience.locator('#inv').click();await page.waitForFunction(()=>guests.size===2);await audience.waitForFunction(()=>pc?.connectionState==='connected');
   await page.locator('#gli li').filter({hasText:'Browser audience'}).locator('[data-a="gdem"]').click();await audience.waitForFunction(()=>!onStage&&local===null);
   await page.locator('#glk').check();const locked=await context.newPage();await locked.goto(await page.evaluate(()=>alink));await locked.locator('#nm').fill('Locked visitor');await locked.locator('#ok').check();await locked.locator('#go').click();await locked.waitForFunction(()=>!document.querySelector('#done').hidden);assert.match(await locked.locator('#dm').innerText(),/locked/);await locked.close();await page.locator('#glk').uncheck();
  });
  await check('all app tabs fit desktop, tablet and mobile widths; guest controls fit mobile',async()=>{
   for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});for(let i=0;i<13;i++){await tab(i);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'overflow at '+width+' tab '+i)}}
   await guest.setViewportSize({width:390,height:844});assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
   const out=process.env.MEETING_AUDIT_OUTPUT||path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'meeting-mobile.png'),fullPage:true});
  });
  await check('failed sign-out-all never claims other devices were signed out',async()=>{
   await tab(8);const token=await page.evaluate(()=>localStorage.getItem('ls_tok'));await page.route('**/api/logout-all',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Sign-out temporarily unavailable"}'}));await page.locator('#aloa').click();await page.waitForFunction(()=>document.querySelector('#acm').textContent==='Sign-out temporarily unavailable');assert.equal(await page.evaluate(()=>localStorage.getItem('ls_tok')),token);await page.unroute('**/api/logout-all');
  });
  await check('logout closes host room, clears private group/program state and stops guest media',async()=>{
   let release,started;const gate=new Promise(resolve=>release=resolve),pending=new Promise(resolve=>started=resolve);await page.route('**/api/team/messages?*',async route=>{started();await gate;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({m:[{k:'msg',n:'Old session',t:'Late private message',ts:Date.now()}],last:1})})});await tab(11);await page.evaluate(()=>{window.fixtureLatePoll=tmPoll()});await pending;await tab(8);await page.locator('#alo').click();release();await page.evaluate(()=>window.fixtureLatePoll);await page.unroute('**/api/team/messages?*');await guest.waitForFunction(()=>!document.querySelector('#done').hidden);assert.equal(await guest.evaluate(()=>local===null),true);assert.equal(await page.evaluate(()=>gws===null&&tm.cur===''&&prList.length===0&&conn.sel.size===0),true);assert.equal(await page.locator('#tcl').innerText(),'');
  });
  await check('malformed password-reset links show an error without crashing',async()=>{
   await page.goto(origin+'/?reset=invalid');await page.locator('#rpw').fill('NewPassword123!');await page.locator('#rsv').click();assert.match(await page.locator('#acm').innerText(),/invalid/);
  });
  await check('public registration controls follow the server setting and require consent',async()=>{
   env.MEETINGSPACE_PRIVATE_PREVIEW='0';const publicPage=await context.newPage();publicPage.on('pageerror',e=>errors.push('public: '+e.message));await publicPage.goto(origin);await publicPage.locator('#acb').click();await publicPage.waitForFunction(()=>!document.querySelector('#asu').hidden);await publicPage.locator('#aem').fill('audit-public@example.test');await publicPage.locator('#apw').fill('PublicFixture123!');await publicPage.locator('#asu').click();await publicPage.waitForFunction(()=>document.querySelector('#acm').textContent.includes('agree'));await publicPage.locator('#aag').check();await publicPage.locator('#asu').click();await publicPage.waitForFunction(()=>!document.querySelector('#acIn').hidden);await publicPage.close();env.MEETINGSPACE_PRIVATE_PREVIEW='1';
  });
  await check('unavailable account services leave sign-in reachable with useful feedback',async()=>{
   const unavailable=await context.newPage();unavailable.on('pageerror',e=>errors.push('unavailable: '+e.message));await unavailable.route('**/api/plans',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Account service temporarily unavailable"}'}));await unavailable.goto(origin);await unavailable.locator('#acb').click();await unavailable.waitForFunction(()=>document.querySelector('#acm').textContent==='Account service temporarily unavailable');assert.equal(await unavailable.locator('#ali').isVisible(),true);await unavailable.close();
  });
  await check('storage-disabled browsers can render account state',async()=>{
   await page.evaluate(()=>{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Storage disabled','SecurityError')}});acRender()});
  });
  assert.deepEqual(errors,[]);console.log(JSON.stringify({browserChecks:checks.length,checks,errors},null,2));
 }finally{if(browser)await browser.close();for(const client of socketServer.clients)client.terminate();socketServer.close();if(server)await new Promise(resolve=>server.close(resolve));raw.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
