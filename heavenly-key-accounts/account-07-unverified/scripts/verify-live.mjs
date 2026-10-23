import fs from 'node:fs';
const origin=new URL(process.argv[2]);
async function get(path,options={}){const r=await fetch(new URL(path,origin),{...options,signal:AbortSignal.timeout(20000),redirect:'error'});if(!r.ok)throw Error(`Radio verification failed: ${path} HTTP ${r.status}`);return r;}
for(const path of ['/','/js/approved-widget-system.js','/css/radio-approved-number-one.css','/assets/ministry/approved-radio-transparent-original.png','/assets/ministry/approved-radio-display-20261017.webp'])await get(path);
const response=await fetch(new URL('/api/broadcast/programme?channel=radio',origin),{signal:AbortSignal.timeout(20000),redirect:'error'});
const programme=await response.json();
if(response.status===503&&programme.error==='Broadcast connection not configured'){
 const message='Account 7 Radio application deployed and assets verified. AUDIO NOT ACTIVE: configure MEDIA_PUBLIC_ORIGIN and RADIO_PUBLIC_API_KEY on the Worker, matching Account 2. Custom radio domain routing and real listening are not yet verified.';
 console.log('::warning::'+message);
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,message+'\n');
 process.exit(0);
}
if(!response.ok)throw Error('Account 2 programme verification failed: HTTP '+response.status);
if(!Array.isArray(programme.items)||!['live','scheduled','playlist','offline','reconnecting'].includes(programme.mode))throw Error('Account 2 returned an invalid programme response.');
if(programme.transport==='livekit')await get('/api/broadcast/livekit/viewer-token',{method:'POST'});
else if(programme.items.length){const url=new URL(programme.items[0].url,origin);if(url.protocol!=='https:'||url.username||url.password)throw Error('Invalid broadcast media URL.');const media=await get(url.href,{headers:{Range:'bytes=0-1023'}});if(!/^(audio|video)\//.test(media.headers.get('content-type')||''))throw Error('Broadcast did not return playable media.');await media.body?.cancel();}
console.log(`Radio deployment and Account 2 programme verified (${programme.mode}). ${programme.items.length||programme.transport==='livekit'?'Real-device audio listening remains to be confirmed.':'No programme is currently on air; audio playback remains unverified.'}`);
