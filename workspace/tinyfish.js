async function tinyfishKey(env){const r=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind('browser:tinyfish-key').first();return r?await unseal(env,JSON.parse(r.value_json).encrypted):env.TINYFISH_API_KEY||null;}
async function tinyfishRoutes(req,env,user,sub,m){
 if(!sub.startsWith('tinyfish'))return null;
 if(user.role!=='owner'||user.kind!=='staff')fail('Owner access required',403);
 if(sub==='tinyfish/status'&&m==='GET')return json({configured:!!await tinyfishKey(env),notice:'TinyFish runs one approved goal. It uses your TinyFish API credits and does not share your ChatGPT browser login.'});
 if(sub==='tinyfish/configure'&&m==='POST'){
 const b=await body(req);await reauthenticate(env,user,b.password);
 if(typeof b.api_key!=='string'||b.api_key.length<16||b.api_key.length>500||/\s/.test(b.api_key))fail('Enter a valid TinyFish API key');
 await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json').bind('browser:tinyfish-key',JSON.stringify({encrypted:await seal(env,b.api_key)})).run();await audit(env,user.username,'tinyfish-configured','Encrypted provider key');return json({ok:true});
 }
 if(sub==='tinyfish/run'&&m==='POST'){
 const b=await body(req);let url;try{url=new URL(b.url);}catch{fail('Enter a public HTTPS website');}
 if(url.protocol!=='https:'||url.username||url.password||!/^([a-z0-9][a-z0-9-]*\.)+[a-z]{2,63}$/i.test(url.hostname)||url.hostname.endsWith('.local'))fail('Enter a public HTTPS website');
 if(typeof b.goal!=='string'||!b.goal.trim()||b.goal.length>1500||b.confirm!=='Run this TinyFish goal')fail('Review and approve the exact TinyFish goal');
 const key=await tinyfishKey(env);if(!key)fail('Connect your TinyFish API key in Browser agent first',503);
 // Never retry a timed-out run: the provider may still be working.
 await audit(env,user.username,'tinyfish-run-requested',url.hostname);
 const response=await fetch('https://agent.tinyfish.ai/v1/automation/run-sse',{method:'POST',redirect:'manual',headers:{'X-API-Key':key,'content-type':'application/json'},body:JSON.stringify({url:url.href,goal:b.goal,browser_profile:'lite'})});
 if(!response.ok){if(response.body)await response.body.cancel();fail('TinyFish returned HTTP '+response.status+'. Check your key and available credits. No retry was made.',502);}
 return new Response(response.body,{headers:{'content-type':'text/event-stream','cache-control':'no-store','x-content-type-options':'nosniff'}});
 }
 fail('Method not allowed',405);
}
