/* Dynamic homepage slider. Keep existing design until the normal admin publishes slides. */
(function(){
 "use strict";
 const slider=document.querySelector(".slider"),thumbs=document.querySelector(".thumbs");
 if(!slider)return;
 const fallback=Array.from(slider.querySelectorAll(".slide")).map((el,i)=>({
  id:"original-"+(i+1),src:el.querySelector("img")?.getAttribute("src")||"",alt:el.querySelector("img")?.alt||"",
  caption:(el.querySelector(".caption")?.cloneNode(true).textContent||"").trim().slice(0,180),
  subtitle:el.querySelector(".caption small")?.textContent||"",enabled:true
 }));
 let slides=[],dots=[],thumbImages=[],index=0,timer=null;
 function pick(i){
  const nodes=Array.from(slider.querySelectorAll(".slide"));
  if(!nodes.length)return;
  index=(i+nodes.length)%nodes.length;
  nodes.forEach((el,j)=>el.classList.toggle("active",j===index));
  dots.forEach((el,j)=>el.classList.toggle("on",j===index));
  thumbImages.forEach((el,j)=>{el.style.outline=j===index?"3px solid #ffd500":"";});
 }
 function refresh(){
  const nodes=Array.from(slider.querySelectorAll(".slide"));
  dots=Array.from(slider.querySelectorAll(".dot"));
  thumbImages=Array.from(thumbs?.querySelectorAll("img")||[]);
  nodes.forEach((el,j)=>{el.classList.toggle("active",j===0);});
  dots.forEach((dot,j)=>dot.addEventListener("click",()=>{pick(j);start();}));
  thumbImages.forEach((img,j)=>{img.setAttribute("role","button");img.tabIndex=0;img.addEventListener("click",()=>{pick(j);start();});img.addEventListener("keydown",e=>{if(e.key==="Enter"){pick(j);start();}});});
  index=0;pick(0);
 }
 function start(){if(timer)clearInterval(timer);if(!document.hidden&&slider.querySelectorAll(".slide").length>1)timer=setInterval(()=>pick(index+1),5000);}
 function render(config){
  const dotsBox=slider.querySelector(".dots");
  slider.querySelectorAll(".slide").forEach(el=>el.remove());
  dotsBox?.replaceChildren();thumbs?.replaceChildren();
  const enabled=config.filter(s=>s.enabled&&s.src);
  for(const item of enabled){
   const slide=document.createElement("div");slide.className="slide";
   const img=document.createElement("img");img.src=item.src;img.alt=item.alt||"";img.loading="lazy";
   const shade=document.createElement("div");shade.className="shade";
   const caption=document.createElement("div");caption.className="caption";
   const main=document.createElement("strong");main.textContent=item.caption||"";
   const small=document.createElement("small");small.textContent=item.subtitle||"";
   caption.append(main,small);slide.append(img,shade,caption);dotsBox?slider.insertBefore(slide,dotsBox):slider.append(slide);
   const dot=document.createElement("i");dot.className="dot";dot.setAttribute("role","button");dot.tabIndex=0;dotsBox?.append(dot);
   const thumb=document.createElement("img");thumb.src=item.src;thumb.alt=item.alt||"";thumb.loading="lazy";thumbs?.append(thumb);
  }
  refresh();start();
 }
 slider.querySelector(".next")?.addEventListener("click",()=>{pick(index+1);start();});
 slider.querySelector(".prev")?.addEventListener("click",()=>{pick(index-1);start();});
 document.addEventListener("visibilitychange",start);
 slider.addEventListener("mouseenter",()=>{if(timer)clearInterval(timer);});
 slider.addEventListener("mouseleave",start);
 refresh();start();
 const mode=new URL(location.href).searchParams.get("cms");
 const endpoint=mode==="1"||mode==="preview"?"/api/admin/cms/slider":"/api/site-content/slider";
 fetch(endpoint,{credentials:"include",headers:{Accept:"application/json"}})
 .then(r=>r.ok?r.json():null)
 .then(data=>{if(data&&Array.isArray(data.slides))render(data.slides);})
 .catch(()=>{/* current approved layout remains usable */});
})();
