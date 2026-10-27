/* The all-in-one app is rendered directly, without embedding another origin. */
(()=>{'use strict';
 const body=document.body, shell=document.querySelector('.shell'),restore=document.querySelector('.app-window-restore');
 if(!shell||!restore)return;
 const controls=document.querySelector('.app-window-controls'),expand=controls.querySelector('[data-window="expand"]');
 const sizes=['small','normal','large'];let size='normal',beforeExpand='normal';
 function apply(next){size=next;body.dataset.windowSize=next;expand.setAttribute('aria-pressed',String(next==='expanded'));expand.textContent=next==='expanded'?'Restore size':'Expand';}
 controls.addEventListener('click',event=>{const button=event.target.closest('[data-window]');if(!button)return;switch(button.dataset.window){
 case 'smaller':apply(sizes[Math.max(0,sizes.indexOf(size==='expanded'?beforeExpand:size)-1)]);break;
 case 'larger':apply(sizes[Math.min(sizes.length-1,sizes.indexOf(size==='expanded'?beforeExpand:size)+1)]);break;
 case 'expand':if(size==='expanded')apply(beforeExpand);else{beforeExpand=size;apply('expanded');}break;
 case 'minimize':body.classList.add('app-minimized');shell.setAttribute('inert','');restore.hidden=false;restore.focus();break;
 }});
 restore.addEventListener('click',()=>{body.classList.remove('app-minimized');shell.removeAttribute('inert');restore.hidden=true;controls.querySelector('[data-window="minimize"]').focus();});
 apply(size);
})();
