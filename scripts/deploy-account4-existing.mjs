import fs from 'node:fs/promises';
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const worker = 'website-management';
if (!/^[a-f0-9]{32}$/i.test(account || '') || !token) throw new Error('Missing or malformed Account 4 credentials');
if (account === 'cd095c096c2d5a42501e7d77cecbb34c') throw new Error('Refusing Account 3 destination');
const base = 'https://api.cloudflare.com/client/v4/accounts/' + account + '/workers/scripts/' + worker;
async function api(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { Authorization: 'Bearer ' + token, ...init.headers }, signal: AbortSignal.timeout(60000) });
  const data = await response.json();
  if (!response.ok || data.success !== true) {
    const codes = (data.errors || []).map(e => e.code).join(', ');
    throw new Error('Cloudflare request failed (' + response.status + '; codes ' + codes + '). Check Account 4 access and existing Worker.');
  }
  return data.result;
}
const settings = await api(base + '/settings');
const bindings = settings.bindings;
if (!Array.isArray(bindings)) throw new Error('Existing Worker bindings unavailable; refusing upload');
for (const [name, type] of [['DB', 'd1'], ['FILES', 'r2_bucket']]) {
  if (!bindings.some(b => b.name === name && b.type === type)) throw new Error('Existing Worker lacks required ' + name + ' binding; refusing to create or replace resources');
}
function signature(values) {
  return JSON.stringify(values.map(b => Object.fromEntries(Object.entries(b).sort(([a],[b]) => a.localeCompare(b)))).sort((a,b) => a.name.localeCompare(b.name)));
}
if (process.argv.includes('--check')) {
  console.log('PASS: saved credentials can read existing Account 4 Worker; DB and FILES bindings found. No resources changed.');
} else {
  const source = await fs.readFile('control-room-worker.js', 'utf8');
  if (source.length < 10000 || !source.includes('export default')) throw new Error('Worker source missing or incomplete');
  const metadata = {
    main_module: 'control-room-worker.js',
    compatibility_date: settings.compatibility_date || '2026-10-18',
    keep_bindings: [...new Set([...bindings.map(b => b.type), 'secret_text'])],
    keep_assets: true,
  };
  for (const key of ['compatibility_flags', 'observability', 'limits', 'placement', 'logpush', 'tail_consumers']) {
    if (settings[key] !== undefined) metadata[key] = settings[key];
  }
  const form = new FormData();
  form.set('metadata', new Blob([JSON.stringify(metadata)], {type:'application/json'}));
  form.set('control-room-worker.js', new Blob([source], {type:'application/javascript+module'}), 'control-room-worker.js');
  await api(base, {method:'PUT', body:form});
  const after = await api(base + '/settings');
  if (signature(bindings) !== signature(after.bindings || [])) throw new Error('Upload completed but binding verification differs. Inspect existing Worker before retrying.');
  console.log('SUCCESS: deployed existing website-management Worker; all saved bindings and secret names verified unchanged.');
}
