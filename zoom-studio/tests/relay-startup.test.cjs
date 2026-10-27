const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');

function harness() {
  let server, resolveDns, spawnCount = 0;
  class Server extends EventEmitter { constructor() { super(); server = this; } }
  class Socket extends EventEmitter {
    constructor() { super(); this.readyState = 1; this.sent = []; }
    send(m) { this.sent.push(m); }
    close() { this.readyState = 3; this.emit('close'); }
  }
  const fakeProcess = { env: { TOKEN: 'test-password-123' }, on() {}, exit() {} };
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
        return child;
      }};
      if (name === 'dns') return { promises: { lookup: () => new Promise(r => { resolveDns = r; }) } };
      return require(name);
    },
    process: fakeProcess, Buffer, console: { log() {}, error() {} },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}
  };
  vm.runInNewContext(source, context);
  const socket = new Socket();
  server.emit('connection', socket, { url: '/', headers: {} });
  return { socket, resolve: () => resolveDns([{ address: '8.8.8.8' }]), spawns: () => spawnCount };
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
