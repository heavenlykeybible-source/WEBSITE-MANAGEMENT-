/* Enhance existing pagination and leave its manual button available. */
(()=>{'use strict';if(!('IntersectionObserver' in window))return;
 const seen=new WeakSet(),observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const button=entry.target;observer.unobserve(button);if(button.isConnected&&!button.disabled)button.click();}},{rootMargin:'400px 0px'});
 function scan(){document.querySelectorAll('.social-stream button[data-load-more]').forEach(button=>{if(!seen.has(button)){seen.add(button);observer.observe(button);}});}
 const root=document.querySelector('#page-root');if(!root)return;new MutationObserver(scan).observe(root,{childList:true,subtree:true});scan();
})();
