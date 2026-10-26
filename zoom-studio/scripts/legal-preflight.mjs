// Fail closed before a public production release if mandatory legal pages remain templates.
// A release must supply finalized, reviewed content. Never fill missing business facts by guessing.
import fs from 'node:fs';
const pages=['privacy.html','terms.html'];
let issues=[];
for(const page of pages){
  const text=fs.readFileSync(new URL('../site/'+page,import.meta.url),'utf8');
  if(/DRAFT TEMPLATE|\[DATE\]|\[BUSINESS NAME\]|\[PRIVACY EMAIL\]|\[SUPPORT EMAIL\]|\[LAWYER|\[ADDRESS\]/i.test(text))
    issues.push(page+' contains draft text or unresolved legal placeholders');
}
if(issues.length) {
  console.error('Account 8 public release blocked:\n'+issues.join('\n'));
  process.exitCode=1;
} else {
  console.log('Account 8 legal placeholder preflight passed');
}
