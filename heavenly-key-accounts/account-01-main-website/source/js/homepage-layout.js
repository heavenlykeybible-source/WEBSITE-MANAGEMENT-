/* Homepage section arrangement and background pictures, saved from normal Admin.
 * Layout drafts are visible only to signed-in admins using ?cms=1 or ?cms=preview. */
(function(){
 "use strict";
 const areas={hero:document.querySelector('[data-cms-section="hero"]'),media:document.querySelector('[data-cms-section="media"]'),bottom:document.querySelector('[data-cms-section="bottom"]')};
 const before=document.querySelector(".verse");if(!before||!areas.hero)return;
 const mode=new URL(location.href).searchParams.get("cms");
 const adminView=mode==="1"||mode==="preview";
 const endpoint=adminView?"/api/admin/cms/layout":"/api/site-content/layout";
 function setBackground(el,value,id){
  if(!value)return;
  const url=value.replaceAll('"',"%22").replaceAll(")", "%29");
  el.style.backgroundImage=id==="hero"?'linear-gradient(90deg,#092d69aa,#07194299),url("'+url+'")':'linear-gradient(90deg,#ffffffe0,#ffffffe0),url("'+url+'")';
  el.style.backgroundSize="cover";el.style.backgroundPosition="center";
 }
 fetch(endpoint,{credentials:"same-origin",headers:{Accept:"application/json"}})
 .then(r=>r.ok?r.json():null)
 .then(data=>{
  if(!data||!Array.isArray(data.sections))return;
  for(const section of data.sections){
   const el=areas[section.id];if(!el)continue;
   el.style.display=section.visible||adminView?"":"none";
   if(!section.visible&&adminView){el.style.outline="4px dashed #af6412";el.title="Hidden in published homepage";}else{el.style.outline="";el.removeAttribute("title");}
   setBackground(el,section.background||"",section.id);
  }
  for(const section of data.sections){const el=areas[section.id];if(el)before.parentElement.insertBefore(el,before);}
 })
 .catch(()=>{/* Keep the existing approved design if settings are unavailable */});
})();
