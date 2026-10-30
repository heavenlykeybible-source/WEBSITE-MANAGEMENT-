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
 const dryRunOnly=/wrangler\s+deploy\s+--dry-run/.test(s)&&!/run:\s*(?:npm\s+run\s+deploy|wrangler\s+deploy(?!\s+--dry-run))/.test(s);
 const manualMainGate=s.includes("github.event_name == 'workflow_dispatch' && inputs.deploy && github.ref == 'refs/heads/main'");
 const classification=!hasDeploy?'checks-only':dryRunOnly?'validation-dry-run':manualMainGate?'explicit-manual-production':'review-deployment-guard';
 console.log(JSON.stringify({file:name,name:title,pull_request:isPR,classification}));
 if(isPR&&classification==='review-deployment-guard')console.log('CROSS_ACCOUNT_REVIEW: inspect workflow '+name+' for an owner-reviewed deployment condition');
}
