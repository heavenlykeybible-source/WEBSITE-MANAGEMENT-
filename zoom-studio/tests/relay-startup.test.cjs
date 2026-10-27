const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');

function harness(overrides = {}) {
  let server, resolveDns, spawnCount = 0;const children=[];
  class Server extends EventEmitter { constructor() { super(); server = this; } }
  class Socket extends EventEmitter {
    constructor() { super(); this.readyState = 1; this.sent = []; }
    send(m) { this.sent.push(m); }
    close() { this.readyState = 3; this.emit('close'); }
  }
  const fakeProcess = { env: { TOKEN: 'test-password-123', ...overrides }, on() {}, exit() {} };
  const source = fs.readFileSync(require('node:path').join(__dirname, '../server/relay.js'), 'utf8');
  const context = {
    require(name) {
      if (name === 'ws') return { WebSocketServer: Server };
      if (name === 'child_process') return { spawn() {
        spawnCount++;
        const child = new EventEmitter();
        child.stdin = new EventEmitter();
        child.stdin.writable = true;
        child.stdin.write = () => true;
        child.stdin.end = () => {};
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.kill = () => {};
        children.push(child);
        return child;
      }};
      if (name === 'dns') return { promises: { lookup: () => new Promise(r => { resolveDns = r; }) } };
      return require(name);
    },
    process: fakeProcess, Buffer, console: { log() {}, error() {} },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}
  };
  vm.runInNewContext(source, context);
  const open = () => {const socket=new Socket();server.emit('connection',socket,{url:'/',headers:{}});return socket;};
  const socket = open();
  return { socket, open, children, verifyToken:context.auth, resolve: (addresses=['8.8.8.8']) => resolveDns(addresses.map(address=>({address}))), spawns: () => spawnCount };
}
const start = JSON.stringify({ type: 'start', token: 'test-password-123', dests: ['rtmps://example.com/live/key'] });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('stop during destination lookup prevents a new broadcast session', async () => {
  const h = harness();
  h.socket.emit('message', Buffer.from(start), false);
  h.socket.emit('message', Buffer.from(JSON.stringify({type:'stop'})), false);
  h.resolve();
  await flush();
  assert.equal(h.socket.readyState, 3);
  assert.equal(h.spawns(), 0);
});

test('closed socket during destination lookup does not start a broadcast', async () => {
  const h = harness();
  h.socket.emit('message', Buffer.from(start), false);
  h.socket.close();
  h.resolve();
  await flush();
  assert.equal(h.spawns(), 0);
});

test('a valid start creates a session after destination validation', async () => {
  const h = harness();
  h.socket.emit('message', Buffer.from(start), false);
  h.resolve();
  await flush();
  assert.equal(h.spawns(), 3);
  assert.ok(h.socket.sent.includes('Connected. Backup is ready.'));
});

test('start button stays disabled while the relay settings are being checked', async () => {
  const html = fs.readFileSync(require('node:path').join(__dirname, '../site/index.html'), 'utf8');
  const handler = html.match(/\$\('gl'\)\.onclick=async\(\)=>\{[\s\S]*?\}finally\{\$\('gl'\)\.disabled=false\}\};/);
  assert.ok(handler, 'broadcast start handler exists');
  let resolveCheck;
  const buttons = { gl: {}, info: {} };
  const context = {
    $: id => buttons[id], want: false, ds: [], acct: { on: false },
    relink: () => new Promise(resolve => { resolveCheck = resolve; })
  };
  vm.runInNewContext(handler[0], context);
  const pending = buttons.gl.onclick();
  assert.equal(buttons.gl.disabled, true);
  resolveCheck(false);
  await pending;
  assert.equal(buttons.gl.disabled, false);
});

test('relay rejects invalid credentials with a terminal error', () => {
  const h = harness();
  h.socket.emit('message', Buffer.from(JSON.stringify({type:'start', token:'wrong'})), false);
  assert.equal(h.socket.readyState, 3);
  assert.equal(JSON.parse(h.socket.sent[0]).type, 'error');
  assert.equal(h.spawns(), 0);
});

test('relay rejects invalid destinations with a terminal error', async () => {
  const h = harness();
  h.socket.emit('message', Buffer.from(JSON.stringify({type:'start', token:'test-password-123', dests:['http://invalid']})), false);
  await flush();
  assert.equal(h.socket.readyState, 3);
  assert.equal(JSON.parse(h.socket.sent[0]).type, 'error');
  assert.equal(h.spawns(), 0);
});

test('terminal relay error stops retrying and closes created platform broadcasts', async () => {
  const html = fs.readFileSync(require('node:path').join(__dirname, '../site/index.html'), 'utf8');
  const start = html.indexOf('let want=false,retry=0,outs=[];');
  const end = html.indexOf("$('gl').onclick=async", start);
  assert.ok(start >= 0 && end > start);
  const elements = { gl: {}, info: {}, low: { checked:false }, st: { classList:{toggle(){}} } };
  const calls = [], sockets = [];
  class Socket {
    constructor() { this.readyState=1; sockets.push(this); }
    send() {}
    close() { this.readyState=3; if (this.onclose) this.onclose(); }
  }
  const context = {
    $: id => elements[id], WebSocket: Socket, RU:'wss://relay.test', RT:'token',
    ws:null, rec:null, liveEnds:['platform-end'], api:(path,body)=>{calls.push({path,body});},
    setSt:(text)=>{elements.st.textContent=text;}, setTimeout:()=>{throw new Error('must not retry');},
    console
  };
  vm.runInNewContext(html.slice(start,end) + '; want=true; connect();', context);
  sockets[0].onmessage({data:JSON.stringify({type:'error',message:'Invalid destination'})});
  assert.equal(elements.info.textContent, 'Invalid destination');
  assert.equal(elements.gl.textContent, 'Go live');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/golive/end');
  assert.equal(calls[0].body.ends[0], 'platform-end');
});

test('media recorder startup failure stops the relay and cleans up destinations', () => {
  const html = fs.readFileSync(require('node:path').join(__dirname, '../site/index.html'), 'utf8');
  const start = html.indexOf('let want=false,retry=0,outs=[];');
  const end = html.indexOf("$('gl').onclick=async", start);
  const elements = { gl: {}, info: {}, low: {checked:false}, st: {} };
  const calls = [], sockets = [];
  class Socket {
    constructor() { this.readyState=1; this.sent=[]; sockets.push(this); }
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.readyState=3; if(this.onclose) this.onclose(); }
  }
  const context = {
    $: id => elements[id], WebSocket: Socket, RU:'wss://relay.test', RT:'token',
    ws:null, rec:null, liveEnds:['end'], api:(path,body)=>calls.push({path,body}),
    setSt:()=>{}, W:1280,H:720,qTier:0,QV:[1,1,1],QA:[1,1,1],
    mkStream:()=>({}), mime:()=>'', MediaRecorder:class { constructor(){throw Error('unsupported');} },
    setTimeout:()=>{throw Error('must not retry');}
  };
  vm.runInNewContext(html.slice(start,end) + '; want=true; connect();', context);
  sockets[0].onopen();
  assert.deepEqual(sockets[0].sent.map(m=>m.type), ['start','stop']);
  assert.match(elements.info.textContent, /Could not start media recording/);
  assert.equal(calls.length,1);
});
test('reconnection rejects changed destinations rather than silently using old ones', async()=>{
 const h=harness();h.socket.emit('message',Buffer.from(start),false);h.resolve();await flush();
 h.socket.close();
 const next=h.open();next.emit('message',Buffer.from(JSON.stringify({type:'start',token:'test-password-123',dests:['rtmps://example.com/other/key']})),false);
 h.resolve();await flush();
 assert.equal(JSON.parse(next.sent[0]).type,'error');
 assert.match(JSON.parse(next.sent[0]).message,/different destinations/i);
 assert.equal(h.spawns(),3);
});
test('authenticated stop ends detached fallback without stopping another active socket', async()=>{
 const h=harness();h.socket.emit('message',Buffer.from(start),false);h.resolve();await flush();
 const activeStop=h.open();activeStop.emit('message',Buffer.from(JSON.stringify({type:'stop',token:'test-password-123'})),false);
 assert.equal(h.socket.readyState,1);
 h.socket.close();
 const invalid=h.open();invalid.emit('message',Buffer.from(JSON.stringify({type:'stop',token:'wrong'})),false);
 const cleanup=h.open();cleanup.emit('message',Buffer.from(JSON.stringify({type:'stop',token:'test-password-123'})),false);
 const next=h.open();next.emit('message',Buffer.from(start),false);h.resolve();await flush();
 assert.equal(h.spawns(),6);
 assert.ok(next.sent.includes('Connected. Backup is ready.'));
});
test('stop during reconnect validation cleans up a detached broadcast', async()=>{
 const h=harness();h.socket.emit('message',Buffer.from(start),false);h.resolve();await flush();h.socket.close();
 const reconnect=h.open();reconnect.emit('message',Buffer.from(start),false);
 reconnect.emit('message',Buffer.from(JSON.stringify({type:'stop',token:'test-password-123'})),false);
 h.resolve();await flush();
 const next=h.open();next.emit('message',Buffer.from(start),false);h.resolve();await flush();
 assert.equal(h.spawns(),6);
});
test('stopping while disconnected uses captured relay credentials for cleanup',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../site/index.html'),'utf8');
 const start=html.indexOf('let want=false,retry=0,outs=[];'),end=html.indexOf("$('gl').onclick=async",start);
 const timers=[],sockets=[],elements={gl:{},info:{}};
 class Socket {
  constructor(url){this.url=url;this.readyState=1;this.sent=[];sockets.push(this);}
  send(value){this.sent.push(JSON.parse(value));}
  close(){this.readyState=3;if(this.onclose)this.onclose();}
 }
 const context={ws:{readyState:3,close(){}},RU:'wss://old.test',RT:'old-token',WebSocket:Socket,
  $:id=>elements[id],liveEnds:[],setSt:()=>{},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{}};
 vm.runInNewContext(html.slice(start,end)+'; want=true; finishBroadcast();',context);
 context.RU='wss://new.test';context.RT='new-token';
 timers.shift()();sockets[0].onopen();
 assert.equal(sockets[0].url,'wss://old.test');
 assert.equal(sockets[0].sent[0].token,'old-token');
 assert.equal(sockets[0].sent[0].type,'stop');
});
test('relay rejects nonpublic DNS answers including mapped and link-local IPv6', async()=>{
 for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','198.18.0.1','192.0.2.1','::1','::ffff:7f00:1','fe90::1','fd00::1','2001:0db8::1']){
  const h=harness();h.socket.emit('message',Buffer.from(start),false);h.resolve([address]);await flush();
  assert.equal(h.socket.readyState,3,address);assert.equal(h.spawns(),0,address);
 }
 const mixed=harness();mixed.socket.emit('message',Buffer.from(start),false);mixed.resolve(['8.8.8.8','::ffff:127.0.0.1']);await flush();
 assert.equal(mixed.socket.readyState,3);
});
test('relay accepts globally routable IPv6 destinations', async()=>{
 const h=harness();h.socket.emit('message',Buffer.from(start),false);h.resolve(['2606:4700:4700::1111']);await flush();
 assert.equal(h.spawns(),3);
});
test('relay rejects malformed hosts and invalid destination ports before DNS lookup', async()=>{
 for(const url of ['rtmps://example.com:0/key','rtmps://example.com:65536/key','rtmps://bad..example/key','rtmps://-bad.example/key']){
  const h=harness();h.socket.emit('message',Buffer.from(JSON.stringify({type:'start',token:'test-password-123',dests:[url]})),false);await flush();
  assert.equal(h.socket.readyState,3,url);assert.equal(h.spawns(),0,url);
 }
});
test('relay token parser safely rejects malformed and non-ASCII signatures',()=>{
 const secret='test-relay-secret-with-32-characters';
 const h=harness({RELAY_SECRET:secret,TOKEN:''});
 const p=Buffer.from(JSON.stringify({u:'owner',exp:Date.now()+60000})).toString('base64url');
 const sig=crypto.createHmac('sha256',secret).update(p).digest('hex');
 assert.equal(h.verifyToken(p+'.'+sig).id,'owner');
 for(const token of [p+'.'+'é'.repeat(64),p+'.'+'g'.repeat(64),p+'.'+sig+'.extra',p+'.'+sig.slice(1)]){
  assert.doesNotThrow(()=>h.verifyToken(token));
  assert.ok(!h.verifyToken(token));
 }
});
test('encoder and input startup errors close failed sessions and notify the host', async()=>{
 for(const index of [0,2]){
  const h=harness();h.socket.emit('message',Buffer.from(start),false);h.resolve();await flush();
  h.children[index].emit('error',new Error('missing encoder'));
  assert.equal(h.socket.readyState,3);
  const failure=h.socket.sent.map(s=>{try{return JSON.parse(s)}catch{return {}}}).find(m=>m.type==='error');
  assert.match(failure.message,/could not start/i);
  const next=h.open();next.emit('message',Buffer.from(start),false);h.resolve();await flush();
  assert.equal(h.spawns(),6);
 }
});
test('unexpected media process exit ends the session with a useful error', async()=>{
 for(const index of [0,2]){
  const h=harness();h.socket.emit('message',Buffer.from(start),false);h.resolve();await flush();
  h.children[index].emit('exit',1);
  const failure=h.socket.sent.map(s=>{try{return JSON.parse(s)}catch{return {}}}).find(m=>m.type==='error');
  assert.match(failure.message,/stopped/i);assert.equal(h.socket.readyState,3);
 }
});
test('overloaded broadcast input is stopped instead of buffering without limit', async()=>{
 const h=harness();h.socket.emit('message',Buffer.from(start),false);h.resolve();await flush();
 h.children[2].stdin.writableLength=8*1024*1024;
 h.socket.emit('message',Buffer.from('media'),true);
 assert.equal(h.socket.readyState,3);
 const error=h.socket.sent.map(s=>{try{return JSON.parse(s)}catch{return {}}}).find(m=>m.type==='error');
 assert.match(error.message,/overloaded/i);
});
