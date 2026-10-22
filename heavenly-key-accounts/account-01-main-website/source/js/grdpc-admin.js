
export async function mountGRDPCAdmin(host,{api,el,getLevel}){
 host.replaceChildren(el('h3','GRDPC prayer reminders'),el('p','Sunday 8:00 PM and Monday 12:00 midnight, Nigeria time. Monday midnight is Sunday night entering Monday. The requested Monday noon, 6 PM and 11:30 PM reminders need clarification before activation.'));
 const link=el('a','Open permanent live / subscription page','btn btn-secondary');link.href='grdpc.html';link.target='_blank';link.rel='noopener noreferrer';host.append(link);
 const state=el('p','Loading…','form-status');state.setAttribute('role','status');host.append(state);
 try{const data=await api('/api/admin/grdpc'),c=data.config,form=el('form'),fields={};
 function field(key,text,type='text'){const input=el('input');input.type=type;input.value=c[key]??'';const label=el('label',text);label.append(input);form.append(label);fields[key]=input;return input;}
 const phone=field('phone','Subscription WhatsApp phone (international digits, without +)');phone.inputMode='tel';
 const number=field('accountId','Sending account ID (from WhatsApp Numbers)','number');number.min=1;
 field('template','Approved Meta template name');field('language','Template language code');const budget=field('dailyLimit','Maximum reminder messages per day','number');budget.min=1;budget.max=1000;
 const times=el('textarea');times.rows=6;times.value=c.reminders.map(r=>r.day+' '+r.time).join('\n');const tl=el('label','Reminder times in Nigeria time: day number and HH:MM, one per line. Sunday=0, Monday=1 … Saturday=6.');tl.append(times);form.append(tl);
 function check(key,text){const input=el('input');input.type='checkbox';input.checked=c[key];const label=el('label',text);label.append(input);form.append(label);fields[key]=input;}
 check('timingConfirmed','I have resolved the Monday timing and confirmed all reminder days.');
 check('enabled','Enable automatic WhatsApp reminders (messages may incur Meta charges).');
 const save=el('button','Save reminder settings','btn btn-primary');save.type='submit';form.append(save);
 if(getLevel()<4){for(const input of form.querySelectorAll('input,textarea,button'))input.disabled=true;form.append(el('p','Owner or deputy access is required to change reminder settings.'));}
 form.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity())return;save.disabled=true;try{const payload={};for(const [key,input]of Object.entries(fields))payload[key]=input.type==='checkbox'?input.checked:input.value;payload.reminders=times.value.trim().split(/\n/).map(line=>{const [day,time]=line.trim().split(/\s+/);return {day:Number(day),time};});await api('/api/admin/grdpc','POST',payload);state.textContent=payload.enabled?'Reminders enabled.':'Settings saved; sending paused.';}catch(e){state.textContent=e.message;}finally{save.disabled=false;}});
 host.append(form,el('h4','Meta template text (body only)'),el('p','Create this exact template in Meta with three text variables: programme, date/time, and live page URL. Activation checks that Meta has approved it and the subscription number matches the sending number.'));
 const template=el('pre',data.templateBody);template.style.whiteSpace='pre-wrap';host.append(template);
 host.append(el('h4','Subscribers'));for(const row of data.counts)host.append(el('p',row.status+': '+row.total));if(!data.counts.length)host.append(el('p','No subscriptions yet.'));
 host.append(el('h4','Recent reminder results'));for(const row of data.deliveries)host.append(el('p',row.slot+' · '+row.status+' · '+row.total));if(!data.deliveries.length)host.append(el('p','No reminders sent yet.'));
 host.append(el('p','Send status means Meta accepted the message. Delivered/read status arrives from the verified webhook. Unconfirmed sends are not automatically retried to avoid duplicates. Each reminder is processed in batches of 20 for up to 15 minutes; excess recipients are skipped. Sound follows the recipient’s WhatsApp settings.'));
 state.textContent=c.enabled?'Automatic sending enabled.':'Automatic sending paused.';
 }catch(e){state.textContent=e.message;}
}
