// Real FFmpeg -> WebSocket -> relay -> two local RTMP receivers.
// Only DNS and the final RTMP hostname are adapted to disposable local receivers.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {spawn,spawnSync}=require('node:child_process');
const {WebSocket}=require('ws');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const port=()=>new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
const until=async(test,message,ms=20000)=>{const end=Date.now()+ms;while(Date.now()<end){if(test())return;await delay(100)}throw Error(message)};
const exit=p=>(p.exitCode!==null||p.signalCode!==null)?Promise.resolve(p.exitCode):new Promise(r=>p.once('exit',r));
const connect=url=>new Promise((resolve,reject)=>{const ws=new WebSocket(url,{origin:'https://meeting.test'});ws.once('open',()=>resolve(ws));ws.once('error',reject)});
test('relay authenticates, accepts ingest, encodes to two RTMP destinations and stops', {timeout:70000},async()=>{
 assert.equal(spawnSync('ffmpeg',['-version'],{stdio:'ignore'}).status,0,'Install FFmpeg to run relay integration');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meeting-relay-')),procs=[];let ws,relay,input;const logs=[];
 try{
  const [relayPort,p1,p2]=await Promise.all([port(),port(),port()]);
  const preload=path.join(dir,'network-fixture.cjs');
  fs.writeFileSync(preload,`const cp=require('node:child_process'),dns=require('node:dns').promises;const original=cp.spawn;cp.spawn=function(file,args,opts){return original(file,file==='ffmpeg'?args.map(x=>String(x).replaceAll('broadcast.fixture','127.0.0.1')):args,opts)};dns.lookup=async hostname=>{if(hostname!=='broadcast.fixture')throw Error('Unexpected test hostname');return [{address:'203.0.113.10',family:4}]};`);
  const outputs=[path.join(dir,'one.flv'),path.join(dir,'two.flv')];
  for(const [i,p]of[p1,p2].entries()){
   const receiver=spawn('ffmpeg',['-loglevel','error','-listen','1','-i','rtmp://127.0.0.1:'+p+'/live/fixture-key','-c','copy','-y',outputs[i]],{stdio:['ignore','ignore','pipe']});procs.push(receiver);receiver.stderr.on('data',()=>{});
  }
  await delay(300);
  relay=spawn(process.execPath,['--require',preload,path.resolve(__dirname,'../server/relay.js')],{env:{...process.env,PORT:String(relayPort),HOST:'127.0.0.1',TOKEN:'fixture-broadcast-password',ALLOWED_ORIGIN:'https://meeting.test',MAX_SESSIONS:'1'},stdio:['ignore','pipe','pipe']});procs.push(relay);
  relay.stdout.on('data',d=>logs.push(d.toString()));relay.stderr.on('data',d=>logs.push(d.toString()));
  await until(()=>logs.join('').includes('Relay listening'),'Relay failed to start');
  const health=await fetch('http://127.0.0.1:'+relayPort+'/healthz');assert.equal(health.status,200);assert.deepEqual(await health.json(),{ok:true,ffmpeg:true});
  const bad=await connect('ws://127.0.0.1:'+relayPort);const rejected=new Promise(resolve=>bad.once('message',m=>resolve(JSON.parse(m))));bad.send(JSON.stringify({type:'start',token:'wrong',dests:[]}));assert.equal((await rejected).type,'relay-error');bad.close();
  const invalid=await connect('ws://127.0.0.1:'+relayPort);const invalidReply=new Promise(resolve=>invalid.once('message',m=>resolve(JSON.parse(m))));invalid.send(JSON.stringify({type:'start',token:'fixture-broadcast-password',dests:['rtmp://broadcast.fixture:99999/live/key']}));assert.equal((await invalidReply).type,'relay-error');invalid.close();
  ws=await connect('ws://127.0.0.1:'+relayPort);const messages=[];ws.on('message',m=>messages.push(JSON.parse(m)));
  ws.send(JSON.stringify({type:'start',token:'fixture-broadcast-password',size:'landscape',dests:['rtmp://broadcast.fixture:'+p1+'/live/fixture-key','rtmp://broadcast.fixture:'+p2+'/live/fixture-key']}));
  await until(()=>messages.some(m=>m.type==='relay-ready'),'Relay did not accept valid destinations');assert.equal(messages.find(m=>m.type==='relay-ready').destinations,2);
  input=spawn('ffmpeg',['-loglevel','error','-re','-f','lavfi','-i','testsrc=size=640x360:rate=15','-f','lavfi','-i','sine=frequency=500:sample_rate=48000','-t','10','-threads','2','-c:v','libvpx','-deadline','realtime','-cpu-used','8','-c:a','libopus','-f','webm','pipe:1'],{stdio:['ignore','pipe','pipe']});procs.push(input);input.stderr.on('data',()=>{});input.stdout.on('data',d=>{if(ws.readyState===1)ws.send(d)});
  await until(()=>logs.join('').includes('live feed is on'),'Real media was not ingested');
  await until(()=>messages.some(m=>m.type==='broadcast-progress'&&m.frames>0),'No encoding progress received');
  await delay(2200);ws.send(JSON.stringify({type:'stop'}));await until(()=>ws.readyState===WebSocket.CLOSED,'Relay did not close stopped broadcast');
  await Promise.race([Promise.all(procs.slice(0,2).map(exit)),delay(8000).then(()=>{throw Error('RTMP receivers did not finish')})]);
  for(const output of outputs){assert.ok(fs.statSync(output).size>1000);const probe=spawnSync('ffprobe',['-v','error','-show_streams','-of','json',output],{encoding:'utf8'});assert.equal(probe.status,0);const streams=JSON.parse(probe.stdout).streams;assert.ok(streams.some(s=>s.codec_name==='h264'&&s.width===1280&&s.height===720));assert.ok(streams.some(s=>s.codec_name==='aac'));}
  assert.equal(logs.join('').includes('fixture-key'),false,'Stream keys must not appear in relay logs');
 }finally{ws?.terminate();for(const p of procs)try{p.kill('SIGKILL')}catch{}await Promise.all(procs.map(exit));fs.rmSync(dir,{recursive:true,force:true});}
});
