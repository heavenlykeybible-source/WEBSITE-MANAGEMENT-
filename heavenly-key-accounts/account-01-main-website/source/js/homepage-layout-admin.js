(function(){
 "use strict";
 const root=document.getElementById("cms-section-manager");if(!root)return;
 const labels={hero:"Hero / welcome banner",media:"Media & community cards",bottom:"President's message and support"};
 const defaults=["hero","media","bottom"].map(id=>({id,visible:true,background:""}));
 let areas=defaults.map(x=>({...x})),busy=false;
 const status=document.createElement("p");status.className="cms-builder-status";status.setAttribute("role","status");
 const list=document.createElement("div");list.className="cms-slide-items";
 const controls=document.createElement("div");controls.className="cms-builder-actions";
 root.append(document.createElement("hr"),controls,list,status);
 const API="/api/admin/cms/layout";
 const api=async(path,options={})=>{const res=await fetch(path,{credentials:"same-origin",...options});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error?.message||data.error||"Unable to complete request");return data;};
 const post=(action,other={})=>api(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...other})});
 const el=(tag,copy,cls)=>{const node=document.createElement(tag);if(copy!==undefined)node.textContent=copy;if(cls)node.className=cls;return node;};
 const btn=(name,fn)=>{const node=el("button",name);node.type="button";node.addEventListener("click",fn);return node;};
 const announce=message=>status.textContent=message;
 async function upload(file){
  if(!file||file.size>8*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type))throw Error("Choose a picture up to 8 MB (JPEG, PNG, WebP).");
  const data=await api("/api/admin/cms/assets",{method:"POST",headers:{"Content-Type":file.type,"X-Filename":encodeURIComponent(file.name)},body:file});
  return data.url;
 }
 function move(a,b){if(b<0||b>=areas.length)return;const [item]=areas.splice(a,1);areas.splice(b,0,item);render();}
 function render(){
  list.replaceChildren();
  areas.forEach((row,index)=>{
   const wrap=el("article",undefined,"cms-section-row");
   wrap.draggable=true;
   wrap.addEventListener("dragstart",event=>event.dataTransfer.setData("text/plain",String(index)));
   wrap.addEventListener("dragover",event=>event.preventDefault());
   wrap.addEventListener("drop",event=>{event.preventDefault();const from=Number(event.dataTransfer.getData("text/plain"));if(Number.isInteger(from)&&from>=0&&from<areas.length)move(from,index);});
   const title=el("h4",labels[row.id]);wrap.append(title);
   const visible=el("label",undefined,"cms-slide-checkbox"),check=el("input");
   check.type="checkbox";check.checked=row.visible;
   check.disabled=row.id==="hero";check.addEventListener("change",()=>row.visible=check.checked);
   visible.append(check,el("span",row.id==="hero"?"Hero must remain visible":"Display section on public website"));wrap.append(visible);
   const field=el("label",undefined,"cms-builder-field");
   field.append(el("span","Custom background picture (optional)"));
   const path=el("input");path.value=row.background;path.placeholder="Upload a picture or choose from library";path.addEventListener("input",()=>{row.background=path.value;preview.src=path.value;});
   const preview=el("img");preview.alt="Section background preview";preview.src=row.background;preview.className="cms-layout-preview";
   field.append(path,preview);wrap.append(field);
   const upl=el("input");upl.type="file";upl.accept="image/jpeg,image/png,image/webp";upl.setAttribute("aria-label","Upload background for "+labels[row.id]);
   upl.addEventListener("change",async()=>{try{announce("Uploading background picture…");const url=await upload(upl.files[0]);row.background=url;render();announce("Uploaded. Save the layout draft to keep this picture.");}catch(e){announce(e.message);}});
   wrap.append(upl);
   const gallery=el("select");const none=el("option","Choose picture from library…");none.value="";gallery.append(none);
   fetch("/api/admin/cms/assets",{credentials:"same-origin"}).then(async r=>{if(!r.ok)return;const d=await r.json();(d.items||[]).forEach(item=>{const option=el("option",item.filename);option.value=item.url;gallery.append(option);});}).catch(()=>{});
   gallery.addEventListener("change",()=>{if(!gallery.value)return;row.background=gallery.value;path.value=row.background;preview.src=row.background;});
   wrap.append(gallery);
   const commands=el("div",undefined,"cms-builder-actions");commands.append(btn("↑ Move up",()=>move(index,index-1)),btn("↓ Move down",()=>move(index,index+1)),btn("Remove background",()=>{row.background="";render();}));
   wrap.append(commands);list.append(wrap);
  });
 }
 async function load(){try{const result=await api(API);areas=(result.sections||defaults).map(x=>({...x}));render();announce(result.hasDraft?"Saved layout draft loaded.":"Homepage sections ready.");}catch(e){announce(e.message);}}
 async function run(callback){if(busy)return;busy=true;controls.querySelectorAll("button").forEach(b=>b.disabled=true);try{await callback();}catch(e){announce(e.message);}finally{busy=false;controls.querySelectorAll("button").forEach(b=>b.disabled=false);}}
 controls.append(
  btn("Save Layout Draft",()=>run(async()=>{await post("save-draft",{sections:areas});announce("Layout draft saved. Public site unchanged.");})),
  btn("Publish Layout",()=>run(async()=>{if(!confirm("Publish this section order, visibility and background design to the public homepage?"))return;await post("save-draft",{sections:areas});await post("publish");announce("Homepage layout published.");})),
  btn("Discard Draft",()=>run(async()=>{if(!confirm("Discard draft layout?"))return;await post("discard");await load();})),
  btn("Restore Layout",()=>run(async()=>{const history=await api(API+"?history=1");const list=history.versions||[];if(!list.length)return announce("No layout revisions yet.");
   const id=prompt("Layout versions:\n"+list.map(v=>v.revision_id+" · "+v.updated_at).join("\n")+"\nEnter version to restore:");
   if(!id||!confirm("Restore and publish revision "+id+"?"))return;await post("restore",{revisionId:Number(id)});await load();
  })),
  btn("Reload",load)
 );
 load();
})();
