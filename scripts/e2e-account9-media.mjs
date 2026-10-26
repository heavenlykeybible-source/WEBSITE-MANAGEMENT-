import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { chromium } from 'playwright-core';

const publicRoot=resolve('heavenly-key-accounts/account-09-heavenly-key-videoeditor/source/public');
const work=await mkdtemp(join(tmpdir(),'account9-media-e2e-'));
const sample=join(work,'sample.webm');
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc=size=320x180:rate=15','-t','2.4','-c:v','libvpx','-b:v','300k','-an',sample],{timeout:30000});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webm':'video/webm','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  const path=url.pathname==='/'?'/index.html':url.pathname;
  if(!/^\/[a-zA-Z0-9._\/-]+$/.test(path)||path.includes('..')){res.writeHead(400);res.end();return}
  const content=await readFile(join(publicRoot,path));
  res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'});
  res.end(content);
 }catch{res.writeHead(404);res.end()}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const port=server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--disable-dev-shm-usage']});
const page=await browser.newPage({acceptDownloads:true});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
async function verifyVideo(path){
 const data=await stat(path); assert.ok(data.size>1500,'Video export must contain encoded frames');
 const seconds=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',path],{encoding:'utf8'}).trim());
 assert.ok(seconds>.2 && seconds<5,'Exported file must decode with reasonable length, got '+seconds);
}
try{
 await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'load'});
 await page.locator('#vf').setInputFiles(sample);
 await page.waitForFunction(()=>!document.getElementById('vexp').disabled,{timeout:15000});
 const duration=await page.locator('#v').evaluate(v=>v.duration);
 assert.ok(duration>2,'Imported source must have metadata');
 await page.locator('#clipStart').fill('0.2');
 await page.locator('#clipEnd').fill('1.5');
 await page.locator('#clipAdd').click();
 assert.equal(await page.locator('#clipList option').count(),1);
 await page.locator('#clipPlay').click();
 await page.waitForFunction(()=>document.getElementById('clipStatus').textContent.includes('preview complete'),{timeout:20000});
 await page.locator('#clipExport').click();
 await page.waitForFunction(()=>!document.getElementById('clipDownload').hidden,{timeout:25000});
 const first=page.waitForEvent('download');
 await page.locator('#clipDownload').click();
 const timelineDownload=await first;
 const timelinePath=join(work,'timeline.'+timelineDownload.suggestedFilename().split('.').pop());
 await timelineDownload.saveAs(timelinePath);
 await verifyVideo(timelinePath);
 await page.locator('#vexp').click();
 await page.waitForFunction(()=>!document.getElementById('vdl').hidden,{timeout:30000});
 const second=page.waitForEvent('download');
 await page.locator('#vdl').click();
 const videoDownload=await second;
 const videoPath=join(work,'single.'+videoDownload.suggestedFilename().split('.').pop());
 await videoDownload.saveAs(videoPath);
 await verifyVideo(videoPath);
 assert.deepEqual(errors,[],'Browser page must not raise uncaught errors');
 console.log('PASS real video import, metadata, timeline clip/preview, timeline export/replay and single export/replay');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
