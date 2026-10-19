(function () {
  "use strict";

  const EDITABLE_PAGES = new Set([
    "home","about","community","contact","events","grdpc","i-said-yes","legal-requests",
    "ministries","missions","partner","privacy","radio","resources","terms","video"
  ]);

  function pageKey() {
    const name = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/i, "").toLowerCase();
    const key = name === "index" || name === "" ? "home" : name;
    return EDITABLE_PAGES.has(key) ? key : "";
  }

  function hash32(input) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36).padStart(7, "0");
  }

  function elementPath(element, root) {
    const parts = [];
    let current = element;
    while (current && current !== root) {
      // Explicit homepage section identities keep saved edits stable after sections move.
      if(current.hasAttribute("data-cms-section")){parts.unshift("section-id:"+current.getAttribute("data-cms-section"));break;}
      const parent = current.parentElement;
      if (!parent) break;
      const tag = current.tagName.toLowerCase();
      const siblings = Array.from(parent.children).filter((node) => node.tagName === current.tagName);
      parts.unshift(tag + ":" + Math.max(0, siblings.indexOf(current)));
      current = parent;
    }
    return parts.join("/");
  }

  function ignored(parent) {
    return !parent ||
      !!parent.closest("[data-cms-ignore],.slidercol,script,style,noscript,template,svg,textarea,input,select,option") ||
      parent.closest(".cms-toolbar,.cms-image-panel") !== null;
  }

  function collect(root) {
    const text = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (ignored(parent)) continue;
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      const childIndex = Array.prototype.indexOf.call(parent.childNodes, node);
      const raw = elementPath(parent, root) + "|text:" + childIndex;
      text.push({ key: "t_" + hash32(raw), node, original: node.nodeValue });
    }

    const images = Array.from(root.querySelectorAll("img")).filter((img) => !img.closest("[data-cms-ignore]")).map((img) => {
      const path = elementPath(img, root);
      return {
        srcKey: "i_" + hash32(path + "|src"),
        altKey: "a_" + hash32(path + "|alt"),
        img,
        originalSrc: img.getAttribute("src") || "",
        originalAlt: img.getAttribute("alt") || ""
      };
    });

    const links = Array.from(root.querySelectorAll("a[href]")).filter(link=>!ignored(link)).map(link=>({
      key:"t_"+hash32(elementPath(link,root)+"|href"),link,original:link.getAttribute("href")||""
    }));
    return { text, images, links };
  }

  function apiUrl(admin) {
    const page = pageKey();
    return (admin ? "/api/admin/cms/page" : "/api/site-content/cms") + "?page=" + encodeURIComponent(page);
  }

  async function readOverrides(admin) {
    const response = await fetch(apiUrl(admin), {
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error(payload?.error?.message || "Unable to load editable page content.");
    return payload.content || {};
  }

  function safeImage(value) {
    if (typeof value !== "string" || !value || value.length > 2048 || /[\\u0000-\\u001f<>\"'\\\\]/.test(value)) return false;
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    if (/^(?:\\.\\/|\\.\\.\\/)?[a-zA-Z0-9_-]/.test(value) && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return !value.includes("..\\");
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }

  function safeLink(value) {
    if(typeof value!=="string"||!value||value.length>500||/[\u0000-\u001f"'<>\\()]/.test(value))return false;
    if(value.startsWith("#"))return /^#[a-zA-Z0-9_-]*$/.test(value);
    if(/^https:\/\//i.test(value)){try{return new URL(value).protocol==="https:";}catch{return false;}}
    if(/^mailto:/i.test(value))return /^mailto:[a-zA-Z0-9._+%-]+@[a-zA-Z0-9.-]+$/.test(value);
    if(/^tel:/i.test(value))return /^tel:\+?[0-9-]{5,25}$/.test(value);
    return !value.startsWith("//")&&!value.includes("..")&&/^[a-zA-Z0-9_./?#%&=+-]+$/.test(value);
  }

  function applyOverrides(descriptors, content) {
    descriptors.text.forEach((item) => {
      const saved = content[item.key];
      if (saved && saved.type === "text") item.node.nodeValue = saved.value;
    });
    descriptors.images.forEach((item) => {
      const src = content[item.srcKey];
      const alt = content[item.altKey];
      if (src && src.type === "image") { if(src.value && safeImage(src.value)){item.img.setAttribute("src", src.value);item.img.hidden=false;}else{item.img.removeAttribute("src");item.img.hidden=true;} }
      if (alt && alt.type === "alt") item.img.setAttribute("alt", alt.value);
    });
    descriptors.links.forEach(item=>{
      const saved=content[item.key];
      if(saved && saved.type==="text" && safeLink(saved.value))
        item.link.setAttribute("href",saved.value);
    });
  }

  function addEditorStyles() {
    const style = document.createElement("style");
    style.setAttribute("data-cms-ignore", "");
    style.textContent = `
      body.cms-editing{padding-bottom:86px}
      .cms-editing [data-cms-text]{outline:1px dashed rgba(194,134,0,.85);outline-offset:2px;border-radius:3px}
      .cms-editing [data-cms-text]:focus{outline:2px solid #0b5bd3;background:#fff9dc;color:#111}
      .cms-editing [data-cms-image]{outline:3px solid rgba(130,17,42,.72);outline-offset:2px;cursor:pointer}
      .cms-toolbar{position:fixed;z-index:2147483000;left:12px;right:12px;bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-radius:14px;background:rgba(5,27,59,.97);color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.3);font-family:system-ui,sans-serif}
      .cms-toolbar strong{margin-right:auto}.cms-toolbar button{border:0;border-radius:9px;padding:9px 13px;font-weight:800;cursor:pointer}
      .cms-save{background:#f4c542;color:#10264e}.cms-reset{background:#8e1730;color:#fff}.cms-exit{background:#fff;color:#17396c}
      .cms-status{width:100%;font-size:12px;color:#d9e6ff}
      .cms-image-panel{position:fixed;z-index:2147483001;right:16px;top:16px;width:min(390px,calc(100vw - 32px));padding:14px;border-radius:14px;background:#fff;color:#17233a;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:system-ui,sans-serif}
      .cms-image-panel label{display:grid;gap:5px;margin:9px 0;font-weight:700;font-size:13px}.cms-image-panel input{width:100%;box-sizing:border-box;padding:9px;border:1px solid #bcc8d8;border-radius:8px}
      .cms-restore-image{padding:8px;background:#f6d487;color:#34290b;border:1px dashed #a67719;border-radius:7px;cursor:pointer;font-weight:700;margin:5px}
      .cms-image-panel .row{display:flex;justify-content:flex-end;gap:8px}.cms-image-panel button{border:0;border-radius:8px;padding:8px 11px;font-weight:800;cursor:pointer}
      .cms-image-apply{background:#17396c;color:#fff}.cms-image-close{background:#eef2f7;color:#17396c}
      .cms-image-panel{max-height:90vh;overflow:auto}.cms-image-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-height:175px;overflow:auto}.cms-image-grid img{height:64px;width:100%;object-fit:cover}.cms-image-grid button{padding:2px!important;background:#f0f3f9;border:1px solid #bbc6d8!important}.cms-upload{width:100%;max-width:100%}
    `;
    document.head.append(style);
  }

  function openImagePanel(item) {
    document.querySelector(".cms-image-panel")?.remove();
    const panel = document.createElement("div");
    panel.className = "cms-image-panel";
    panel.setAttribute("data-cms-ignore", "");
    panel.innerHTML = '<strong>Edit picture</strong><p style="font-size:12px">Use an existing site image path or an HTTPS image URL.</p>';
    const srcLabel = document.createElement("label");
    srcLabel.textContent = "Image path / HTTPS URL";
    const src = document.createElement("input");
    src.value = item.img.getAttribute("src") || "";
    srcLabel.append(src);
    const altLabel = document.createElement("label");
    altLabel.textContent = "Picture description (alt text)";
    const alt = document.createElement("input");
    alt.value = item.img.getAttribute("alt") || "";
    altLabel.append(alt);
    const uploadLabel = document.createElement("label");uploadLabel.textContent="Upload picture from phone or computer (8 MB maximum)";
    const uploadInput=document.createElement("input");uploadInput.type="file";uploadInput.accept="image/jpeg,image/png,image/webp";uploadInput.className="cms-upload";
    const uploadNotice=document.createElement("small");uploadNotice.textContent="Choose a picture to upload to the website's media library.";
    uploadInput.addEventListener("change",async()=>{const file=uploadInput.files?.[0];if(!file)return;
      if(file.size>8*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type)){uploadNotice.textContent="Use JPEG, PNG or WebP up to 8 MB.";return;}
      try{uploadNotice.textContent="Uploading…";const result=await fetch("/api/admin/cms/assets",{method:"POST",credentials:"same-origin",headers:{"Content-Type":file.type,"X-Filename":encodeURIComponent(file.name)},body:file});
      const data=await result.json();if(!result.ok)throw Error(data.error||"Upload failed");
      src.value=data.url;uploadNotice.textContent="Uploaded. Press Apply, then Save Draft."; }catch(error){uploadNotice.textContent=error.message;}
    });
    uploadLabel.append(uploadInput,uploadNotice);
    const mediaLabel=document.createElement("strong");mediaLabel.textContent="Media Library";
    const library=document.createElement("div");library.className="cms-image-grid";
    fetch("/api/admin/cms/assets",{credentials:"same-origin"}).then(async response=>{if(!response.ok)return;const data=await response.json();
      (data.items||[]).forEach(image=>{const button=document.createElement("button");button.type="button";button.title=image.filename;
      const thumb=document.createElement("img");thumb.alt=image.filename;thumb.src=image.url;button.append(thumb);
      button.addEventListener("click",()=>{src.value=image.url;});library.append(button);});
    }).catch(()=>{});
    const row = document.createElement("div");
    row.className = "row";
    const close = document.createElement("button");
    close.className = "cms-image-close";
    close.type = "button";
    close.textContent = "Close";
    const apply = document.createElement("button");
    apply.className = "cms-image-apply";
    apply.type = "button";
    apply.textContent = "Apply";
    close.addEventListener("click", () => panel.remove());
    apply.addEventListener("click", () => {
      const srcValue = src.value.trim();
      if(srcValue && safeImage(srcValue)){item.img.setAttribute("src",srcValue);item.img.hidden=false;}else{item.img.removeAttribute("src");item.img.hidden=true;}
      item.img.setAttribute("alt", alt.value.trim());
      if(item.restoreButton)item.restoreButton.hidden=!item.img.hidden;
      panel.remove();
    });
    const remove=document.createElement("button");remove.type="button";remove.textContent="Remove picture";remove.addEventListener("click",()=>{src.value="";apply.click();});
    row.append(close,remove,apply);
    panel.append(srcLabel,altLabel,uploadLabel,mediaLabel,library,row);
    document.body.append(panel);
    src.focus();
  }

  function openLinkPanel(links){
    document.querySelector(".cms-image-panel")?.remove();
    const panel=document.createElement("div");panel.className="cms-image-panel";panel.setAttribute("data-cms-ignore","");
    const head=document.createElement("strong");head.textContent="Edit a menu or button link";
    const info=document.createElement("p");info.textContent="Choose a button or menu item, then change its destination. HTTPS and safe website addresses are supported.";
    const select=document.createElement("select");select.setAttribute("aria-label","Website link to edit");
    select.style.cssText="display:block;width:100%;padding:11px;border:1px solid #aabbd2;border-radius:8px";
    links.forEach((item,index)=>{
      const opt=document.createElement("option");opt.value=String(index);
      opt.textContent=(item.link.textContent||"Link "+(index+1)).trim().slice(0,85)+" · "+item.original.slice(0,35);
      select.append(opt);
    });
    const label=document.createElement("label");label.textContent="Destination address (HTTPS or website page)";
    const input=document.createElement("input");input.type="text";input.maxLength=500;
    const note=document.createElement("small");note.textContent="Changes are drafts until you press Save Draft or Publish Page.";
    const setSelected=()=>{input.value=links[Number(select.value)]?.link.getAttribute("href")||"";};
    select.addEventListener("change",setSelected);setSelected();
    const row=document.createElement("div");row.className="row";
    const close=document.createElement("button");close.type="button";close.textContent="Cancel";close.addEventListener("click",()=>panel.remove());
    const apply=document.createElement("button");apply.type="button";apply.className="cms-image-apply";apply.textContent="Apply link";
    apply.addEventListener("click",()=>{
      const value=input.value.trim();if(!safeLink(value)){note.textContent="Use a valid HTTPS link, internal website page, email or telephone address.";return;}
      const item=links[Number(select.value)];if(item)item.link.setAttribute("href",value);
      panel.remove();
    });
    row.append(close,apply);label.append(input);panel.append(head,info,select,label,note,row);
    document.body.append(panel);
  }

  function cleanExit() {
    const url = new URL(location.href);
    url.searchParams.delete("cms");
    location.href = url.toString();
  }

  async function enableEditor(root, descriptors, content) {
    document.body.classList.add("cms-editing");
    addEditorStyles();
    applyOverrides(descriptors, content);

    const liveText = [];
    descriptors.text.forEach((item) => {
      const span = document.createElement("span");
      span.setAttribute("data-cms-text", item.key);
      span.contentEditable = "true";
      span.spellcheck = true;
      span.textContent = item.node.nodeValue || "";
      item.node.replaceWith(span);
      liveText.push({ key: item.key, span });
    });

    descriptors.images.forEach((item) => {
      item.img.setAttribute("data-cms-image", item.srcKey);
      const restore=document.createElement("button");restore.type="button";
      restore.className="cms-restore-image";restore.textContent="Add or replace picture";
      restore.setAttribute("data-cms-ignore","");
      restore.hidden=!item.img.hidden;
      item.img.insertAdjacentElement("afterend",restore);
      restore.addEventListener("click",()=>openImagePanel(item));
      item.restoreButton=restore;
      item.img.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openImagePanel(item);
      });
    });

    const toolbar = document.createElement("div");
    toolbar.className = "cms-toolbar";
    toolbar.setAttribute("data-cms-ignore", "");
    const title = document.createElement("strong");
    title.textContent = "Editing: " + pageKey().replaceAll("-", " ");
    const save = document.createElement("button");
    save.className = "cms-save";
    save.type = "button";
    save.textContent = "Save Draft";
    const reset = document.createElement("button");
    reset.className = "cms-reset";
    reset.type = "button";
    reset.textContent = "Discard Draft";
    const exit = document.createElement("button");
    exit.className = "cms-exit";
    exit.type = "button";
    exit.textContent = "Exit editor";
    const status = document.createElement("span");
    status.className = "cms-status";
    status.textContent = "Edit gold-outlined text directly. Click any outlined picture to replace it.";
    const publish=document.createElement("button");publish.type="button";publish.className="cms-save";publish.textContent="Publish Page";
    const history=document.createElement("button");history.type="button";history.className="cms-exit";history.textContent="Restore Version";
    const editLinks=document.createElement("button");editLinks.type="button";editLinks.className="cms-exit";
    editLinks.textContent="Edit Menus & Links";editLinks.addEventListener("click",()=>openLinkPanel(descriptors.links));
    toolbar.append(title,save,publish,editLinks,history,reset,exit,status);
    document.body.append(toolbar);

    exit.addEventListener("click", cleanExit);
    reset.addEventListener("click",async()=>{
      if(!confirm("Discard this unpublished draft? The public website will not be changed."))return;
      try{const response=await fetch(apiUrl(true),{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"discard"})});
      if(!response.ok)throw Error((await response.json()).error||"Unable to discard draft");location.reload();
      }catch(error){status.textContent=error.message;}
    });
    history.addEventListener("click",async()=>{
      try{const response=await fetch(apiUrl(true)+"&history=1",{credentials:"include"});
      if(!response.ok)throw Error("Unable to load versions");const data=await response.json();
      const versions=data.versions||[];if(!versions.length){status.textContent="No previous versions yet.";return;}
      const number=prompt("Available versions:\n"+versions.map(v=>v.revision_id+" · "+v.updated_at).join("\n")+"\nEnter a version number to restore:");
      if(!number)return;if(!confirm("Restore and publish version "+number+"?"))return;
      const restored=await fetch(apiUrl(true),{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"restore",revisionId:Number(number)})});
      if(!restored.ok)throw Error((await restored.json()).error||"Restore failed");location.reload();
      }catch(error){status.textContent=error.message;}
    });
    async function saveDraft(publishNow=false) {
      save.disabled=true;publish.disabled=true;status.textContent="Saving draft…";
      const changes=liveText.map(item=>({key:item.key,type:"text",value:item.span.textContent||""}));
      descriptors.images.forEach(item=>{
        changes.push({key:item.srcKey,type:"image",value:item.img.getAttribute("src")||""});
        changes.push({key:item.altKey,type:"alt",value:item.img.getAttribute("alt")||""});
      });
      descriptors.links.forEach(item=>{
        const destination=item.link.getAttribute("href")||"";
        if(safeLink(destination))changes.push({key:item.key,type:"text",value:destination});
      });
      try{
        const response=await fetch(apiUrl(true),{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save-draft",changes})});
        if(!response.ok)throw Error((await response.json()).error||"Unable to save draft");
        status.textContent="Draft saved. The public page is unchanged.";
        if(publishNow){
          const published=await fetch(apiUrl(true),{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"publish"})});
          if(!published.ok)throw Error((await published.json()).error||"Unable to publish");
          status.textContent="Page published successfully; no GitHub deployment needed.";
        }
      }catch(error){status.textContent=error.message;}finally{save.disabled=false;publish.disabled=false;}
    }
    save.addEventListener("click",()=>saveDraft(false));
    publish.onclick=()=>{if(confirm("Publish these changes to the public website?"))saveDraft(true);};
  }

  async function start() {
    const page = pageKey();
    if (!page) return;
    const root = page === "home" ? document.body : document.querySelector("main");
    if (!root) return;

    const descriptors = collect(root);
    const mode = new URL(location.href).searchParams.get("cms");
    const editing = mode === "1";const preview=mode==="preview";
    try {
      if (editing) {
        const content = await readOverrides(true);
        await enableEditor(root, descriptors, content);
      } else if(preview){
        const content=await readOverrides(true);applyOverrides(descriptors,content);
        const banner=document.createElement("div");banner.textContent="PRIVATE DRAFT PREVIEW · No changes published";banner.style.cssText="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#132958;color:#fff;text-align:center;padding:9px";banner.setAttribute("data-cms-ignore","");document.body.append(banner);
      } else {
        const content = await readOverrides(false);
        applyOverrides(descriptors, content);
      }
    } catch (error) {
      if (editing) {
        alert(error.message || "You must sign in as an administrator before editing this page.");
        cleanExit();
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
