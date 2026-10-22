// Each deployed commit must ship different service worker bytes so installed PWAs find updates.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const path=new URL('../public/sw.js',import.meta.url);
let revision=process.env.CF_PAGES_COMMIT_SHA||process.env.GITHUB_SHA||process.env.COMMIT_SHA||'';
if(!/^[a-f0-9]{7,64}$/i.test(revision)){
 try{revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}
 catch{revision='local';}
}
revision=/^[a-f0-9]{7,64}$/i.test(revision)?revision.slice(0,16):'local';
const source=readFileSync(path,'utf8');
if(!/const RELEASE='[^']+';/.test(source))throw Error('App service worker release token is missing.');
const next=source.replace(/const RELEASE='[^']+';/,`const RELEASE='${revision}';`);
if(next!==source)writeFileSync(path,next);
console.log('Heavenly Key app shell release:',revision);
