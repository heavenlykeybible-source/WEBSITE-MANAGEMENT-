document.addEventListener('DOMContentLoaded',function(){
 const explore=document.querySelector('#all-bible-tools .feature-grid');
 const study=document.getElementById('bible-study-tools');
 if(!explore||!study)return;
 const grid=study.querySelector('.study-tools-grid');
 const featureNames=['Search','Bookmarks','Notes','Topical Bible'];
 const quickNames=['important','references'];
 const quickButtons=[...document.querySelectorAll('.reader-sidebar button[data-tool]')];
 const quick=quickNames.map(n=>quickButtons.find(b=>b.dataset.tool===n)).filter(Boolean);
 const labels=['Important Verses','Cross References'];
 quick.forEach((b,i)=>{let label=b.querySelector('span:not(.quick-icon):not(.chevron)');if(label)label.textContent=labels[i];grid.appendChild(b)});
 featureNames.forEach(name=>{const card=[...explore.querySelectorAll('a.feature-card')].find(a=>a.querySelector('strong')?.textContent.trim()===name);if(card){grid.appendChild(card)}});
 const launcher=explore.querySelector('.feature-0');
 launcher?.addEventListener('click',function(e){e.preventDefault();study.open=true;study.scrollIntoView({block:'start',behavior:'smooth'});});
});

document.getElementById("hk-hymn-search")?.addEventListener("submit",function(e){e.preventDefault();const q=document.getElementById("hk-hymn-query").value.trim();const url="./old-time-gospel-revival-hymn-book.html"+(q?"?search="+encodeURIComponent(q):"");window.location.href=url})

(function(){var pending=null,button=document.getElementById("bible-install-now"),status=document.getElementById("bible-install-status");window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();pending=e;button.hidden=false});button.addEventListener("click",async function(){if(!pending){status.textContent="Choose your device below for installation instructions.";return}var event=pending;pending=null;button.hidden=true;try{await event.prompt();var choice=await event.userChoice;status.textContent=choice&&choice.outcome==="accepted"?"Installation accepted. Look for Heavenly Key Bible on your device.":"Installation cancelled. You can install later."}catch(_){status.textContent="Direct installation is unavailable. Choose your device below."}});window.addEventListener("appinstalled",function(){pending=null;button.hidden=true;status.textContent="Heavenly Key Bible installed successfully."})})();