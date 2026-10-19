(function(){
  "use strict";
  const select=document.getElementById("site-page-editor-select");
  const open=document.getElementById("site-page-editor-open");
  const status=document.getElementById("site-page-editor-status");
  if(!select||!open)return;
  open.addEventListener("click",()=>{
    const value=select.value;
    if(!value){if(status)status.textContent="Choose a page first.";return;}
    const url=new URL(value,location.href);
    url.searchParams.set("cms","1");
    window.open(url.toString(),"_blank","noopener");
    if(status)status.textContent="Visual editor opened in a new tab.";
  });
})();