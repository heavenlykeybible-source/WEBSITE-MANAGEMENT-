(function(){
 "use strict";
 const root=document.getElementById("cms-slider-manager");
 if(!root)return;
 const rootPath=location.pathname.includes("/pages/")?"../":"";
 const DEFAULT_SLIDES=[
  {id:"original-1",src:"assets/ministry/outreach-1.jpg",alt:"Worship and cross",caption:"A PEOPLE PREPARED FOR HIS COMING",subtitle:"REVIVAL FOR OUR GENERATION",enabled:true},
  {id:"original-2",src:"assets/ministry/outreach-2.jpg",alt:"Prayer",caption:"MEN OUGHT ALWAYS TO PRAY",subtitle:"CALLING UPON GOD",enabled:true},
  {id:"original-3",src:"assets/ministry/ministries-header.jpg",alt:"Bible ministry",caption:"THE FAITH OF OUR FATHERS",subtitle:"APOSTOLIC CHRISTIANITY",enabled:true},
  {id:"original-4",src:"assets/ministry/outreach-4.jpg",alt:"Evangelistic outreach",caption:"END-TIME HARVEST",subtitle:"TAKING CHRIST TO THE NATIONS",enabled:true}
 ];
 let slides=DEFAULT_SLIDES.map(v=>({...v})),busy=false,library=[],draft=false;
 const api=async (url,options={})=>{
  const response=await fetch(url,{credentials:"include",...options});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.error?.message||result.error||"Request failed");
  return result;
 };
 const post=(url,data)=>api(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
 const $=(tag,text,cls)=>{const x=document.createElement(tag);if(text!=null)x.textContent=text;if(cls)x.className=cls;return x;};
 const btn=(label,fn,cls)=>{const b=$("button",label,cls);b.type="button";b.addEventListener("click",fn);return b;};
 const status=$("p","Loading slider…","cms-builder-status");status.setAttribute("role","status");
 const previewLink=$("a","Preview Draft (private)","btn btn-secondary");previewLink.target="_blank";previewLink.rel="noopener";previewLink.href=rootPath+"index.html?cms=preview";
 const controls=$("div",null,"cms-builder-actions");
 const items=$("div",null,"cms-slide-items");
 const pictures=$("div",null,"cms-builder-library");
 const heading=$("div",null,"cms-builder-actions");
 heading.append($("h3","Homepage Slider"),previewLink);
 root.append(heading,$("p","Add, remove, reorder and edit rotating homepage pictures. Save Draft first; Publish only when you approve.", "cms-builder-explain"),controls,items,$("h3","Picture Library"),pictures,status);
 const notify=t=>status.textContent=t;
 async function upload(file){
  if(!file||!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>8*1024*1024)throw Error("Choose a JPEG, PNG or WebP picture up to 8 MB.");
  const result=await api("/api/admin/cms/assets",{method:"POST",headers:{"Content-Type":file.type,"X-Filename":encodeURIComponent(file.name)},body:file});
  return result.url;
 }
 function inputField(value,label,max,handler,multiline=false){
  const wrap=$("label",null,"cms-builder-field");
  wrap.append($("span",label));
  const input=$(multiline?"textarea":"input");
  input.value=value||"";input.maxLength=max;input.addEventListener("input",()=>handler(input.value));
  wrap.append(input);return wrap;
 }
 function move(from,to){
  if(to<0||to>=slides.length)return;
  const [item]=slides.splice(from,1);slides.splice(to,0,item);render();
 }
 function render(){
  items.replaceChildren();
  for(let i=0;i<slides.length;i++){
   const s=slides[i],row=$("article",null,"cms-slide-row");
   row.draggable=true;
   row.addEventListener("dragstart",e=>{e.dataTransfer.setData("text/plain",String(i));});
   row.addEventListener("dragover",e=>e.preventDefault());
   row.addEventListener("drop",e=>{e.preventDefault();const from=Number(e.dataTransfer.getData("text/plain"));if(Number.isInteger(from)&&from>=0&&from<slides.length)move(from,i);});
   const thumb=$("img");thumb.alt=s.alt||"Slide";thumb.src=s.src;thumb.loading="lazy";thumb.className="cms-slide-picture";
   const picture=$("div",null,"cms-slide-picture-controls");picture.append(thumb);
   const file=$("input");file.type="file";file.accept="image/png,image/jpeg,image/webp";file.setAttribute("aria-label","Upload a replacement picture for slide "+(i+1));
   file.addEventListener("change",async()=>{try{notify("Uploading picture…");s.src=await upload(file.files[0]);await loadLibrary();render();notify("Picture uploaded. Save Draft to keep your changes.");}catch(e){notify(e.message);}});
   picture.append(file);
   const src=inputField(s.src,"Picture URL or uploaded library path",700,v=>{s.src=v;thumb.src=v;});
   const alt=inputField(s.alt,"Picture description",200,v=>s.alt=v);
   const caption=inputField(s.caption,"Slide headline",180,v=>s.caption=v);
   const subtitle=inputField(s.subtitle,"Small caption",180,v=>s.subtitle=v);
   const enabled=$("label",null,"cms-slide-checkbox");
   const check=$("input");check.type="checkbox";check.checked=s.enabled;check.addEventListener("change",()=>s.enabled=check.checked);
   enabled.append(check,$("span","Show this slide"));
   const actions=$("div",null,"cms-builder-actions");
   actions.append(btn("↑ Up",()=>move(i,i-1)),btn("↓ Down",()=>move(i,i+1)),btn("Remove",()=>{if(confirm("Remove this picture from the homepage slider draft?")){slides.splice(i,1);render();}},"cms-delete"));
   const details=$("div",null,"cms-slide-fields");
   details.append($("h4","Slide "+(i+1)),src,alt,caption,subtitle,enabled,actions);
   row.append(picture,details);items.append(row);
  }
  if(!slides.length)items.append($("p","No slides yet. Add a picture below."));
 }
 async function loadLibrary(){
  const data=await api("/api/admin/cms/assets");
  library=data.items||[];pictures.replaceChildren();
  if(!library.length)pictures.append($("p","Your uploaded pictures will appear here."));
  for(const item of library){
   const tile=btn("",()=>{if(slides.length>=12){notify("Maximum 12 slides.");return;}
    slides.push({id:crypto.randomUUID(),src:item.url,alt:item.filename||"",caption:"",subtitle:"",enabled:true});render();notify("Picture added. Save Draft when ready.");
   },"cms-library-item");
   const img=$("img");img.src=item.url;img.alt=item.filename||"Uploaded picture";img.loading="lazy";
   tile.append(img,$("small",item.filename||"Picture"));pictures.append(tile);
  }
 }
 async function reload(){
  try{const data=await api("/api/admin/cms/slider");draft=!!data.hasDraft;
   slides=(Array.isArray(data.slides)?data.slides:DEFAULT_SLIDES).map(x=>({...x}));
   render();await loadLibrary();notify(draft?"Unpublished slider draft loaded.":"Slider ready. Make changes and Save Draft.");
  }catch(e){notify(e.message);}
 }
 async function change(fn){
  if(busy)return;busy=true;controls.querySelectorAll("button").forEach(b=>b.disabled=true);
  try{await fn();}catch(e){notify(e.message);}finally{busy=false;controls.querySelectorAll("button").forEach(b=>b.disabled=false);}
 }
 const add=btn("+ Add Slide",()=>{if(slides.length>=12)return notify("Maximum 12 slides.");
  slides.push({id:crypto.randomUUID(),src:"",alt:"",caption:"",subtitle:"",enabled:true});render();notify("Choose a picture or upload one.");
 },"btn btn-secondary");
 const file=$("input");file.type="file";file.accept="image/png,image/jpeg,image/webp";file.setAttribute("aria-label","Upload picture and add to slider");
 file.addEventListener("change",()=>change(async()=>{if(slides.length>=12)throw Error("Maximum 12 slides");
  notify("Uploading picture…");const url=await upload(file.files[0]);
  slides.push({id:crypto.randomUUID(),src:url,alt:file.files[0].name,caption:"",subtitle:"",enabled:true});await loadLibrary();render();notify("Slide added. Save Draft before publishing.");file.value="";
 }));
 const fileWrap=$("label",null,"cms-builder-upload");fileWrap.append($("span","Upload picture and add slide"),file);
 controls.append(add,fileWrap,btn("Save Draft",()=>change(async()=>{
   await post("/api/admin/cms/slider",{action:"save-draft",slides});
   draft=true;notify("Slider draft saved. Public homepage unchanged. Use Preview Draft to inspect.");
 }),"btn btn-primary"),
 btn("Publish Slider",()=>change(async()=>{
  if(!confirm("Publish these slider changes to the public homepage?"))return;
  if(!slides.some(x=>x.enabled&&x.src))throw Error("Please keep at least one enabled picture.");
  await post("/api/admin/cms/slider",{action:"save-draft",slides});
  await post("/api/admin/cms/slider",{action:"publish"});draft=false;
  notify("Slider published! No website software deployment needed.");
 }),"btn btn-primary"),
 btn("Discard Draft",()=>change(async()=>{
  if(!confirm("Discard the unpublished slider draft?"))return;
  await post("/api/admin/cms/slider",{action:"discard"});await reload();
 })),
 btn("Version History",()=>change(async()=>{
  const info=await api("/api/admin/cms/slider/history"),v=info.versions||[];
  if(!v.length)return notify("No published slider versions yet.");
  const id=prompt("Slider versions:\n"+v.map(x=>x.revision_id+" · "+x.created_at).join("\n")+"\n\nEnter version to restore:");
  if(!id)return;if(!confirm("Restore and publish slider version "+id+"?"))return;
  await post("/api/admin/cms/slider",{action:"restore",revisionId:Number(id)});await reload();
 })),
 btn("Reload",reload)
 );
 reload();
})();
