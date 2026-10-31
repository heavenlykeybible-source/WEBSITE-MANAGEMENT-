const loginForm=document.querySelector('#owner-login');
if(loginForm){
  // Keep the current session when opening a new tab or returning to sign in.
  fetch('/api/owner/session',{credentials:'same-origin',cache:'no-store',redirect:'error'})
    .then(response=>response.ok?response.json():null)
    .then(data=>{if(data?.signedIn===true)location.assign('/');})
    .catch(()=>{});
  const toggle=document.querySelector('#show-password');
  toggle?.addEventListener('change',()=>{document.querySelector('#password').type=toggle.checked?'text':'password';});
  loginForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const status=document.querySelector('#login-status');
    const button=loginForm.querySelector('button[type="submit"]')||loginForm.querySelector('button');
    const passwordField=document.querySelector('#password');
    const usernameField=document.querySelector('#username');
    if(button.disabled)return;
    button.disabled=true;
    status.textContent='Checking your sign-in securely…';
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch('/api/owner/login',{
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        redirect:'error',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({username:usernameField.value.trim(),password:passwordField.value}),
        signal:controller.signal
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        if(response.status===429)throw Error('Too many sign-in attempts. Please try again after the security cooldown.');
        if(response.status===503)throw Error('Owner sign-in is temporarily unavailable. Please try again or contact the site administrator.');
        throw Error(typeof data.error==='string'?data.error:'Sign-in failed. Check your username and password.');
      }
      if(data.ok!==true)throw Error('The sign-in response was incomplete. Please try again.');
      // Navigate only after a verified response; HttpOnly session cookie is set by the server.
      location.assign('/');
    }catch(error){
      status.textContent=error?.name==='AbortError'?'Sign-in timed out. Please check your connection and try again.':(error?.message||'Could not sign in. Please try again.');
      passwordField.value='';
      passwordField.focus();
    }finally{
      clearTimeout(timeout);
      button.disabled=false;
    }
  });
}
