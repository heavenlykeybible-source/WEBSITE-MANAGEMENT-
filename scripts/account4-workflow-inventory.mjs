import fs from 'node:fs';
import path from 'node:path';
const folder=new URL('../.github/workflows/',import.meta.url);
const files=fs.readdirSync(folder).filter(x=>/\.ya?ml$/.test(x)).sort();
console.log('Audit of '+files.length+' GitHub Actions workflows');
for(const name of files){
 const s=fs.readFileSync(new URL(name,folder),'utf8');
 const title=(s.match(/^name:\s*(.+)$/m)||[])[1]||name;
 const isPR=/^\s*pull_request\s*:/m.test(s)||/^on:\s*\[[^\]]*pull_request/m.test(s);
 const hasDeploy=/\b(?:wrangler\s+deploy|npm\s+run\s+deploy|cloudflare\/wrangler-action|deployments:\s*write|pages deploy|workers deploy)\b/i.test(s);
 console.log(JSON.stringify({file:name,name:title,pull_request:isPR,deployment_commands:hasDeploy}));
 if(isPR&&hasDeploy)console.log('CROSS_ACCOUNT_REVIEW: deployment commands present in PR-triggered workflow '+name+'; check job and step guards before production approval');
}
