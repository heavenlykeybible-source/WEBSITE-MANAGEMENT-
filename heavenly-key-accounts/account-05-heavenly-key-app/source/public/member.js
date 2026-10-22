(() => {
  const get=id=>document.getElementById(id);
  const connect=get('connect-member'),form=get('member-login'),status=get('member-status'),account=get('member-account'),name=get('member-name'),logout=get('member-logout'),learning=get('member-learning'),load=get('load-member-tracks'),list=get('member-tracks-list'),trackStatus=get('member-tracks-status');
  if(!connect||!form||!status||!account||!logout||!learning||!load||!list)return;
  let generation=0,signedIn=false;
  function clearMember(){
    generation++;signedIn=false;form.hidden=true;account.hidden=true;learning.hidden=true;
    name.textContent='';get('member-password').value='';get('member-email').value='';
    list.replaceChildren();trackStatus.textContent='';connect.hidden=false;
  }
  async function api(path,method='GET',data){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch('/api/member/'+path,{method,credentials:'same-origin',cache:'no-store',headers:method==='POST'?{'Content-Type':'application/json'}:{Accept:'application/json'},body:method==='POST'?JSON.stringify(data||{}):undefined,signal:controller.signal});
      const result=await response.json();
      if(!response.ok){const error=new Error(typeof result.error==='string'?result.error:'The connection could not be completed.');error.status=response.status;throw error;}
      return result;
    }catch(error){if(error.name==='AbortError')throw new Error('Connection timed out. Please try again.');throw error;}
    finally{clearTimeout(timeout);}
  }
  function displayMember(member){
    if(!member||!['active','restricted'].includes(member.status))throw Error('The member service returned an invalid profile.');
    signedIn=member.status==='active';name.textContent=member.displayName||'Community member';
    form.hidden=true;account.hidden=false;connect.hidden=true;learning.hidden=!signedIn;
    status.textContent=signedIn?'Connected to your existing Community account.':'Your account is restricted. Use the Community website for the review process.';
  }
  connect.addEventListener('click',async()=>{
    if(connect.disabled)return;connect.disabled=true;clearMember();const run=generation;
    status.textContent='Checking account connection…';
    try{
      const config=await api('config');if(run!==generation)return;
      if(config.enabled!==true){status.textContent='The account connection is still being tested. Please use the existing Community website for now.';return;}
      try{const data=await api('session');if(run===generation)displayMember(data.member);}
      catch(error){if(run!==generation)return;if(error.status===401){form.hidden=false;status.textContent='Sign in with your existing Community email and password.';}else throw error;}
    }catch(error){if(run===generation)status.textContent=error.message;}
    finally{connect.disabled=false;}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();const submit=get('member-submit');if(submit.disabled||form.hidden)return;
    submit.disabled=true;const run=generation;status.textContent='Signing in…';
    try{
      await api('login','POST',{email:get('member-email').value,password:get('member-password').value});
      get('member-password').value='';
      if(run!==generation)return;
      const data=await api('session');if(run===generation)displayMember(data.member);
    }catch(error){if(run===generation)status.textContent=error.message;}
    finally{get('member-password').value='';submit.disabled=false;}
  });
  logout.addEventListener('click',async()=>{
    if(logout.disabled)return;logout.disabled=true;connect.disabled=true;
    clearMember();status.textContent='Signing out…';
    try{await api('logout','POST');status.textContent='Signed out.';}
    catch(error){status.textContent=error.status===401?'Signed out.':error.message;}
    finally{logout.disabled=false;connect.disabled=false;}
  });
  load.addEventListener('click',async()=>{
    if(load.disabled||!signedIn)return;load.disabled=true;const run=generation;trackStatus.textContent='Loading your lessons…';
    try{
      const data=await api('tracks');if(run!==generation)return;list.replaceChildren();
      const tracks=Array.isArray(data.items)?data.items:[];
      for(const track of tracks){
        const section=document.createElement('section'),title=document.createElement('h3');title.textContent=track.title||'Discipleship track';section.append(title);
        for(const lesson of Array.isArray(track.lessons)?track.lessons:[]){
          if(!Number.isSafeInteger(lesson.id)||lesson.id<1)continue;
          const details=document.createElement('details');details.className='lesson';
          const summary=document.createElement('summary');summary.textContent=lesson.title+(lesson.completed?' — Completed':'');details.append(summary);
          for(const value of [lesson.scripture,lesson.body,lesson.question,lesson.action]){if(!value)continue;const p=document.createElement('p');p.textContent=value;details.append(p);}
          const label=document.createElement('label'),reflection=document.createElement('textarea'),complete=document.createElement('button'),result=document.createElement('p');
          reflection.id='reflection-'+lesson.id;reflection.maxLength=1200;label.htmlFor=reflection.id;label.textContent='Your reflection (optional)';
          complete.type='button';complete.className='action';complete.textContent=lesson.completed?'Lesson completed':'Mark lesson complete';complete.disabled=lesson.completed===true;
          result.className='note';result.setAttribute('role','status');details.append(label,reflection,complete,result);
          complete.addEventListener('click',async()=>{
            if(complete.disabled||!signedIn||run!==generation)return;complete.disabled=true;result.textContent='Saving…';
            try{const saved=await api('lessons/'+lesson.id+'/complete','POST',{reflection:reflection.value});if(run!==generation)return;if(saved.completed!==true)throw Error('Completion was not confirmed.');reflection.value='';complete.textContent='Lesson completed';summary.textContent=lesson.title+' — Completed';result.textContent='Saved to your existing Community account.';}
            catch(error){if(run!==generation)return;if(error.status===401||error.status===403){clearMember();status.textContent=error.message;}else{result.textContent=error.message;complete.disabled=false;}}
          });
          section.append(details);
        }
        list.append(section);
      }
      trackStatus.textContent=tracks.length?'Open a lesson to read and reflect.':'No discipleship lessons are available yet.';
    }catch(error){if(run!==generation)return;if(error.status===401||error.status===403){clearMember();status.textContent=error.message;}else trackStatus.textContent=error.message;}
    finally{load.disabled=false;}
  });
  // Private member content is memory-only. Wipe it when a cached page is restored.
  window.addEventListener('pageshow',event=>{if(event.persisted){clearMember();status.textContent='Reconnect to refresh your account.';}});
  window.addEventListener('pagehide',()=>clearMember());
})();
