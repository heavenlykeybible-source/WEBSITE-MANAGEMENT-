const supplied = process.argv[2] || process.env.RADIO_PUBLIC_ORIGIN || "https://radio.heavenlykey.org";
const origin = new URL(supplied);
if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("A valid HTTPS radio origin is required.");
const requiredHeaders = ["strict-transport-security", "x-content-type-options", "content-security-policy", "referrer-policy"];
async function request(path, options = {}) {
  const response = await fetch(new URL(path, origin), { ...options, redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(path + " returned HTTP " + response.status);
  return response;
}
const page = await request("/");
const html = await page.text();
for (const name of requiredHeaders) if (!page.headers.has(name)) throw new Error("Missing live security header: " + name);
const csp = page.headers.get("content-security-policy") || "";
for (const directive of ["object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'"]) if (!csp.includes(directive)) throw new Error("Live CSP missing " + directive);
if (!html.includes("HEAVENLY KEY RADIO")) throw new Error("Radio homepage content was not found.");
for (const path of ["/js/approved-widget-system.js", "/css/radio-approved-number-one.css"]) await request(path);
const programmeResponse = await request("/api/broadcast/programme?channel=radio", { headers: { Accept: "application/json" } });
const programme = await programmeResponse.json();
if (!["live", "scheduled", "playlist", "offline", "reconnecting"].includes(programme.mode) || !Array.isArray(programme.items)) throw new Error("Account 2 returned an invalid radio programme response.");
if (programme.transport === "livekit") {
  const tokenResponse = await request("/api/media-engine/livekit/viewer-token", { method: "POST" });
  const token = await tokenResponse.json();
  if (!token.token || !token.url || !Number.isFinite(token.expiresAt)) throw new Error("LiveKit viewer token response is invalid.");
  throw new Error("LiveKit token exists, but browser LiveKit playback is not implemented/verified. Not launch-ready.");
}
if (!programme.items.length) throw new Error("No playable radio programme is published.");
const mediaUrl = new URL(programme.items[0].url, origin);
if (mediaUrl.protocol !== "https:" || mediaUrl.username || mediaUrl.password || mediaUrl.origin !== origin.origin) throw new Error("Playlist media must use same-origin HTTPS.");
const media = await request(mediaUrl.href, { headers: { Range: "bytes=0-0" } });
if (!/^audio\//i.test(media.headers.get("content-type") || "")) throw new Error("Playlist item is not audio media.");
if (media.status !== 206 || !media.headers.has("content-range")) throw new Error("Audio byte-range response is not working.");
await media.body?.cancel();
console.log("LIVE RADIO CHECK PASSED: homepage, headers, player assets, programme and byte-range media verified.");
console.log("Real-device, Bluetooth, background playback and browser compatibility tests remain separate release gates.");
