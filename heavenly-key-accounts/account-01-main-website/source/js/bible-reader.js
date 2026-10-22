/* Heavenly Key Bible reader: Scripture audio and independent optional background music.
 * Only approved audio tagged bible-background-music is offered. No auto-play.
 * The reader never speaks or displays placeholder verse text as Scripture. */
(() => {
  "use strict";
  const apiBase = "https://heavenlykey.alldaywow247.workers.dev";
  const books = [
    ["Genesis",50],["Exodus",40],["Leviticus",27],["Numbers",36],["Deuteronomy",34],
    ["Joshua",24],["Judges",21],["Ruth",4],["1 Samuel",31],["2 Samuel",24],
    ["1 Kings",22],["2 Kings",25],["1 Chronicles",29],["2 Chronicles",36],
    ["Ezra",10],["Nehemiah",13],["Esther",10],["Job",42],["Psalms",150],
    ["Proverbs",31],["Ecclesiastes",12],["Song of Solomon",8],["Isaiah",66],
    ["Jeremiah",52],["Lamentations",5],["Ezekiel",48],["Daniel",12],
    ["Hosea",14],["Joel",3],["Amos",9],["Obadiah",1],["Jonah",4],
    ["Micah",7],["Nahum",3],["Habakkuk",3],["Zephaniah",3],["Haggai",2],
    ["Zechariah",14],["Malachi",4],["Matthew",28],["Mark",16],["Luke",24],
    ["John",21],["Acts",28],["Romans",16],["1 Corinthians",16],["2 Corinthians",13],
    ["Galatians",6],["Ephesians",6],["Philippians",4],["Colossians",4],
    ["1 Thessalonians",5],["2 Thessalonians",3],["1 Timothy",6],["2 Timothy",4],
    ["Titus",3],["Philemon",1],["Hebrews",13],["James",5],["1 Peter",5],
    ["2 Peter",3],["1 John",5],["2 John",1],["3 John",1],["Jude",1],
    ["Revelation",22]
  ];
  const el = (id) => document.getElementById(id);
  const book = el("hk-book"), chapter = el("hk-chapter"), verses = el("hk-verses");
  const message = el("hk-reader-message"), audioBible = el("hk-bible-audio");
  const readButton = el("hk-read-aloud"), readingStatus = el("hk-reading-status");
  const musicAudio = el("hk-music-audio"), musicVolume = el("hk-music-volume");
  const volumeLabel = el("hk-volume-value"), musicButton = el("hk-music-play");
  const credits = el("hk-music-credit"), availability = el("hk-music-availability");
  const prev = el("hk-prev"), next = el("hk-next");
  if (!book || !chapter || !musicAudio || !audioBible) return;
  let tracks = [null, null], choice = "off", musicRequested = false, speaking = false;
  let musicCatalogueUnavailable = false;
  let speechToken = 0, readyVerses = [], loadToken = 0, audioAvailable = false;
  const safeGet = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const show = (target, value) => { target.textContent = value; };
  const narrating = () => speaking || (!audioBible.paused && !audioBible.ended);
  const stopMusic = () => { musicAudio.pause(); musicAudio.currentTime = 0; musicButton.textContent = "Play music while reading"; };
  const selected = () => choice === "off" ? null : tracks[Number(choice) - 1];
  const musicUri = (item) => apiBase + "/api/media/" + encodeURIComponent(item.media_id) + "/object";
  const status = (text) => show(readingStatus, text);

  async function syncMusic() {
    const item = selected();
    if (!item) {
      stopMusic();
      musicAudio.removeAttribute("src");
      musicAudio.load();
      show(credits, "");
      musicButton.disabled = true;
      musicButton.textContent = "Play music while reading";
      return;
    }
    musicButton.disabled = false;
    show(credits, item.attribution_required ? "Audio credit: " + (item.title || "Approved music") + (item.source ? " — " + item.source : "") : "");
    const uri = musicUri(item);
    if (musicAudio.src !== uri) {
      musicAudio.pause();
      musicAudio.src = uri;
      musicAudio.load();
    }
    if (musicRequested || narrating()) {
      try { await musicAudio.play(); musicButton.textContent = "Pause background music"; }
      catch { musicButton.textContent = "Play music while reading"; show(availability, "Tap Play music to enable sound on this device."); }
    } else {
      musicAudio.pause();
      musicButton.textContent = "Play music while reading";
    }
  }

  const updateMusicChoices = () => {
    document.querySelectorAll('input[name="hk-background"]').forEach((input) => {
      if (input.value === "off") { input.disabled = false; return; }
      const i = Number(input.value) - 1, item = tracks[i];
      input.disabled = !item;
      const title = el("hk-track-label-" + input.value);
      if (title) title.textContent = item ? (item.title || "Background music " + input.value) : "Background music " + input.value + " (not available yet)";
    });
    if (choice !== "off" && !selected()) choice = "off";
    const checked = document.querySelector('input[name="hk-background"][value="' + choice + '"]');
    if (checked) checked.checked = true;
    const count = tracks.filter(Boolean).length;
    show(availability, musicCatalogueUnavailable ? "The music catalogue is temporarily unavailable. Bible reading still works without music." : count ? count + " of 2 approved background music options available." : "Background music will appear after the ministry uploads and approves it. Bible reading remains available without music.");
    syncMusic();
  };

  async function loadTracks() {
    musicCatalogueUnavailable = false;
    try {
      const response = await fetch(apiBase + "/api/media?topic=bible-background-music", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Music catalogue not available.");
      const data = await response.json();
      const approved = (Array.isArray(data.items) ? data.items : [])
        .filter((m) => m && m.file_type === "audio" && Number.isSafeInteger(Number(m.media_id)) && Number(m.media_id) > 0)
        .sort((a, b) => Number(b.media_id) - Number(a.media_id));
      tracks = [null, null];
      // Explicit slot tags have priority; newest approved replacement wins.
      for (const item of approved) {
        const match = /^bible-background-slot-([12])$/.exec(String(item.event || ""));
        if (match && !tracks[Number(match[1]) - 1]) tracks[Number(match[1]) - 1] = item;
      }
      // Older untagged approved music remains usable in whichever slot is free.
      for (const item of approved) {
        if (/^bible-background-slot-([12])$/.test(String(item.event || ""))) continue;
        const empty = tracks.findIndex((value) => !value);
        if (empty < 0) break;
        tracks[empty] = item;
      }
    } catch {
      tracks = [null, null];
      musicCatalogueUnavailable = true;
    }
    updateMusicChoices();
  }

  function updateChapters() {
    const entry = books.find((b) => b[0] === book.value) || books[0];
    const current = Math.min(Number(chapter.value) || 1, entry[1]);
    chapter.replaceChildren();
    for (let i = 1; i <= entry[1]; i++) {
      const option = document.createElement("option");
      option.value = String(i); option.textContent = String(i);
      chapter.append(option);
    }
    chapter.value = String(current);
  }
  function stopNarration() {
    speechToken++;
    speaking = false;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    audioBible.pause();
    readButton.textContent = "Play Bible narration";
    if (!musicRequested) { musicAudio.pause(); musicButton.textContent = "Play music while reading"; }
  }
  function showVerses(data) {
    verses.replaceChildren();
    readyVerses = [];
    const list = Array.isArray(data.verses) ? data.verses : [];
    const approved = list.length > 0 && list.every((v) => v && !v.isPlaceholder && typeof v.text === "string" && v.text.trim());
    if (data.warning || !approved) {
      show(message, data.warning || "An approved Bible text is not available for this chapter yet. Placeholder text is not displayed as Scripture.");
      return;
    }
    show(message, "");
    readyVerses = list.map((v) => v.text);
    const frag = document.createDocumentFragment();
    for (const verse of list) {
      const p = document.createElement("p"); p.className = "hk-verse";
      const n = document.createElement("sup"); n.textContent = String(verse.number);
      p.append(n, document.createTextNode(" " + verse.text));
      frag.append(p);
    }
    verses.append(frag);
  }
  async function loadChapter() {
    const token = ++loadToken;
    stopNarration();
    audioBible.hidden = true; audioBible.removeAttribute("src"); audioBible.load();
    audioAvailable = false;
    show(message, "Loading approved Scripture…"); verses.replaceChildren();
    const url = apiBase + "/api/bible/" + encodeURIComponent(book.value) + "/" + encodeURIComponent(chapter.value);
    try {
      const result = await fetch(url, { headers: { Accept: "application/json" } });
      if (!result.ok) throw new Error("Chapter has not been made available yet.");
      const data = await result.json();
      if (token !== loadToken) return;
      showVerses(data);
      if (Number.isInteger(Number(data.chapterId)) && Number(data.chapterId) > 0) {
        try {
          const audioResponse = await fetch(apiBase + "/api/bible/audio?chapterId=" + encodeURIComponent(data.chapterId));
          if (!audioResponse.ok) throw new Error("Audio unavailable");
          const audioData = await audioResponse.json();
          if (token !== loadToken) return;
          const item = Array.isArray(audioData.items) ? audioData.items[0] : null;
          if (item && Number(item.mediaId) > 0) {
            audioBible.src = apiBase + "/api/media/" + encodeURIComponent(item.mediaId) + "/object";
            audioBible.hidden = false;
            audioAvailable = true;
          }
        } catch { /* Text reader and browser narration continue without a recording. */ }
      }
      status(audioAvailable ? "An approved recorded narration is available." : readyVerses.length ? "Browser narration is available for this approved text." : "Audio Bible unavailable for this chapter.");
      readButton.disabled = !audioAvailable && !readyVerses.length;
    } catch (error) {
      if (token !== loadToken) return;
      show(message, error.message || "Bible chapter could not load.");
      readButton.disabled = true;
      status("Try another chapter.");
    }
    safeSet("hk-bible-location", JSON.stringify([book.value, Number(chapter.value)]));
  }

  function speakBible() {
    if (!("speechSynthesis" in window) || !readyVerses.length) { status("Browser narration is not available on this device."); return; }
    const token = ++speechToken;
    speaking = true;
    readButton.textContent = "Stop Bible narration";
    status("Reading Scripture aloud…");
    syncMusic();
    let index = 0;
    const nextVerse = () => {
      if (token !== speechToken) return;
      if (index >= readyVerses.length) {
        speaking = false; readButton.textContent = "Play Bible narration";
        status("Chapter reading completed.");
        if (!musicRequested) { musicAudio.pause(); musicButton.textContent = "Play music while reading"; }
        return;
      }
      const voice = new SpeechSynthesisUtterance(readyVerses[index++]);
      voice.lang = "en-GB"; voice.rate = 0.94; voice.volume = 1;
      voice.onend = nextVerse;
      voice.onerror = () => { speaking = false; readButton.textContent = "Play Bible narration"; status("Browser narration stopped."); if (!musicRequested) musicAudio.pause(); };
      window.speechSynthesis.speak(voice);
    };
    window.speechSynthesis.cancel();
    nextVerse();
  }

  async function setupAdminMusic() {
    const adminPanel = el("hk-admin-music"), form = el("hk-admin-music-form");
    if (!adminPanel || !form) return;
    try {
      const response = await fetch("/api/auth/profile", { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) return;
      const data = await response.json();
      const role = data.profile && data.profile.roleName;
      if (!["Administrator", "Deputy Super Administrator", "Super Administrator"].includes(role)) return;
    } catch { return; }
    adminPanel.hidden = false;
    async function adminApi(path, method, payload, contentType) {
      const headers = { Accept: "application/json" };
      if (contentType) headers["Content-Type"] = contentType;
      const response = await fetch(path, { method, body: payload, credentials: "same-origin", headers });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error?.message || "Request could not be completed. Please check the administrator session.");
      return data;
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const file = el("hk-admin-file").files[0], title = el("hk-admin-title").value.trim();
      const slot = el("hk-admin-slot").value, license = el("hk-admin-license").value;
      const credit = el("hk-admin-credit").value.trim();
      const feedback = el("hk-admin-status"), submit = el("hk-admin-upload");
      if (!file || !/\.(mp3|m4a|aac)$/i.test(file.name) || !file.size || file.size > 100 * 1024 * 1024) {
        show(feedback, "Choose an MP3, M4A or AAC recording up to 100 MB."); return;
      }
      if (!["1", "2"].includes(slot) || !["ministry_owned", "licensed", "public_domain"].includes(license) || !el("hk-admin-rights").checked) {
        show(feedback, "Select a slot, confirm rights and choose the correct licence."); return;
      }
      if (license === "licensed" && !credit) { show(feedback, "Enter the licensed recording creator or rights holder."); return; }
      let mediaId = null;
      submit.disabled = true;
      try {
        show(feedback, "Registering approved music slot " + slot + "…");
        const metadata = await adminApi("/api/media", "POST", JSON.stringify({
          fileType: "audio", title, topic: "bible-background-music",
          event: "bible-background-slot-" + slot,
          licenseType: "pending_review", attributionRequired: license === "licensed", source: credit || undefined,
          usageRights: "Approved by ministry administrator for Bible reading background playback"
        }), "application/json");
        mediaId = metadata.mediaId;
        if (!Number.isSafeInteger(Number(mediaId)) || Number(mediaId) <= 0) throw new Error("Media registration did not return a valid ID.");
        const extension = file.name.split(".").pop().toLowerCase();
        const mime = extension === "mp3" ? "audio/mpeg" : extension === "aac" ? "audio/aac" : "audio/mp4";
        show(feedback, "Uploading music. Keep this page open until approval finishes…");
        await adminApi("/api/media/" + mediaId + "/upload", "PUT", file, mime);
        // Permanent approved assets must not be removed by the 48-hour cleanup.
        await adminApi("/api/media/" + mediaId + "/keep", "POST", JSON.stringify({ keep: true }), "application/json");
        show(feedback, "Confirming publication rights…");
        await adminApi("/api/media/" + mediaId + "/approve", "POST", JSON.stringify({ licenseType: license }), "application/json");
        await loadTracks();
        form.reset();
        show(feedback, "Published successfully. Music slot " + slot + " is now available in the Bible reader.");
      } catch (error) {
        show(feedback, (error.message || "Music upload failed.") + (mediaId ? " Reference ID: " + mediaId + ". Do not upload duplicates until the record is checked." : ""));
      } finally { submit.disabled = false; }
    });
  }

  for (const [name] of books) {
    const opt = document.createElement("option"); opt.value = name; opt.textContent = name; book.append(opt);
  }
  const location = safeGet("hk-bible-location");
  if (location) try {
    const [savedBook, savedChapter] = JSON.parse(location);
    if (books.some((b) => b[0] === savedBook)) book.value = savedBook;
    if (Number.isInteger(savedChapter) && savedChapter > 0) chapter.dataset.saved = String(savedChapter);
  } catch {}
  if (!book.value) book.value = "Genesis";
  updateChapters();
  if (chapter.dataset.saved) {
    const max = books.find((b) => b[0] === book.value)[1];
    chapter.value = String(Math.min(Number(chapter.dataset.saved), max));
  }

  const v = Number(safeGet("hk-bible-music-volume"));
  const initialVolume = Number.isFinite(v) && v >= 0 && v <= 100 && safeGet("hk-bible-music-volume") !== null ? v : 20;
  musicVolume.value = String(initialVolume);
  musicAudio.volume = initialVolume / 100;
  show(volumeLabel, initialVolume + "%");
  choice = ["off", "1", "2"].includes(safeGet("hk-bible-music-choice")) ? safeGet("hk-bible-music-choice") : "off";

  book.addEventListener("change", () => { chapter.value = "1"; updateChapters(); loadChapter(); });
  chapter.addEventListener("change", loadChapter);
  el("hk-load-chapter").addEventListener("click", loadChapter);
  prev.addEventListener("click", () => { if (Number(chapter.value) > 1) { chapter.value = String(Number(chapter.value) - 1); loadChapter(); } });
  next.addEventListener("click", () => { if (Number(chapter.value) < chapter.options.length) { chapter.value = String(Number(chapter.value) + 1); loadChapter(); } });
  musicVolume.addEventListener("input", () => {
    const level = Math.max(0, Math.min(100, Number(musicVolume.value) || 0));
    musicAudio.volume = level / 100; show(volumeLabel, level + "%");
    safeSet("hk-bible-music-volume", String(level));
  });
  document.querySelectorAll('input[name="hk-background"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked || input.disabled) return;
      choice = input.value; safeSet("hk-bible-music-choice", choice);
      musicRequested = false; syncMusic();
    });
  });
  musicButton.addEventListener("click", async () => {
    if (!selected()) return;
    if (!musicAudio.paused) {
      musicRequested = false; musicAudio.pause();
      musicButton.textContent = "Play music while reading";
    } else {
      musicRequested = true; await syncMusic();
    }
  });
  readButton.addEventListener("click", async () => {
    if (narrating()) { stopNarration(); status("Bible narration stopped."); return; }
    if (audioAvailable) {
      // Start optional background playback in the same user gesture, important on mobile.
      if (selected()) void syncMusic();
      try { await audioBible.play(); readButton.textContent = "Stop Bible narration"; status("Playing Bible recording…"); }
      catch { status("Tap the audio player's Play control to start narration."); }
    } else speakBible();
  });
  audioBible.addEventListener("play", () => { if (speaking) { speechToken++; speaking = false; if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } readButton.textContent = "Stop Bible narration"; status("Playing Bible recording…"); syncMusic(); });
  audioBible.addEventListener("pause", () => { if (!speaking) { readButton.textContent = "Play Bible narration"; if (!musicRequested) { musicAudio.pause(); musicButton.textContent = "Play music while reading"; } } });
  audioBible.addEventListener("ended", () => { readButton.textContent = "Play Bible narration"; status("Bible recording completed."); if (!musicRequested) musicAudio.pause(); });
  musicAudio.addEventListener("error", () => { show(availability, "This music recording could not be loaded. Choose Off or another approved option."); musicRequested = false; musicButton.textContent = "Play music while reading"; });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { stopNarration(); musicAudio.pause(); musicRequested = false; } });
  window.addEventListener("pagehide", () => { stopNarration(); musicAudio.pause(); });
  const musicRefresh = el("hk-music-refresh");
  if (musicRefresh) musicRefresh.addEventListener("click", loadTracks);
  loadTracks();
  loadChapter();
  setupAdminMusic();
})();
