(() => {'use strict';
const form=document.getElementById('auth'),token=document.getElementById('token'),status=document.getElementById('status'),report=document.getElementById('report'),rows=document.getElementById('rows');
form.addEventListener('submit',async event=>{
 event.preventDefault();report.hidden=true;rows.replaceChildren();status.textContent='Loading private statistics…';
 const credential=token.value;token.value='';
 try{
  const response=await fetch('/api/admin/download-counts',{headers:{Authorization:'Bearer '+credential},cache:'no-store',credentials:'omit'});
  if(!response.ok)throw new Error(response.status===401?'Access denied.':'Statistics unavailable ('+response.status+').');
  const result=await response.json();if(!Array.isArray(result.counts))throw new Error('Invalid statistics response.');
  for(const item of result.counts){const tr=document.createElement('tr');for(const value of [item.app_id,item.platform,item.downloads]){const td=document.createElement('td');td.textContent=String(value??'');tr.append(td)}rows.append(tr)}
  report.hidden=false;status.textContent=result.counts.length?'Private statistics loaded.':'No native package requests recorded yet.';
 }catch(error){status.textContent=error.message}
});
})();