/* READ & PRAY DAILY ROUTINE — active-page reminder on the main Bible reader.
   Background delivery requires a separately deployed push scheduler. */
(()=>{'use strict';
 const KEY='hk-read-pray-v2',LAST='hk-read-pray-last-v2';let notificationPending=false;
 const today=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 async function check(){if(notificationPending)return;let s;try{s=JSON.parse(localStorage.getItem(KEY)||'null')}catch{return}
  if(!s?.enabled||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time))return;
  const n=new Date(),day=today(n);if(n.toTimeString().slice(0,5)<s.time||localStorage.getItem(LAST)===day)return;
  if(!('Notification'in window)||Notification.permission!=='granted')return;
  notificationPending=true;try{if(localStorage.getItem(LAST)===day)return;const title='READ & PRAY DAILY ROUTINE',options={body:'Have you prayed today? It’s time to read God’s Word and pray.',tag:'hk-read-pray-daily',icon:'./icon-192.png',data:{url:new URL('./study-extensions.html',location.href).href}};
   if('serviceWorker'in navigator){const registration=await navigator.serviceWorker.ready;await registration.showNotification(title,options)}else new Notification(title,options);
   localStorage.setItem(LAST,day);
  }catch(e){console.warn('Read & Pray reminder unavailable:',e)}finally{notificationPending=false;}
 }
 check();setInterval(check,20000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});window.addEventListener('focus',check);
})();
