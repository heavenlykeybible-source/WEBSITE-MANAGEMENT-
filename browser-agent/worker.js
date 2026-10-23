import puppeteer from '@cloudflare/puppeteer';
import {createDriver,resolvePublic} from './driver.js';
const run=createDriver(puppeteer,resolvePublic);
export default {async fetch(request,env){
 if(request.method!=='POST')return new Response('Private browser service',{status:405});
 try{const {job,action}=await request.json();return Response.json(await run(env.HK_BROWSER,job,action));}
 catch {return Response.json({error:'Browser operation failed or session expired. Observe again or restart the task.'},{status:409});}
}};
