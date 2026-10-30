import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
for(const [label,needle] of [
 ['Gemini reconnection button','Reconnect Gemini API key'],
 ['Gemini-specific connection guidance','Gemini authentication failed.'],
 ['Gemini official API endpoint','https://generativelanguage.googleapis.com/v1beta/openai'],
 ['OpenAI connection selection','A ChatGPT website login does not authorize API access.'],
 ['key validated before save','await aiTest({ provider: b.provider, model, base, key })'],
 ['token encrypted', 'const enc = await seal(env, key)']
])assert.ok(s.includes(needle),'Missing '+label);
console.log('PASS Gemini/OpenAI API reconnection guidance and existing secure key validation');
