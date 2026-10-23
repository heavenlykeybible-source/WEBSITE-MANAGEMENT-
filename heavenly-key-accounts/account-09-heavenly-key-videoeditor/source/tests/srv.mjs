import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import http from 'node:http';import {onRequest} from '../functions/api/[[path]].js';
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url),'utf8'));
const D1={prepare:s=>{const st=db.prepare(s);let a=[];const o={bind:(...x)=>{a=x;return o},first:async()=>st.get(...a)??null,all:async()=>({results:st.all(...a)}),run:async()=>({meta:{changes:Number(st.run(...a).changes)}})};return o}};
const store=new Map();const R2={put:async(k,b)=>{store.set(k,Buffer.from(await new Response(b).arrayBuffer()))},get:async k=>store.has(k)?{body:store.get(k)}:null,delete:async k=>{store.delete(k)}};
http.createServer(async(q,s)=>{const u=new URL(q.url,'http://127.0.0.1:8125');
 if(u.pathname.startsWith('/api/')){const ch=[];for await(const c of q)ch.push(c);const b=Buffer.concat(ch);const h={...q.headers};if(b.length)h['content-length']=String(b.length);
  const r=await onRequest({request:new Request(u,{method:q.method,headers:h,body:['GET','HEAD'].includes(q.method)?undefined:b}),env:{DB:D1,MEDIA:R2,AI:{run:async(m,i)=>{globalThis.calls=(globalThis.calls||0)+1;return{text:'hello brave new world',words:[{word:' hello',start:0.5,end:0.9},{word:' brave',start:1.0,end:1.4},{word:' new',start:1.5,end:1.8},{word:' world',start:1.9,end:2.4}]}}}},params:{path:u.pathname.slice(5).split('/')}});
  const hd={};r.headers.forEach((v,k)=>hd[k]=v);s.writeHead(r.status,hd);s.end(Buffer.from(await r.arrayBuffer()));return}
 const f=new URL('../index.html', import.meta.url);s.writeHead(200,{'content-type':'text/html'});s.end(fs.readFileSync(f))}).listen(8125);
