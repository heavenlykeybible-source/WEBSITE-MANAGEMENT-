/* Device verification happens in the operating system; no biometrics reach this site. */
window.CommunityPasskeys=(()=>{
 const supported=()=>window.isSecureContext&&!!window.PublicKeyCredential&&!!navigator.credentials;
 const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 const encode=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 const serialize=c=>({id:c.id,rawId:encode(c.rawId),type:c.type,authenticatorAttachment:c.authenticatorAttachment,clientExtensionResults:c.getClientExtensionResults(),response:c.response.attestationObject?{clientDataJSON:encode(c.response.clientDataJSON),attestationObject:encode(c.response.attestationObject),transports:c.response.getTransports?.()||[]}:{clientDataJSON:encode(c.response.clientDataJSON),authenticatorData:encode(c.response.authenticatorData),signature:encode(c.response.signature),userHandle:c.response.userHandle?encode(c.response.userHandle):null}});
 function options(data,registration){data.challenge=decode(data.challenge);if(registration){data.user.id=decode(data.user.id);for(const c of data.excludeCredentials||[])c.id=decode(c.id);}else for(const c of data.allowCredentials||[])c.id=decode(c.id);return data;}
 const message=e=>e.name==='NotAllowedError'?'Device verification was cancelled or timed out. Try again or use your password.':e.name==='InvalidStateError'?'This device already has a passkey. Try signing in with it.':e.message||'Device verification failed. Try your password.';
 function login({form,email,api,el,navigate}){
  if(!supported())return;
  const button=el('button','Sign in with Face ID / fingerprint','btn secondary'),feedback=el('p','','status');button.type='button';feedback.setAttribute('role','status');
  button.addEventListener('click',async()=>{if(!email.value||!email.reportValidity())return;button.disabled=true;feedback.textContent='Confirm on your device…';try{const data=await api('/api/auth/passkeys/login/options','POST',{email:email.value});const credential=await navigator.credentials.get({publicKey:options(data,false)});if(!credential)throw Error('Device verification was cancelled.');await api('/api/auth/passkeys/login/verify','POST',{credential:serialize(credential)});const me=await api('/api/me');navigate(me.user.status==='restricted'?'safety.html':'index.html');}catch(e){feedback.textContent=message(e);}finally{button.disabled=false;}});
  form.append(button,el('small','Uses a saved passkey and your device’s Face ID, fingerprint, or PIN.','muted'),feedback);
 }
 async function settings({root,api,el,card}){
  const panel=card('Face ID, fingerprint & passkeys','Add a passkey after creating your account. Your device keeps your biometric data private. Your password remains available for recovery.');root.append(panel);
  const feedback=el('p','','status');feedback.setAttribute('role','status');panel.append(feedback);
  if(!supported()){feedback.textContent='Use a browser with passkey support on a secure connection. You can still sign in with your password.';return;}
  const list=el('div',null,'stack'),form=el('form',null,'stack'),label=el('label','Device name'),name=el('input'),passwordLabel=el('label','Current password'),password=el('input'),button=el('button','Add Face ID / fingerprint','btn primary');
  name.maxLength=80;name.value='My device';name.autocomplete='off';label.append(name);password.type='password';password.required=true;password.maxLength=128;password.autocomplete='current-password';passwordLabel.append(password);button.type='submit';form.append(label,passwordLabel,button);panel.append(list,form);
  async function refresh(){const data=await api('/api/auth/passkeys');list.replaceChildren();if(!data.credentials.length)list.append(el('p','No passkeys added yet.'));for(const item of data.credentials){const row=el('div',null,'card'),remove=el('button','Remove','btn secondary');remove.type='button';row.append(el('strong',item.label),remove);remove.addEventListener('click',async()=>{if(!password.reportValidity())return;remove.disabled=true;try{await api('/api/auth/passkeys/remove','POST',{id:item.id,password:password.value});password.value='';await refresh();feedback.textContent='Passkey removed.';}catch(e){feedback.textContent=message(e);}finally{remove.disabled=false;}});list.append(row);}}
  form.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;feedback.textContent='Confirm on your device…';try{const data=await api('/api/auth/passkeys/register/options','POST',{password:password.value});password.value='';const credential=await navigator.credentials.create({publicKey:options(data,true)});if(!credential)throw Error('Device registration was cancelled.');await api('/api/auth/passkeys/register/verify','POST',{credential:serialize(credential),label:name.value});await refresh();feedback.textContent='Passkey added. Next time, enter your email and choose Face ID / fingerprint.';}catch(e){feedback.textContent=message(e);}finally{password.value='';button.disabled=false;}});
  try{await refresh();}catch(e){feedback.textContent=message(e);}
 }
 return {login,settings};
})();
