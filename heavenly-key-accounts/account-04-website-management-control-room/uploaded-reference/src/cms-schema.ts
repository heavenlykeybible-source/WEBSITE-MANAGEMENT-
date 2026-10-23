export type CmsField = {key:string;type:'text'|'image'|'alt'|'link'|'visible'|'background'|'layout'|'tone';value:string|boolean};
export type CmsDocument = {schema:1;fields?:CmsField[];items?:{key?:string;label:string;href:string;newTab:boolean;visible:boolean}[];copyright?:string;designer?:{label:string;href:string}};
export const AI_MODEL='@cf/meta/llama-3.1-8b-instruct-fp8';
export const PUBLIC_CMS_ORIGIN='https://heavenlykey-cms-public.emmanuel2026miracle.workers.dev';
export const CONTROL_ORIGIN='https://heavenlykey-control-room.emmanuel2026miracle.workers.dev';
export function safeUrl(raw:unknown,allowEmpty=false):raw is string {
 if(typeof raw!=='string'||raw.length>1000||(!raw&&!allowEmpty)||/[\u0000-\u0020<>"'\\]/.test(raw))return false;
 if(!raw)return allowEmpty;
 if(raw.startsWith('//')||raw.split(/[?#]/)[0].split('/').includes('..'))return false;
 if(/^https:\/\//i.test(raw)){try{const u=new URL(raw);return !u.username&&!u.password}catch{return false}}
 if(/^mailto:/i.test(raw))return /^mailto:[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+$/.test(raw);
 if(/^tel:/i.test(raw))return /^tel:\+?[0-9-]{5,25}$/.test(raw);
 return /^[A-Za-z0-9_./#?%&=+~-]+$/.test(raw)&&!raw.includes(':');
}
export function validateDocument(kind:string,input:unknown):CmsDocument {
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Choose content to save.');
 const d=input as CmsDocument;
 if(d.schema!==1)throw Error('This content needs the visual CMS format before publication.');
 if(kind==='menu'){
  if(!Array.isArray(d.items)||d.items.length>40)throw Error('A menu can contain up to 40 links.');
  for(const i of d.items)if(!i||typeof i.label!=='string'||!i.label.trim()||i.label.length>100||!safeUrl(i.href)||typeof i.visible!=='boolean'||typeof i.newTab!=='boolean')throw Error('Check each menu title and destination.');
  if(d.items.some(i=>i.key!==undefined&&(typeof i.key!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(i.key))))throw Error('Invalid menu item.');
  return {schema:1,items:d.items.map(i=>({...(i.key?{key:i.key}:{}),label:i.label,href:i.href,visible:i.visible,newTab:i.newTab}))};
 }
 if(kind==='footer'){
  if(typeof d.copyright!=='string'||d.copyright.length>300||!d.designer||typeof d.designer.label!=='string'||d.designer.label.length>100||!safeUrl(d.designer.href))throw Error('Check the footer text and designer link.');
  return {schema:1,copyright:d.copyright,designer:{label:d.designer.label,href:d.designer.href}};
 }
 if(!Array.isArray(d.fields)||d.fields.length>600)throw Error('A page can contain up to 600 editable fields.');
 const keys=new Set<string>();
 for(const f of d.fields){
  if(!f||!/^([tilavbsc])_[a-z0-9]{7,12}$/.test(f.key)||keys.has(f.key)||!['text','image','alt','link','visible','background','layout','tone'].includes(f.type))throw Error('An editable page field is invalid.');
  keys.add(f.key);
  if(f.type==='layout'){if(!['original','contained','wide','full'].includes(String(f.value)))throw Error('Choose a supported page width.');continue}
  if(f.type==='tone'){if(!['original','royal','wine','gold','light','dark'].includes(String(f.value)))throw Error('Choose a supported colour.');continue}
  if(f.type==='visible'){if(typeof f.value!=='boolean')throw Error('Choose whether the section is visible.');continue}
  if(typeof f.value!=='string'||f.value.length>(f.type==='text'?5000:1000))throw Error('An edited field is too long.');
  if(['image','background'].includes(f.type)&&(!safeUrl(f.value,true)||/^(mailto|tel):/.test(f.value)))throw Error('Use an image path or HTTPS picture link.');
  if(f.type==='link'&&!safeUrl(f.value))throw Error('Use a safe website, email or telephone link.');
 }
 return {schema:1,fields:d.fields.map(f=>({key:f.key,type:f.type,value:f.value}))};
}
export function pageKey(path:string){
 const p=path.split(/[?#]/)[0].replace(/^\/+|\/+$/g,'').replace(/\.html$/i,'');
 return !p||p==='index'?'home':p.replace(/\/index$/,'');
}
