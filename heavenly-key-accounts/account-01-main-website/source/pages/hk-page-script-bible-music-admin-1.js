
(() => {
"use strict";
const qs = (id) => document.getElementById(id);
const progress = qs("progress");
const setProgress = (message) => { progress.textContent = message; };
const allowed = {m4a:"audio/mp4",mp3:"audio/mpeg"};
async function request(path, options = {}) {
  const response = await fetch(path, {credentials:"same-origin", cache:"no-store", ...options});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const reason = payload.error && (payload.error.message || payload.error) || payload.message || ("Request failed (" + response.status + ")");
    throw new Error(String(reason));
  }
  return payload;
}
async function refresh() {
  try {
    const data = await request("/api/media?topic=bible-background-music");
    const items = (Array.isArray(data.items) ? data.items : []).filter(x => x && x.file_type === "audio");
    const slots = [null,null];
    for(const item of items.slice().sort((a,b) => Number(b.media_id)-Number(a.media_id))) {
      const match = /^bible-background-slot-([12])$/.exec(String(item.event || ""));
      if(match && !slots[Number(match[1])-1]) slots[Number(match[1])-1] = item;
    }
    for(const item of items.slice().sort((a,b) => Number(b.media_id)-Number(a.media_id))) {
      if(/^bible-background-slot-([12])$/.test(String(item.event || ""))) continue;
      const empty = slots.findIndex(x => !x);
      if(empty !== -1) slots[empty] = item;
    }
    qs("current").textContent = slots.map((m,i) => "Background music " + (i+1) + ": " + (m ? (m.title || "Approved recording") : "Not yet available")).join("\n");
  } catch(err) {qs("current").textContent = "Unable to check the music catalogue: " + err.message;}
}
qs("refresh").addEventListener("click", refresh);
qs("upload").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = qs("submit"), file = qs("file").files[0];
  const ext = file && file.name.split(".").pop().toLowerCase();
  if (!file || !allowed[ext] || file.size < 1 || file.size > 100*1024*1024) {
    setProgress("Choose a valid MP3 or M4A file smaller than 100 MB."); return;
  }
  if (!qs("rights").checked || !qs("license").value) {setProgress("Confirm the recording's publication rights.");return;}
  const mime = allowed[ext], slot = qs("slot").value, title = qs("title").value.trim();
  if (!title) {setProgress("Enter a music title.");return;}
  button.disabled = true;
  let mediaId = null;
  try {
    setProgress("Step 1/4: Registering Background " + slot + "…");
    const registered = await request("/api/media", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
      fileType:"audio", title:title, topic:"bible-background-music",
      event:"bible-background-slot-" + slot,
      owner:"Heavenly Key Evangelistic Movement", source:"Heavenly Key Bible Reading",
      licenseType:"pending_review", usageRights:"Owner-confirmed website and app background playback",
      attributionRequired:qs("license").value === "licensed"
    })});
    mediaId = Number(registered.mediaId);
    if (!Number.isSafeInteger(mediaId) || mediaId < 1) throw new Error("Media registration did not return a valid ID.");
    setProgress("Step 2/4: Uploading " + (file.size/1024/1024).toFixed(1) + " MB of audio…");
    await request("/api/media/" + mediaId + "/upload", {method:"PUT",headers:{"Content-Type":mime},body:file});
    setProgress("Step 3/4: Protecting the recording from automatic deletion…");
    await request("/api/media/" + mediaId + "/keep", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({keep:true})});
    setProgress("Step 4/4: Approving publication after your rights confirmation…");
    await request("/api/media/" + mediaId + "/approve", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({licenseType:qs("license").value})});
    setProgress("Published successfully as Background Music " + slot + ". Media ID: " + mediaId + ". Open Bible Reader, refresh music choices and test playback. Your other track remains available.");
    await refresh();
  } catch (err) {
    setProgress("Upload/publishing not fully completed. " + err.message + (mediaId ? "\nMedia ID " + mediaId + " was registered. The unfinished item is not publicly approved unless every step succeeded." : "") + "\nPlease check your administrator login and media storage settings before retrying.");
  } finally {button.disabled = false;}
});
refresh();
})();
