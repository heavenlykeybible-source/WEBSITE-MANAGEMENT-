export function improveCodingChat(worker){
 worker=worker.replace("var inp=h('textarea',{rows:1,'aria-label':'Message your AI',placeholder:'Message your AI…'});var busy=false;","var inp=h('textarea',{rows:1,'aria-label':'Message your AI',placeholder:'Message your AI… Enter to send · Shift+Enter for a new line'});var busy=false;");
 if(!worker.includes("inp.onkeydown=function(event)"))worker=worker.replace("  var options=h('details',{class:'chat-options'}", "  inp.onkeydown=function(event){if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();send.onclick();}};\n  var options=h('details',{class:'chat-options'}");
 if(!worker.includes("var preferred=st.accounts.find"))worker=worker.replace("var st=await api('ai');","var st=await api('ai');if(!CHAT_AI){var preferred=st.accounts.find(function(a){return a.provider!=='cloudflare';});if(preferred)CHAT_AI=String(preferred.id);}");
 worker=worker.replace("await refreshAccess();\n  var log=", "refreshAccess();\n  var log=");
 worker=worker.replace("await verificationPanel(providerBox);", "verificationPanel(providerBox);");
 worker=worker.replace("try{var savedChats=await api('ai/history');", "api('ai/history').then(function(savedChats){").replace("CHAT_FILES=[];claude();}};}catch(e){}", "CHAT_FILES=[];claude();}};}).catch(function(){});");
 worker=worker.replace("send.textContent='Working…';", "send.textContent='Sending…';fileStatus.textContent='Your message is being processed. Coding tasks may take longer than conversation.';");
 worker=worker.replace("send.textContent='Send';});", "send.textContent='Send';inp.focus();});");
 worker=worker.replace("gemini:{label:'Google Gemini',provider:'openai',base:'https://generativelanguage.googleapis.com/v1beta/openai',model:''}","gemini:{label:'Google Gemini · free tier available',provider:'openai',base:'https://generativelanguage.googleapis.com/v1beta/openai',model:'gemini-3.7-flash'}");
 worker=worker.replace("groq:{label:'Groq',provider:'openai',base:'https://api.groq.com/openai/v1',model:''}","groq:{label:'Groq · coding / free-tier limits',provider:'openai',base:'https://api.groq.com/openai/v1',model:'qwen/qwen3.6-27b'}");
 worker=worker.replace("openrouter:{label:'OpenRouter',provider:'openai',base:'https://openrouter.ai/api/v1',model:''}","openrouter:{label:'OpenRouter · free models',provider:'openai',base:'https://openrouter.ai/api/v1',model:'openrouter/free'}");
 const codingStandard=' Coding and website standard: first inspect the actual existing files and stated requirements. Preserve the architecture, functionality, branding, data, responsive design and existing integrations. Make targeted multi-file changes when needed; never replace a full application with a generic HTML landing page. Treat screenshots and the owner requirements as acceptance criteria. Verify relevant routes, asset links, mobile layout and syntax where your tools permit; clearly report anything untested. Distinguish implemented, proposed, deployed and verified states. Keep normal chat concise and do not invoke tools for greetings. Do not claim professional testing you did not perform. ';
 const repeated="'"+codingStandard+"' + ";
 worker=worker.split(repeated).join('');
 worker=worker.replace("const system = AI_SYSTEM + ",()=>"const system = AI_SYSTEM + "+repeated);

 return worker;
}
