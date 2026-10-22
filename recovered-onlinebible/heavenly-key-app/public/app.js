(() => {
  const tabs = Array.from(document.querySelectorAll(".tabbar button[data-screen]"));
  const views = Array.from(document.querySelectorAll(".view"));
  const valid = new Set(views.map(v => v.id));
  function show(screen, pushHistory = false) {
    if (!valid.has(screen)) screen = "home";
    for (const view of views) {
      view.hidden = view.id !== screen;
      view.classList.toggle("active", view.id === screen);
    }
    for (const tab of tabs) {
      const parent = {bible:"grow",prayer:"community",messages:"community",groups:"community",live:"home",settings:"profile"}[screen] || screen;
      if (tab.dataset.screen === parent) tab.setAttribute("aria-current","page");
      else tab.removeAttribute("aria-current");
    }
    // Preserve browser/iPhone Back navigation for user-selected app screens.
    if (pushHistory && window.location.hash.slice(1) !== screen)
      history.pushState(null,"","#"+screen);
    if(pushHistory){const heading=document.getElementById(screen)?.querySelector('h1');if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}}
    window.scrollTo({top:0,behavior:"auto"});
  }
  document.querySelectorAll("[data-screen]").forEach(el =>
    el.addEventListener("click", () => show(el.dataset.screen, true)));
  function restoreLocation() {
    const screen = location.hash.slice(1);
    // #main is the native accessibility skip link, not an app screen.
    // Do not replace its hash or defeat keyboard/screen-reader navigation.
    if (!screen || valid.has(screen)) show(screen || "home");
  }
  window.addEventListener("hashchange", restoreLocation);
  window.addEventListener("popstate", restoreLocation);
  // Optional public reads: no credentials, background polling or media downloads.
  function setupPublicList(kind, endpoint) {
    const button=document.getElementById("load-"+kind),status=document.getElementById(kind+"-status"),list=document.getElementById(kind+"-list");
    if (!button || !status || !list) return;
    button.addEventListener("click",async()=>{
      if(button.disabled)return;
      button.disabled=true;status.textContent="Loading…";
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
      try {
        const response=await fetch(endpoint,{credentials:"omit",cache:"no-store",signal:controller.signal});
        const data=await response.json();
        if(!response.ok)throw new Error(response.status===503?"This connection is still being prepared. Please use the Community website for now.":"Could not load this content. Please try again.");
        list.replaceChildren();
        const items=Array.isArray(data.items)?data.items.slice(0,20):[];
        for(const item of items){
          if(!item || typeof item!=="object" || item.post_type==="video" || item.type==="video")continue;
          const article=document.createElement("article");article.className="public-item";
          const heading=document.createElement("h3"),body=document.createElement("p");
          heading.textContent=String(kind==="feed"?(item.display_name||"Community member"):(item.title||"Discipleship track")).slice(0,160);
          body.textContent=String(kind==="feed"?(item.body||""):(item.description||"")).slice(0,5000);
          article.append(heading,body);list.append(article);
        }
        status.textContent=list.childElementCount?"Public content loaded. Member actions remain on the Community website.":"No public content is available yet.";
      }catch(error){status.textContent=error.name==="AbortError"?"Connection timed out. Please try again.":error.message;}
      finally{clearTimeout(timeout);button.disabled=false;}
    });
  }
  setupPublicList("feed","/api/community/feed");
  setupPublicList("tracks","/api/community/tracks");
  const verses = {
    john:["John 3:16","For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."],
    psalm:["Psalm 27:14","Wait on the LORD: be of good courage, and he shall strengthen thine heart: wait, I say, on the LORD."],
    proverbs:["Proverbs 3:5","Trust in the LORD with all thine heart; and lean not unto thine own understanding."]
  };
  const select=document.getElementById("passage");
  select?.addEventListener("change", () => {
    const [ref,verse]=verses[select.value] || verses.john;
    document.getElementById("verse-ref").textContent=ref;
    document.getElementById("verse-text").textContent=verse;
  });
  show(valid.has(location.hash.slice(1)) ? location.hash.slice(1) : "home");
  if ("serviceWorker" in navigator && location.protocol === "https:")
    window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{document.getElementById("app-connection")?.setAttribute("data-offline-unavailable","true");}));
})();

