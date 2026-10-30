// Run: node apps/heavenly-key-bible/bible/tests/validate-strength-ui-security.mjs
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible');
const html=readFileSync(resolve(root,'strength-for-today.html'),'utf8');
const sw=readFileSync(resolve(root,'sw.js'),'utf8');
assert(!/\.innerHTML\s*=/.test(html),'Avoid innerHTML DOM assignment sinks');
assert(!/\beval\s*\(/.test(html),'Avoid eval');
assert(html.includes("entry.status!=='approved-for-publication'"),'Do not display unapproved dated content');
assert(html.includes("t.reviewStatus==='approved'"),'Topic-level approval required');
assert(html.includes('prefers-reduced-motion:reduce'),'Reduced-motion accessibility missing');
assert(html.includes(':focus-visible'),'Keyboard focus indicator missing');
assert(html.includes("archiveContainer.id='strength-archive'"),'Archive missing');
assert(html.includes("memberFind.id='find-members'"),'Member search missing');
assert(html.includes("memberSend.id='send-selected'"),'Member share missing');
assert(html.includes("memberClose.id='close-selector'"),'Member dialog close missing');
assert(html.includes('const DEVOTIONAL_BATCHES='),'Devotional batch list missing');
assert(html.includes('expectedDays'),'Devotional dates must be checked for completeness');
assert(sw.includes('SHELL_PRECACHE'),'Offline cache partitioning missing');
assert(sw.includes('SHELL_ASSETS.filter'),'Unpublished batches must not slow initial installation');
assert(sw.includes('async function cachePublicOfflineAsset(cache,asset)'),'Precache must validate asset cacheability');
assert(sw.includes('credentials:"omit"'),'Offline shell fetch must omit member cookies');
assert(sw.includes('redirect:"error"'),'Offline shell fetch must reject redirects');
assert(sw.includes('Sensitive asset excluded from offline storage'),'Private pages must not be precached');
assert(sw.includes('if(response.headers.has("Set-Cookie"))throw Error("Cookie-setting asset excluded from public offline shell")'),"Offline installer must reject cookie-setting responses");
assert(sw.includes('CORE_OFFLINE'),'Critical pages must be required for offline install');
assert(sw.includes('await Promise.all(CORE_OFFLINE.map(asset=>cachePublicOfflineAsset(cache,asset)))'),'Core assets must be fetched atomically before install success');
assert(sw.includes('await caches.delete(SHELL)'),'Failed core installs must clean partial caches');
assert(sw.includes('new Set(SHELL_ASSETS.filter'),'Cache assets must be deduplicated');
assert(sw.includes('OPTIONAL_OFFLINE.map(asset=>cachePublicOfflineAsset(cache,asset))'),'Optional files must remain best effort');
assert(sw.includes('url.search===""'),'Query-specific responses must not be persisted');
assert(sw.includes('headers.has("Authorization")'),'Authenticated responses must not be cached');
assert(sw.includes('Cache-Control'),'Private or no-store responses must not be cached');
assert(sw.includes("sourceUrl.origin!==self.location.origin"),'Offline download message must validate the sender origin');
assert(sw.includes("!sourceUrl.pathname.startsWith(PREFIX)"),'Offline download message must validate scope');
assert(sw.includes("!event.ports?.length"),'Offline download requires a reply port');
assert(sw.includes('previous.books.length===manifest.books.length'),'Cached KJV manifest must be checked for book count');
assert(sw.includes('book.sha256===previous.books[i]?.sha256'),'Cached manifest checksum must match current book checksum');
assert(sw.includes('await cachedBook.arrayBuffer()'),'Previously cached KJV book bytes must be rechecked');
assert(sw.includes('if(digest!==book.sha256)'),'Cached KJV checksum mismatch must force refresh');
assert(sw.includes("if(!approved){cached=undefined;try{await cache.delete(event.request);}")||sw.includes("if(!approved){cached=undefined;try{await cache.delete(event.request);"),'Withdrawn devotionals must be evicted and never served as cached fallback');
assert(sw.includes('const varies=response.headers.get("Vary")'),'Responses varying by cookies or authorization must be classified');
assert(sw.includes('const sensitive='),'Sensitive caching must be evaluated before writes');
assert(!sw.includes(String.raw`const sensitive=/(?:^|,)\\s*`),'Malformed double-escaped security regex');
assert(sw.includes(String.raw`const sensitive=/(?:^|,)\s*`),'Correct whitespace detection required');
assert(sw.includes(String.raw`(?:cookie|authorization|\*)`),'Vary wildcard recognition required');
const cachePolicySensitive=(cc,vary)=>/(?:^|,)\s*(?:private|no-store)(?:\s*(?:,|$)|\s*;)/i.test(cc)
 ||/(?:^|,)\s*(?:cookie|authorization|\*)(?:\s*,|\s*$)/i.test(vary);
for(const [cc,vary,expected] of [
 ['private','',true],['no-store','',true],['public, max-age=300','',false],
 ['public','Cookie',true],['public','Accept-Encoding, Authorization',true],
 ['public','*',true],['public','Accept-Encoding',false]
])assert.equal(cachePolicySensitive(cc,vary),expected,'Sensitive header policy regression');

assert(sw.includes('if(sensitive){cached=undefined;try{await cache.delete(event.request);}') ,'Sensitive previously cached responses must be evicted');
assert(sw.includes('&&!sensitive&&!setsCookie&&anonymousRequest&&'),'Sensitive and credentialed responses must not be newly stored');
assert(sw.includes('event.request.credentials==="omit"'),'Only credential-free runtime requests may be cached');
assert(sw.includes('response.headers.has("Set-Cookie")'),'Set-Cookie responses cannot enter public Cache API');

assert(sw.includes('const expectsJson=(isScripture||isDevotionalDraftLibrary)'), 'Bible JSON resources must use MIME validation');
assert(sw.includes('type==="application/json"||type.endsWith("+json")'),'Allow standard JSON and structured JSON types only');
assert(sw.includes('anonymousRequest&&validJsonType&&'),'Disguised HTML must not enter runtime caches');
assert(sw.includes('if(expectsJson&&!validJsonType){cached=undefined;'),'Incorrectly typed JSON response must evict stale cache');
assert(sw.includes('isDevotionalDraftLibrary'),'Devotional cache classification missing');
assert(sw.includes("entry.status==='approved-for-publication'"),'Unapproved content must never be cached');
assert(sw.includes("topic.reviewStatus==='approved'"),'Topics must pass review before offline caching');
assert(sw.includes('if(safeToCache){try{await cache.put'),'Cache failures must not interrupt online responses');
assert(sw.includes('hk-bible-shell-v68'),'Service-worker cache version must retire older draft caches');
assert(html.includes("redirect:'error'"),'Member API requests must not follow redirects');
assert(html.includes("cache:'no-store'"),'Member API requests must bypass response caching');
assert(html.includes('new AbortController()'),'Member API requests need cancellation');
assert(html.includes('15000'),'Member API requests need bounded timeouts');
assert(html.includes("Unexpected member service response"),'Member API must validate JSON responses');
assert(html.includes("Invalid member request"),'Member API requires an endpoint allowlist');
assert(html.includes("path==='/api/messages/requests'"),'Member message request endpoint must be explicit');
assert(html.includes("path==='/api/me'"),'Member identity endpoint must be explicit');
assert(html.includes('method===\'GET\'')&&html.includes('method===\'POST\''),'Member endpoints must enforce the HTTP method');
assert(html.includes('[a-f0-9]{8}-[a-f0-9]{4}'),'Conversation UUID route must be constrained');
console.log('PASS: source-level devotional UI, publication gate, accessibility and cache checks');
console.log('NOTE: static checks do not replace browser testing, accessibility audit or penetration testing.');
