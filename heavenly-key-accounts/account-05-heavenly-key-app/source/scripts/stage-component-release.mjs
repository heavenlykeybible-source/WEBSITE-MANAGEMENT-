import {cpSync,mkdirSync,rmSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd(),publicDir=join(root,'public'),out=join(root,'.component-release');
const target=process.env.RELEASE_TARGET;
const allowed=new Set(['premium-page','guide-android','guide-iphone','guide-ipad','guide-windows','guide-mac']);
if(!allowed.has(target))throw new Error('Unknown isolated release target');
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
const transfer=(path)=>{const src=join(publicDir,path),dest=join(out,path);if(!existsSync(src))throw new Error('Missing required asset '+path);mkdirSync(dest.substring(0,dest.lastIndexOf('/')),{recursive:true});cpSync(src,dest,{recursive:true});};
if(target==='premium-page'){
 for(const path of ['index.html','premium-home.css','premium-family-nav.js','premium-download-options.js','premium-share.js','site-sync.js','icon.svg','manifest.webmanifest','assets/ministry','icons','qr','download','styles.css'])transfer(path);
 const home=join(out,'index.html');writeFileSync(home,readFileSync(home,'utf8').replaceAll('href="/experience.html"','href="https://heavenly-key-app.heavenlykeyapp.workers.dev/experience.html"'));
 // Dedicated showcase does not ship Account 5's API Worker or production credentials.
}else{
 const platform=target.slice('guide-'.length);
 for(const path of ['download/'+platform,'download/hk-approved-page-style-download-index.css','download/hk-page-script-index-1.js','icon.svg','icons'])transfer(path);
 writeFileSync(join(out,'index.html'),'<meta http-equiv="refresh" content="0;url=/download/'+platform+'/"><a href="/download/'+platform+'/">Open installation guide</a>');
}
transfer('_headers');
const project=target==='premium-page'?'heavenly-key-app-showcase':'heavenly-key-guide-'+target.slice(6);
writeFileSync(join(root,'.component-project'),project);
console.log('Isolated staging completed:',target,project);
