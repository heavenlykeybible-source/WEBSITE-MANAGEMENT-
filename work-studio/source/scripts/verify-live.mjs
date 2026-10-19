const site='https://heavenlykey.alldaywow247.workers.dev';
for(const [path,marker] of [['/','Heavenly Key Evangelistic Movement'],['/pages/community','community-compose'],['/pages/admin','group-create'],['/pages/radio','data-broadcast-player="radio"'],['/pages/video','data-broadcast-player="video"']]){
 const r=await fetch(site+path);const body=await r.text();if(!r.ok||!body.includes(marker))throw new Error('Live page failed: '+path);
 if(path==='/pages/radio'&&body.includes('data-broadcast-player="video"'))throw new Error('Radio still includes the video player');
 console.log('Live page ready: '+path);
}
for(const path of ['/api/groups','/api/discussions','/api/prayer','/api/testimonies']){
 const r=await fetch(site+path);if(!r.ok)throw new Error('Live service failed: '+path);await r.json();console.log('Live service ready: '+path);
}
for(const channel of ['radio','video']){
 const path='/api/broadcast/programme?channel='+channel;
 const r=await fetch(site+path);if(!r.ok)throw new Error('Live broadcast service failed: '+path);
 const programme=await r.json();
 if(!['offline','playlist','scheduled','live','reconnecting'].includes(programme.mode))throw new Error('Invalid broadcast mode for '+channel);
 if(!Array.isArray(programme.items))throw new Error('Invalid broadcast items for '+channel);
 if(programme.transport&& !['livekit','youtube'].includes(programme.transport))throw new Error('Invalid live transport for '+channel);
 if(programme.items.length){
   const item=programme.items[0];
   if(!item||typeof item.url!=='string'||!item.url)throw new Error('Broadcast item URL missing for '+channel);
   const media=await fetch(new URL(item.url,site),{method:'HEAD'});
   if(!media.ok)throw new Error('Published broadcast media is unreachable for '+channel);
   const type=media.headers.get('content-type')||'';
   if(!/^(audio|video)\//i.test(type))throw new Error('Published broadcast media has invalid content type for '+channel+': '+type);
 }
 console.log('Live broadcast programme ready: '+channel+' · '+programme.mode);
}
if((await fetch(site+'/api/auth/profile')).status!==401)throw new Error('Guest session protection failed');
console.log('Account 1 production verified independently. Guest administrator access remains protected.');
