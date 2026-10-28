import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const handlers = {};
const entries = new Map();
const keyOf = value => new URL(typeof value === 'string' ? value : value.url, 'https://editor.test').pathname;
const cache = {
  async addAll(paths) { for (const path of paths) entries.set(keyOf(path), new Response('offline '+path)); },
  async match(request) { return entries.get(keyOf(request))?.clone(); },
  async put(request, response) { entries.set(keyOf(request),response.clone()); }
};
const caches = {
  async open() { return cache; },
  async match(request) { return cache.match(request); },
  async keys() { return ['hk-account9-offline-v5','hk-account9-offline-v6']; },
  async delete() { return true; }
};
let offline=true, networkCalls=0, privateNext=false, failureNext=false;
const fetch = async request => {
  networkCalls++;
  if (offline) throw Error('Offline');
  if(privateNext){privateNext=false;return new Response('private editor',{headers:{'cache-control':'private, no-store'}})}
  if(failureNext){failureNext=false;return new Response('Service unavailable',{status:503});}
  return new Response('live '+keyOf(request));
};
const self = {
  location: { origin:'https://editor.test' },
  addEventListener(type, callback) { handlers[type]=callback; },
  async skipWaiting() {},
  clients: { async claim() {} }
};
runInNewContext(readFileSync('public/sw.js','utf8'),{self,caches,fetch,URL,Response},{filename:'account9-service-worker.js'});
const fire = async(type,request) => {
  let responsePromise, tasks=[];
  handlers[type]({
    request,
    waitUntil(promise) { tasks.push(Promise.resolve(promise)); },
    respondWith(promise) { responsePromise=Promise.resolve(promise); }
  });
  const response=responsePromise&&await responsePromise;
  await Promise.all(tasks);
  return response;
};
const swSource=readFileSync('public/sw.js','utf8');
assert.ok(swSource.includes("'/hk-approved-footer.js'")&&swSource.includes("'/hk-approved-footer.css'"),'Approved footer code and styles must be available offline');
await fire('install');
await fire('activate');
const api = await fire('fetch',new Request('https://editor.test/api/me'));
assert.equal(api,undefined,'Authenticated API calls must bypass service worker');
const post = await fire('fetch',new Request('https://editor.test/projects',{method:'POST'}));
assert.equal(post,undefined,'Mutating requests must bypass service worker');
const authenticated = await fire('fetch',new Request('https://editor.test/timeline.js',{headers:{authorization:'Bearer test'}}));
assert.equal(authenticated,undefined,'Authorized requests must bypass the offline cache');
const cookieRequest = await fire('fetch',new Request('https://editor.test/timeline.js',{headers:{cookie:'session=example'}}));
assert.equal(cookieRequest,undefined,'Session-bearing requests must bypass offline caching');
const remote = await fire('fetch',new Request('https://other.test/index.html'));
assert.equal(remote,undefined,'Cross-origin requests must bypass the cache');
let navigate = await fire('fetch',{url:'https://editor.test/',method:'GET',mode:'navigate'});
assert.ok((await navigate.text()).includes('offline'),'Offline navigation must return cached editor');
const privateRoute=await fire('fetch',{url:'https://editor.test/private/dashboard',method:'GET',mode:'navigate'});
assert.equal(privateRoute,undefined,'Non-editor navigations must bypass offline caching');
const tokenized=await fire('fetch',{url:'https://editor.test/?session=secret',method:'GET',mode:'navigate'});
assert.equal(tokenized,undefined,'Query-token navigations must bypass the offline cache');
const tokenizedAsset=await fire('fetch',new Request('https://editor.test/timeline.js?access_token=private'));
assert.equal(tokenizedAsset,undefined,'Query-bearing static requests must bypass offline caching');
const footer = await fire('fetch',new Request('https://editor.test/hk-approved-footer.js'));
assert.ok((await footer.text()).includes('offline'),'Approved footer must remain available offline');
const style = await fire('fetch',new Request('https://editor.test/hk-approved-footer.css'));
assert.ok((await style.text()).includes('offline'),'Approved footer styles must remain available offline');
const script = await fire('fetch',new Request('https://editor.test/timeline.js'));
assert.ok((await script.text()).includes('offline'),'Offline module must load from cache');
offline=false;
navigate = await fire('fetch',{url:'https://editor.test/',method:'GET',mode:'navigate'});
assert.equal(await navigate.text(),'live /','Online navigation must fetch current editor');
const refreshedScript=await fire('fetch',new Request('https://editor.test/timeline.js'));
assert.equal(await refreshedScript.text(),'live /timeline.js','Online editor assets must update immediately instead of serving stale cached scripts');
failureNext=true;
const recoveredScript=await fire('fetch',new Request('https://editor.test/timeline.js'));
assert.equal(await recoveredScript.text(),'live /timeline.js','Temporary server errors must preserve the last working editor asset');
assert.equal(await (await cache.match('/index.html')).text(),'live /','Online launch must refresh offline editor');
privateNext=true;
navigate=await fire('fetch',{url:'https://editor.test/',method:'GET',mode:'navigate'});
assert.equal(await navigate.text(),'private editor','Private response is still delivered to the requester');
assert.equal(await (await cache.match('/index.html')).text(),'live /','Private response must never overwrite public offline editor');
assert.ok(networkCalls>=3,'Network refreshes must be attempted');
console.log('PASS offline editor lifecycle, API exclusion, and cache refresh');
