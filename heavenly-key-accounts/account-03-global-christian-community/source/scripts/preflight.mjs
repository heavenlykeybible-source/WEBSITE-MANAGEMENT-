import { readFile } from 'node:fs/promises';

const config = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
const release = process.argv.includes('--release');
const requiredBindings = ['DB', 'SESSIONS', 'MEDIA'];
const requiredSecrets = ['SESSION_SECRET', 'PASSWORD_PEPPER', 'INTERSERVICE_SECRET'];

for (const secret of requiredSecrets) {
  if (new RegExp('^\\s*' + secret + '\\s*=', 'm').test(config)) {
    throw new Error('Never store secret values in wrangler.toml: ' + secret);
  }
}
for (const binding of requiredBindings) {
  if (!config.includes('binding = "' + binding + '"')) {
    throw new Error('Missing required binding: ' + binding);
  }
}
if (!config.includes('https://global.heavenlykey.org')) {
  throw new Error('Global community origin missing.');
}
const placeholders = [...config.matchAll(/REPLACE_[A-Z0-9_]+/g)].map(m => m[0]);
if (release && placeholders.length) {
  throw new Error('Release blocked: unresolved Cloudflare resource placeholders: ' + [...new Set(placeholders)].join(', '));
}
if (release) {
  console.log('RELEASE CONFIGURATION CHECK PASSED — confirm secrets, migrations, security and live tests separately.');
} else {
  console.log('GLOBAL COMMUNITY DEVELOPMENT PREFLIGHT PASSED — ' + [...new Set(placeholders)].length + ' resource placeholders; deployment readiness NOT certified.');
}
