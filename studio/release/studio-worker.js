var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/livekit.ts
var livekit_exports = {};
__export(livekit_exports, {
  createLiveKitToken: () => createLiveKitToken,
  livekitConfigured: () => livekitConfigured,
  signLiveKitGrant: () => signLiveKitGrant
});
async function signHs256(input, secret) {
  const key2 = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return enc(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key2, new TextEncoder().encode(input)))));
}
function livekitConfigured(env) {
  return !!(env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.LIVEKIT_URL);
}
async function createLiveKitToken(env, room, identity, publish) {
  if (!livekitConfigured(env)) throw new Error("Live broadcast transport is not configured.");
  const now = Math.floor(Date.now() / 1e3);
  const header = enc(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = enc(JSON.stringify({ iss: env.LIVEKIT_API_KEY, sub: identity, nbf: now - 5, exp: now + 600, video: { roomJoin: true, room, canPublish: publish, canSubscribe: true, canPublishData: publish } }));
  const input = header + "." + payload;
  return { token: input + "." + await signHs256(input, env.LIVEKIT_API_SECRET), url: env.LIVEKIT_URL, room, expiresAt: now + 600 };
}
async function signLiveKitGrant(env, video) {
  const now = Math.floor(Date.now() / 1e3), input = enc(JSON.stringify({ alg: "HS256", typ: "JWT" })) + "." + enc(JSON.stringify({ iss: env.LIVEKIT_API_KEY, nbf: now - 5, exp: now + 60, video }));
  return input + "." + await signHs256(input, env.LIVEKIT_API_SECRET);
}
var enc;
var init_livekit = __esm({
  "src/livekit.ts"() {
    enc = (v) => btoa(v).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
});

// src/livekit-config.ts
init_livekit();
var LiveKitConnectionError = class extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
  code;
  status;
};
var CONFIG_KEY = "livekit-connection-v1";
async function cipherKey(env) {
  const seed = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.MEDIA_ENGINE_SHARED_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", seed, new TextEncoder().encode("heavenlykey-livekit-credential-encryption-v1"));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function resolveLiveKitConfig(env) {
  const stored = await env.LIVE_STATUS_KV?.get(CONFIG_KEY);
  if (!stored) return env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET ? { LIVEKIT_URL: env.LIVEKIT_URL, LIVEKIT_API_KEY: env.LIVEKIT_API_KEY, LIVEKIT_API_SECRET: env.LIVEKIT_API_SECRET } : null;
  if (JSON.parse(stored).disabled === true) return null;
  try {
    const { iv, data } = JSON.parse(stored);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.from(iv) }, await cipherKey(env), Uint8Array.from(data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error("Stored broadcast connection cannot be decrypted. Reconnect it in Settings.");
  }
}
function validateCloudConnection(body) {
  let url;
  try {
    url = new URL(String(body.url ?? "").trim());
  } catch {
    throw new LiveKitConnectionError("Project URL is invalid. Copy the full wss:// URL from your LiveKit project settings, not the project name.", "invalid_project_url");
  }
  if (!["wss:", "https:"].includes(url.protocol) || !/^[-a-z0-9]+\.livekit\.cloud$/i.test(url.hostname) || url.port || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new LiveKitConnectionError("Use the exact LiveKit Cloud project URL, such as wss://your-project.livekit.cloud. Do not enter the project name or dashboard address.", "invalid_project_url");
  const key2 = String(body.apiKey ?? "").trim(), secret = String(body.apiSecret ?? "").trim();
  if (!key2 || !secret || key2.length > 256 || secret.length > 512) throw new LiveKitConnectionError("Enter both the API key and matching API secret from the same LiveKit project.", "missing_credentials");
  return { LIVEKIT_URL: "wss://" + url.hostname, LIVEKIT_API_KEY: key2, LIVEKIT_API_SECRET: secret };
}
async function checkLiveKitConnection(config) {
  const token = await signLiveKitGrant(config, { roomList: true });
  let r;
  try {
    r = await fetch(config.LIVEKIT_URL.replace("wss:", "https:") + "/twirp/livekit.RoomService/ListRooms", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}", redirect: "manual", signal: AbortSignal.timeout(1e4) });
  } catch {
    throw new LiveKitConnectionError("The server could not reach your LiveKit project. Check the project URL and try again.", "provider_unreachable", 503);
  }
  if (r.status >= 300 && r.status < 400) throw new LiveKitConnectionError("The project URL redirected instead of answering. Copy its exact LiveKit Cloud Project URL; credentials were not forwarded.", "provider_redirect");
  if (r.status === 401 || r.status === 403) throw new LiveKitConnectionError("LiveKit rejected the API key or secret. Copy a matching pair from this project\u2019s Settings \u2192 Keys.", "credentials_rejected");
  if (r.status === 404) throw new LiveKitConnectionError("LiveKit could not find this project endpoint. Copy its exact Project URL from project settings.", "project_not_found");
  if (!r.ok) throw new LiveKitConnectionError("LiveKit returned HTTP " + r.status + ". Wait briefly, then try again.", "provider_unavailable", 503);
  let result;
  try {
    result = await r.json();
  } catch {
    throw new LiveKitConnectionError("The project endpoint did not return a LiveKit response. Check the Project URL.", "invalid_provider_response", 502);
  }
  if (!result || typeof result !== "object" || result.rooms !== void 0 && !Array.isArray(result.rooms)) throw new LiveKitConnectionError("The project endpoint returned an unexpected LiveKit response.", "invalid_provider_response", 502);
}
async function saveLiveKitConnection(env, config) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cipherKey(env), new TextEncoder().encode(JSON.stringify(config)));
  await env.LIVE_STATUS_KV.put(CONFIG_KEY, JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(data)) }));
}
var STATUS_KEY = "livekit-connection-status-v1";
async function liveKitConnectionStatus(env) {
  const meta = JSON.parse(await env.LIVE_STATUS_KV.get(STATUS_KEY) || "{}");
  try {
    const config = await resolveLiveKitConfig(env);
    return { configured: !!config, state: config ? meta.state || "saved" : meta.state === "reset" ? "reset" : env.LIVEKIT_API_KEY || env.LIVEKIT_API_SECRET || env.LIVEKIT_URL ? "incomplete" : "not_configured", url: meta.state === "reset" ? null : config?.LIVEKIT_URL ?? env.LIVEKIT_URL ?? null, keyMasked: config ? "\u2022\u2022\u2022\u2022" + (config.LIVEKIT_API_KEY.length > 4 ? config.LIVEKIT_API_KEY.slice(-4) : "") : null, secretSaved: !!config, verifiedAt: meta.verifiedAt ?? null, checkedAt: meta.checkedAt ?? null, errorCode: meta.errorCode ?? null, source: await env.LIVE_STATUS_KV.get(CONFIG_KEY) ? "dashboard" : "environment" };
  } catch {
    return { configured: false, state: "unreadable", url: null, keyMasked: null, secretSaved: false, verifiedAt: meta.verifiedAt ?? null, errorCode: "connection_unreadable" };
  }
}
async function recordLiveKitVerification(env, ok, errorCode) {
  const old = JSON.parse(await env.LIVE_STATUS_KV.get(STATUS_KEY) || "{}"), now = (/* @__PURE__ */ new Date()).toISOString();
  await env.LIVE_STATUS_KV.put(STATUS_KEY, JSON.stringify({ state: ok ? "connected" : "attention", verifiedAt: ok ? now : old.verifiedAt ?? null, checkedAt: now, errorCode: ok ? null : errorCode || "connection_check_failed" }));
}
async function resetLiveKitConnection(env) {
  await env.LIVE_STATUS_KV.put(CONFIG_KEY, JSON.stringify({ disabled: true }));
  await env.LIVE_STATUS_KV.put(STATUS_KEY, JSON.stringify({ state: "reset", checkedAt: (/* @__PURE__ */ new Date()).toISOString() }));
}

// src/restream.ts
init_livekit();
var CONFIG_KEY2 = "restream-destinations-v1";
var ACTIVE_KEY = "restream-active-egress-v1";
var allowed = /* @__PURE__ */ new Set(["youtube", "facebook", "tiktok", "instagram", "linkedin", "x"]);
async function key(env) {
  const seed = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.MEDIA_ENGINE_SHARED_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", seed, new TextEncoder().encode("heavenlykey-restream-destination-encryption-v1"));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function seal(env, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(env), new TextEncoder().encode(JSON.stringify(value)));
  return JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(data)) });
}
async function open(env, stored) {
  if (!stored) return null;
  try {
    const { iv, data } = JSON.parse(stored);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.from(iv) }, await key(env), Uint8Array.from(data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error("Saved streaming destinations cannot be decrypted. Keep the original MEDIA_ENGINE_SHARED_SECRET; no saved destinations were changed.");
  }
}
async function listDestinations(env) {
  const store = await open(env, await env.LIVE_STATUS_KV.get(CONFIG_KEY2)) ?? {};
  return Array.from(allowed).map((destination) => {
    const row = store[destination];
    let host = null;
    try {
      host = row ? new URL(row.url).hostname : null;
    } catch {
    }
    return { destination, configured: !!row?.url, enabled: !!row?.enabled, host, updatedAt: row?.updatedAt ?? null };
  });
}
async function saveDestination(env, destination, urlValue, enabled) {
  if (!allowed.has(destination)) throw new Error("Unsupported destination.");
  let u;
  try {
    u = new URL(urlValue.trim());
  } catch {
    throw new Error("Enter the platform RTMP or RTMPS server URL including its stream key.");
  }
  if (!["rtmp:", "rtmps:"].includes(u.protocol) || !u.hostname || u.username || u.password) throw new Error("Use a valid RTMP or RTMPS streaming URL.");
  if (u.href.length > 2048) throw new Error("Streaming URL is too long.");
  const store = await open(env, await env.LIVE_STATUS_KV.get(CONFIG_KEY2)) ?? {};
  store[destination] = { url: u.href, enabled, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  await env.LIVE_STATUS_KV.put(CONFIG_KEY2, await seal(env, store));
  return { destination, configured: true, enabled, host: u.hostname };
}
async function removeDestination(env, destination) {
  if (!allowed.has(destination)) throw new Error("Unsupported destination.");
  const store = await open(env, await env.LIVE_STATUS_KV.get(CONFIG_KEY2)) ?? {};
  if (!store[destination]) return { destination, configured: false, enabled: false };
  delete store[destination];
  await env.LIVE_STATUS_KV.put(CONFIG_KEY2, await seal(env, store));
  return { destination, configured: false, enabled: false };
}
async function setDestinationEnabled(env, destination, enabled) {
  if (!allowed.has(destination)) throw new Error("Unsupported destination.");
  const store = await open(env, await env.LIVE_STATUS_KV.get(CONFIG_KEY2)) ?? {};
  if (!store[destination]?.url) throw new Error("Connect this destination first.");
  store[destination].enabled = enabled;
  store[destination].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  await env.LIVE_STATUS_KV.put(CONFIG_KEY2, await seal(env, store));
}
async function enabledUrls(env) {
  const store = await open(env, await env.LIVE_STATUS_KV.get(CONFIG_KEY2)) ?? {};
  return Object.entries(store).filter(([name, v]) => allowed.has(name) && v.enabled && v.url).map(([destination, v]) => ({ destination, url: v.url }));
}
async function callLiveKit(env, method, body) {
  const config = await resolveLiveKitConfig(env);
  if (!config) throw new Error("LiveKit connection is not configured.");
  const token = await signLiveKitGrant(config, { roomRecord: true });
  const endpoint = config.LIVEKIT_URL.replace("wss:", "https:") + "/twirp/livekit.Egress/" + method;
  const r = await fetch(endpoint, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(15e3) });
  const text = await r.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
  }
  if (!r.ok) {
    const status = r.status;
    throw new Error(status === 401 || status === 403 ? "LiveKit rejected the streaming request. Check the matching project credentials and egress access." : status === 404 ? "The LiveKit streaming endpoint was not found. Check the project URL and egress availability." : status === 429 ? "LiveKit streaming quota was reached. Check the project limits." : "LiveKit could not start or update streaming (HTTP " + status + "). Check its egress logs; saved stream keys were preserved.");
  }
  return data;
}
async function startRestream(env, input) {
  if (input.source !== "live" && input.source !== "247") throw new Error("Choose a valid live or 24/7 stream source.");
  const outputs = await enabledUrls(env);
  if (!outputs.length) throw new Error("Enable at least one connected streaming destination.");
  const format = String(input.format ?? "landscape-720");
  const presetByFormat = { landscape_720: "H264_720P_30", landscape_1080: "H264_1080P_30", portrait_720: "PORTRAIT_H264_720P_30", portrait_1080: "PORTRAIT_H264_1080P_30" };
  const normalized = format.replace(/-/g, "_");
  const preset = presetByFormat[normalized] ?? (normalized.startsWith("portrait_") ? "PORTRAIT_H264_720P_30" : "H264_720P_30");
  let body;
  if (input.source === "live") {
    if (!Number.isSafeInteger(input.sessionId) || Number(input.sessionId) <= 0) throw new Error("An active live session is required.");
    const live = await env.DB.prepare("SELECT session_id,source_ref FROM live_sessions WHERE session_id=? AND status='live' AND julianday(last_heartbeat_at)>julianday('now','-180 seconds')").bind(input.sessionId).first();
    if (!live || !String(live.source_ref).startsWith("livekit:")) throw new Error("LiveKit camera is not on air. Connect the publisher before starting social distribution.");
    body = { room_name: "heavenlykey-live-" + input.sessionId, template: { layout: "grid" }, preset, outputs: [{ stream: { protocol: "RTMP", urls: outputs.map((x) => x.url) } }] };
  } else {
    const page = String(input.programmeUrl ?? "").trim();
    let u;
    try {
      u = new URL(page);
    } catch {
      throw new Error("24/7 programme source URL is invalid.");
    }
    if (u.protocol !== "https:" || u.username || u.password || u.hash) throw new Error("24/7 programme source must be a safe HTTPS URL.");
    body = { web: { url: u.href, await_start_signal: false }, preset, outputs: [{ stream: { protocol: "RTMP", urls: outputs.map((x) => x.url) } }] };
  }
  const previous = await reconcileActive(env);
  let replacedEgressId = null;
  if (previous.active?.egressId) throw new Error("Social streaming is already active or its status is uncertain. Check the current programme and use End broadcast before starting another distribution.");
  const result = await callLiveKit(env, "StartEgress", body);
  if (!result.egress_id) throw new Error("LiveKit did not return an egress ID.");
  await env.LIVE_STATUS_KV.put(ACTIVE_KEY, JSON.stringify({ egressId: result.egress_id, source: input.source, sessionId: input.source === "live" ? input.sessionId : void 0, channel: input.source === "247" ? input.channel ?? "video" : void 0, format, quality: input.quality ?? "balanced", destinations: outputs.map((x) => x.destination), startedAt: (/* @__PURE__ */ new Date()).toISOString() }));
  return { ok: true, egressId: result.egress_id, source: input.source, destinations: outputs.map((x) => x.destination), replacedEgressId };
}
function egressStillActive(status) {
  if (typeof status === "number") return [0, 1, 2].includes(status);
  return ["EGRESS_STARTING", "EGRESS_ACTIVE", "EGRESS_ENDING"].includes(String(status || "").toUpperCase());
}
async function reconcileActive(env) {
  const raw = await env.LIVE_STATUS_KV.get(ACTIVE_KEY);
  let active = null;
  try {
    active = raw ? JSON.parse(raw) : null;
  } catch {
  }
  if (!active?.egressId) return { active: null, last: null };
  try {
    const listed = await callLiveKit(env, "ListEgress", { egress_id: active.egressId });
    const item = (listed?.items || []).find((x) => String(x.egress_id || x.egressId || "") === String(active.egressId));
    if (item && egressStillActive(item.status)) return { active: { ...active, providerStatus: item.status, providerUpdatedAt: item.updated_at || item.updatedAt || null }, last: null };
    await env.LIVE_STATUS_KV.delete(ACTIVE_KEY);
    return { active: null, last: item ? { egressId: active.egressId, status: item.status, error: item.error || item.details ? "Streaming ended at the provider. Inspect its egress logs for the delivery error." : null } : null };
  } catch {
    return { active: { ...active, providerStatus: "UNKNOWN" }, last: null };
  }
}
async function stopRestream(env) {
  const reconciled = await reconcileActive(env), active = reconciled.active;
  if (!active?.egressId) return { ok: true, active: false };
  await callLiveKit(env, "StopEgress", { egress_id: active.egressId });
  await env.LIVE_STATUS_KV.delete(ACTIVE_KEY);
  return { ok: true, active: false };
}
async function restreamStatus(env) {
  const state = await reconcileActive(env);
  return { active: state.active, last: state.last, destinations: await listDestinations(env) };
}

// src/diagnostics.ts
async function connectionDiagnostics(env) {
  const checks = [];
  for (const [name, probe] of [["Database", () => env.DB.prepare("SELECT 1 AS ok").first()], ["Media storage", () => env.MEDIA_R2.list({ limit: 1 })], ["Session storage", () => env.LIVE_STATUS_KV.get("__hk_health_probe__")]]) {
    try {
      await probe();
      checks.push({ name, state: "passed", detail: "Existing binding responded." });
    } catch {
      checks.push({ name, state: "failed", detail: "The existing binding could not be read. Check its configuration; do not replace or reset it." });
    }
  }
  let transportReady = false;
  try {
    const config = await resolveLiveKitConfig(env);
    if (config) {
      await checkLiveKitConnection(config);
      transportReady = true;
      checks.push({ name: "Live broadcast connection", state: "passed", detail: "LiveKit accepted the saved connection. A device preview and on-air test are still needed." });
    } else checks.push({ name: "Live broadcast connection", state: "setup_needed", detail: "No complete LiveKit connection is saved." });
  } catch (e) {
    checks.push({ name: "Live broadcast connection", state: "failed", detail: e instanceof LiveKitConnectionError ? e.message : "The saved connection could not be read or checked. Preserve existing secrets and inspect the configuration." });
  }
  let stream = null;
  try {
    stream = await restreamStatus(env);
  } catch {
    checks.push({ name: "Streaming destinations", state: "failed", detail: "Saved streaming destinations could not be read. Existing credentials were preserved. Check the original media encryption secret." });
  }
  const facebook = stream?.destinations?.find((x) => x.destination === "facebook");
  let facebookDetail = "Facebook configuration could not be checked.", facebookState = "unknown";
  if (stream) {
    if (!facebook?.configured) {
      facebookState = "setup_needed";
      facebookDetail = "No Facebook RTMP destination is saved in this Studio. Prepare an event in Facebook Live Producer, then save its server URL and stream key in Connections.";
    } else if (!facebook.enabled) {
      facebookState = "disabled";
      facebookDetail = "A Facebook destination is saved but disabled. Select Facebook in the Studio final check before broadcasting.";
    } else if (!transportReady) {
      facebookState = "blocked";
      facebookDetail = "The Facebook destination is saved, but the LiveKit connection did not pass. Fix that connection first.";
    } else if (stream.active?.destinations?.includes("facebook")) {
      facebookState = stream.active.providerStatus === "UNKNOWN" ? "unverified" : "stream_requested";
      facebookDetail = "Facebook is included in the current distribution request. This does not confirm Facebook is publicly live. Check Live Producer and the provider status.";
    } else {
      facebookState = "ready_to_test";
      facebookDetail = "A Facebook destination is saved and enabled. Start a programme, choose Facebook and confirm the incoming stream in Facebook Live Producer. No stream is started by this check.";
    }
  }
  checks.push({ name: "Facebook", state: facebookState, detail: facebookDetail });
  return { checkedAt: (/* @__PURE__ */ new Date()).toISOString(), checks, liveBroadcastVerified: false, facebookPublicLiveVerified: false, startsBroadcast: false };
}

// src/embedded-manifest.ts
var assets = { "/assets/ministry/logo.svg": { "content": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="32" fill="#11245b"/><path d="M70 25h20v42h32v20H90v48H70V87H38V67h32z" fill="#f4cf70"/><text x="80" y="153" text-anchor="middle" font-size="12" font-family="sans-serif" fill="white">HEAVENLY KEY</text></svg>\n', "type": "image/svg+xml" }, "/css/ministry-footer.css": { "content": '/* Compact premium primary and secondary footer, scoped to Account 1 homepage. */.site-footer{background:linear-gradient(125deg,#073b2b,#07543a);color:#fff}.site-footer .hk-primary-footer{display:grid;grid-template-columns:1.35fr .85fr 1fr 1fr 1fr;gap:clamp(14px,2vw,30px);padding-block:34px 30px;align-items:start;min-height:0}.site-footer .hk-footer-column{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:9px}.site-footer .hk-footer-column h2{font-size:clamp(16px,1.35vw,19px);font-weight:850;color:#ffe48b;margin:0 0 9px;line-height:1.3}.site-footer .hk-footer-column>a{font-size:14px;line-height:1.4;color:#f8fff8;text-decoration:none;overflow-wrap:anywhere}.site-footer .hk-footer-column>a:hover,.site-footer .hk-footer-column>a:focus-visible{text-decoration:underline;color:#ffe48b}.site-footer .hk-footer-app-showcase{width:100%;background:#ffffff10;border:1px solid #f7df6a80;border-radius:15px;padding:14px}.site-footer .hk-footer-app-showcase p{margin:7px 0;font-size:13px;line-height:1.45}.site-footer .hk-footer-app-showcase p strong{color:#ffe7a3;font-size:15px}.site-footer .hk-footer-app-emblem{width:58px;height:67px;background:linear-gradient(150deg,#f6e397,#fffef1);color:#06513a;border:3px solid #d4ae4b;border-radius:14px;display:flex;flex-direction:column;justify-content:center;align-items:center;font-weight:1000;font-size:22px;box-shadow:0 5px 12px #001a1640}.site-footer .hk-footer-app-emblem span{font-size:10px;letter-spacing:.18em}.site-footer .hk-footer-cta{display:inline-block;background:#ffe079;color:#143b2c!important;padding:8px 12px;border-radius:999px;font-weight:850;font-size:13px;margin-top:5px}.site-footer .hk-footer-recent-posts{width:100%;display:flex;flex-direction:column;gap:8px}.site-footer .hk-footer-recent-posts a{display:block;color:#fff;text-decoration:none;font-size:13px;line-height:1.4;border-bottom:1px solid #ffffff35;padding-bottom:7px;overflow-wrap:anywhere}.site-footer .hk-footer-recent-posts a:hover{text-decoration:underline}.site-footer .hk-footer-recent-posts p{font-size:13px;margin:0}.site-footer .hk-footer-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;width:100%}.site-footer .hk-footer-gallery a{display:block;aspect-ratio:4/3;overflow:hidden;border:1px solid #e1c56b;border-radius:8px}.site-footer .hk-footer-gallery img{display:block;width:100%;height:100%;object-fit:cover}.site-footer .copyright-strip{background:linear-gradient(90deg,#141716,#232523);color:#f1f1f1;border-top:1px solid #ffffff28;padding:12px 0}.site-footer .copyright-inner{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px 20px;min-height:0}.site-footer .copyright-inner p{font-size:12px;margin:0;line-height:1.45;color:#eee}.site-footer .copyright-inner p:last-child{text-align:left}.site-footer .copyright-inner a{color:#ffe3a2;border:0;text-decoration:underline;font-weight:800}.site-footer .copyright-inner .social-links{display:flex;gap:8px}.site-footer .copyright-inner .social{width:28px;height:28px;font-size:16px}.welcome-copy .hero-motto{max-width:590px;margin:14px 0 8px;color:#075438;font-size:clamp(17px,1.5vw,21px);font-weight:850;line-height:1.4}.welcome-copy .hero-motto strong{color:#80213e}@media(max-width:1100px){.site-footer .hk-primary-footer{grid-template-columns:repeat(3,minmax(0,1fr));gap:25px}}@media(max-width:680px){.site-footer .hk-primary-footer{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;padding-block:25px}.site-footer .hk-footer-column h2{font-size:16px}.site-footer .hk-footer-column>a{font-size:13px}.site-footer .hk-footer-app-showcase{padding:11px}.site-footer .copyright-inner{justify-content:center;text-align:center}.site-footer .copyright-inner p:last-child{text-align:center}}@media(max-width:370px){.site-footer .hk-primary-footer{gap:12px}.site-footer .hk-footer-app-showcase p{font-size:12px}}\n/* Approved footer credit: bright yellow TALKMONEY ECOSYSTEM link. */\n.site-footer .copyright-inner a[href*="talkmoney.uk"]{color:#ffdf26!important;text-decoration-color:#ffdf26!important;font-weight:900}\n.site-footer .copyright-inner a[href*="talkmoney.uk"]:hover,.site-footer .copyright-inner a[href*="talkmoney.uk"]:focus-visible{color:#fff18b!important;text-decoration-color:#fff18b!important}\n\n.site-footer .copyright-inner .hk-footer-legal{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}.site-footer .copyright-inner .hk-footer-legal a{color:#f8f6e8;text-decoration:none;border-bottom:1px solid #d8cba2;font-weight:650;font-size:12px}.site-footer .copyright-inner .hk-footer-legal a:hover,.site-footer .copyright-inner .hk-footer-legal a:focus-visible{color:#ffe37b;border-bottom-color:#ffe37b}@media(max-width:680px){.site-footer .copyright-inner .hk-footer-legal{width:100%;gap:18px}}\n\n', "type": "text/css;charset=utf-8" }, "/css/production-studio.css": { "content": ".hk-production-studio{--studio-wine:#721d40;--studio-blue:#153d8a;--studio-yellow:#f3ca4a;border:1px solid #d9dfeb;border-radius:16px;padding:clamp(16px,3vw,30px);background:#f7f9fd;color:#172d4c}.studio-head{display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap}.studio-badge{background:#dfe9f8;color:#153d8a;padding:7px 12px;border-radius:30px;font-weight:700}.studio-badge[data-live=true]{background:#721d40;color:white}.studio-monitors{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px;margin:20px 0}.studio-monitor{min-width:0;background:white;border:1px solid #dce3ef;border-radius:12px;padding:12px}.studio-monitor canvas{width:100%;max-height:480px;object-fit:contain;background:#153d8a;border-radius:8px}.studio-monitor h4{margin:0 0 10px}.studio-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.studio-box{padding:16px;background:white;border:1px solid #dce3ef;border-radius:12px;min-width:0}.studio-box h4{margin-top:0}.studio-box label{display:block;margin:12px 0}.studio-box input:not([type=checkbox]),.studio-box select,.studio-box textarea{width:100%;box-sizing:border-box}.studio-box input[type=checkbox]{margin-right:8px}.studio-actions,.studio-scenes{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.studio-scenes button[aria-pressed=true]{background:var(--studio-blue);color:white}.studio-metrics{display:flex;gap:20px;flex-wrap:wrap;font-variant-numeric:tabular-nums;background:#edf1f9;padding:12px;border-radius:10px}.studio-meter{width:100%;height:14px;accent-color:#153d8a}.studio-help{font-size:.9rem;color:#52627a}.studio-status{min-height:1.5em;font-weight:600}.studio-controls button{white-space:normal}.studio-source-video{display:none}.studio-box details{margin:12px 0}.studio-box button{max-width:100%}.studio-box a{display:inline-block;margin:8px 0}@media(max-width:1000px){.studio-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.studio-grid,.studio-monitors{grid-template-columns:1fr}.studio-monitors{gap:8px}.studio-monitor canvas{max-height:360px}.studio-actions button{flex:1 1 140px}}\n.broadcast-playback-controls{display:flex;flex-wrap:wrap;gap:.75rem;margin:1rem 0}.broadcast-playback-controls .btn:first-child{background:#772b46;color:#fff;border-radius:2rem;padding:.85rem 1.4rem}.portal-card[data-broadcast-player]{background:linear-gradient(145deg,#fff,#f4f5ff);border:1px solid #d8ddef;box-shadow:0 14px 34px #19295016;border-radius:1.5rem}.portal-card[data-broadcast-player] video{width:100%;max-height:65vh;background:#101527;border-radius:1rem}.portal-card[data-broadcast-player] audio{width:100%}.portal-playlist{display:flex;flex-wrap:wrap;gap:.5rem}\n\n.ministry-youtube-player{display:block;width:100%;aspect-ratio:16/9;min-height:200px;border:0;border-radius:1rem;background:#101527;margin:1rem 0}\n\n.hk-production-studio{box-shadow:0 18px 42px #14284a14;background:linear-gradient(180deg,#f9fbff,#f3f6fb)}\n.studio-head h3{margin:0;font-size:clamp(1.35rem,2.2vw,2rem)}\n.studio-badge{letter-spacing:.08em;box-shadow:inset 0 0 0 1px #153d8a1a}\n.studio-badge[data-live=true]{box-shadow:0 0 0 4px #721d4014,0 8px 24px #721d4022}\n.studio-monitor{box-shadow:0 8px 22px #162d4f0d}\n.studio-monitor canvas{box-shadow:inset 0 0 0 1px #ffffff18}\n.studio-box{box-shadow:0 7px 18px #172d4c0b}\n.studio-box input[type=range]{accent-color:var(--studio-blue)}\n.studio-box select,.studio-box input:not([type=checkbox]):not([type=range]),.studio-box textarea{border:1px solid #aeb9ca;border-radius:8px;padding:.72rem;background:#fff;color:#172d4c;font:inherit}\n.studio-box select:focus,.studio-box input:focus,.studio-box textarea:focus{outline:3px solid #f3ca4a55;outline-offset:1px;border-color:#153d8a}\n.studio-metrics span{background:#fff;border:1px solid #d9e1ed;border-radius:999px;padding:.35rem .7rem}\n.studio-status{padding:.75rem 1rem;border-left:4px solid var(--studio-yellow);background:#fff;border-radius:8px}\n\nhtml[data-broadcast-egress=true] body{margin:0;background:#000;overflow:hidden}\nhtml[data-broadcast-egress=true] .top-strip,\nhtml[data-broadcast-egress=true] .site-header,\nhtml[data-broadcast-egress=true] .breadcrumb,\nhtml[data-broadcast-egress=true] .page-banner,\nhtml[data-broadcast-egress=true] .site-footer,\nhtml[data-broadcast-egress=true] .content-section.portal-surface,\nhtml[data-broadcast-egress=true] .skip-link{display:none!important}\nhtml[data-broadcast-egress=true] main,\nhtml[data-broadcast-egress=true] .content-section,\nhtml[data-broadcast-egress=true] .content-section>.container{width:100%;max-width:none;margin:0;padding:0}\nhtml[data-broadcast-egress=true] [data-broadcast-player]{width:100vw;height:100vh;margin:0;padding:0;border:0;border-radius:0;background:#000;box-shadow:none}\nhtml[data-broadcast-egress=true] [data-broadcast-player]>:not(video):not(.ministry-youtube-player){display:none!important}\nhtml[data-broadcast-egress=true] [data-broadcast-player] video,\nhtml[data-broadcast-egress=true] .ministry-youtube-player{display:block!important;width:100vw;height:100vh;max-height:none;aspect-ratio:auto;object-fit:contain;margin:0;border:0;border-radius:0;background:#000}\n\n/* Coordinated studio control room */\n.studio-workflow{border:1px solid #d9e2ef;border-radius:18px;padding:1rem;margin:1rem 0;background:linear-gradient(135deg,#f8fbff,#fff8fb)}\n.studio-workflow h4{margin:.1rem 0 .35rem;color:#17345f}\n.studio-mode-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.7rem;margin:.8rem 0}\n.studio-mode-card{display:grid;gap:.25rem;text-align:left;padding:.9rem;border:1px solid #d9e2ef;border-radius:14px;background:#fff;cursor:pointer;color:#213b63}\n.studio-mode-card strong{font-size:1rem}.studio-mode-card span{font-size:.84rem;color:#66758a;line-height:1.35}\n.studio-mode-card[aria-pressed=true]{border-color:#7a1f3e;box-shadow:0 0 0 2px #7a1f3e1c;background:#fff8fa}\n.studio-onair-bar{display:flex;gap:.65rem;align-items:center;flex-wrap:wrap;padding:.7rem .8rem;border-radius:12px;background:#102f5e;color:#fff;margin-top:.8rem}\n.studio-onair-label{font-weight:800;letter-spacing:.06em;background:#b42145;padding:.3rem .55rem;border-radius:999px}\n.studio-onair-bar span:last-child{font-size:.86rem;opacity:.92;flex:1;min-width:220px}\n.studio-go-live{font-size:1.05rem;font-weight:800;padding:.8rem 1.2rem}\n.studio-box{border:1px solid #dce3ec;border-radius:14px;background:#fff;overflow:hidden}\n.studio-box>summary{cursor:pointer;font-weight:800;color:#17345f;padding:.9rem 1rem;background:#f7f9fc;list-style:none}\n.studio-box>summary::-webkit-details-marker{display:none}\n.studio-box>summary::after{content:'\u25BE';float:right;color:#7a1f3e}.studio-box:not([open])>summary::after{content:'\u25B8'}\n.studio-box[open]>:not(summary){margin-left:1rem;margin-right:1rem}\n.studio-background-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:.55rem;margin:.65rem 0 1rem}\n.studio-background-tile{border:1px solid #d8e0ea;border-radius:10px;background:#fff;padding:.35rem;overflow:hidden;cursor:pointer;text-align:left}\n.studio-background-tile canvas{width:100%;aspect-ratio:16/9;display:block;border-radius:7px;background:#18396b}\n.studio-background-tile span{display:block;font-size:.77rem;padding:.35rem .15rem .1rem;color:#33455f}\n.studio-background-tile[aria-pressed=true]{border-color:#7a1f3e;box-shadow:0 0 0 2px #7a1f3e18}\n@media(max-width:900px){.studio-mode-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}\n@media(max-width:520px){.studio-mode-grid{grid-template-columns:1fr}.studio-workflow{padding:.8rem}}\n\n/* Compact source-first Studio launcher */\n.studio-launcher{padding:1rem 1.1rem;border:1px solid #dce3ec;border-radius:18px;background:#fff;box-shadow:0 10px 24px rgba(16,47,94,.06)}\n.studio-launch-row{display:flex;gap:.65rem;align-items:center;flex-wrap:wrap}\n.studio-launch-button{min-width:180px;font-size:1.05rem;font-weight:800}\n.studio-source-menu{margin-top:.75rem;padding:.65rem;border:1px solid #dfe6ef;border-radius:14px;background:#f8fbff}\n.studio-source-menu[hidden],.studio-camera-choice[hidden],.studio-quick-panel[hidden],.studio-onair-bar[hidden]{display:none!important}\n.studio-camera-choice,.studio-quick-panel{display:flex;gap:.6rem;align-items:end;flex-wrap:wrap;margin:.75rem 0}\n.studio-quick-panel label{flex:1 1 300px;margin:0}\n.studio-quick-panel input{width:100%}\n.studio-onair-bar{margin-top:1rem}\n.studio-onair-switch{display:flex;align-items:center;gap:.45rem;font-weight:700}\n.hk-production-studio>.studio-grid[hidden]{display:none!important}\n@media(max-width:640px){.studio-launch-row>.btn{flex:1}.studio-mode-grid{grid-template-columns:1fr}.studio-camera-choice>.btn,.studio-quick-panel>.btn{width:100%}}\n\n/* Simplified tabbed Studio settings + final confirmation */\n.studio-settings{margin-top:1rem;border:1px solid #dce3ec;border-radius:16px;background:#fff;overflow:hidden}\n.studio-settings[hidden],.studio-final-check[hidden]{display:none!important}\n.studio-settings-tabs{display:flex;gap:.25rem;overflow-x:auto;padding:.55rem;background:#f4f7fb;border-bottom:1px solid #dce3ec}\n.studio-settings-tab{flex:0 0 auto;border:0;border-radius:999px;background:transparent;color:#41536d;padding:.55rem .8rem;font-weight:700;cursor:pointer}\n.studio-settings-tab[aria-pressed=true]{background:#153d8a;color:#fff}\n.studio-settings-panels{padding:.8rem}\n.studio-settings-panel{box-shadow:none!important;border:0!important;padding:.25rem .35rem 1rem!important;overflow:visible!important}\n.studio-settings-panel[hidden]{display:none!important}\n.studio-settings-panel h4{margin:.25rem 0 .75rem;color:#17345f}\n.studio-final-check{display:grid;grid-template-columns:minmax(0,1.5fr) repeat(2,minmax(150px,.75fr));gap:.65rem;margin-top:1rem;padding:.8rem;border:1px solid #dce3ec;border-radius:14px;background:#f8fbff}\n.studio-final-check h4{grid-column:1/-1;margin:0;color:#17345f}\n.studio-final-check label{display:grid;gap:.3rem;font-weight:700;color:#33455f}\n.studio-final-check input,.studio-final-check select{width:100%;box-sizing:border-box;border:1px solid #aeb9ca;border-radius:9px;padding:.72rem;background:#fff;color:#172d4c;font:inherit}\n@media(max-width:760px){.studio-final-check{grid-template-columns:1fr}.studio-settings-tabs{scrollbar-width:thin}}\n\n/* Premium Studio presentation */\n.hk-production-studio{background:linear-gradient(155deg,#f9fbff 0%,#ffffff 54%,#fff8ec 100%);border:1px solid #dbe4f1;border-radius:22px;box-shadow:0 22px 55px rgba(17,45,81,.11)}\n.studio-head{padding-bottom:.7rem;border-bottom:1px solid #e1e8f2}.studio-head h3{color:#17345f}\n.studio-launcher{background:linear-gradient(135deg,#fff 0%,#f6f9ff 60%,#fff9ec 100%);border:1px solid #dbe4f1;box-shadow:0 13px 30px rgba(16,47,94,.08)}\n.studio-launch-button{background:linear-gradient(135deg,#b11e42,#7a1733)!important;border:0!important;color:#fff!important;box-shadow:0 12px 26px rgba(177,30,66,.22)!important}\n.studio-mode-grid{grid-template-columns:repeat(4,minmax(150px,1fr))}\n.studio-mode-card{min-height:108px;border:1px solid #d8e2f0;border-radius:16px;padding:1rem;background:linear-gradient(180deg,#fff,#f8fbff);box-shadow:0 8px 18px rgba(17,45,81,.05)}\n.studio-mode-card:hover{transform:translateY(-2px);box-shadow:0 13px 25px rgba(17,45,81,.1)}\n.studio-mode-card[aria-pressed=true]{border-color:#b11e42;background:linear-gradient(180deg,#fff7fa,#fff);box-shadow:0 0 0 3px rgba(177,30,66,.09)}\n.studio-final-check{background:linear-gradient(135deg,#f7faff,#fffaf0);border-color:#d8e2f0;box-shadow:0 8px 20px rgba(17,45,81,.05)}\n.studio-onair-bar{background:linear-gradient(135deg,#153d8a,#102f5e 65%,#721d40);box-shadow:0 10px 24px rgba(16,47,94,.16)}\n.studio-background-gallery{grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.8rem}\n.studio-background-tile{border:1px solid #d7e1ee;border-radius:14px;padding:.45rem;background:#fff;box-shadow:0 7px 18px rgba(16,47,94,.06);transition:transform .15s ease,box-shadow .15s ease}\n.studio-background-tile:hover{transform:translateY(-2px);box-shadow:0 12px 24px rgba(16,47,94,.11)}\n.studio-background-tile canvas{border-radius:10px;aspect-ratio:16/9;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)}\n.studio-background-tile span{font-weight:700;color:#233d63;padding:.5rem .2rem .2rem}\n.studio-background-tile[aria-pressed=true]{border-color:#b11e42;box-shadow:0 0 0 3px rgba(177,30,66,.09),0 12px 24px rgba(16,47,94,.08)}\n.studio-settings{box-shadow:0 12px 30px rgba(17,45,81,.07)}\n.studio-settings-tabs{background:linear-gradient(90deg,#f3f7fd,#fff9ee)}\n.studio-settings-tab[aria-pressed=true]{background:linear-gradient(135deg,#153d8a,#2854a0);box-shadow:0 6px 14px rgba(21,61,138,.16)}\n@media(max-width:760px){.studio-mode-grid{grid-template-columns:1fr 1fr}.studio-background-gallery{grid-template-columns:1fr 1fr}}\n@media(max-width:480px){.studio-mode-grid,.studio-background-gallery{grid-template-columns:1fr}.studio-launch-button{width:100%}}\n\n/* Streamlabs-inspired final destination confirmation */\n.studio-platform-field{grid-column:1/-1;display:grid;gap:.55rem;padding:.75rem;border:1px solid #dbe4f1;border-radius:13px;background:#fff}\n.studio-platform-field>strong{color:#17345f;font-size:.92rem}\n.studio-platform-field>small{color:#66758a}\n.studio-platform-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:.55rem}\n.studio-platform-option{display:flex!important;align-items:center;gap:.55rem;border:1px solid #d9e3ef;border-radius:12px;padding:.65rem .7rem;background:#fff;cursor:pointer}\n.studio-platform-option:has(input:checked){border-color:#2854a0;background:#f3f7ff;box-shadow:0 0 0 2px rgba(40,84,160,.08)}\n.studio-platform-option:has(input:disabled){opacity:.58;cursor:not-allowed}\n.studio-platform-option input{width:18px;height:18px;accent-color:#153d8a;flex:0 0 auto}\n.studio-platform-option-copy{display:grid;gap:.08rem}.studio-platform-option-copy strong{font-size:.82rem;color:#233d63}.studio-platform-option-copy small{font-size:.7rem;color:#69788d;line-height:1.2}\n@media(max-width:560px){.studio-platform-grid{grid-template-columns:1fr 1fr}.studio-platform-field>.btn{width:100%}}\n\n/* Broadcast readiness */\n.studio-readiness{grid-column:1/-1;display:grid;gap:.55rem;padding:.75rem;border:1px solid #dbe4f1;border-radius:13px;background:#fff}\n.studio-readiness>strong{color:#17345f}\n.studio-readiness-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.45rem}\n.studio-readiness-item{display:flex;gap:.48rem;align-items:flex-start;padding:.52rem .6rem;border-radius:10px;background:#f8fafc;border:1px solid #e0e7ef}\n.studio-readiness-item[data-ok=true]{background:#f1fbf5;border-color:#cae9d7}.studio-readiness-item[data-ok=false]{background:#fff8ed;border-color:#f0d9a6}\n.studio-readiness-icon{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;font-size:.72rem;font-weight:900;background:#dbe4ef;color:#45566f;flex:0 0 20px}\n.studio-readiness-item[data-ok=true] .studio-readiness-icon{background:#23955a;color:#fff}.studio-readiness-item[data-ok=false] .studio-readiness-icon{background:#d48a18;color:#fff}\n.studio-readiness-copy{display:grid;gap:.06rem}.studio-readiness-copy strong{font-size:.76rem;color:#283f5f}.studio-readiness-copy small{font-size:.68rem;color:#6c7a8f;line-height:1.25}\n.studio-readiness[data-ready=true]{border-color:#bcdcc9;box-shadow:0 0 0 2px rgba(35,149,90,.05)}\n\n/* Streamlined Go Live confirmation sheet */\n.studio-final-check{position:relative;grid-template-columns:1fr!important;max-width:880px;margin:1rem auto 0;padding:1rem;border-radius:18px;background:linear-gradient(145deg,#fff,#f8fbff 70%,#fff9ef);box-shadow:0 16px 38px rgba(17,45,81,.1)}\n.studio-final-check>h4{font-size:1.18rem;color:#17345f;margin-bottom:.15rem}\n.studio-final-check>label{display:grid;gap:.35rem;font-weight:700;color:#263e61}\n.studio-final-check textarea{resize:vertical;min-height:82px}\n.studio-platform-field{display:grid;gap:.6rem;padding:.8rem;border:1px solid #dce5f1;border-radius:14px;background:#fff}\n.studio-platform-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.55rem}\n.studio-platform-option{display:flex;align-items:center;gap:.55rem;border:1px solid #d5e0ed;border-radius:12px;padding:.68rem;background:#fff;cursor:pointer}\n.studio-platform-option:has(input:checked){border-color:#2854a0;box-shadow:0 0 0 3px rgba(40,84,160,.08);background:#f6f9ff}\n.studio-platform-option:has(input:disabled){opacity:.55;cursor:not-allowed}\n.studio-platform-option-copy{display:grid;gap:.1rem}.studio-platform-option-copy small{color:#6b7890}\n.studio-go-live-advanced{border:1px solid #dce5f1;border-radius:13px;background:#fff;overflow:hidden}\n.studio-go-live-advanced summary{cursor:pointer;padding:.78rem .9rem;font-weight:800;color:#17345f;background:#f7f9fc}\n.studio-go-live-advanced-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.65rem;padding:.85rem}\n.studio-go-live-advanced-grid label{display:grid;gap:.3rem;font-weight:700;color:#33455f}\n.studio-protection-note{grid-column:1/-1;border-radius:10px;padding:.62rem .72rem;background:#eef8f2;color:#17643b;font-weight:700;font-size:.86rem}\n.studio-readiness{display:grid;gap:.55rem;padding:.75rem;border-radius:13px;background:#f7f9fc;border:1px solid #dce5f1}\n.studio-readiness-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.45rem}\n.studio-readiness-item{display:flex;gap:.45rem;align-items:flex-start;padding:.55rem;border-radius:10px;background:#fff;border:1px solid #e1e7f0}\n.studio-readiness-item[data-ok=true]{border-color:#cde7d8}.studio-readiness-item[data-ok=false]{border-color:#f0d5d5}\n.studio-readiness-icon{font-weight:900}.studio-readiness-item[data-ok=true] .studio-readiness-icon{color:#1f7a48}.studio-readiness-item[data-ok=false] .studio-readiness-icon{color:#a74141}\n.studio-readiness-copy{display:grid;gap:.08rem}.studio-readiness-copy small{color:#66758a}\n@media(max-width:700px){.studio-go-live-advanced-grid{grid-template-columns:1fr}.studio-platform-grid{grid-template-columns:1fr}.studio-final-check{padding:.8rem}}\n\n/* Provider-confirmed live status */\n.studio-platform-option[data-live-confirmed=true]{border-color:#55a879;background:#f4fff8;box-shadow:0 0 0 3px rgba(55,150,93,.09)}\n.studio-platform-option[data-live-confirmed=true] .studio-platform-option-copy small{color:#17643b;font-weight:800}\n.studio-platform-option[data-live-confirmed=false]{border-color:#ddb6b6;background:#fff8f8}\n.studio-platform-option[data-live-confirmed=false] .studio-platform-option-copy small{color:#8d3434;font-weight:700}\n\n\n/* Source-first workspace: only the current task is expanded. */\n.hk-production-studio [hidden]{display:none!important}\n.hk-production-studio{background:#f8fafc;box-shadow:none;padding:clamp(14px,2vw,24px)}\n.studio-launcher,.studio-final-check,.studio-settings,.studio-monitor{background:#fff;box-shadow:none;border-radius:14px}\n.studio-launch-row{align-items:flex-end;justify-content:space-between}\n.studio-source-label{display:grid;gap:.4rem;flex:1 1 260px;max-width:540px;font-weight:700}\n.studio-source-label select,.studio-settings-select select,.studio-scene-toolbar select{width:100%;min-height:44px;border:1px solid #bac6d6;border-radius:9px;background:#fff;padding:.65rem;color:#172d4c;font:inherit}\n.studio-settings-select{display:grid;gap:.4rem;max-width:420px;padding:1rem;font-weight:700}\n.studio-settings-tabs{display:none}\n.studio-monitors{grid-template-columns:minmax(0,1fr);align-items:start}\n.studio-monitors:has(.studio-monitor:not([hidden])+.studio-monitor:not([hidden])){grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)}\n.studio-monitors>.studio-help{grid-column:1/-1;margin:0}\n.studio-scene-toolbar{display:flex;gap:.6rem;align-items:flex-end;flex-wrap:wrap;margin-top:.8rem}\n.studio-scene-toolbar label{display:grid;gap:.35rem;flex:1 1 160px;font-weight:700}\n.studio-scene-toolbar button{min-height:44px}\n.studio-scene-toolbar button[aria-pressed=true]{background:#721d40;color:#fff}\n.studio-final-check{max-width:none;margin:1rem 0}\n.studio-final-check .studio-onair-bar{margin:0 0 .5rem;grid-column:1/-1;background:#153d8a;box-shadow:none}\n.studio-actions{position:sticky;bottom:0;z-index:5;background:#f8fafcf2;border-top:1px solid #dce3ec;padding:.75rem 0;margin:0}\n.studio-actions .studio-go-live{margin-left:auto;min-width:180px;background:#721d40;color:#fff}\n.studio-background-gallery{grid-template-columns:repeat(auto-fit,minmax(125px,1fr));max-height:320px;overflow:auto}\n.hk-production-studio :is(button,select,input,summary):focus-visible{outline:3px solid #e0aa24;outline-offset:3px}\n@media(max-width:700px){.studio-monitors:has(.studio-monitor:not([hidden])+.studio-monitor:not([hidden])){grid-template-columns:1fr}.studio-source-label{max-width:none}.studio-launch-row>.btn{flex:0 0 auto}.studio-scene-toolbar button{flex:1 1 130px}.studio-actions .studio-go-live{margin-left:0}.studio-background-gallery{grid-template-columns:repeat(2,minmax(0,1fr))}}\n\n.studio-status:empty{display:none}\n\n", "type": "text/css;charset=utf-8" }, "/css/shell.css": { "content": ":root{--primary:#075e54;--text:#172d2a;--border:#dce6e0}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:#f0f2ed radial-gradient(#c9d5cc55 .8px,transparent .8px);background-size:19px 19px;color:var(--text);font:16px/1.6 system-ui,sans-serif}a{color:#075e54}button,.btn{cursor:pointer;border:1px solid transparent;border-radius:10px;background:#075e54;color:#fff;padding:11px 17px;font:inherit;font-weight:650;margin:4px;min-height:44px}button:disabled{opacity:.55;cursor:wait}a:focus-visible,button:focus-visible,summary:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #d69815;outline-offset:3px}.skip-link{position:absolute;top:-80px;left:16px;z-index:20;background:white;padding:12px}.skip-link:focus{top:10px}.studio-header{background:#075e54;color:white;padding:24px max(24px,calc((100vw - 1360px)/2));display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}.studio-brand small{font-size:12px;letter-spacing:.13em;color:#d9efe2}.studio-brand h1{font-size:clamp(25px,3vw,34px);margin:4px 0}.studio-brand p{margin:0;color:#def0e8}.account-actions{display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-size:14px}.account-actions a{color:white}.account-actions button{border-color:#ffffff66;background:transparent;font-size:14px}.workspace-nav{display:flex;gap:6px;background:#fff;position:sticky;top:0;z-index:10;overflow-x:auto;padding:8px max(16px,calc((100vw - 1360px)/2));box-shadow:0 3px 12px #14392b09}.workspace-nav a{padding:12px 18px;white-space:nowrap;font-weight:650;text-decoration:none;border-radius:9px;color:#496359}.workspace-nav a[aria-current=page]{background:#e3f0e7;color:#075e54}.workspace-nav a:hover{background:#f0f5f1}#workspace{max-width:1408px;margin:auto;padding:20px 24px 36px;min-height:60vh}.workspace-notice{font-size:14px;margin:0 0 20px;color:#476255}.workspace-panel{background:#fff;border:1px solid var(--border);border-radius:20px;padding:clamp(20px,4vw,40px);box-shadow:0 10px 35px #1a3d2c06}.panel-heading{max-width:790px;margin-bottom:26px}.panel-heading h2{font-size:clamp(26px,4vw,36px);letter-spacing:-.03em;line-height:1.2;margin:7px 0 12px;color:#153e30}.panel-heading p{margin:8px 0;color:#597065}.eyebrow{font-size:11px!important;font-weight:750;letter-spacing:.13em;color:#26765c!important}.task-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.task-card{border:1px solid var(--border);border-radius:15px;padding:24px;text-decoration:none;background:#fcfdfb;color:var(--text);display:block}.task-card>span{font-size:25px;color:#168368}.task-card h3{font-size:20px;margin:10px 0}.task-card p{color:#5c7067;font-size:15px}.task-card strong{color:#075e54;font-size:14px}a.task-card:hover{border-color:#82ad96}.guidance{padding:19px 22px;background:#edf5ee;border-left:3px solid #76a98b;border-radius:10px;margin:24px 0 0}.guidance h3{font-size:17px;margin:0 0 6px}.guidance p{font-size:15px;margin:6px 0}.guidance a{font-weight:650}details{padding:18px;border:1px solid var(--border);border-radius:12px;background:white;margin:16px 0}summary{font-weight:650;cursor:pointer;font-size:16px}dt{font-weight:700;margin-top:16px}dd{margin:4px 0;color:#597065}label{display:block;margin:14px 0}input,select{padding:11px;border:1px solid #b9cabc;border-radius:8px;max-width:100%;font:inherit}input:not([type=checkbox]):not([type=file]){display:block;width:100%}form{max-width:720px}.library-item{padding:18px 0;border-bottom:1px solid var(--border);overflow-wrap:anywhere}.library-item h3{font-size:17px;margin:0}.library-item p{font-size:14px;color:#587366;margin:7px 0}.library-item a{margin-right:15px;font-size:14px}.radio-state{display:flex;gap:14px;align-items:flex-start;padding:20px;background:#f0f7f2;border:1px solid #d6e9dd;border-radius:13px;margin-bottom:22px}.radio-state p{margin:5px 0 0;color:#597065;font-size:14px}.status-dot{width:10px;height:10px;background:#518d6e;border-radius:50%;margin-top:9px;flex:none}.step-navigation{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:24px 0 0;font-size:14px}.step-navigation a{font-weight:650;text-decoration:none;padding:10px 0}.step-navigation span{margin-left:auto;color:#728779}.studio-status{overflow-wrap:anywhere}.site-footer .wrap{max-width:1360px;width:calc(100% - 48px);margin:auto}.site-footer .social-links{display:flex;gap:8px}.site-footer .social{display:grid;place-items:center;border-radius:50%;color:white!important;text-decoration:none!important}.site-footer .youtube{background:#df1230}.site-footer .facebook{background:#087afb}.site-footer .instagram{background:#9e2d8b}.site-footer .twitter{background:black}.hk-footer-bottom-legal{display:flex;justify-content:center;gap:24px;background:#111;padding:14px}.hk-footer-bottom-legal a{font-size:14px;color:white;text-decoration:none}.site-footer .hk-footer-community{text-align:center;align-items:center}.hk-community-network{font-size:24px;letter-spacing:.2em;color:#f4ca32}.hk-community-kicker,.hk-community-tagline{color:#f4ca32;font-weight:700}.site-footer .hk-footer-community h3{font-size:17px;margin:0}.site-footer .hk-footer-community p{font-size:14px;margin:0}@media(max-width:700px){.studio-header{padding:20px;gap:14px}.account-actions{gap:10px 14px;font-size:13px}.workspace-nav{padding:7px 10px}.workspace-nav a{padding:10px 13px;font-size:14px}#workspace{padding:16px 12px 28px}.workspace-panel{padding:20px 16px;border-radius:15px}.task-grid{grid-template-columns:1fr}.task-card{padding:20px}.step-navigation{font-size:13px}.site-footer .wrap{width:calc(100% - 32px)}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}\n/* Temporary homepage concept; independent Studio branding with the ministry footer. */\n.studio-header{background:#fff;color:#075e54;border-bottom:1px solid #e7e7dc}.studio-brand small{color:#987329}.studio-brand p{color:#5c7869}.account-actions a{color:#075e54}.account-actions button{color:#075e54;border-color:#a3b9a9}.workspace-nav{overflow:visible;display:grid;grid-template-columns:repeat(6,auto)}.workspace-nav>a{text-align:center}.workspace-more{position:relative;border:0;margin:0;padding:0;background:transparent}.workspace-more>summary{padding:12px 18px;color:#496359;list-style:none;min-height:44px;text-align:center}.workspace-more>summary:after{content:' \u25BE'}.workspace-more>div{position:absolute;right:0;top:100%;z-index:15;background:white;border:1px solid #dce6e0;box-shadow:0 10px 30px #103e3220;border-radius:12px;width:290px;max-width:90vw;padding:8px}.workspace-more a{display:block;white-space:normal;padding:10px 14px;font-size:14px}.workspace-more small{display:inline-block;background:#f6efd9;padding:1px 5px;border-radius:5px;font-size:11px;color:#8b6b2a}.home-hero{background:linear-gradient(110deg,#fffcf4,#f1f5e9);border:1px solid #e4e4d6;border-radius:17px;padding:25px;display:grid;grid-template-columns:1.6fr 1fr;gap:15px;margin:0 0 30px;width:100%}.home-hero h3{font:700 clamp(30px,4.8vw,56px)/1.08 Georgia,serif;letter-spacing:-.04em;margin:12px 0;color:#0a382e}.home-hero h3 span{color:#9e7832}.home-hero svg{width:100%;align-self:center}.home-hero .btn{display:inline-block;text-decoration:none;font-size:14px}.btn-outline{background:transparent;color:#075e54;border-color:#aa8b4f}.panel-heading:has(.home-hero){max-width:none}.planned-badge{font-size:11px!important;color:#86692d!important;background:#f6efd9;border-radius:6px;padding:4px 8px}.connection-check{border-bottom:1px solid #dce6e0;padding:12px 0}.connection-check h4{margin:0}.connection-check p{margin:5px 0;font-size:14px}#device-test-video{display:block;width:min(100%,640px);aspect-ratio:16/9;background:#102b24;border-radius:10px;margin-top:14px}#device-test-meter{width:min(100%,350px)}.signin-layout{max-width:540px;margin:8vh auto;background:white;border:1px solid #dce6e0;padding:32px;border-radius:18px}.signin-layout .btn{display:inline-block;text-decoration:none}.signin-divider{margin-top:24px;color:#6a7d71;font-size:14px}@media(max-width:700px){.workspace-nav{grid-template-columns:repeat(3,1fr);gap:0}.workspace-nav>a,.workspace-more>summary{font-size:13px;padding:9px 7px}.home-hero{padding:20px;grid-template-columns:1fr}.home-hero svg{display:none}.signin-layout{margin:5vh 14px;padding:24px}.workspace-more>div{width:280px;max-width:calc(100vw - 24px)}}\n", "type": "text/css;charset=utf-8" }, "/css/studio-premium-overrides.css": { "content": '/* Premium Studio refinement \u2014 source-first, low-clutter, mobile-first. */\n.hk-production-studio{position:relative;overflow:hidden;background:linear-gradient(145deg,#f4f8ff 0%,#fff 45%,#fff9ef 100%);border:1px solid #d6e0ee!important;box-shadow:0 28px 70px rgba(15,45,87,.14)!important}\n.hk-production-studio:before{content:"";position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(90deg,#153d8a 0 48%,#f3ca4a 48% 58%,#7a1733 58% 100%)}\n.studio-head{position:relative;padding:.2rem 0 .9rem!important}.studio-head h3{font-size:clamp(1.3rem,2.4vw,1.9rem)!important;letter-spacing:-.025em}.studio-badge{font-size:.72rem;font-weight:900!important;letter-spacing:.11em!important}\n.studio-launcher{position:relative;border:0!important;background:linear-gradient(135deg,#102f5e,#173f7e 58%,#6f1939)!important;color:#fff;box-shadow:0 20px 42px rgba(16,47,94,.2)!important;padding:1.15rem!important}.studio-launcher .studio-help{color:#dce7f7}.studio-launch-row{justify-content:space-between}.studio-launch-button{min-width:210px;min-height:54px;border-radius:14px!important;background:linear-gradient(135deg,#d0274e,#a7193d)!important;box-shadow:0 12px 28px rgba(176,25,61,.32)!important;letter-spacing:.035em}.studio-launch-row>.btn-secondary{background:rgba(255,255,255,.1)!important;color:#fff!important;border:1px solid rgba(255,255,255,.28)!important}\n.studio-source-menu{background:rgba(255,255,255,.98)!important;border:0!important;box-shadow:0 16px 36px rgba(5,25,56,.22);padding:.75rem!important}.studio-mode-card{position:relative;min-height:104px!important;border:1px solid #dce5f1!important;background:#fff!important;box-shadow:none!important}.studio-mode-card:hover{border-color:#8ea9cd!important;box-shadow:0 10px 24px rgba(17,45,81,.09)!important}.studio-mode-card[aria-pressed=true]{border-color:#b11e42!important;box-shadow:0 0 0 3px rgba(177,30,66,.11)!important}.studio-mode-card strong{color:#17345f}.studio-mode-card span{color:#69788c}\n.studio-monitors{padding:.65rem;border-radius:18px;background:#0c1728;box-shadow:0 18px 38px rgba(6,18,36,.2)}.studio-monitor{background:#111d30!important;border-color:#27374f!important;color:#fff!important;padding:.55rem!important}.studio-monitor h4{font-size:.72rem;letter-spacing:.09em;color:#a9bdd8}.studio-monitor canvas{border-radius:12px!important;background:#050b14!important}\n.studio-final-check{border:1px solid #d5dfed!important;background:linear-gradient(135deg,#fff,#f5f8fd)!important;box-shadow:0 12px 28px rgba(17,45,81,.08)!important}.studio-final-check h4:before{content:"\u2713 ";color:#278552}.studio-go-live{min-height:52px;border-radius:13px!important;background:linear-gradient(135deg,#c51f46,#8e1535)!important;box-shadow:0 10px 24px rgba(177,30,66,.24)}\n.studio-settings{border:1px solid #d7e1ee!important;border-radius:18px!important;box-shadow:0 16px 34px rgba(17,45,81,.08)!important}.studio-settings-tabs{padding:.55rem!important;gap:.35rem!important;background:#f3f6fb!important}.studio-settings-tab{min-height:40px}.studio-settings-tab[aria-pressed=true]{background:#173f7e!important;box-shadow:0 6px 16px rgba(23,63,126,.2)!important}\n.studio-background-gallery{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))!important;gap:.85rem!important}.studio-background-gallery:before{content:"BUILT-IN LOW-DATA MOVING BACKGROUNDS \xB7 The first three move inside the live programme without uploading a video.";grid-column:1/-1;display:block;padding:.72rem .85rem;border-radius:12px;background:linear-gradient(90deg,#edf4ff,#fff8e8);border:1px solid #d8e4f3;color:#173f7e;font-size:.76rem;font-weight:850;letter-spacing:.025em}.studio-background-tile{position:relative;border-radius:16px!important;padding:.42rem!important;box-shadow:0 8px 22px rgba(17,45,81,.07)!important}.studio-background-tile canvas{border-radius:12px!important}.studio-background-tile span{font-size:.82rem!important;padding:.55rem .25rem .3rem!important}.studio-background-tile span:first-letter{text-transform:uppercase}.studio-background-tile[aria-pressed=true]{border-color:#b11e42!important;box-shadow:0 0 0 3px rgba(177,30,66,.1),0 14px 30px rgba(17,45,81,.1)!important}\n.studio-background-tile[data-background="hkem-stage"]:after,.studio-background-tile[data-background="world-map"]:after,.studio-background-tile[data-background="prayer"]:after{content:"\u25CF MOVING";position:absolute;top:.72rem;right:.72rem;padding:.25rem .45rem;border-radius:999px;background:rgba(126,18,51,.92);color:#fff;font-size:.62rem;font-weight:900;letter-spacing:.06em;box-shadow:0 4px 12px rgba(0,0,0,.2);animation:studioMovingPulse 1.8s ease-in-out infinite}\n.studio-background-tile[data-background="hkem-stage"] canvas,.studio-background-tile[data-background="world-map"] canvas,.studio-background-tile[data-background="prayer"] canvas{outline:2px solid rgba(243,202,74,.55);outline-offset:-2px}\n@keyframes studioMovingPulse{0%,100%{transform:scale(1);box-shadow:0 4px 12px rgba(0,0,0,.2)}50%{transform:scale(1.045);box-shadow:0 5px 16px rgba(122,23,51,.32)}}\n.studio-onair-bar{border:1px solid rgba(255,255,255,.08);background:linear-gradient(135deg,#102f5e,#173f7e 58%,#6f1939)!important}.studio-onair-label{box-shadow:0 4px 12px rgba(0,0,0,.16)}\n.studio-status{border-left:0!important;border:1px solid #d9e3ef;border-radius:12px!important;box-shadow:0 7px 18px rgba(17,45,81,.05)}\n.studio-metrics{background:#eef3fa!important}.studio-metrics span{box-shadow:0 3px 10px rgba(17,45,81,.04)}\n@media(max-width:760px){.hk-production-studio{border-radius:16px!important;padding:12px!important}.studio-launcher{border-radius:15px!important}.studio-launch-row{display:grid;grid-template-columns:1fr auto}.studio-launch-button{min-width:0;width:100%}.studio-source-menu{grid-template-columns:1fr 1fr!important}.studio-background-gallery{grid-template-columns:1fr 1fr!important}.studio-monitors{padding:.4rem}.studio-monitor{padding:.4rem!important}}\n@media(max-width:480px){.studio-source-menu,.studio-background-gallery{grid-template-columns:1fr!important}.studio-launch-row{grid-template-columns:1fr}.studio-launch-row>.btn{width:100%}.studio-mode-card{min-height:88px!important}.studio-settings-tabs{position:sticky;top:0;z-index:2}.studio-final-check{padding:.65rem!important}}\n\n.studio-motion-gallery:before{content:"UPLOADED MOVING BACKGROUNDS \xB7 Hover with a mouse or tap a thumbnail to preview/select. Videos load only when the studio library is open.";background:linear-gradient(90deg,#eef8ff,#fff4f6)}\n.studio-motion-tile video{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;background:#081426}\n.studio-motion-tile[aria-pressed=true]:after{content:"\u2713 SELECTED";position:absolute;top:.72rem;right:.72rem;padding:.25rem .45rem;border-radius:999px;background:#173f7e;color:#fff;font-size:.62rem;font-weight:900;letter-spacing:.05em}\n\n', "type": "text/css;charset=utf-8" }, "/index.html": { "content": `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Heavenly Key Studio</title>
<link rel="stylesheet" href="/css/production-studio.css"><link rel="stylesheet" href="/css/studio-premium-overrides.css"><link rel="stylesheet" href="/css/shell.css"><link rel="stylesheet" href="/css/ministry-footer.css"></head>
<body><a class="skip-link" href="#workspace">Skip to workspace</a>
<header class="studio-header"><div class="studio-brand"><small>REVIVAL \xB7 HOLINESS \xB7 POWER</small><h1>Heavenly Key Studio</h1><p>One clear step at a time.</p></div><div class="account-actions"><a href="https://heavenlykey.org/" target="_blank" rel="noopener noreferrer">Go back to the main website \u2197</a><a href="/auth/start">Renew sign-in</a><button id="logout">Sign out</button></div></header>
<nav class="workspace-nav" aria-label="Studio navigation"><a href="#home" data-nav="home">Home</a><a href="#live" data-nav="live">Live Studio</a><a href="#radio" data-nav="radio">24/7 Radio</a><a href="#library" data-nav="library">Sources</a><a href="#connections" data-nav="connections">Connections</a><details class="workspace-more"><summary>More tools</summary><div><a href="#editing" data-nav="editing">AI Video &amp; Audio Editing <small>Planned</small></a><a href="#meetings" data-nav="meetings">Live Meetings <small>Planned</small></a><a href="#autopost" data-nav="autopost">Social Media Auto Post <small>Planned</small></a><a href="#automation" data-nav="automation">Social Media Automation <small>Planned</small></a><a href="#settings" data-nav="settings">Settings</a><a href="#help" data-nav="help">Help</a></div></details></nav>
<main id="workspace"><p id="notice" class="workspace-notice" role="status" aria-live="polite">Checking your sign-in\u2026</p>
<section class="workspace-panel" id="view-home" data-view="home" aria-labelledby="home-heading"><div class="panel-heading"><div class="home-hero"><div><p class="eyebrow">REVIVAL \xB7 HOLINESS \xB7 POWER</p><h3>Your message.<br><span>To the nations.</span></h3><p>Create, broadcast and share the Gospel \u2014 one simple step at a time.</p><div><a class="btn" href="#live">Open Live Studio</a><a class="btn btn-outline" href="#radio">Manage Radio</a></div></div><svg viewBox="0 0 280 250" role="img" aria-label="Microphone and globe illustration"><circle cx="180" cy="105" r="92" fill="#e4ece1"/><g stroke="#b9cdb8" fill="none" stroke-width="1.5"><circle cx="180" cy="105" r="83"/><ellipse cx="180" cy="105" rx="42" ry="83"/><path d="M98 105h166M109 64h142M109 146h142"/></g><g stroke="#bd954d" fill="none" stroke-width="4" stroke-linecap="round"><path d="M33 103v25m14-43v58m14-45v33m164-40v50m14-69v89m14-58v25"/></g><g transform="translate(90 34)"><rect x="0" y="0" width="66" height="125" rx="32" fill="#b99144"/><rect x="7" y="7" width="52" height="93" rx="25" fill="#143f34"/><g stroke="#dfcc97" stroke-width="2"><path d="M19 19v66m10-72v79m10-79v79m10-73v66M12 32h42M9 46h48M9 60h48M12 74h42"/></g><path d="M-13 87v34c0 56 92 56 92 0V87M33 161v36m-31 0h62" fill="none" stroke="#133e32" stroke-width="9" stroke-linecap="round"/></g></svg></div><p class="eyebrow">WELCOME TO YOUR WORKSPACE</p><h2 id="home-heading" tabindex="-1">What would you like to do?</h2><p>Choose one task. Each section explains what to do next.</p></div><div class="task-grid">
<a class="task-card" href="#live"><span aria-hidden="true">\u25C9</span><h3>Start a live programme</h3><p>Choose a camera or recording, preview it, then go live.</p><strong>Open Live Studio \u2192</strong></a>
<a class="task-card" href="#radio"><span aria-hidden="true">\u266B</span><h3>Manage Revival Radio</h3><p>Speak live with your microphone or manage recorded programmes.</p><strong>Open Radio \u2192</strong></a>
<a class="task-card" href="#library"><span aria-hidden="true">\u25A4</span><h3>Add a recording</h3><p>Upload audio or video privately. Preview before publishing.</p><strong>Open Media Library \u2192</strong></a>
<a class="task-card" href="#connections"><span aria-hidden="true">\u2197</span><h3>Check connections</h3><p>Set up the broadcast service and social streaming destinations.</p><strong>Open Connections \u2192</strong></a></div><details class="planned-tools"><summary>More Studio tools \xB7 planned</summary><div class="task-grid"><a class="task-card" href="#editing"><span class="planned-badge">Planned</span><h3>AI Video &amp; Audio Editing</h3><p>A dedicated editing workspace for video and audio. Its own path and website will be configured when this module is built.</p><strong>View module plan \u2192</strong></a><a class="task-card" href="#meetings"><span class="planned-badge">Planned</span><h3>Live Meetings</h3><p>Interactive meetings with hosts and guests, similar to a Zoom-style meeting room. This module will be built separately from one-way broadcasting.</p><strong>View module plan \u2192</strong></a><a class="task-card" href="#autopost"><span class="planned-badge">Planned</span><h3>Social Media Auto Post</h3><p>Prepare a post once and publish or schedule it to connected social accounts when this module is ready.</p><strong>View module plan \u2192</strong></a><a class="task-card" href="#automation"><span class="planned-badge">Planned</span><h3>Social Media Automation</h3><p>Manage recurring posting workflows and social tasks when the automation module is ready.</p><strong>View module plan \u2192</strong></a></div></details><div class="guidance"><h3>First time here?</h3><p>Check Connections once, then choose Live Studio or Radio. Opening a section does not start a broadcast.</p><a href="#help">Read the feature guide \u2192</a></div></section>
<section class="workspace-panel" id="view-live" data-view="live" aria-labelledby="live-heading" hidden><div class="panel-heading"><p class="eyebrow">PREPARE \xB7 PREVIEW \xB7 GO LIVE</p><h2 id="live-heading" tabindex="-1">Live Studio</h2><p>Choose your source and programme title. Prepare a private preview, check the sound, then press Go live when you are ready.</p></div><details class="feature-help"><summary>What do the Studio controls mean?</summary><dl><dt>Source</dt><dd>Your camera, microphone, a saved recording or an external stream.</dd><dt>Preview</dt><dd>A private check of your picture and sound before broadcasting.</dd><dt>Programme output</dt><dd>The picture and mixed sound you send to your audience.</dd><dt>Take over 24/7</dt><dd>Your live programme temporarily replaces automatic playback on the selected channel.</dd><dt>End broadcast</dt><dd>Ends your live programme. Scheduled or enabled 24/7 playback can resume.</dd><dt>Settings</dt><dd>Change sound, backgrounds, text, screen size, recording and saved preferences.</dd></dl></details><div id="studio"></div><p class="guidance">You can move between these menu sections while preparing. Use End broadcast to stop a live programme and Close preview to release your microphone or camera.</p></section>
<section class="workspace-panel" id="view-radio" data-view="radio" aria-labelledby="radio-heading" hidden><div class="panel-heading"><p class="eyebrow">FAITH OF OUR FATHERS \xB7 REVIVAL RADIO</p><h2 id="radio-heading" tabindex="-1">Your radio workspace</h2><p>Speak live, add recorded messages or manage automatic playback.</p></div><div class="radio-state"><span class="status-dot" aria-hidden="true"></span><div><strong id="radio-state-title">Checking radio status\u2026</strong><p id="radio-state-description">Programme status appears here after sign-in.</p></div></div><div class="task-grid"><article class="task-card"><h3>1. Speak live</h3><p>Use your microphone with the camera off. Enter a title, prepare your audio preview and check the microphone meter before going live.</p><button id="radio-prepare">Prepare a radio programme</button></article><article class="task-card"><h3>2. Play recorded messages</h3><p>Upload an audio recording privately. Preview it, then add it to the radio playlist.</p><button id="radio-library">Open audio recordings</button></article><article class="task-card"><h3>3. Manage 24/7 radio</h3><p>Enable automatic playback to use published audio when no live or scheduled programme has priority. Switching this off does not end a live broadcast.</p><div id="radio-playlist"></div></article></div><div class="guidance"><h3>Check what listeners hear</h3><p>The status above describes the server programme. Open the listener page to confirm sound and playback on your device. Use headphones during a live programme to prevent feedback.</p><a href="https://heavenlykey.org/pages/radio.html" target="_blank" rel="noopener noreferrer">Open the radio listener page \u2197</a></div><details><summary>How live radio and 24/7 playback work together</summary><p>Live radio takes priority on the radio channel. When it ends, a current scheduled programme takes priority, followed by enabled 24/7 playback. Publishing a recording adds it to automatic playback; it does not start a microphone broadcast.</p></details></section>
<section class="workspace-panel" id="view-library" data-view="library" aria-labelledby="library-heading" hidden><div class="panel-heading"><p class="eyebrow">YOUR RECORDINGS</p><h2 id="library-heading" tabindex="-1">Media library</h2><p>Upload a recording, preview it, then choose whether to add it to 24/7 playback.</p></div><button id="refresh">Refresh library</button><form id="upload"><label>Upload audio or video (up to 2 GB)<input type="file" name="file" accept="audio/*,video/*" required></label><label><input name="keep" type="checkbox"> Keep permanently</label><button>Upload to private library</button><button type="button" id="pause-upload" disabled>Pause upload</button></form><p id="upload-status" role="status"></p><label>Show recordings<select id="library-filter"><option value="all">Audio and video</option><option value="audio">Audio for radio</option><option value="video">Video for television</option></select></label><p>Audio recordings enter the radio playlist. Videos enter the television playlist; radio may use their audio when no published audio recording is available.</p><div id="library"></div><h3>Automatic television playback</h3><p>This switch controls the video playlist. Manage automatic radio in the Radio section.</p><div id="video-playlist"></div></section>
<section class="workspace-panel" id="view-connections" data-view="connections" aria-labelledby="connections-heading" hidden><div class="panel-heading"><p class="eyebrow">SET UP ONCE</p><h2 id="connections-heading" tabindex="-1">Connections</h2><p>Connect the broadcast service and any social platforms you want to use.</p></div><details><summary>Broadcast service \xB7 LiveKit</summary><p>Saved connections remain on the server. Blank fields preserve existing LiveKit settings.</p><form id="connection"><label>LiveKit URL<input name="url" type="url" placeholder="https://your-project.livekit.cloud"></label><label>API key<input name="apiKey" type="password" autocomplete="off"></label><label>API secret<input name="apiSecret" type="password" autocomplete="off"></label><button>Check and save connection</button><button type="button" id="check-connection">Check saved connection</button></form><p id="connection-status" role="status"></p>
</details><details><summary>Social platforms \xB7 RTMP streaming</summary><form id="destination"><h3>Social streaming destinations</h3><p>Prepare your live event on the platform, then enter its RTMP server and stream key. Confirm the public broadcast on that platform.</p><label>Platform<select name="destination"><option>youtube</option><option>facebook</option><option>tiktok</option><option>instagram</option><option>linkedin</option><option>x</option></select></label><label>RTMP server URL<input name="server_url" required placeholder="rtmps://\u2026"></label><label>Stream key<input name="stream_key" type="password" required autocomplete="off"></label><button>Save destination</button></form><p id="destination-status" role="status"></p></details></section>

<section class="workspace-panel" id="view-editing" data-view="editing" aria-labelledby="editing-heading" hidden><div class="panel-heading"><p class="eyebrow">PLANNED STUDIO MODULE</p><h2 id="editing-heading" tabindex="-1">AI Video &amp; Audio Editing</h2><p>A dedicated editing workspace for video and audio. Its own path and website will be configured when this module is built.</p></div><div class="guidance"><h3>Recorded for the next build</h3><p>This module is not installed or connected yet. Its controls will appear here when it is ready.</p><a href="#home">Return to Studio Home \u2192</a></div></section><section class="workspace-panel" id="view-meetings" data-view="meetings" aria-labelledby="meetings-heading" hidden><div class="panel-heading"><p class="eyebrow">PLANNED STUDIO MODULE</p><h2 id="meetings-heading" tabindex="-1">Live Meetings</h2><p>Interactive meetings with hosts and guests, similar to a Zoom-style meeting room. This module will be built separately from one-way broadcasting.</p></div><div class="guidance"><h3>Recorded for the next build</h3><p>This module is not installed or connected yet. Its controls will appear here when it is ready.</p><a href="#home">Return to Studio Home \u2192</a></div></section><section class="workspace-panel" id="view-autopost" data-view="autopost" aria-labelledby="autopost-heading" hidden><div class="panel-heading"><p class="eyebrow">PLANNED STUDIO MODULE</p><h2 id="autopost-heading" tabindex="-1">Social Media Auto Post</h2><p>Prepare a post once and publish or schedule it to connected social accounts when this module is ready.</p></div><div class="guidance"><h3>Recorded for the next build</h3><p>This module is not installed or connected yet. Its controls will appear here when it is ready.</p><a href="#home">Return to Studio Home \u2192</a></div></section><section class="workspace-panel" id="view-automation" data-view="automation" aria-labelledby="automation-heading" hidden><div class="panel-heading"><p class="eyebrow">PLANNED STUDIO MODULE</p><h2 id="automation-heading" tabindex="-1">Social Media Automation</h2><p>Manage recurring posting workflows and social tasks when the automation module is ready.</p></div><div class="guidance"><h3>Recorded for the next build</h3><p>This module is not installed or connected yet. Its controls will appear here when it is ready.</p><a href="#home">Return to Studio Home \u2192</a></div></section><section class="workspace-panel" id="view-settings" data-view="settings" aria-labelledby="settings-heading" hidden><div class="panel-heading"><p class="eyebrow">STUDIO CHECKS</p><h2 id="settings-heading" tabindex="-1">Settings &amp; checks</h2><p>Check your device and saved connections before a programme.</p></div><div class="guidance"><h3>Camera and microphone \xB7 local test</h3><p>This opens your devices only on this page. It does not start a broadcast. Stop your Studio preview before running a separate device test.</p><button id="test-devices">Test camera &amp; microphone</button><button id="stop-device-test">Stop test</button><video id="device-test-video" muted playsinline hidden></video><label>Microphone level <meter id="device-test-meter" min="0" max="100" value="0"></meter></label><p id="device-test-status" role="status">Ready for a private device test.</p></div><div class="guidance"><h3>Broadcast and Facebook connections</h3><p>Checks the existing storage, LiveKit credentials and saved Facebook streaming configuration. This does not start or stop a broadcast.</p><button id="check-all-connections">Check connections</button><p id="diagnostics-status" role="status"></p><div id="diagnostics-results"></div><a href="#connections">Open connection settings \u2192</a></div><details><summary>Sign-in options</summary><p>Open Studio from your owner control room session, or sign in directly here with the same existing control room owner or admin credentials. Password changes remain managed in the control room.</p><a href="/auth/start">Continue with control room</a></details></section><section class="workspace-panel" id="view-help" data-view="help" aria-labelledby="help-heading" hidden><div class="panel-heading"><p class="eyebrow">SIMPLE FEATURE GUIDE</p><h2 id="help-heading" tabindex="-1">Help, one feature at a time</h2><p>Open the explanation you need.</p></div>
<details><summary>Home \xB7 choose your next task</summary><p>Your starting point. Open Live Studio, Radio, Media Library or Connections using a large task card or the top menu.</p></details>
<details><summary>Live Studio \xB7 prepare and broadcast</summary><p>Choose a source, enter the programme title and prepare the preview. Check sound and the destination. Press Go live when ready. Press End broadcast when finished; Close preview releases your camera and microphone.</p></details>
<details><summary>Radio \xB7 microphone programmes and recorded messages</summary><p>Choose Prepare a radio programme for microphone-only broadcasting. For recorded messages, open audio recordings, upload a file and preview it before adding it to the radio playlist.</p></details>
<details><summary>Media Library \xB7 private uploads and publishing</summary><p>Upload audio or video up to 2 GB. An uploaded file is private until you publish it or use it in a programme. Pause stops after the current upload chunk. To resume, keep the same tab and select the same original file again. Temporary files normally expire after 48 hours; choose Keep permanently to retain a private upload. Publishing retains the file.</p></details>
<details><summary>Connections \xB7 broadcast service and social platforms</summary><p>LiveKit carries your live sound and video. Check the saved connection before replacing any details. For a social platform, prepare an event there, then save its RTMP server and stream key here. Choose destinations in the Studio final check and confirm the broadcast on each platform.</p></details>
<details><summary>Studio settings \xB7 sound, background and recording</summary><p>Output sets screen size and channel. Camera &amp; Background controls your source and backdrop. Audio adjusts microphone, media and music levels. Branding adds programme text. Recording saves local clips; download or save them before leaving. Advanced stores your preferences for later.</p></details>
<details><summary>Sign-in and returning to the website</summary><p>Open Studio from your signed-in control room without entering another password. Use Renew sign-in if the session expires. Direct sign-in also accepts your existing control room owner or admin username and password. Go back to the main website opens the ministry website in a separate tab so this workspace stays open.</p></details></section>
<div class="step-navigation"><a id="previous-feature" href="#home">\u2190 Home</a><span id="feature-position"></span><a id="next-feature" href="#live">Next: Live Studio \u2192</a></div></main>
<footer class="site-footer"><div class="wrap hk-primary-footer"><section class="hk-footer-column hk-footer-app" aria-labelledby="footer-app-heading"><h2 id="footer-app-heading">Heavenly Key App</h2><div class="hk-footer-app-showcase"><div class="hk-footer-app-emblem" aria-hidden="true"><span class="hk-footer-app-spark">\u2726</span><span class="hk-footer-app-mark" style="font-size:clamp(38px,5vw,68px);line-height:1">\u{1F4D6}</span><span class="hk-footer-app-label">APP</span></div><p><strong>Discipleship and Global Christian Community</strong></p><a class="hk-footer-cta" href="https://app.heavenlykey.org/" target="_blank" rel="noopener noreferrer">Explore the App \u2197</a></div></section><nav class="hk-footer-column" aria-labelledby="footer-links-heading"><h2 id="footer-links-heading">Quick Links</h2><a href="https://heavenlykey.org/pages/about.html">About the Ministry</a><a href="https://heavenlykey.org/pages/meet-the-pastor.html">Meet the Pastor</a><a href="https://heavenlykey.org/pages/steps-to-salvation.html">Steps to Salvation</a><a href="https://heavenlykey.org/pages/partner.html">Partner With Us</a><a href="https://heavenlykey.org/pages/contact.html">Contact Us</a></nav><nav class="hk-footer-column" aria-labelledby="footer-resources-heading"><h2 id="footer-resources-heading">Ministry Resources</h2><a href="https://heavenlykey.org/pages/radio.html">Faith of Our Fathers Radio</a><a href="https://heavenlykey.org/pages/grdpc.html">Global Revival &amp; Destiny Prayer Cry</a><a href="https://bible.heavenlykey.org/" target="_blank" rel="noopener noreferrer">Heavenly Key Bible \u2197</a><a href="https://global.heavenlykey.org/" target="_blank" rel="noopener noreferrer">Global Christian Community \u2197</a></nav><section class="hk-footer-column" aria-labelledby="footer-posts-heading"><h2 id="footer-posts-heading">Recent Blog Posts</h2><div id="hk-footer-recent-posts" class="hk-footer-recent-posts"><p>Visit our ministry blog for recent messages.</p></div><a class="hk-footer-all" href="https://blog.heavenlykey.org/" target="_blank" rel="noopener noreferrer">View All Posts \u2197</a></section><section class="hk-footer-column hk-footer-community" aria-labelledby="footer-community-heading"><h2 id="footer-community-heading">Global Christian Community</h2><div class="hk-community-network" aria-hidden="true"><span>\u25CF</span><span>\u2726</span><span>\u25CF</span><span>\u25CE</span><span>\u25CF</span></div><p class="hk-community-kicker">Connecting Believers Across the Nations</p><h3>Join the Community of God's People!</h3><p>Become part of a global Christian family where believers connect, share the Word of God, encourage one another, build godly friendships, and grow together in faith.</p><p class="hk-community-tagline">One Faith \u2022 One Family \u2022 One Body in Christ</p><a class="hk-footer-cta hk-community-join" href="https://global.heavenlykey.org/" target="_blank" rel="noopener noreferrer">JOIN OUR GLOBAL COMMUNITY \u2197</a></section></div><div class="copyright-strip"><div id="hk-footer-credit" class="wrap copyright-inner"><p>Copyright \xA9 Heavenly Key Evangelistic Movement 2022\u20132026.</p><div class="social-links" aria-label="Follow the ministry"><a href="https://www.youtube.com/@heavenlykeyministry" class="social youtube" target="_blank" rel="noopener noreferrer" aria-label="YouTube">\u25B6</a><a href="https://www.facebook.com/heavenlykey" class="social facebook" target="_blank" rel="noopener noreferrer" aria-label="Facebook">f</a><a href="https://www.instagram.com/heavenlykey247" class="social instagram" target="_blank" rel="noopener noreferrer" aria-label="Instagram">\u25CE</a><a href="https://twitter.com/EAdiohwo" class="social twitter" target="_blank" rel="noopener noreferrer" aria-label="X">\u{1D54F}</a></div><p>Designed by <a href="https://talkmoney.uk/" target="_blank" rel="noopener noreferrer">TALKMONEY ECOSYSTEM \u2197</a></p></div></div><nav class="hk-footer-bottom-legal" aria-label="Legal information"><a href="https://heavenlykey.org/pages/terms.html">Terms of Use</a><a href="https://heavenlykey.org/pages/privacy.html">Privacy Policy</a></nav></footer>
<script type="module" src="/js/studio-app.js"><\/script></body></html>`, "type": "text/html;charset=utf-8" }, "/js/device-check.js": { "content": "export function createDeviceCheck({video,meter,onStatus,mediaDevices=navigator.mediaDevices,audioFactory=()=>new (window.AudioContext||window.webkitAudioContext)()}){\n let stream=null,audio=null,frame=null,generation=0,timer=null;\n function stop(announce=true){generation++;clearTimeout(timer);if(frame!==null)cancelAnimationFrame(frame);frame=null;for(const track of stream?.getTracks()||[])track.stop();stream=null;video.pause();video.srcObject=null;video.hidden=true;meter.value=0;audio?.close().catch(()=>{});audio=null;if(announce)onStatus('Camera and microphone test stopped.');}\n async function start(){stop(false);const attempt=generation;if(!mediaDevices?.getUserMedia){onStatus('Camera access is unavailable. Use a browser that supports camera access over HTTPS.');return false;}onStatus('Allow camera and microphone access to start your private test.');\n  try{const acquired=await mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:360}},audio:{echoCancellation:true,noiseSuppression:true}});if(attempt!==generation){for(const t of acquired.getTracks())t.stop();return false;}stream=acquired;video.srcObject=stream;video.hidden=false;await video.play();if(attempt!==generation)return false;\n   const camera=stream.getVideoTracks().some(t=>t.readyState==='live'),microphone=stream.getAudioTracks().some(t=>t.readyState==='live');if(!camera||!microphone)throw Error('Both a working camera and microphone are needed for this test.');\n   try{audio=audioFactory();await audio.resume();if(attempt!==generation)return false;const analyser=audio.createAnalyser();analyser.fftSize=256;audio.createMediaStreamSource(stream).connect(analyser);const data=new Uint8Array(analyser.fftSize);function sample(){if(attempt!==generation)return;analyser.getByteTimeDomainData(data);let sum=0;for(const x of data)sum+=((x-128)/128)**2;meter.value=Math.min(100,Math.round(Math.sqrt(sum/data.length)*300));frame=requestAnimationFrame(sample);}sample();}catch{if(attempt!==generation)return false;onStatus('Camera and microphone opened. The sound meter is unavailable in this browser. This is a local test only.');timer=setTimeout(()=>stop(),60000);return true;}\n   onStatus('Camera and microphone opened. Speak and check the meter. Nothing is being broadcast. The test stops after one minute.');timer=setTimeout(()=>stop(),60000);return true;\n  }catch(e){if(attempt!==generation)return false;stop(false);onStatus(e.name==='NotAllowedError'?'Camera or microphone permission was denied. Allow them in your browser settings and retry.':e.name==='NotFoundError'?'No camera or microphone was found. Connect a device and retry.':e.name==='NotReadableError'?'Another app may be using the camera or microphone. Close it and retry.':e.message||'The device test could not start.');return false;}\n }\n return {start,stop};\n}\n", "type": "application/javascript;charset=utf-8" }, "/js/production-studio.js": { "content": "import {formats,scenes,backgroundPresets,normalizePreset,fitRect,microphoneLevel,musicLevel,wrapText} from './studio-model.js?v=2.4.0';\nimport {createSubjectEffects,drawStudioBackground} from './studio-effects.js?v=1.2.0';\nconst SDK='https://cdn.jsdelivr.net/npm/livekit-client@2.22.3/+esm';\nexport function mountProductionStudio({container,api,refresh,isAuthorized}){\n const node=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;};\n const root=node('section','','hk-production-studio');root.id='production-studio';container.prepend(root);\n const head=node('div','','studio-head'),title=node('h3','Faith of Our Fathers \xB7 Live studio'),badge=node('span','OFF AIR','studio-badge');head.append(title,badge);root.append(head,node('p','Choose a source, prepare your preview, then go live. Your programme output is what viewers see.'));\n const monitors=node('div','','studio-monitors'),programmeBox=node('div','','studio-monitor'),previewBox=node('div','','studio-monitor');\n const programmeCanvas=node('canvas'),previewCanvas=node('canvas');programmeCanvas.width=1280;programmeCanvas.height=720;previewCanvas.width=480;previewCanvas.height=270;\n programmeBox.append(node('h4','PROGRAMME OUTPUT'),programmeCanvas);previewBox.append(node('h4','NEXT SCENE \xB7 Preview before applying'),previewCanvas);monitors.append(programmeBox,previewBox);monitors.hidden=true;previewBox.hidden=true;root.append(monitors);\n const ctx=programmeCanvas.getContext('2d',{alpha:false}),previewCtx=previewCanvas.getContext('2d',{alpha:false});\n const status=node('p','','studio-status');status.setAttribute('role','status');root.append(status);\n const metrics=node('div','','studio-metrics'),elapsed=node('span','Elapsed: \u2014'),viewers=node('span','LiveKit room participants: \u2014'),quality=node('span','Connection: offline'),fps=node('span','Render: \u2014');metrics.append(elapsed,viewers,quality,fps);metrics.hidden=true;root.append(metrics);\n const actions=node('div','','studio-actions');root.append(actions);function button(parent,text,fn){const b=node('button',text,'btn btn-secondary');b.type='button';b.addEventListener('click',async()=>{if(!isAuthorized()){status.textContent='Sign in as an administrator to use the studio.';return;}try{await fn();}catch(e){status.textContent=e.message||'The studio could not complete this action.';}});parent.append(b);return b;}\n const prepareButton=button(actions,'Prepare preview',prepare),liveButton=button(actions,'Go live',goLive),recoverButton=button(actions,'Recover interrupted live session',recoverExistingLive),returnLiveButton=button(actions,'Return live camera to programme',returnLiveToProgramme),endButton=button(actions,'End broadcast',endLive),closeButton=button(actions,'Close preview',closePreview);liveButton.className='btn btn-primary studio-go-live';prepareButton.hidden=true;liveButton.hidden=true;recoverButton.hidden=true;recoverButton.disabled=true;returnLiveButton.hidden=true;returnLiveButton.disabled=true;endButton.hidden=true;endButton.disabled=true;closeButton.hidden=true;closeButton.disabled=true;\n\n const workflow=node('section','','studio-workflow studio-launcher');\n const launchRow=node('div','','studio-launch-row'),sourceLabel=node('label','1 \xB7 Source','studio-source-label'),sourceSelect=node('select');sourceSelect.id='studio-source';sourceLabel.htmlFor=sourceSelect.id;const emptySource=node('option','Choose your source\u2026');emptySource.value='';sourceSelect.append(emptySource);sourceLabel.append(sourceSelect);const settingsButton=node('button','Settings','btn btn-secondary');settingsButton.type='button';settingsButton.setAttribute('aria-expanded','false');settingsButton.setAttribute('aria-controls','studio-settings');launchRow.append(sourceLabel,settingsButton);workflow.append(launchRow);\n const modeChoices=node('div','','studio-mode-grid studio-source-menu');modeChoices.hidden=true;workflow.append(modeChoices);\n const modeHelp=node('p','Camera, a saved video, the 24/7 programme, or an external stream \u2014 choose above to get started.','studio-help');workflow.append(modeHelp);\n let selectedLaunchMode='camera',cameraStyle='direct';\n sourceSelect.addEventListener('change',()=>{if(!sourceSelect.value){sourceSelect.value=finalCheck.hidden?'':selectedLaunchMode;return;}const choice=[...modeChoices.children].find(x=>x.dataset.mode===sourceSelect.value);if(choice)choice.click();});\n settingsButton.addEventListener('click',()=>{setSettingsOpen(grid.hidden);if(!grid.hidden)settingsSelect.focus();});\n function setSettingsOpen(open){grid.hidden=!open;settingsButton.textContent=open?'Close settings':'Settings';settingsButton.setAttribute('aria-expanded',String(open));prepareButton.hidden=!open||prepared;closeButton.hidden=!prepared;}\n root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!grid.hidden){setSettingsOpen(false);settingsButton.focus();}});\n const onAirBar=node('div','','studio-onair-bar');const onAirToggle=node('input');onAirToggle.type='checkbox';onAirToggle.checked=true;onAirToggle.id='studio-onair-takeover';const onAirToggleLabel=node('label','','studio-onair-switch');onAirToggleLabel.htmlFor=onAirToggle.id;onAirToggleLabel.append(onAirToggle,node('span','Take over 24/7'));const socialLiveToggle=node('input');socialLiveToggle.type='checkbox';socialLiveToggle.checked=false;socialLiveToggle.hidden=true;socialLiveToggle.id='studio-social-live';const onAirLamp=node('span','FINAL CHECK','studio-onair-label'),onAirHelp=node('span','Take over 24/7 means this live source temporarily becomes the public Heavenly Key programme. Ending live returns viewers to the scheduled/24/7 source.');onAirBar.append(onAirToggleLabel,socialLiveToggle,onAirLamp,onAirHelp);workflow.append(onAirBar);onAirBar.hidden=true;onAirToggle.addEventListener('change',()=>{onAirLamp.textContent=onAirToggle.checked?'READY':'LOCAL ONLY';onAirLamp.dataset.active=String(onAirToggle.checked);});socialLiveToggle.addEventListener('change',()=>{if(socialLiveToggle.checked){for(const item of livePlatformState)if(item.ready)selectedLivePlatforms.add(item.platform);}else selectedLivePlatforms.clear();for(const box of platformGrid.querySelectorAll('input[type=checkbox]'))box.checked=selectedLivePlatforms.has(box.value);});\n root.insertBefore(workflow,monitors);\n const grid=node('div','','studio-settings');grid.hidden=true;grid.id='studio-settings';root.append(grid);const settingsLabel=node('label','Settings section','studio-settings-select'),settingsSelect=node('select');settingsLabel.append(settingsSelect);grid.append(settingsLabel);settingsSelect.addEventListener('change',()=>selectSettings(settingsSelect.value));const settingsTabs=node('div','','studio-settings-tabs'),settingsPanels=node('div','','studio-settings-panels');grid.append(settingsTabs,settingsPanels);const boxes={};const settingDefs=[['scenes','Output'],['sources','Camera & Background'],['audio','Audio'],['branding','Branding'],['recording','Recording'],['presets','Advanced']];for(const [key,label] of settingDefs){const option=node('option',label);option.value=key;settingsSelect.append(option);const tab=node('button',label,'studio-settings-tab');tab.type='button';tab.dataset.settingsTab=key;const box=node('section','','studio-box studio-settings-panel');box.dataset.settingsPanel=key;box.append(node('h4',label));boxes[key]=box;settingsTabs.append(tab);settingsPanels.append(box);tab.addEventListener('click',()=>selectSettings(key));}function selectSettings(key){settingsSelect.value=key;for(const t of settingsTabs.children)t.setAttribute('aria-pressed',String(t.dataset.settingsTab===key));for(const p of settingsPanels.children)p.hidden=p.dataset.settingsPanel!==key;}selectSettings('scenes');\n const fields={};function field(box,label,key,type='text',options){const l=node('label',label),e=node(options?'select':type==='textarea'?'textarea':'input');if(!options&&type!=='textarea')e.type=type;e.name=key;fields[key]=e;if(options)for(const [v,t]of options){const o=node('option',t);o.value=v;e.append(o);}if(type==='checkbox'){l.textContent='';l.append(e,document.createTextNode(label));}else l.append(e);box.append(l);if(['title','presenter','lowerThird','ticker','scripture'].includes(key))e.maxLength={title:200,presenter:150,lowerThird:240,ticker:500,scripture:1000}[key];e.addEventListener('input',()=>{preset=readPreset();announceOutput();updateAudio();if(!prepared)draw();});return e;}\n field(boxes.scenes,'Programme title','title');field(boxes.scenes,'Heavenly Key output','destination','select',[['both','Radio + video'],['radio','Radio only'],['video','Video only']]);\n field(boxes.scenes,'Output resolution','format','select',[['landscape-480','Low data \xB7 480p'],['landscape-720','16:9 \xB7 720p'],['landscape-1080','16:9 \xB7 1080p'],['portrait-720','9:16 \xB7 720 \xD7 1280'],['portrait-1080','9:16 \xB7 1080 \xD7 1920'],['portrait-3-4','3:4 \xB7 810 \xD7 1080'],['square-720','1:1 \xB7 720 \xD7 720'],['square-1080','1:1 \xB7 1080 \xD7 1080']]);\n field(boxes.scenes,'Network / video quality','qualityPreset','select',[['data','Data Saver \xB7 lower bitrate and 15 fps'],['balanced','Balanced \xB7 recommended'],['high','High Quality \xB7 stronger network required']]);\n const sceneToolbar=node('div','','studio-scene-toolbar'),sceneLabel=node('label','2 \xB7 Preview scene'),sceneSelect=node('select');sceneLabel.append(sceneSelect);const sceneButtons=node('div','','studio-scenes');sceneButtons.hidden=true;boxes.scenes.append(sceneButtons);sceneToolbar.append(sceneLabel);programmeBox.append(sceneToolbar);sceneSelect.addEventListener('change',()=>sceneButtons.children[[...sceneSelect.options].findIndex(x=>x.value===sceneSelect.value)]?.click());let previewScene='camera',programmeScene='camera',countdownUntil=0;const sceneLabels={camera:'Camera',screen:'Screen + camera',media:'Media + camera',starting:'Starting soon',break:'Prayer break',ending:'Closing'};\n for(const scene of scenes){const option=node('option',sceneLabels[scene]);option.value=scene;sceneSelect.append(option);const b=button(sceneButtons,sceneLabels[scene],()=>{previewScene=scene;sceneSelect.value=scene;previewBox.hidden=false;if(!prepared)draw();for(const x of sceneButtons.children)x.setAttribute('aria-pressed',String(x===b));});b.setAttribute('aria-pressed',String(scene==='camera'));}\n button(sceneToolbar,'Apply scene',()=>{programmeScene=previewScene;if(programmeScene==='starting')countdownUntil=Date.now()+preset.countdown*60000;updateAudio();status.textContent=(sessionId?'Live scene: ':'Programme scene: ')+sceneLabels[programmeScene];});\n const minutes=field(boxes.scenes,'Starting countdown \xB7 minutes','countdown','number');minutes.min='1';minutes.max='60';\n const captureCamera=field(boxes.sources,'Capture camera','useCamera','checkbox'),captureMic=field(boxes.sources,'Capture microphone','useMicrophone','checkbox');captureCamera.checked=true;captureMic.checked=true;\n field(boxes.sources,'Camera direction','facing','select',[['user','Front camera'],['environment','Rear camera']]);field(boxes.sources,'Show camera in programme','cameraVisible','checkbox');field(boxes.sources,'Mirror camera','mirror','checkbox');\n const cameraDeviceSelect=node('select'),cameraDeviceLabel=node('label','Camera device');cameraDeviceLabel.append(cameraDeviceSelect);boxes.sources.append(cameraDeviceLabel);\n const microphoneDeviceSelect=node('select'),microphoneDeviceLabel=node('label','Microphone device \xB7 choose your condenser mic here');microphoneDeviceLabel.append(microphoneDeviceSelect);boxes.sources.append(microphoneDeviceLabel);\n async function refreshDevices(){\n  if(!navigator.mediaDevices?.enumerateDevices)return;\n  const currentCamera=cameraDeviceSelect.value,currentMic=microphoneDeviceSelect.value,devices=await navigator.mediaDevices.enumerateDevices();\n  cameraDeviceSelect.replaceChildren();microphoneDeviceSelect.replaceChildren();\n  const dc=node('option','System/default camera');dc.value='';cameraDeviceSelect.append(dc);const dm=node('option','System/default microphone');dm.value='';microphoneDeviceSelect.append(dm);\n  let ci=0,mi=0;for(const d of devices){if(d.kind==='videoinput'){const o=node('option',d.label||('Camera '+(++ci)));o.value=d.deviceId;cameraDeviceSelect.append(o);}if(d.kind==='audioinput'){const o=node('option',d.label||('Microphone '+(++mi)));o.value=d.deviceId;microphoneDeviceSelect.append(o);}}\n  if(Array.from(cameraDeviceSelect.options).some(o=>o.value===currentCamera))cameraDeviceSelect.value=currentCamera;if(Array.from(microphoneDeviceSelect.options).some(o=>o.value===currentMic))microphoneDeviceSelect.value=currentMic;\n }\n button(boxes.sources,'Refresh camera & microphone list',async()=>{await refreshDevices();status.textContent='Camera and microphone list refreshed.';});refreshDevices().catch(()=>{});\n const backgroundModeField=field(boxes.sources,'Camera background','backgroundMode','select',[['none','Camera only \xB7 no background effect'],['blur','Smart blur \xB7 presenter stays sharp'],['virtual','Static virtual studio / tourist background'],['video','Moving video background \xB7 people/scenes can move']]);\n backgroundModeField.addEventListener('change',async()=>{preset=readPreset();try{if(prepared&&preset.backgroundMode!=='none'&&!subjectEffects)subjectEffects=await createSubjectEffects();if(preset.backgroundMode==='video')await loadBackgroundVideo();else backgroundVideo.pause();status.textContent=preset.backgroundMode==='none'?'Camera-only background selected.':preset.backgroundMode==='video'?'Moving background selected.':'Background effect updated.';}catch(e){status.textContent=e.message;}if(!prepared)draw();});\n const backgroundPresetField=field(boxes.sources,'Studio background','backgroundPreset','select',backgroundPresets);\n const backgroundGallery=node('div','','studio-background-gallery');boxes.sources.append(backgroundGallery);\n for(const [bgId,bgLabel] of backgroundPresets){const tile=node('button','','studio-background-tile');tile.type='button';tile.dataset.background=bgId;const canvas=node('canvas');canvas.width=240;canvas.height=135;const caption=node('span',bgLabel);tile.append(canvas,caption);tile.addEventListener('click',async()=>{backgroundPresetField.value=bgId;backgroundModeField.value='virtual';backgroundModeField.dispatchEvent(new Event('change'));preset=readPreset();for(const x of backgroundGallery.children)x.setAttribute('aria-pressed',String(x===tile));status.textContent='Virtual background selected: '+bgLabel;});backgroundGallery.append(tile);queueMicrotask(()=>{try{drawStudioBackground(canvas.getContext('2d',{alpha:false}),canvas.width,canvas.height,bgId,logo,0);}catch{}});}\n const backgroundStrength=field(boxes.sources,'Background effect strength','backgroundStrength','range');backgroundStrength.min='0';backgroundStrength.max='100';backgroundStrength.step='1';\n const motionBackgroundSelect=node('select');fields.backgroundVideoId=motionBackgroundSelect;const motionEmpty=node('option','Choose a moving background video');motionEmpty.value='0';motionBackgroundSelect.append(motionEmpty);const motionLabel=node('label','Moving background video \xB7 airport / church / prayer / scenery');motionLabel.append(motionBackgroundSelect);boxes.sources.append(motionLabel);\n const motionBackgroundGallery=node('div','','studio-background-gallery studio-motion-gallery');boxes.sources.append(node('p','MOVING BACKGROUNDS \xB7 Preview and tap one to use it','studio-help'),motionBackgroundGallery);\n motionBackgroundSelect.addEventListener('change',async()=>{preset=readPreset();try{await loadBackgroundVideo();}catch(e){status.textContent=e.message;}for(const tile of motionBackgroundGallery.children)tile.setAttribute('aria-pressed',String(tile.dataset.mediaId===motionBackgroundSelect.value));if(!prepared)draw();});\n field(boxes.sources,'Protect face, hands and body \xB7 fall back to clean camera if segmentation is weak','subjectProtection','checkbox');\n boxes.sources.append(node('p','Virtual backgrounds run locally in the browser. Presenter protection has priority: if subject separation is unavailable, the programme keeps the clean camera instead of showing a broken or fading body outline.','studio-help'));\n const screenButton=button(boxes.sources,'Share screen / window',shareScreen);const stopScreenButton=button(boxes.sources,'Stop screen share',stopScreen);stopScreenButton.disabled=true;\n const mediaInput=node('input');mediaInput.type='file';mediaInput.accept='video/*,audio/*,image/*';const mediaLabel=node('label','Local video, audio or picture');mediaLabel.append(mediaInput);boxes.sources.append(mediaLabel);\n const librarySelect=node('select');const libraryEmpty=node('option','Choose an uploaded media file');libraryEmpty.value='';librarySelect.append(libraryEmpty);const libraryLabel=node('label','Private media library');libraryLabel.append(librarySelect);boxes.sources.append(libraryLabel);const loadLibraryButton=button(boxes.sources,'Load selected library media',loadLibrary);\n  const fallbackSelect=node('select');const fallbackEmpty=node('option','Automatic 24/7 playlist if no advert is selected');fallbackEmpty.value='';fallbackSelect.append(fallbackEmpty);const fallbackLabel=node('label','Network-loss advert / standby video');fallbackLabel.append(fallbackSelect);boxes.sources.append(fallbackLabel,node('p','If your live internet connection drops, this uploaded video plays automatically during the reconnect window. When live returns, the advert stops and viewers return to the live programme.','studio-help'));\n const mediaPlayButton=button(boxes.sources,'Play / pause media',async()=>{requirePrepared();if(!media.src)throw Error('Load a video or audio file first.');if(media.paused)await media.play();else media.pause();});const loop=field(boxes.sources,'Loop programme media','loopMedia','checkbox');loop.checked=true;loop.addEventListener('change',()=>{media.loop=loop.checked;});\n\n const quickCameraOptions=node('div','','studio-camera-choice');quickCameraOptions.hidden=true;\n const directCamera=node('button','Direct camera','btn btn-secondary');directCamera.type='button';\n const backgroundCamera=node('button','Camera with background','btn btn-secondary');backgroundCamera.type='button';\n quickCameraOptions.append(directCamera,backgroundCamera);workflow.append(quickCameraOptions);\n const quickMediaPanel=node('div','','studio-quick-panel');quickMediaPanel.hidden=true;const quickMediaHint=node('p','Choose a pre-recorded video from your device or the Media Library.','studio-help');const quickLocalVideo=node('button','Choose video from device','btn btn-secondary');quickLocalVideo.type='button';const quickLibraryVideo=node('button','Choose from Media Library','btn btn-secondary');quickLibraryVideo.type='button';quickMediaPanel.append(quickMediaHint,quickLocalVideo,quickLibraryVideo);workflow.append(quickMediaPanel);\n quickLocalVideo.addEventListener('click',()=>mediaInput.click());\n quickLibraryVideo.addEventListener('click',()=>{setSettingsOpen(true);selectSettings('sources');librarySelect.focus();modeHelp.textContent='Choose a video in Media Library, then tap Load selected library media. After it appears in Preview, use the final GO LIVE button.';});\n\n const quickLinkPanel=node('div','','studio-quick-panel');quickLinkPanel.hidden=true;const linkInput=node('input');linkInput.type='url';linkInput.inputMode='url';linkInput.placeholder='https:// direct stream or supported YouTube URL';const linkLabel=node('label','External live source');linkLabel.append(linkInput);quickLinkPanel.append(linkLabel,node('p','Use a direct HTTPS stream or supported YouTube source. Advertisements inserted by the source platform cannot be stripped by Heavenly Key Studio.','studio-help'));workflow.append(quickLinkPanel);linkInput.addEventListener('input',()=>updateReadiness?.().catch(()=>{}));\n const finalCheck=node('div','','studio-final-check');finalCheck.hidden=true;\n const quickTitle=node('input');quickTitle.type='text';quickTitle.maxLength=200;quickTitle.placeholder='Programme title';quickTitle.autocomplete='off';\n const quickTitleLabel=node('label','Programme title');quickTitleLabel.append(quickTitle);\n const quickDescription=node('textarea');quickDescription.rows=3;quickDescription.maxLength=3000;quickDescription.placeholder='Optional description for connected social platforms';const quickDescriptionLabel=node('label','Description \xB7 optional');quickDescriptionLabel.append(quickDescription);\n const platformField=node('div','','studio-platform-field'),platformTitle=node('strong','Where do you want to broadcast?'),platformGrid=node('div','','studio-platform-grid'),platformHelp=node('small','Select any ready social platforms. Leave all off to broadcast only on Heavenly Key.');platformField.append(platformTitle,platformGrid,platformHelp);\n const managePlatforms=node('button','Manage Platforms & Connections','btn btn-secondary');managePlatforms.type='button';managePlatforms.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('hk-open-platforms')));platformField.append(managePlatforms);\n const advanced=node('details','','studio-go-live-advanced'),advancedSummary=node('summary','Advanced broadcast settings');\n const advancedGrid=node('div','','studio-go-live-advanced-grid');\n const quickFormat=node('select');for(const [v,t] of [['landscape-480','Low data \xB7 480p'],['landscape-720','Landscape \xB7 720p'],['landscape-1080','Landscape \xB7 1080p'],['portrait-720','Portrait \xB7 720 \xD7 1280'],['portrait-1080','Portrait \xB7 1080 \xD7 1920'],['square-720','Square \xB7 720 \xD7 720']]){const o=node('option',t);o.value=v;quickFormat.append(o);}const quickFormatLabel=node('label','Screen size');quickFormatLabel.append(quickFormat);\n const quickDestination=node('select');for(const [v,t] of [['both','Radio + video'],['video','Video only'],['radio','Radio only']]){const o=node('option',t);o.value=v;quickDestination.append(o);}const quickDestinationLabel=node('label','Heavenly Key output');quickDestinationLabel.append(quickDestination);\n const quickQuality=node('select');for(const [v,t] of [['data','Data Saver \xB7 low data'],['balanced','Balanced \xB7 recommended'],['high','High Quality \xB7 stronger network']]){const o=node('option',t);o.value=v;quickQuality.append(o);}const quickQualityLabel=node('label','Network quality');quickQualityLabel.append(quickQuality);\n const protection=node('div','\u2713 Automatic reconnect protection \xB7 up to 10 minutes','studio-protection-note');\n advancedGrid.append(quickFormatLabel,quickDestinationLabel,quickQualityLabel,protection);advanced.append(advancedSummary,advancedGrid);\n const readiness=node('div','','studio-readiness'),readinessTitle=node('strong','Broadcast readiness'),readinessGrid=node('div','','studio-readiness-grid'),readinessMessage=node('small','Studio will check the source, network, engine and chosen destinations before going live.');readiness.append(readinessTitle,readinessGrid,readinessMessage);\n finalCheck.append(node('h4','3 \xB7 Broadcast details'),quickTitleLabel,quickDescriptionLabel,platformField,advanced,readiness);root.insertBefore(finalCheck,status);finalCheck.prepend(onAirBar);root.insertBefore(actions,grid);const previewTip=node('p','Preview stays local until you press Go live. Use Apply scene to change the programme output.','studio-help');monitors.append(previewTip);\n let livePlatformState=[],selectedLivePlatforms=new Set(),lastCapabilities=null,readinessGeneration=0,platformLoadGeneration=0;\n function readinessItem(label,ok,detail){const item=node('div','','studio-readiness-item');item.dataset.ok=String(Boolean(ok));item.append(node('span',ok?'\u2713':'!','studio-readiness-icon'),node('span','','studio-readiness-copy'));item.lastChild.append(node('strong',label),node('small',detail));return item;}\n async function updateReadiness(){\n  const generation=++readinessGeneration;readinessGrid.replaceChildren();readiness.dataset.ready=\"false\";readinessMessage.textContent=\"Checking broadcast readiness\u2026\";const issues=[];\n  const titleOk=Boolean(fields.title.value.trim());readinessGrid.append(readinessItem('Title',titleOk,titleOk?'Ready':'Enter a programme title'));if(!titleOk)issues.push('programme title');\n  let sourceOk=false,sourceDetail='';\n  if(selectedLaunchMode==='247'){sourceOk=true;sourceDetail='24/7 ON AIR source ready';}\n  else if(selectedLaunchMode==='link'){try{const u=new URL(linkInput.value.trim());sourceOk=u.protocol==='https:';}catch{}sourceDetail=sourceOk?'External HTTPS source ready':'Enter a valid HTTPS source';}\n  else if(selectedLaunchMode==='radio'){sourceOk=prepared&&Boolean(cameraStream?.getAudioTracks?.().length);sourceDetail=sourceOk?'Microphone preview ready':'Prepare your microphone preview';}\n  else if(selectedLaunchMode==='video'){sourceOk=Boolean(media.src)&&prepared;sourceDetail=sourceOk?'Pre-recorded video preview ready':'Choose and preview a video';}\n  else {sourceOk=prepared&&Boolean(cameraStream?.getVideoTracks?.().length);sourceDetail=sourceOk?'Camera preview ready':'Open the camera preview';}\n  readinessGrid.append(readinessItem('Source',sourceOk,sourceDetail));if(!sourceOk)issues.push('source/preview');\n  const online=navigator.onLine!==false;readinessGrid.append(readinessItem('Network',online,online?'Browser reports online':'Device appears offline'));if(!online)issues.push('network');\n  let engineOk=true,engineDetail='Media Engine ready';\n  if(selectedLaunchMode==='camera'||selectedLaunchMode==='video'||selectedLaunchMode==='radio'){try{lastCapabilities=lastCapabilities||await api('capabilities');engineOk=Boolean(lastCapabilities?.transport?.live_camera_ingest);engineDetail=engineOk?'LiveKit / Media Engine ready':'LiveKit connection is not ready';}catch{engineOk=false;engineDetail='Media Engine could not be reached';}}\n  if(generation!==readinessGeneration)return {ok:false,issues:['source changed during check']};\n  readinessGrid.append(readinessItem('Broadcast engine',engineOk,engineDetail));if(!engineOk)issues.push('broadcast engine');\n  const selected=[...selectedLivePlatforms],platformsOk=selected.every(p=>livePlatformState.some(x=>x.platform===p&&x.ready));const socialDetail=selected.length?(platformsOk?selected.map(x=>x.toUpperCase()).join(', ')+' selected':'One or more selected destinations are not ready'):'Heavenly Key only \xB7 no social destination selected';\n  readinessGrid.append(readinessItem('Destinations',platformsOk,socialDetail));if(!platformsOk)issues.push('social destination');\n  readinessMessage.textContent=issues.length?'Needs attention: '+issues.join(', ')+'.':'Ready to broadcast.';\n  readiness.dataset.ready=String(issues.length===0);\n  return {ok:issues.length===0,issues};\n }\n\n async function loadLivePlatforms(){\n  const generation=++platformLoadGeneration;platformGrid.replaceChildren();platformHelp.textContent='Checking connected live destinations\u2026';\n  try{\n   const restream=await api('restream');if(generation!==platformLoadGeneration)return;\n   const restored247=restream.active?.source==='247';\n   if(restored247){\n    social247Active=true;\n    badge.textContent='24/7 \xB7 SOCIAL LIVE';\n    badge.dataset.live='true';\n    liveButton.hidden=true;\n    endButton.hidden=false;\n    endButton.disabled=false;\n    const providerState=restream.active?.providerStatus&&restream.active.providerStatus!=='UNKNOWN'?' \xB7 '+restream.active.providerStatus:'';\n    status.textContent='24/7 social live distribution is active'+providerState+'.';\n   }else if(social247Active&&!sessionId){\n    social247Active=false;\n    if(!recoverableLive){\n     badge.textContent='OFF AIR';\n     badge.dataset.live='false';\n     endButton.hidden=true;\n     endButton.disabled=true;\n     liveButton.hidden=false;\n     status.textContent=restream.last?.error?'Previous 24/7 social live ended: '+restream.last.error:'24/7 social live distribution is stopped.';\n    }\n   }\n   const manual=new Map((restream.destinations||[]).map(d=>[d.destination,d]));\n   livePlatformState=(restream.destinations||[]).map(item=>({platform:item.destination,connected:item.configured,manual_ready:item.configured,ready:item.configured}));\n   const icons={facebook:'\u{1F535}',youtube:'\u{1F534}',tiktok:'\u26AB',instagram:'\u{1F7E3}',linkedin:'\u{1F537}',x:'\u2715'};\n   for(const item of livePlatformState){\n    const label=node('label','','studio-platform-option');label.dataset.platform=item.platform;const check=node('input');check.type='checkbox';check.value=item.platform;check.disabled=!item.ready;check.checked=item.ready&&selectedLivePlatforms.has(item.platform);\n    const copy=node('span','','studio-platform-option-copy'),name=node('strong',(icons[item.platform]||'\u{1F310}')+' '+item.platform.toUpperCase()),state=node('small',item.ready?'Ready for this broadcast':(item.connected?'Connected \xB7 live API not available':'Not connected'));state.dataset.platformState=item.platform;\n    copy.append(name,state);label.append(check,copy);check.addEventListener('change',()=>{if(check.checked)selectedLivePlatforms.add(item.platform);else selectedLivePlatforms.delete(item.platform);syncSocialToggle();updateReadiness().catch(()=>{});});platformGrid.append(label);\n   }\n   platformHelp.textContent=livePlatformState.some(x=>x.ready)?'Select the destinations for this broadcast.':'No live social destination is ready yet. Heavenly Key ON AIR can still broadcast normally.';\n   syncSocialToggle();updateReadiness().catch(()=>{});\n  }catch(e){if(generation!==platformLoadGeneration)return;platformHelp.textContent=e.message;updateReadiness().catch(()=>{});}\n }\n function syncSocialToggle(){socialLiveToggle.checked=selectedLivePlatforms.size>0;}\n\n quickTitle.addEventListener('input',()=>{fields.title.value=quickTitle.value;preset=readPreset();updateReadiness().catch(()=>{});});\n quickFormat.addEventListener('change',()=>{if(prepared){status.textContent='Close the preview before changing screen size.';quickFormat.value=fields.format.value;return;}fields.format.value=quickFormat.value;preset=readPreset();applyPreset(preset);});\n quickDestination.addEventListener('change',()=>{fields.destination.value=quickDestination.value;preset=readPreset();updateReadiness().catch(()=>{});});\n quickQuality.addEventListener('change',()=>{fields.qualityPreset.value=quickQuality.value;preset=readPreset();announceOutput();updateReadiness().catch(()=>{});});\n fields.title.addEventListener('input',()=>{quickTitle.value=fields.title.value;});\n fields.format.addEventListener('change',()=>{quickFormat.value=fields.format.value;});\n fields.destination.addEventListener('change',()=>{quickDestination.value=fields.destination.value;});\n fields.qualityPreset.addEventListener('change',()=>{quickQuality.value=fields.qualityPreset.value;});\n\n\n directCamera.addEventListener('click',async()=>{if(!isAuthorized())return;try{cameraStyle='direct';backgroundModeField.value='none';backgroundModeField.dispatchEvent(new Event('change'));directCamera.setAttribute('aria-pressed','true');backgroundCamera.setAttribute('aria-pressed','false');backgroundGallery.hidden=true;monitors.hidden=false;if(!prepared)await prepare();modeHelp.textContent='Direct camera preview is ready. Review Take over 24/7 and connected destinations, then Go live.';updateReadiness().catch(()=>{});}catch(e){status.textContent=e.message;}});\n backgroundCamera.addEventListener('click',async()=>{if(!isAuthorized())return;try{cameraStyle='background';backgroundModeField.value=backgroundModeField.value==='none'?'virtual':backgroundModeField.value;backgroundModeField.dispatchEvent(new Event('change'));directCamera.setAttribute('aria-pressed','false');backgroundCamera.setAttribute('aria-pressed','true');if(backgroundGallery.parentElement!==workflow){const heading=node('p','Lightweight backgrounds \xB7 low data','studio-help');heading.dataset.quickBackgroundHeading='true';workflow.append(heading,backgroundGallery);}backgroundGallery.hidden=false;monitors.hidden=false;if(!prepared)await prepare();modeHelp.textContent='Camera preview is ready. Choose a lightweight background thumbnail below, or open Settings for blur/moving background and advanced controls.';updateReadiness().catch(()=>{});}catch(e){status.textContent=e.message;}});\n const radioPrepare=button(workflow,'Prepare microphone preview',async()=>{await prepare();await updateReadiness();});radioPrepare.hidden=true;\n const guidedModes=[\n  ['radio','Microphone / radio','Speak live with the camera off'],\n  ['camera','Camera','Live camera with direct or virtual/moving background'],\n  ['video','Pre-recorded video','Choose a local or Media Library video and broadcast it'],\n  ['247','24/7 ON AIR','Send the programme already playing on Heavenly Key 24/7 to social live destinations'],\n  ['link','External link','Take over ON AIR with a supported direct HTTPS stream or YouTube source']\n ];\n for(const [mode,labelText,description] of guidedModes){const option=node('option',labelText);option.value=mode;sourceSelect.append(option);const b=node('button','','studio-mode-card');b.type='button';b.dataset.mode=mode;b.append(node('strong',labelText),node('span',description));b.addEventListener('click',async()=>{if(!isAuthorized()){sourceSelect.value='';status.textContent='Sign in as an administrator to use the studio.';return;}if(preparing||prepared||sessionId||liveConnecting||social247Active||recordingActive){sourceSelect.value=selectedLaunchMode;status.textContent='Close the preview before changing source. End any active broadcast or recording first.';return;}sourceSelect.value=mode;selectedLaunchMode=mode;sceneSelect.value=mode==='video'?'media':'camera';previewBox.hidden=true;modeChoices.hidden=true;finalCheck.hidden=false;onAirBar.hidden=false;liveButton.hidden=false;metrics.hidden=true;loadLivePlatforms().catch(()=>{});quickTitle.value=fields.title.value;quickFormat.value=fields.format.value;quickDestination.value=fields.destination.value;quickQuality.value=fields.qualityPreset.value;monitors.hidden=!['camera','video','radio'].includes(mode);radioPrepare.hidden=mode!=='radio';setTimeout(()=>updateReadiness().catch(()=>{}),0);for(const x of modeChoices.children)x.setAttribute('aria-pressed',String(x===b));quickCameraOptions.hidden=mode!=='camera';quickMediaPanel.hidden=mode!=='video';quickLinkPanel.hidden=mode!=='link';if(mode==='camera'){previewScene='camera';programmeScene='camera';captureCamera.checked=true;captureMic.checked=true;fields.cameraVisible.checked=true;modeHelp.textContent='Choose Direct camera or Camera with background.';}else if(mode==='radio'){previewScene='camera';programmeScene='camera';captureCamera.checked=false;captureMic.checked=true;fields.cameraVisible.checked=false;fields.destination.value='radio';quickDestination.value='radio';modeHelp.textContent='Camera is off. Enter a title, prepare the microphone preview and check its meter before Go live.';}else if(mode==='video'){previewScene='media';programmeScene='media';captureCamera.checked=false;fields.cameraVisible.checked=false;mediaInput.accept='video/*';modeHelp.textContent='Choose your pre-recorded video. The Preview will show it before the final GO LIVE.';}else if(mode==='247'){modeHelp.textContent='24/7 ON AIR selected. The programme already playing on Heavenly Key will be sent to the connected social live destinations.';}else{modeHelp.textContent='Paste the external live source link, then complete the final check and GO LIVE.';}preset=readPreset();draw();});modeChoices.append(b);}\n boxes.sources.append(node('p','Screen sharing requires a supported browser. Tab/system audio is included only when your browser provides it. Do not share a window containing passwords.','studio-help'));\n field(boxes.branding,'Presenter name','presenter');field(boxes.branding,'Lower-third caption','lowerThird');field(boxes.branding,'Scrolling message','ticker');const scripture=field(boxes.branding,'Scripture / prayer text','scripture','textarea');scripture.rows=4;\n field(boxes.branding,'Show ministry logo and name','showBrand','checkbox');field(boxes.branding,'Show lower third','showLowerThird','checkbox');field(boxes.branding,'Show scrolling message','showTicker','checkbox');\n const micGain=field(boxes.audio,'Microphone level','micGain','range'),mediaGain=field(boxes.audio,'Programme media level','mediaGain','range'),screenGain=field(boxes.audio,'Shared-screen audio level','screenGain','range');const musicGain=field(boxes.audio,'Background music level','musicGain','range');field(boxes.audio,'Lower music automatically while speaking','duckMusic','checkbox');for(const e of [micGain,mediaGain,screenGain,musicGain]){e.min='0';e.max=e===micGain?'150':'100';e.step='1';}\n field(boxes.audio,'Voice / microphone preset','voicePreset','select',[['condenser','Condenser mic \xB7 rich preaching voice'],['speech','Speech clarity \xB7 strong cleanup'],['natural','Natural voice \xB7 light processing']]);\n field(boxes.audio,'Strong browser noise suppression','noiseSuppression','checkbox');field(boxes.audio,'Echo cancellation','echoCancellation','checkbox');field(boxes.audio,'Automatic input gain control','autoGainControl','checkbox');field(boxes.audio,'Noise gate \xB7 reduce room sound between words','noiseGate','checkbox');field(boxes.audio,'Voice compressor','compressor','checkbox');field(boxes.audio,'Output limiter \xB7 prevent clipping','limiter','checkbox');const voiceClarity=field(boxes.audio,'Voice clarity / presence','voiceClarity','range');voiceClarity.min='0';voiceClarity.max='100';voiceClarity.step='1';\n field(boxes.audio,'Mute microphone during starting, break and closing scenes','muteIntermission','checkbox');let micMuted=false;const micMuteButton=button(boxes.audio,'Mute microphone',()=>{micMuted=!micMuted;micMuteButton.textContent=micMuted?'Unmute microphone':'Mute microphone';quickMute.textContent=micMuteButton.textContent;quickMute.setAttribute('aria-pressed',String(micMuted));updateAudio();});\n const micState=node('p','Microphone: preview not prepared');boxes.audio.append(micState);const quickMute=button(sceneToolbar,'Mute microphone',()=>micMuteButton.click());quickMute.setAttribute('aria-pressed','false');\n const meter=node('meter');meter.min=0;meter.max=1;meter.value=0;meter.className='studio-meter';meter.setAttribute('aria-label','Actual output audio level');boxes.audio.append(meter,node('p','Echo cancellation and noise suppression are requested from the browser. Voice high-pass filtering and compression run in the mixer. Preview audio is kept off your speakers to prevent feedback.','studio-help'));\n const musicInput=node('input');musicInput.type='file';musicInput.accept='audio/*';const musicLabel=node('label','Background worship / music file');musicLabel.append(musicInput);boxes.audio.append(musicLabel);\n button(boxes.audio,'Play / pause background music',async()=>{requirePrepared();if(!music.src)throw Error('Choose a background music file first.');connectMusicAudio();if(music.paused)await music.play();else music.pause();});\n musicInput.addEventListener('change',async()=>{try{if(!isAuthorized())return;const file=musicInput.files?.[0];if(!file)return;if(!file.type.startsWith('audio/'))throw Error('Choose an audio file for background music.');music.pause();if(musicUrl)URL.revokeObjectURL(musicUrl);musicUrl=URL.createObjectURL(file);music.src=musicUrl;music.loop=true;connectMusicAudio();status.textContent='Background music loaded. Use Play / pause background music to start it.';}catch(e){status.textContent=e.message;}});\n const recordButton=button(boxes.recording,'Start recording programme',toggleRecording);recordButton.disabled=true;const permanent=field(boxes.recording,'Keep uploaded clips permanently','keepRecording','checkbox');\n const recordStatus=node('p');recordStatus.setAttribute('role','status');boxes.recording.append(recordStatus,node('p','The composed programme and mixed audio are recorded. Recording rolls into bounded clips; each clip can be saved to the private library or downloaded. Clips are not published automatically.','studio-help'));\n const clips=node('div');boxes.recording.append(clips);\n button(boxes.recording,'Clear clips already saved to library',()=>{for(const row of Array.from(clips.children)){if(row.dataset.saved==='true'){const link=row.querySelector('a');if(link){URL.revokeObjectURL(link.href);clipUrls.delete(link.href);}row.remove();}}recordStatus.textContent='Saved clips cleared from this browser. Their library copies remain.';});\n button(boxes.presets,'Save my studio preset',async()=>{await api('studio/preferences','POST',{preferences:readPreset()});status.textContent='Your studio preset is saved to your account.';});button(boxes.presets,'Load my saved preset',loadPreset);\n button(boxes.presets,'Reset studio settings',()=>{if(prepared||sessionId)throw Error('Close the preview before resetting output settings.');applyPreset(normalizePreset());programmeScene='camera';previewScene='camera';sceneSelect.value='camera';draw();status.textContent='Studio settings reset.';});\n boxes.presets.append(node('p','Presets contain programme text, scenes and mixer settings. Cameras, local files, screen access and broadcasting never start automatically. Keep this tab open and in the foreground during a broadcast; browser throttling can reduce frame rate in a hidden tab.','studio-help'));\n const camera=node('video'),screen=node('video'),backgroundVideo=node('video');let media=node('video'),music=node('audio');music.loop=true;music.className='studio-source-video';root.append(music);for(const video of [camera,screen,media,backgroundVideo]){video.playsInline=true;video.autoplay=false;video.className='studio-source-video';root.append(video);}camera.muted=true;screen.muted=true;media.loop=true;backgroundVideo.loop=true;backgroundVideo.muted=true;backgroundVideo.autoplay=true;\n const logo=new Image();logo.src='/assets/ministry/logo.svg';logo.onload=()=>draw();let picture=null,localUrl=null,musicUrl=null,preset=normalizePreset(),prepared=false,preparing=false,directCameraFallback=false,recoverableLive=null,cameraStream=null,screenStream=null,canvasStream=null,audioContext=null,mixDestination=null,micNode=null,micGateGain=null,micCompressor=null,presenceEq=null,limiterNode=null,screenNode=null,mediaSource=null,mediaNode=null,musicNode=null,musicSource=null,micAnalyser=null,analyser=null,subjectEffects=null,renderTimer=null,room=null,published=[],sessionId=null,heartbeat=null,metricsTimer=null,expectedDisconnect=false,liveConnecting=false,social247Active=false,startTime=0,frameCount=0,lastFpsAt=0,recorder=null,recordingActive=false,recordSequence=0,recordedChunks=[],recordedBytes=0,clipUrls=new Set();\n function readPreset(){const value={scene:programmeScene};for(const [key,e]of Object.entries(fields))value[key]=e.type==='checkbox'?e.checked:e.value;return normalizePreset(value);}\n function announceOutput(){document.dispatchEvent(new CustomEvent('hk-studio-output-settings',{detail:{format:preset.format,qualityPreset:preset.qualityPreset}}));}\n function applyPreset(value){preset=normalizePreset(value);for(const [key,e]of Object.entries(fields)){if(!(key in preset))continue;if(e.type==='checkbox')e.checked=preset[key];else e.value=String(preset[key]);}if(!prepared){const [w,h]=formats[preset.format];programmeCanvas.width=w;programmeCanvas.height=h;previewCanvas.width=480;previewCanvas.height=Math.round(480*h/w);}announceOutput();updateAudio();}\n function requirePrepared(){if(!prepared)throw Error('Prepare the preview first.');}\n function updateAudio(){const level=microphoneLevel(preset,programmeScene,micMuted);micState.textContent=!micNode?'Microphone: no input captured':level===0?'Microphone: muted':`Microphone: active \xB7 ${Math.round(level*100)}% \xB7 ${preset.voicePreset}`;if(micNode)micNode.gain.value=level;if(presenceEq)presenceEq.gain.value=preset.voicePreset==='natural'?preset.voiceClarity*.025:preset.voiceClarity*.055;if(micCompressor){micCompressor.threshold.value=preset.compressor?(preset.voicePreset==='condenser'?-22:-26):0;micCompressor.ratio.value=preset.compressor?(preset.voicePreset==='natural'?2.2:3.5):1;}if(limiterNode){limiterNode.threshold.value=preset.limiter?-3:0;limiterNode.ratio.value=preset.limiter?20:1;}if(mediaNode)mediaNode.gain.value=preset.mediaGain/100;if(screenNode)screenNode.gain.value=preset.screenGain/100;if(musicNode)musicNode.gain.value=preset.musicGain/100;}\n function drawSource(context,source,x,y,w,h,mirror=false){if(source===camera&&cameraStream?.getVideoTracks()[0]?.readyState!=='live')return false;const sw=source.videoWidth||source.naturalWidth,sh=source.videoHeight||source.naturalHeight;if(!sw||!sh)return false;const r=fitRect(sw,sh,x,y,w,h);context.save();if(mirror){context.translate(r.x+r.width,r.y);context.scale(-1,1);context.drawImage(source,0,0,r.width,r.height);}else context.drawImage(source,r.x,r.y,r.width,r.height);context.restore();return true;}\n function drawCover(context,source,x,y,w,h,mirror=false){const sw=source.videoWidth||source.naturalWidth,sh=source.videoHeight||source.naturalHeight;if(!sw||!sh)return false;const scale=Math.max(w/sw,h/sh),dw=sw*scale,dh=sh*scale,sx=x+(w-dw)/2,sy=y+(h-dh)/2;context.save();if(mirror){context.translate(x+w,0);context.scale(-1,1);context.drawImage(source,x+w-(sx+dw),sy,dw,dh);}else context.drawImage(source,sx,sy,dw,dh);context.restore();return true;}\n function drawLines(context,text,x,y,width,fontSize,maxLines=4){context.font=`600 ${fontSize}px \"Source Sans 3\", sans-serif`;const lines=wrapText(context,text,width).slice(0,maxLines);for(const [i,line]of lines.entries())context.fillText(line,x,y+i*fontSize*1.2,width);}\n function drawCameraComposite(context,x,y,w,h){\n  if(!camera.videoWidth)return false;\n  if(preset.backgroundMode==='none'||!subjectEffects?.ready)return drawSource(context,camera,x,y,w,h,preset.mirror);\n  subjectEffects.update(camera);\n  if(preset.backgroundMode==='blur'){context.save();context.filter=`blur(${Math.max(4,Math.round(preset.backgroundStrength/5))}px)`;drawCover(context,camera,x-12,y-12,w+24,h+24,preset.mirror);context.restore();}\n  else if(preset.backgroundMode==='video'){if(!drawCover(context,backgroundVideo,x,y,w,h))drawStudioBackground(context,w,h,preset.backgroundPreset,logo,performance.now());}\n  else drawStudioBackground(context,w,h,preset.backgroundPreset,logo,performance.now());\n  if(subjectEffects.drawPerson(context,camera,x,y,w,h,preset.mirror))return true;\n  if(preset.subjectProtection)return drawSource(context,camera,x,y,w,h,preset.mirror);\n  return preset.backgroundMode==='virtual';\n }\n function compose(context,scene,w,h){const unit=Math.min(w,h)/720;const gradient=context.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#153d8a');gradient.addColorStop(1,'#721d40');context.fillStyle=gradient;context.fillRect(0,0,w,h);const footer=preset.showTicker?42*unit:0,lower=preset.showLowerThird?100*unit:0,contentHeight=h-footer;\n  let found=false;if(scene==='camera'&&preset.cameraVisible)found=drawCameraComposite(context,0,0,w,contentHeight);if(scene==='screen')found=drawSource(context,screen,0,0,w,contentHeight);if(scene==='media')found=drawSource(context,picture||media,0,0,w,contentHeight);\n  if(['screen','media'].includes(scene)&&preset.cameraVisible&&camera.videoWidth){const pw=w*.25,ph=Math.min(contentHeight*.3,pw*.75);context.fillStyle='#ffffff';context.fillRect(w-pw-22*unit,contentHeight-ph-lower-22*unit,pw+4*unit,ph+4*unit);drawSource(context,camera,w-pw-20*unit,contentHeight-ph-lower-20*unit,pw,ph,preset.mirror);}\n  context.fillStyle='#ffffff';if(['starting','break','ending'].includes(scene)){const label=scene==='starting'?'STARTING SOON':scene==='break'?'PRAYER BREAK':'THANK YOU FOR JOINING';context.textAlign='center';context.font=`700 ${44*unit}px \"Source Sans 3\", sans-serif`;context.fillText(label,w/2,h*.33,w*.9);context.font=`600 ${30*unit}px \"Source Sans 3\", sans-serif`;context.fillText(preset.title,w/2,h*.43,w*.9);if(scene==='starting'){const remaining=Math.max(0,Math.ceil((countdownUntil-Date.now())/1000));context.fillText(`${Math.floor(remaining/60).toString().padStart(2,'0')}:${(remaining%60).toString().padStart(2,'0')}`,w/2,h*.54);}context.textAlign='left';if(preset.scripture)drawLines(context,preset.scripture,w*.08,h*.63,w*.84,24*unit,5);}else if(!found){context.textAlign='center';context.font=`600 ${28*unit}px sans-serif`;context.fillText(scene==='screen'?'Choose a screen to share':scene==='media'?'Load programme media':'Camera preview is off',w/2,h*.48,w*.9);context.textAlign='left';}\n  if(preset.showBrand){context.fillStyle='rgba(255,255,255,.93)';context.fillRect(16*unit,16*unit,Math.min(w-32*unit,490*unit),68*unit);if(logo.complete&&logo.naturalWidth)drawSource(context,logo,22*unit,22*unit,54*unit,54*unit);context.fillStyle='#153d8a';drawLines(context,'HEAVENLY KEY EVANGELISTIC MOVEMENT',88*unit,43*unit,Math.min(w-120*unit,400*unit),18*unit,2);}\n  if(preset.showLowerThird){context.fillStyle='rgba(114,29,64,.94)';context.fillRect(0,h-footer-lower,w,lower);context.fillStyle='#f3ca4a';drawLines(context,preset.presenter||preset.title,24*unit,h-footer-lower+34*unit,w-48*unit,25*unit,1);context.fillStyle='white';drawLines(context,preset.lowerThird,24*unit,h-footer-lower+69*unit,w-48*unit,21*unit,1);}\n  if(preset.showTicker){context.fillStyle='#153d8a';context.fillRect(0,h-footer,w,footer);context.save();context.beginPath();context.rect(0,h-footer,w,footer);context.clip();context.fillStyle='white';context.font=`600 ${20*unit}px sans-serif`;const text=preset.ticker||'Heavenly Key Evangelistic Movement',tw=context.measureText(text).width,span=w+tw+40*unit;const offset=((performance.now()/1000)*65*unit)%span;context.fillText(text,w-offset,h-13*unit);context.restore();}\n }\n function draw(){compose(ctx,programmeScene,programmeCanvas.width,programmeCanvas.height);compose(previewCtx,previewScene,previewCanvas.width,previewCanvas.height);frameCount++;if(micAnalyser){const speech=new Uint8Array(micAnalyser.fftSize);micAnalyser.getByteTimeDomainData(speech);const rms=Math.sqrt(speech.reduce((sum,v)=>sum+((v-128)/128)**2,0)/speech.length);if(micGateGain)micGateGain.gain.setTargetAtTime(preset.noiseGate&&(rms<.012)?0.12:1,audioContext.currentTime,.035);if(musicNode)musicNode.gain.setTargetAtTime(musicLevel(preset,rms,micNode?.gain.value>0),audioContext.currentTime,.12);}if(analyser){const samples=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((sum,v)=>sum+((v-128)/128)**2,0)/samples.length);meter.value=Math.min(1,rms*3);}const now=performance.now();if(now-lastFpsAt>=2000){fps.textContent='Render: '+Math.round(frameCount*1000/(now-lastFpsAt))+' fps';frameCount=0;lastFpsAt=now;}}\n async function prepare(){if(prepared)return;if(preparing)throw Error('Preview is still preparing. Wait until it is ready.');preparing=true;prepareButton.disabled=true;status.textContent='Preparing local programme preview\u2026';try{preset=readPreset();directCameraFallback=!programmeCanvas.captureStream&&selectedLaunchMode==='camera'&&cameraStyle==='direct';if(!programmeCanvas.captureStream&&!directCameraFallback)throw Error('This browser cannot compose Studio video. Choose Direct Camera, or use current Chrome/Edge for backgrounds and overlays.');applyPreset(preset);const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('This browser does not support the audio mixer.');audioContext=new AC();await audioContext.resume();mixDestination=audioContext.createMediaStreamDestination();analyser=audioContext.createAnalyser();analyser.fftSize=1024;limiterNode=audioContext.createDynamicsCompressor();limiterNode.threshold.value=-3;limiterNode.knee.value=0;limiterNode.ratio.value=20;limiterNode.connect(analyser);analyser.connect(mixDestination);mixDestination.input=limiterNode;\n   if(captureCamera.checked||captureMic.checked){if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera/microphone access is unavailable in this browser. Open the Studio over HTTPS in Safari/Chrome and allow camera + microphone permission.');const requestedFps=preset.qualityPreset==='data'?15:preset.qualityPreset==='high'?30:24;const videoConstraints={width:{ideal:1280},height:{ideal:720},frameRate:{ideal:requestedFps,max:requestedFps}};if(cameraDeviceSelect.value)videoConstraints.deviceId={exact:cameraDeviceSelect.value};else videoConstraints.facingMode=preset.facing;const audioConstraints={echoCancellation:preset.echoCancellation,noiseSuppression:preset.noiseSuppression,autoGainControl:preset.autoGainControl,channelCount:1};if(microphoneDeviceSelect.value)audioConstraints.deviceId={exact:microphoneDeviceSelect.value};cameraStream=await navigator.mediaDevices.getUserMedia({video:captureCamera.checked?videoConstraints:false,audio:captureMic.checked?audioConstraints:false});camera.srcObject=cameraStream;await refreshDevices().catch(()=>{});if(cameraStream.getVideoTracks().length)await camera.play();if(cameraStream.getVideoTracks().length&&preset.backgroundMode!=='none'){try{subjectEffects=await createSubjectEffects();}catch{subjectEffects=null;status.textContent='Camera opened. Background separation is unavailable, so Studio is using the clean camera instead.';}}if(preset.backgroundMode==='video'&&subjectEffects)await loadBackgroundVideo();if(cameraStream.getAudioTracks().length){const source=audioContext.createMediaStreamSource(cameraStream),highPass=audioContext.createBiquadFilter();highPass.type='highpass';highPass.frequency.value=preset.voicePreset==='condenser'?75:preset.voicePreset==='speech'?95:60;presenceEq=audioContext.createBiquadFilter();presenceEq.type='peaking';presenceEq.frequency.value=3200;presenceEq.Q.value=.8;micCompressor=audioContext.createDynamicsCompressor();micGateGain=audioContext.createGain();micGateGain.gain.value=1;micNode=audioContext.createGain();micAnalyser=audioContext.createAnalyser();micAnalyser.fftSize=1024;source.connect(highPass);highPass.connect(presenceEq);presenceEq.connect(micCompressor);micCompressor.connect(micAnalyser);micAnalyser.connect(micGateGain);micGateGain.connect(micNode);micNode.connect(limiterNode);}}\n   if(media.src)connectMediaAudio();if(music.src)connectMusicAudio();const targetFps=preset.qualityPreset==='data'?15:preset.qualityPreset==='high'?30:24;canvasStream=programmeCanvas.captureStream?programmeCanvas.captureStream(targetFps):null;prepared=true;closeButton.hidden=false;closeButton.disabled=false;prepareButton.hidden=true;recordButton.disabled=false;for(const e of [fields.format,fields.qualityPreset,fields.facing,captureCamera,captureMic,cameraDeviceSelect,microphoneDeviceSelect])e.disabled=true;updateAudio();lastFpsAt=performance.now();renderTimer=setInterval(draw,1000/(preset.qualityPreset==='data'?15:preset.qualityPreset==='high'?30:24));draw();status.textContent=directCameraFallback?'Direct camera preview ready. This browser will publish the camera directly without Studio overlays/backgrounds.':(selectedLaunchMode==='radio'?'Microphone preview ready. Your camera is off. Sound stays private until Go live.':'Preview ready. Camera and microphone are local until you click Go live.');\n  }catch(e){await releaseSources();throw e;}finally{preparing=false;prepareButton.disabled=prepared;}}\n async function shareScreen(){requirePrepared();if(!navigator.mediaDevices.getDisplayMedia)throw Error('Screen sharing is not supported by this browser.');const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:preset.qualityPreset==='data'?15:preset.qualityPreset==='high'?30:24},audio:true});stopScreen();screenStream=stream;screen.srcObject=stream;await screen.play();if(stream.getAudioTracks().length){const source=audioContext.createMediaStreamSource(stream);screenNode=audioContext.createGain();source.connect(screenNode);screenNode.connect(mixDestination.input);updateAudio();}stream.getVideoTracks()[0].addEventListener('ended',()=>{if(screenStream===stream)stopScreen();},{once:true});stopScreenButton.disabled=false;previewScene='screen';sceneSelect.value='screen';previewBox.hidden=false;status.textContent='Screen selected'+(stream.getAudioTracks().length?' with shared audio.':'; the browser provided no shared audio.')+' Click Apply scene to send it to programme.';}\n function stopScreen(){screenNode?.disconnect();screenNode=null;if(screenStream){for(const t of screenStream.getTracks())t.stop();screenStream=null;}screen.srcObject=null;stopScreenButton.disabled=true;if(programmeScene==='screen')programmeScene='camera';}\n function connectMediaAudio(){if(!audioContext||!media.src)return;if(!mediaSource)mediaSource=audioContext.createMediaElementSource(media);if(!mediaNode){mediaNode=audioContext.createGain();mediaSource.connect(mediaNode);mediaNode.connect(mixDestination.input);}updateAudio();}\n function connectMusicAudio(){if(!audioContext||!music.src)return;if(!musicSource)musicSource=audioContext.createMediaElementSource(music);if(!musicNode){musicNode=audioContext.createGain();musicSource.connect(musicNode);musicNode.connect(mixDestination.input);}updateAudio();}\n function clearMedia(){media.pause();media.removeAttribute('src');media.load();picture=null;if(localUrl){URL.revokeObjectURL(localUrl);localUrl=null;}}\n async function setMedia(url,type){if(!['image','audio','video'].includes(type))throw Error('Choose an image, audio or video file.');clearMedia();if(type==='image'){picture=new Image();picture.src=url;await picture.decode();}else{media.src=url;media.loop=loop.checked;if(audioContext){connectMediaAudio();await media.play();}}previewScene='media';sceneSelect.value='media';previewBox.hidden=false;status.textContent='Media loaded. Click Apply scene to use the media scene.';}\n mediaInput.addEventListener('change',async()=>{try{if(!isAuthorized())return;const file=mediaInput.files?.[0];if(!file)return;const type=file.type.split('/')[0];const url=URL.createObjectURL(file);try{await setMedia(url,type);localUrl=url;if(selectedLaunchMode==='video'&&!prepared)await prepare();programmeScene='media';previewScene='media';draw();modeHelp.textContent='Pre-recorded video preview is ready. Complete the final check and press GO LIVE.';updateReadiness().catch(()=>{});}catch(e){URL.revokeObjectURL(url);throw e;}}catch(e){status.textContent=e.message;}});\n async function loadLibrary(){const option=librarySelect.selectedOptions[0];if(!option?.value)throw Error('Choose an uploaded media file.');await setMedia('/api/media/'+option.value+'/preview',option.dataset.type);if(selectedLaunchMode==='video'&&!prepared)await prepare();programmeScene='media';previewScene='media';draw();if(selectedLaunchMode==='video')modeHelp.textContent='Pre-recorded video preview is ready. Complete the final check and press GO LIVE.';updateReadiness().catch(()=>{});}\n async function loadBackgroundVideo(){const id=Number(motionBackgroundSelect.value||preset.backgroundVideoId||0);if(!id){backgroundVideo.pause();backgroundVideo.removeAttribute('src');backgroundVideo.load();return;}const src='/api/media/'+id+'/preview';if(backgroundVideo.getAttribute('src')!==src){backgroundVideo.pause();backgroundVideo.src=src;backgroundVideo.load();}if(prepared||preset.backgroundMode==='video'){try{await backgroundVideo.play();}catch{}}}\n async function liveRequest(path,body={}){\n  if(path==='live-status'){path='live';body={title:body.title,source_type:body.sourceType,source_ref:body.sourceRefId,destination:body.destination,fallback_media_id:body.fallbackMediaId};}\n  else path=path.replace(/^live-session\\//,'live/');\n  const r=await fetch('/api/broadcast/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(typeof d.error==='string'?d.error:d.error?.message||'Broadcast request failed.');return d;\n }\n\n async function connectPublisher(existingSessionId,recovered=false){\n  const sdk=await import(SDK),auth=await api('livekit/publisher-token','POST',{session_id:existingSessionId});expectedDisconnect=false;\n  room=new sdk.Room({adaptiveStream:true,dynacast:true});\n  room.on(sdk.RoomEvent.Reconnecting,()=>{quality.textContent='Connection: reconnecting';status.textContent='Reconnecting programme output\u2026';});\n  room.on(sdk.RoomEvent.Reconnected,()=>{quality.textContent='Connection: restored';returnLiveButton.disabled=false;status.textContent='Live programme connection restored.';});\n  room.on(sdk.RoomEvent.ConnectionQualityChanged,(q,participant)=>{if(participant===room?.localParticipant)quality.textContent='Connection: '+q;});\n  room.on(sdk.RoomEvent.Disconnected,()=>{returnLiveButton.disabled=true;if(!expectedDisconnect){quality.textContent='Connection: waiting to recover';status.textContent='Network connection lost. Broadcast session is being held for up to 10 minutes and will recover if the connection returns.';}});\n  await room.connect(auth.url,auth.token);if(!isAuthorized()||!prepared)throw Error('Studio access ended while connecting.');\n  const sourceVideoTrack=directCameraFallback?cameraStream?.getVideoTracks?.()[0]:canvasStream?.getVideoTracks?.()[0];if(preset.destination!=='radio'&&!sourceVideoTrack)throw Error('No video track is available to publish. Reopen the camera preview and try again.');const video=sourceVideoTrack?new sdk.LocalVideoTrack(sourceVideoTrack.clone(),undefined,true):null;const mixedAudioTrack=mixDestination?.stream?.getAudioTracks?.()[0]||cameraStream?.getAudioTracks?.()[0];if(!mixedAudioTrack)throw Error('No microphone/audio track is available to publish. Check microphone permission and try again.');const audio=new sdk.LocalAudioTrack(mixedAudioTrack.clone(),undefined,true);published=preset.destination==='radio'?[audio]:[video,audio].filter(Boolean);\n  const pixels=programmeCanvas.width*programmeCanvas.height,is1080=pixels>=1900000,is480=pixels<=500000;const bitrate=preset.qualityPreset==='data'?(is480?450000:is1080?1600000:900000):preset.qualityPreset==='high'?(is480?900000:is1080?6000000:3500000):(is480?650000:is1080?4500000:2500000);const targetFps=preset.qualityPreset==='data'?15:preset.qualityPreset==='high'?30:24,audioBitrate=preset.qualityPreset==='data'?48000:preset.qualityPreset==='high'?96000:64000;\n  for(const t of published)await room.localParticipant.publishTrack(t,{videoEncoding:{maxBitrate:bitrate,maxFramerate:targetFps},audioPreset:{maxBitrate:audioBitrate}});\n  const recoveredStart=recovered&&recoverableLive?.started_at?new Date(recoverableLive.started_at).getTime():NaN;startTime=Number.isFinite(recoveredStart)?recoveredStart:Date.now();badge.textContent=recovered?'LIVE \xB7 RECOVERED':'LIVE';badge.dataset.live='true';recoverButton.hidden=true;recoverButton.disabled=true;endButton.disabled=false;fields.destination.disabled=true;quality.textContent='Connection: connected';\n  clearInterval(heartbeat);heartbeat=setInterval(async()=>{if(room?.state!=='connected')return;try{await liveRequest('live-session/'+sessionId+'/heartbeat');}catch(e){status.textContent='Network is weak or offline. The live session is being preserved for up to 10 minutes: '+e.message;}},30000);\n  clearInterval(metricsTimer);metricsTimer=setInterval(()=>{if(sessionId){const seconds=Math.max(0,Math.floor((Date.now()-startTime)/1000));elapsed.textContent='Elapsed: '+Math.floor(seconds/60).toString().padStart(2,'0')+':'+(seconds%60).toString().padStart(2,'0');viewers.textContent='LiveKit room participants: '+(room?.remoteParticipants.size??0);}},1000);\n }\n async function prepareAuthorizedSocialLive(){\n  const selected=[...selectedLivePlatforms],state=await api('restream');\n  for(const name of selected)if(!state.destinations?.some(x=>x.destination===name&&x.configured))throw Error('Configure the selected streaming destination first.');\n  for(const dest of state.destinations||[])if(dest.configured&&Boolean(dest.enabled)!==selected.includes(dest.destination))await api('restream/destination','POST',{destination:dest.destination,enabled:selected.includes(dest.destination)});\n  return selected.map(platform=>({platform,ok:true}));\n }\n async function verifyPreparedSocialLive(){for(const platform of selectedLivePlatforms)setPlatformLiveState(platform,'Stream requested \xB7 confirm live on the platform',null);}\n function setPlatformLiveState(platform,message,ok){\n  const label=platformGrid.querySelector('[data-platform=\"'+CSS.escape(platform)+'\"]'),state=label?.querySelector('[data-platform-state]');\n  if(state)state.textContent=message;\n  if(label){if(ok===true)label.dataset.liveConfirmed='true';else if(ok===false)label.dataset.liveConfirmed='false';else delete label.dataset.liveConfirmed;}\n }\n\n  async function goLive(){if(sessionId||liveConnecting)return;const preflight=await updateReadiness();if(!preflight.ok){status.textContent='Not ready to go live yet. Fix: '+preflight.issues.join(', ')+'.';throw Error(status.textContent);} \n if(selectedLaunchMode==='247'){\n   if(!selectedLivePlatforms.size)throw Error('Select at least one ready social destination for the 24/7 programme.');\n   liveConnecting=true;liveButton.disabled=true;try{status.textContent='Preparing 24/7 ON AIR for social live distribution\u2026';const preparedSocial=await prepareAuthorizedSocialLive();await api('restream/start','POST',{source:'247',format:preset.format,quality:preset.qualityPreset});verifyPreparedSocialLive(preparedSocial).catch(()=>{});social247Active=true;status.textContent='24/7 social egress started. Confirm that each platform has received and publicly activated the live video.';badge.textContent='24/7 \xB7 SOCIAL LIVE';badge.dataset.live='true';liveButton.hidden=true;endButton.hidden=false;endButton.disabled=false;refresh?.click();}finally{liveConnecting=false;liveButton.disabled=false;}return;\n }\n if(!onAirToggle.checked)throw Error('Take over 24/7 is off. Turn it on before starting a new camera, pre-recorded, or external-link programme.');\n if(selectedLaunchMode==='link'){\n   const source=linkInput.value.trim();if(!source)throw Error('Paste the external live source link first.');let parsed;try{parsed=new URL(source);}catch{throw Error('Enter a valid HTTPS or supported YouTube source URL.');}if(parsed.protocol!=='https:')throw Error('External source must use HTTPS.');\n   if(!fields.title.value.trim())throw Error('Enter a programme title.');\n   liveConnecting=true;liveButton.disabled=true;try{status.textContent='Taking over 24/7 with the external source\u2026';const created=await liveRequest('live-status',{isLive:true,title:fields.title.value.trim(),sourceType:'camera',sourceRefId:source,destination:preset.destination,fallbackMediaId:fallbackSelect.value?Number(fallbackSelect.value):undefined});sessionId=created.session_id;metrics.hidden=false;badge.textContent='LIVE \xB7 EXTERNAL';badge.dataset.live='true';let socialWarning='';if(socialLiveToggle.checked){try{const preparedSocial=await prepareAuthorizedSocialLive();await api('restream/start','POST',{source:'247',format:preset.format,quality:preset.qualityPreset});verifyPreparedSocialLive(preparedSocial).catch(()=>{});socialWarning=' \xB7 social distribution requested; confirm each platform separately';}catch(e){socialWarning=' \xB7 website is live, but social distribution failed: '+(e.message||'unavailable');}}heartbeat=setInterval(()=>{if(sessionId)liveRequest('live-session/'+sessionId+'/heartbeat').catch(()=>{});},15000);status.textContent='LIVE \u2014 external source has taken over 24/7'+socialWarning+'.';refresh?.click();}catch(e){if(sessionId){try{await endLive();}catch{status.textContent='The external session may still be live. Press End broadcast or check Live Status immediately.';}}throw e;}finally{liveConnecting=false;liveButton.disabled=!!sessionId;}return;\n }\n if(!fields.title.value.trim())throw Error('Enter a programme title.');liveConnecting=true;liveButton.disabled=true;closeButton.disabled=true;try{const ready=await api('capabilities');if(!ready.transport.live_camera_ingest)throw Error('Connect and verify LiveKit in Settings & connections first.');if(!prepared)await prepare();if(!isAuthorized())throw Error('Sign in again before starting the programme.');status.textContent='Connecting programme output\u2026';const created=await liveRequest('live-status',{isLive:true,title:preset.title,sourceType:'camera',sourceRefId:'livekit:pending',destination:preset.destination,fallbackMediaId:fallbackSelect.value?Number(fallbackSelect.value):undefined});sessionId=created.session_id;metrics.hidden=false;await connectPublisher(sessionId,false);let socialMessage='';if(socialLiveToggle.checked){try{const prepared=await prepareAuthorizedSocialLive(),failures=prepared.filter(x=>!x.ok);await api('restream/start','POST',{source:'live',session_id:Number(sessionId),format:preset.format,quality:preset.qualityPreset});verifyPreparedSocialLive(prepared).catch(()=>{});socialMessage=' \xB7 social live distribution started'+(failures.length?' \xB7 some authorized platforms need attention: '+failures.map(x=>x.platform).join(', '):'');}catch(socialError){socialMessage=' \xB7 ON AIR is live, but social distribution needs attention: '+(socialError.message||'could not start');}}status.textContent='LiveKit publisher connected \xB7 '+preset.qualityPreset+' quality. Check the public viewer page for picture and sound'+socialMessage+'.';refresh?.click();}catch(e){const message=e.message;await endLive().catch(()=>{});status.textContent=message;throw e;}finally{liveConnecting=false;liveButton.disabled=!!sessionId;closeButton.disabled=!prepared;}}\n async function recoverExistingLive(){if(sessionId||liveConnecting)return;if(!recoverableLive||!String(recoverableLive.source_ref||'').startsWith('livekit:'))throw Error('No recoverable live camera session is available.');liveConnecting=true;recoverButton.disabled=true;liveButton.disabled=true;try{const ready=await api('capabilities');if(!ready.transport.live_camera_ingest)throw Error('LiveKit is not connected.');if(['radio','video','both'].includes(String(recoverableLive.destination||''))){fields.destination.value=String(recoverableLive.destination);preset=readPreset();}if(!prepared)await prepare();sessionId=Number(recoverableLive.session_id);if(!Number.isInteger(sessionId))throw Error('The preserved live session is invalid.');status.textContent='Recovering preserved live session\u2026';await connectPublisher(sessionId,true);await liveRequest('live-session/'+sessionId+'/heartbeat');recoverableLive=null;status.textContent='LIVE session recovered. Camera and microphone are publishing again.';refresh?.click();}catch(e){const message=e.message;await endLive(false).catch(()=>{});status.textContent=message;throw e;}finally{liveConnecting=false;liveButton.disabled=!!sessionId;recoverButton.disabled=!recoverableLive;closeButton.disabled=!prepared;}}\n async function returnLiveToProgramme(){if(!sessionId||!room||room.state!=='connected')throw Error('The live camera publisher is not connected. Prepare and start a live broadcast again.');status.textContent='Returning live camera to programme\u2026';await liveRequest('live-session/'+sessionId+'/switch-to-live');returnLiveButton.hidden=true;returnLiveButton.disabled=true;quality.textContent='Connection: connected';status.textContent='LIVE camera restored to programme.';refresh?.click();}\n async function endLive(stopServer=true){if(social247Active&&stopServer){try{await api('restream/stop','POST',{});}catch(e){status.textContent='Could not confirm social streaming stopped. Check platform status and press End broadcast again.';throw e;}social247Active=false;badge.textContent='OFF AIR';badge.dataset.live='false';endButton.hidden=true;endButton.disabled=true;liveButton.hidden=false;status.textContent='24/7 social live distribution stopped. Heavenly Key 24/7 continues normally.';refresh?.click();return;}const endedSessionId=Number(sessionId);let socialStopWarning='';expectedDisconnect=true;clearInterval(heartbeat);heartbeat=null;clearInterval(metricsTimer);metricsTimer=null;const currentRoom=room;room=null;for(const t of published)t.stop();published=[];if(currentRoom)await currentRoom.disconnect();let failure=null;if(sessionId){const id=sessionId;if(stopServer){try{const r=await fetch('/api/broadcast/live/'+id+'/stop',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok&&r.status!==404)throw Error('Local broadcast ended, but the server session could not be ended. Click End broadcast again to retry.');sessionId=null;}catch(e){failure=e;}}else sessionId=null;}if(stopServer&&!failure){recoverableLive=null;recoverButton.hidden=true;recoverButton.disabled=true;try{const active=await api('restream');if(active?.active?.source==='live'&&Number(active.active.sessionId)===endedSessionId)await api('restream/stop','POST',{});}catch{socialStopWarning=' Social restream shutdown was not verified: check social destinations separately.';}}badge.textContent=failure?'LIVE \xB7 STOP UNCONFIRMED':stopServer?'OFF AIR':'LIVE \xB7 RECOVERY AVAILABLE';badge.dataset.live=failure||!stopServer?'true':'false';returnLiveButton.hidden=true;returnLiveButton.disabled=true;endButton.disabled=!sessionId;endButton.hidden=!sessionId;liveButton.disabled=!!sessionId;liveButton.hidden=!!sessionId;fields.destination.disabled=!!sessionId;quality.textContent='Connection: offline';viewers.textContent='LiveKit room participants: \u2014';metrics.hidden=true;status.textContent=failure?failure.message:'Broadcast ended. Preview remains local.'+socialStopWarning;refresh?.click();if(failure)throw failure;}\n async function releaseSources(){clearInterval(renderTimer);renderTimer=null;stopScreen();for(const t of cameraStream?.getTracks()||[])t.stop();cameraStream=null;camera.srcObject=null;for(const t of canvasStream?.getTracks()||[])t.stop();canvasStream=null;micNode=null;micGateGain=null;micCompressor=null;presenceEq=null;limiterNode=null;mediaNode=null;mediaSource=null;musicSource=null;musicNode=null;micAnalyser=null;analyser=null;subjectEffects?.close?.();subjectEffects=null;backgroundVideo.pause();const oldMusic=music,musicSrc=music.getAttribute('src');music.pause();music=node('audio');music.loop=true;music.className='studio-source-video';if(musicSrc)music.src=musicSrc;oldMusic.replaceWith(music);const oldMedia=media,sourceUrl=media.getAttribute('src');media.pause();media=node('video');media.playsInline=true;media.loop=loop.checked;media.className='studio-source-video';if(sourceUrl)media.src=sourceUrl;oldMedia.replaceWith(media);if(audioContext){await audioContext.close();audioContext=null;}mixDestination=null;prepared=false;closeButton.hidden=true;directCameraFallback=false;for(const e of [fields.format,fields.qualityPreset,fields.facing,captureCamera,captureMic,cameraDeviceSelect,microphoneDeviceSelect])e.disabled=false;prepareButton.disabled=false;closeButton.disabled=true;recordButton.disabled=true;meter.value=0;fps.textContent='Render: \u2014';}\n async function closePreview(){let error=null;try{if(sessionId)await endLive();}catch(e){error=e;}recordingActive=false;if(recorder?.state==='recording')recorder.stop();media.pause();await releaseSources();status.textContent=error?error.message:'Camera, microphone and screen capture closed.';draw();}\n function toggleRecording(){requirePrepared();if(recordingActive){recordingActive=false;recordButton.disabled=true;if(recorder?.state==='recording')recorder.stop();return;}if(!window.MediaRecorder)throw Error('Recording is unavailable in this browser.');if(clips.children.length>=6)throw Error('Save or download your six clips and reload before recording more.');recordingActive=true;try{startRecordingSegment();}catch(e){recordingActive=false;throw e;}}\n function startRecordingSegment(){const mime=['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime){recordingActive=false;throw Error('No supported recording format is available.');}recordedChunks=[];recordedBytes=0;const keep=permanent.checked,stream=new MediaStream([...canvasStream.getVideoTracks(),...mixDestination.stream.getAudioTracks()]);const recordingVideoBitrate=preset.qualityPreset==='data'?900000:preset.qualityPreset==='high'?5000000:2500000,recordingAudioBitrate=preset.qualityPreset==='data'?64000:preset.qualityPreset==='high'?128000:96000;const active=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:recordingVideoBitrate,audioBitsPerSecond:recordingAudioBitrate});recorder=active;recordButton.textContent='Stop recording';recordButton.disabled=false;const started=Date.now();active.ondataavailable=e=>{if(e.data.size){recordedChunks.push(e.data);recordedBytes+=e.data.size;if((recordedBytes>=18000000||Date.now()-started>=60000)&&active.state==='recording')active.stop();}};active.onerror=()=>{recordingActive=false;recordStatus.textContent='Recording failed. Stop recording and retry.';};active.onstop=()=>{const blob=new Blob(recordedChunks,{type:mime});const sequence=++recordSequence;recorder=null;saveClip(blob,mime,sequence,keep).catch(e=>{recordStatus.textContent=e.message;});if(recordingActive&&prepared)startRecordingSegment();else{recordButton.textContent='Start recording programme';recordButton.disabled=!prepared;recordStatus.textContent='Recording stopped. Download or save your clips below.';}};active.start(1000);recordStatus.textContent='Recording programme output \xB7 clips split every minute or before the upload limit.';}\n async function saveClip(blob,mime,sequence,keep){if(!blob.size)return;const url=URL.createObjectURL(blob);clipUrls.add(url);const row=node('div'),label=node('p','Clip '+sequence+' \xB7 '+(blob.size/1048576).toFixed(1)+' MB'),download=node('a','Download clip '+sequence,'btn btn-secondary');download.href=url;download.download='heavenly-key-clip-'+sequence+(mime.includes('mp4')?'.mp4':'.webm');const progress=node('p');row.append(label,download,progress);clips.append(row);const save=button(row,'Save clip to private library',async()=>{if(blob.size>26214400)throw Error('This clip exceeds 25 MB. Download it instead.');save.disabled=true;progress.textContent='Uploading clip\u2026';try{const registered=await api('media','POST',{object_key:'recordings/'+crypto.randomUUID()+(mime.includes('mp4')?'.mp4':'.webm'),media_type:'video',mime_type:mime,size_bytes:blob.size,keep_media:keep});const r=await fetch('/api/media/'+registered.media_id+'/upload',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':mime},body:blob});if(!r.ok)throw Error('Clip upload failed. You can download the clip.');progress.textContent='Saved privately in Media library.';row.dataset.saved='true';save.remove();refresh?.click();}catch(e){progress.textContent=e.message;save.disabled=false;}});if(clips.children.length>=6){recordingActive=false;recordStatus.textContent='Recording stopped: six clips are ready. Save or download them before recording more.';}recordStatus.textContent='Clip '+sequence+' ready. Download clips during long sessions; recording pauses after six clips to protect browser memory.';}\n async function loadPreset(){if(prepared||sessionId)throw Error('Close preview before loading saved output settings.');const r=await api('studio/preferences');applyPreset(r.preferences||{});quickTitle.value=fields.title.value;quickFormat.value=fields.format.value;quickDestination.value=fields.destination.value;programmeScene=preset.scene;previewScene=preset.scene;sceneSelect.value=preset.scene;draw();status.textContent='Saved studio preset loaded. Nothing is broadcasting.';}\n document.addEventListener('hk-studio-state',e=>{if(sessionId&&!liveConnecting&&(!e.detail.live||Number(e.detail.live.session_id)!==Number(sessionId)))endLive(false).catch(()=>{});if(!sessionId&&e.detail.live&&String(e.detail.live.source_ref||'').startsWith('livekit:')&&['live','reconnecting'].includes(String(e.detail.live.status||''))){recoverableLive=e.detail.live;recoverButton.hidden=false;recoverButton.disabled=false;badge.textContent='LIVE \xB7 RECOVERY AVAILABLE';badge.dataset.live='true';status.textContent='A preserved live camera session is waiting. Prepare your camera/microphone, then choose Recover interrupted live session.';}else if(!sessionId){recoverableLive=null;recoverButton.hidden=true;recoverButton.disabled=true;}if(sessionId&&e.detail.live&&Number(e.detail.live.session_id)===Number(sessionId)){const isCamera=String(e.detail.live.source_ref||'').startsWith('livekit:');returnLiveButton.hidden=isCamera;returnLiveButton.disabled=isCamera||!room||room.state!=='connected';if(!isCamera&&room?.state==='connected'){badge.textContent='LIVE \xB7 CAMERA STANDBY';badge.dataset.live='true';status.textContent='Prerecorded programme is on air. Live camera remains connected in standby.';}else if(isCamera&&room?.state==='connected'){badge.textContent='LIVE';badge.dataset.live='true';}}librarySelect.replaceChildren();fallbackSelect.replaceChildren();motionBackgroundSelect.replaceChildren();motionBackgroundGallery.replaceChildren();const placeholder=node('option','Choose an uploaded media file');placeholder.value='';librarySelect.append(placeholder);const fallbackPlaceholder=node('option','Automatic 24/7 playlist if no advert is selected');fallbackPlaceholder.value='';fallbackSelect.append(fallbackPlaceholder);const motionPlaceholder=node('option','Choose a moving background video');motionPlaceholder.value='0';motionBackgroundSelect.append(motionPlaceholder);for(const item of e.detail.media||[]){if(!['approved','published'].includes(item.status))continue;const name=item.object_key.split('/').pop();const o=node('option',name);o.value=String(item.media_id);o.dataset.type=item.media_type;librarySelect.append(o);if(item.media_type==='video'){const ad=node('option',name);ad.value=String(item.media_id);fallbackSelect.append(ad);const bg=node('option',name);bg.value=String(item.media_id);motionBackgroundSelect.append(bg);const tile=node('button','','studio-background-tile studio-motion-tile');tile.type='button';tile.dataset.mediaId=String(item.media_id);const preview=node('video');preview.src='/api/media/'+item.media_id+'/preview';preview.muted=true;preview.loop=true;preview.playsInline=true;preview.preload='metadata';const caption=node('span',name);tile.append(preview,caption);tile.addEventListener('pointerenter',()=>preview.play().catch(()=>{}));tile.addEventListener('pointerleave',()=>{preview.pause();preview.currentTime=0;});tile.addEventListener('click',async()=>{motionBackgroundSelect.value=String(item.media_id);backgroundModeField.value='video';preset=readPreset();for(const x of motionBackgroundGallery.children)x.setAttribute('aria-pressed',String(x===tile));try{await loadBackgroundVideo();status.textContent='Moving background selected: '+name;}catch(err){status.textContent=err.message;}if(!prepared)draw();});motionBackgroundGallery.append(tile);}}if(!motionBackgroundGallery.children.length)motionBackgroundGallery.append(node('p','No uploaded moving-background videos yet. Upload a video in Sources, then it will appear here automatically.','studio-help'));if(preset.backgroundVideoId){motionBackgroundSelect.value=String(preset.backgroundVideoId);for(const tile of motionBackgroundGallery.children)if(tile.dataset?.mediaId)tile.setAttribute('aria-pressed',String(tile.dataset.mediaId===motionBackgroundSelect.value));loadBackgroundVideo().catch(()=>{});}});\n document.addEventListener('hk-admin-session',e=>{if(!e.detail.profile||!isAuthorized()){recoverableLive=null;recoverButton.hidden=true;recoverButton.disabled=true;recordingActive=false;if(recorder?.state==='recording')recorder.stop();expectedDisconnect=true;room?.disconnect();room=null;sessionId=null;clearInterval(heartbeat);clearInterval(metricsTimer);releaseSources().catch(()=>{});clearMedia();music.pause();music.removeAttribute('src');music.load();if(musicUrl){URL.revokeObjectURL(musicUrl);musicUrl=null;}for(const url of clipUrls)URL.revokeObjectURL(url);clipUrls.clear();clips.replaceChildren();badge.dataset.live='false';badge.textContent='OFF AIR';}});\n window.addEventListener('beforeunload',e=>{if(sessionId||recordingActive||Array.from(clips.children).some(row=>row.dataset.saved!=='true')){e.preventDefault();e.returnValue='';}});\n window.addEventListener('pagehide',()=>{if(sessionId)status.textContent='Studio page left unexpectedly. The server will preserve the live session through the reconnect grace period.';});\n document.addEventListener('hk-studio-prepare',()=>{if(isAuthorized()&&!prepared&&!liveConnecting)prepareButton.click();});\n applyPreset(preset);draw();return {close:closePreview,isBusy:()=>Boolean(preparing||prepared||sessionId||liveConnecting||social247Active||recordingActive),openRadio(){if(preparing||prepared||sessionId||liveConnecting||social247Active||recordingActive){status.textContent='An existing preview, recording or broadcast is active. Close it before preparing a different radio programme.';return false;}sourceSelect.value='radio';sourceSelect.dispatchEvent(new Event('change'));return true;}};\n}\n\n\n", "type": "application/javascript;charset=utf-8" }, "/js/signin.js": { "content": "const form=document.getElementById('signin-form'),status=document.getElementById('signin-status'),submit=document.getElementById('signin-submit');\ndocument.getElementById('show-password').onclick=e=>{const show=form.elements.pass.type==='password';form.elements.pass.type=show?'text':'password';e.currentTarget.textContent=show?'Hide password':'Show password';e.currentTarget.setAttribute('aria-pressed',String(show));};\nform.onsubmit=async e=>{e.preventDefault();if(submit.disabled)return;submit.disabled=true;status.textContent='Signing in\u2026';try{const response=await fetch('/auth/password',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({user:form.elements.user.value.trim(),pass:form.elements.pass.value})});form.elements.pass.value='';if(response.redirected&&new URL(response.url).pathname==='/'){location.replace('/');return;}const data=await response.json();throw Error(data.error||'Sign-in could not complete. Please try again.');}catch(e){status.textContent=e.message;}finally{submit.disabled=false;}};\n", "type": "application/javascript;charset=utf-8" }, "/js/studio-app.js": { "content": "import {mountProductionStudio} from './production-studio.js';\nimport {initNavigation,radioSummary} from './workspace.js';\nimport {createDeviceCheck} from './device-check.js';\nconst $=id=>document.getElementById(id);let authorized=false,paused=false,studio;const navigate=initNavigation();let cachedMedia=[];\nfunction sessionEnded(){authorized=false;document.dispatchEvent(new CustomEvent('hk-admin-session',{detail:{profile:null}}));$('notice').textContent='Your Studio session ended. Use Renew sign-in to continue.';}\nasync function request(path,method='GET',data,raw=false){\n const r=await fetch(path,{method,credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':raw?data.type||'application/octet-stream':'application/json'},body:data===undefined?undefined:raw?data:JSON.stringify(data)});\n const result=await r.json().catch(()=>({}));if(r.status===401)sessionEnded();if(!r.ok)throw Error(typeof result.error==='string'?result.error:result.error?.message||'Request failed ('+r.status+').');return result;\n}\nconst api=(path,method='GET',data)=>request(path==='media'?'/api/media':'/api/media-engine/'+path,method,data);\nfunction renderLibrary(){\n $('library').replaceChildren();const filter=$('library-filter').value;const media=cachedMedia.filter(m=>filter==='all'||m.media_type===filter);\n for(const m of media){const row=document.createElement('div');row.className='library-item';const name=document.createElement('h3');name.textContent=m.title||m.object_key.split('/').pop();const description=document.createElement('p');description.textContent=(m.media_type==='audio'?'Audio':'Video')+' \xB7 '+(m.status==='published'?'In the '+(m.media_type==='audio'?'radio':'television')+' playlist':m.status==='approved'?'Private \xB7 ready to preview':'Upload '+m.status)+(m.keep_media?' \xB7 kept permanently':' \xB7 temporary');row.append(name,description);\n  if(['approved','published'].includes(m.status)){const preview=document.createElement('a');preview.textContent='Preview recording \u2197';preview.href='/api/media/'+m.media_id+'/preview';preview.target='_blank';preview.rel='noopener';row.append(preview);const publish=document.createElement('button');publish.textContent=m.status==='published'?'Remove from playlist':'Add to '+(m.media_type==='audio'?'radio':'television')+' playlist';publish.onclick=async()=>{publish.disabled=true;try{await request('/api/media/'+m.media_id+'/publish','POST',{published:m.status!=='published'});await refresh();}catch(e){showError(e);}finally{publish.disabled=false;}};row.append(publish);}$('library').append(row);\n }\n if(!media.length)$('library').textContent=filter==='audio'?'No audio recordings yet. Upload a message or worship recording above.':'No recordings to show yet. Upload your first recording above.';\n}\nasync function refresh(){\n const [media,live,settings,playout]=await Promise.all([request('/api/media'),request('/api/broadcast/live'),request('/api/broadcast/settings'),request('/api/playout')]);\n cachedMedia=media.items||[];document.dispatchEvent(new CustomEvent('hk-studio-state',{detail:{media:cachedMedia,live:live.live}}));renderLibrary();\n const videoSetting=(settings.items||[]).find(x=>x.channel==='video');$('video-playlist').replaceChildren();if(videoSetting){const b=document.createElement('button');b.textContent=videoSetting.playlist_enabled?'Turn off automatic television':'Turn on automatic television';b.onclick=async()=>{b.disabled=true;try{await request('/api/broadcast/settings','POST',{channel:'video',enabled:!videoSetting.playlist_enabled});await refresh();}catch(e){showError(e);}finally{b.disabled=false;}};$('video-playlist').append(b);}\n const summary=radioSummary({media:cachedMedia,live:live.live,settings:settings.items||[],playout:playout.items||[]});$('radio-state-title').textContent=summary.title;$('radio-state-description').textContent=summary.description;\n $('radio-playlist').replaceChildren();const setting=(settings.items||[]).find(x=>x.channel==='radio');if(setting){const b=document.createElement('button');b.textContent=setting.playlist_enabled?'Turn off automatic radio':'Turn on automatic radio';b.onclick=async()=>{b.disabled=true;try{await request('/api/broadcast/settings','POST',{channel:'radio',enabled:!setting.playlist_enabled});await refresh();}catch(e){showError(e);}finally{b.disabled=false;}};$('radio-playlist').append(b);}\n}\n$('library-filter').onchange=()=>{const type=$('library-filter').value;$('upload').elements.file.accept=type==='all'?'audio/*,video/*':type+'/*';renderLibrary();};\n$('radio-library').onclick=()=>{$('library-filter').value='audio';$('upload').elements.file.accept='audio/*';renderLibrary();navigate('library');};\n$('radio-prepare').onclick=()=>{if(!authorized||!studio){$('notice').textContent='Sign in through the control room before preparing a radio programme.';return;}navigate('live');studio.openRadio();};\n\nfunction showError(e){$('notice').textContent=e.message;}\n$('refresh').onclick=()=>refresh().catch(showError);\n$('logout').onclick=async()=>{try{const r=await fetch('/auth/logout',{method:'POST'});if(!r.ok)throw Error('Sign out failed. Try again.');sessionEnded();location.replace('/');}catch(e){showError(e);}};\n$('connection').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button');b.disabled=true;try{const data=Object.fromEntries(new FormData(f));await api('livekit/connection','POST',data);f.reset();$('connection-status').textContent='LiveKit connection verified and saved.';}catch(e){$('connection-status').textContent=e.message;}finally{b.disabled=false;}};\n$('check-connection').onclick=async()=>{try{await api('livekit/connection','POST',{action:'check'});$('connection-status').textContent='Saved connection verified.';}catch(e){$('connection-status').textContent=e.message;}};\n$('destination').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;try{await api('restream/destination','POST',{...Object.fromEntries(new FormData(f)),enabled:true});f.reset();$('destination-status').textContent='Destination saved. Choose it in the Studio final check.';await refresh();}catch(e){$('destination-status').textContent=e.message;}};\n$('pause-upload').onclick=()=>{paused=true;$('upload-status').textContent='Pausing after the current chunk. Select the same file and upload again to resume.';};\n$('upload').onsubmit=async e=>{\n e.preventDefault();const f=e.currentTarget,file=f.elements.file.files[0],submit=f.querySelector('button'),keep=f.elements.keep.checked;if(!file||!file.size)return;\n if(file.size>2*1024**3){$('upload-status').textContent='Choose a file up to 2 GB.';return;}if(!/^(audio|video)\\//.test(file.type)){$('upload-status').textContent='Choose a supported audio or video file.';return;}\n const resumeKey='hk-studio-upload:'+JSON.stringify([file.name,file.size,file.lastModified,file.type]);paused=false;submit.disabled=true;$('pause-upload').disabled=false;\n try{\n  let id=Number(sessionStorage.getItem(resumeKey));if(!id){const created=await request('/api/media','POST',{object_key:'uploads/'+crypto.randomUUID()+'/'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_'),media_type:file.type.split('/')[0],mime_type:file.type,size_bytes:file.size,keep_media:keep});id=created.media_id;sessionStorage.setItem(resumeKey,String(id));}\n  const started=await request('/api/media/'+id+'/multipart','POST',{}),state=await request('/api/media/'+id+'/multipart/status'),done=new Set((state.parts||[]).map(x=>x.part_number)),chunk=started.chunk_bytes;\n  for(let offset=0,part=1;offset<file.size;offset+=chunk,part++){if(paused)return;if(done.has(part))continue;const bytes=file.slice(offset,Math.min(file.size,offset+chunk),file.type);let success=false;for(let attempt=0;attempt<3&&!success;attempt++){try{await request('/api/media/'+id+'/multipart/part/'+part,'PUT',bytes,true);success=true;}catch(e){if(attempt===2||!authorized)throw e;}}$('upload-status').textContent='Uploaded '+Math.round(Math.min(file.size,offset+chunk)/file.size*100)+'%';}\n  if(paused)return;await request('/api/media/'+id+'/multipart/complete','POST',{});sessionStorage.removeItem(resumeKey);f.reset();$('upload-status').textContent='Upload complete. File is private until you publish it.';await refresh();\n }catch(e){$('upload-status').textContent=e.message+' Select the same file and upload again to retry.';}finally{submit.disabled=false;$('pause-upload').disabled=true;}\n};\ntry{const me=await request('/api/studio/me');authorized=true;$('notice').textContent='Signed in as '+me.name+' \xB7 Choose a task from the menu. Preview stays private until Go live.';studio=mountProductionStudio({container:$('studio'),api,refresh:$('refresh'),isAuthorized:()=>authorized});await refresh();setInterval(()=>{if(authorized)refresh().catch(showError);},30000);setInterval(()=>{if(authorized)request('/api/studio/me').catch(showError);},60000);}catch(e){showError(e);}\n\nconst deviceCheck=createDeviceCheck({video:$('device-test-video'),meter:$('device-test-meter'),onStatus:text=>{$('device-test-status').textContent=text;}});\n$('test-devices').onclick=async()=>{if(!authorized){$('device-test-status').textContent='Sign in before testing your devices.';return;}if(studio?.isBusy()){$('device-test-status').textContent='Close the current preview and finish any live programme or recording before running this separate device test.';return;}await deviceCheck.start();};\n$('stop-device-test').onclick=()=>deviceCheck.stop();\nwindow.addEventListener('hashchange',()=>{if(location.hash!=='#settings')deviceCheck.stop(false);});\nwindow.addEventListener('pagehide',()=>deviceCheck.stop(false));\ndocument.addEventListener('visibilitychange',()=>{if(document.hidden)deviceCheck.stop(false);});\ndocument.addEventListener('hk-admin-session',e=>{if(!e.detail.profile)deviceCheck.stop(false);});\n$('check-all-connections').onclick=async()=>{const b=$('check-all-connections');b.disabled=true;$('diagnostics-status').textContent='Checking saved connections\u2026';$('diagnostics-results').replaceChildren();try{const result=await api('diagnostics');for(const check of result.checks||[]){const row=document.createElement('article'),title=document.createElement('h4'),detail=document.createElement('p');row.className='connection-check';title.textContent=check.name+' \xB7 '+check.state.replaceAll('_',' ');detail.textContent=check.detail;row.append(title,detail);$('diagnostics-results').append(row);}$('diagnostics-status').textContent='Check complete. Live camera transmission and Facebook public playback still require an on-air test.';}catch(e){$('diagnostics-status').textContent=e.message;}finally{b.disabled=false;}};\n", "type": "application/javascript;charset=utf-8" }, "/js/studio-effects.js": { "content": "const MP='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';\nconst WASM=MP+'/wasm';\nconst MODEL='https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';\nexport async function createSubjectEffects(){let segmenter=null,busy=false,last=0,maskCanvas=document.createElement('canvas'),maskCtx=maskCanvas.getContext('2d'),ready=false,error=null;try{const {FilesetResolver,ImageSegmenter}=await import(MP+'/+esm');const vision=await FilesetResolver.forVisionTasks(WASM);segmenter=await ImageSegmenter.createFromOptions(vision,{baseOptions:{modelAssetPath:MODEL,delegate:'GPU'},runningMode:'VIDEO',outputCategoryMask:true,outputConfidenceMasks:false});ready=true;}catch(e){error=e;}function update(video,now=performance.now()){if(!ready||busy||!video.videoWidth||now-last<85)return;last=now;busy=true;try{segmenter.segmentForVideo(video,now,result=>{try{const m=result.categoryMask;if(!m)return;const data=m.getAsUint8Array(),w=m.width,h=m.height;maskCanvas.width=w;maskCanvas.height=h;const img=maskCtx.createImageData(w,h);for(let i=0;i<data.length;i++){const a=data[i]?255:0,j=i*4;img.data[j]=255;img.data[j+1]=255;img.data[j+2]=255;img.data[j+3]=a;}maskCtx.putImageData(img,0,0);m.close?.();}finally{busy=false;}});}catch(e){busy=false;error=e;}}const subjectCanvas=document.createElement('canvas'),subjectCtx=subjectCanvas.getContext('2d');function drawPerson(ctx,video,x,y,w,h,mirror=false){if(!ready||!maskCanvas.width||!video.videoWidth||!video.videoHeight)return false;const tw=Math.max(2,Math.round(w)),th=Math.max(2,Math.round(h));if(subjectCanvas.width!==tw)subjectCanvas.width=tw;if(subjectCanvas.height!==th)subjectCanvas.height=th;subjectCtx.clearRect(0,0,tw,th);const scale=Math.max(tw/video.videoWidth,th/video.videoHeight),dw=video.videoWidth*scale,dh=video.videoHeight*scale,dx=(tw-dw)/2,dy=(th-dh)/2;subjectCtx.save();if(mirror){subjectCtx.translate(tw,0);subjectCtx.scale(-1,1);}subjectCtx.drawImage(video,dx,dy,dw,dh);subjectCtx.restore();subjectCtx.globalCompositeOperation='destination-in';subjectCtx.save();subjectCtx.filter='blur(0.8px)';if(mirror){subjectCtx.translate(tw,0);subjectCtx.scale(-1,1);}subjectCtx.drawImage(maskCanvas,dx-2,dy-2,dw+4,dh+4);subjectCtx.restore();subjectCtx.filter='none';subjectCtx.globalCompositeOperation='source-over';ctx.drawImage(subjectCanvas,x,y,w,h);return true;}return {get ready(){return ready;},get error(){return error;},update,drawPerson,close(){segmenter?.close?.();ready=false;}};}\nconst themes={'hkem-global':['#0a2c73','#771d3d','#f4c542','WORLD MISSION'],'hkem-stage':['#081f5c','#8b1836','#f5cf5b','REVIVAL \xB7 HOLINESS \xB7 POWER'],'nations-wall':['#123d86','#6f1737','#f3c84b','CHRIST FOR ALL NATIONS'],'world-map':['#071f55','#0c4b9b','#f4d467','TAKING CHRIST TO THE NATIONS'],'sanctuary':['#3b1732','#781a3d','#e9c45f','WORSHIP \xB7 WORD \xB7 PRAYER'],'prayer':['#182d68','#6c183b','#f1d06a','GLOBAL REVIVAL & DESTINY PRAYER CRY'],'europe-paris':['#205ca8','#8f243f','#f3c45e','EUROPE \xB7 PARIS'],'europe-london':['#173f7a','#8b1b35','#f5cf60','EUROPE \xB7 LONDON'],'europe-rome':['#2d4f86','#7f2137','#eec469','EUROPE \xB7 ROME'],'europe-alps':['#4f84b8','#26496f','#f1d37a','EUROPE \xB7 SCENIC'],'america-newyork':['#173c72','#9a2337','#f0c75d','AMERICA \xB7 NEW YORK'],'america-washington':['#1e477d','#8b1c36','#f4cd62','AMERICA \xB7 WASHINGTON'],'america-coast':['#287db2','#153c69','#f2cc66','AMERICA \xB7 COASTLINE'],'america-city':['#101d4d','#8a1938','#f7cb4d','AMERICA \xB7 CITY LIGHTS'],'world-night':['#06152e','#102f68','#f1ca52','GLOBAL NIGHT MISSION'],'mission-clouds':['#7cb5e9','#d9ecff','#f0be54','THE GOSPEL MUST BE PREACHED'],'royal-blue':['#071f5d','#174caa','#efc64f','HEAVENLY KEY EVANGELISTIC MOVEMENT'],'wine-gold':['#52152f','#8f2343','#f0c95b','HEAVENLY KEY EVANGELISTIC MOVEMENT'],'clean-white':['#f7f4ee','#e4e8f0','#d6aa45','HEAVENLY KEY EVANGELISTIC MOVEMENT'],'media-wall':['#0b255d','#6e1837','#e8bd4d','FAITH OF OUR FATHERS TV']};\nfunction skyline(ctx,w,h,type){ctx.save();ctx.fillStyle='rgba(8,16,35,.45)';const base=h*.78;for(let i=0;i<18;i++){const bw=w*(.018+(i%4)*.006),bh=h*(.06+((i*7)%9)*.012),x=i*w/17-bw/2;ctx.fillRect(x,base-bh,bw,bh);}if(type.includes('paris')){ctx.beginPath();ctx.moveTo(w*.78,base);ctx.lineTo(w*.82,h*.34);ctx.lineTo(w*.86,base);ctx.fill();}if(type.includes('london')){ctx.fillRect(w*.78,h*.45,w*.055,h*.33);ctx.fillRect(w*.793,h*.38,w*.03,h*.08);}if(type.includes('newyork'))ctx.fillRect(w*.72,h*.3,w*.035,h*.48);if(type.includes('washington')){ctx.beginPath();ctx.arc(w*.78,base-h*.12,w*.08,Math.PI,0);ctx.fill();ctx.fillRect(w*.7,base-h*.12,w*.16,h*.12);}ctx.restore();}\nfunction drawAnimated(ctx,w,h,id,t,g){ctx.save();if(id==='hkem-stage'){for(let i=0;i<7;i++){const x=w*(.1+i*.145)+Math.sin(t*.35+i)*w*.024,beam=ctx.createLinearGradient(x,h*.06,x,h*.82);beam.addColorStop(0,'rgba(255,224,116,0)');beam.addColorStop(.45,'rgba(255,224,116,.13)');beam.addColorStop(1,'rgba(255,224,116,0)');ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(x-w*.05,h*.06);ctx.lineTo(x+w*.08,h*.82);ctx.lineTo(x+w*.17,h*.82);ctx.lineTo(x+w*.03,h*.06);ctx.closePath();ctx.fill();}ctx.globalAlpha=.22;ctx.strokeStyle=g;ctx.lineWidth=Math.max(2,w*.003);for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(w*.5,h*.49,w*(.16+i*.09)+Math.sin(t*.55+i)*w*.012,0,Math.PI*2);ctx.stroke();}}else if(id==='world-map'){ctx.translate(w*.5,h*.48);ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=Math.max(1,w*.0015);const r=Math.min(w,h)*.31;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();for(let i=-2;i<=2;i++){ctx.beginPath();ctx.ellipse(0,0,r*Math.cos(i*.22),r,0,0,Math.PI*2);ctx.stroke();}for(let i=0;i<18;i++){const a=t*.12+i*.73,x=Math.cos(a)*r*(.35+(i%4)*.16),y=Math.sin(a*.8+i)*r*.62;ctx.fillStyle=i%3===0?g:'rgba(255,255,255,.65)';ctx.beginPath();ctx.arc(x,y,2+(i%3),0,Math.PI*2);ctx.fill();}}else if(id==='prayer'){for(let i=0;i<20;i++){const phase=(t*.055+i/20)%1,x=w*(.08+(i*47%84)/100),y=h*(.82-phase*.72),r=w*(.0025+(i%4)*.0013);ctx.fillStyle=`rgba(255,224,142,${.08+phase*.24})`;ctx.beginPath();ctx.arc(x+Math.sin(t*.45+i)*w*.018,y,r,0,Math.PI*2);ctx.fill();}const glow=ctx.createRadialGradient(w*.5,h*.34,0,w*.5,h*.34,w*.34);glow.addColorStop(0,'rgba(255,231,157,.24)');glow.addColorStop(1,'rgba(255,231,157,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h*.8);}ctx.restore();}\nexport function drawStudioBackground(ctx,w,h,id,logo,time=performance.now()){const [a,b,g,label]=themes[id]||themes['hkem-global'];const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,a);grad.addColorStop(.62,b);grad.addColorStop(1,'#07132e');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);if(id==='clean-white'){ctx.fillStyle='rgba(255,255,255,.72)';ctx.fillRect(0,0,w,h);}const t=time/1000;if(['hkem-stage','world-map','prayer'].includes(id))drawAnimated(ctx,w,h,id,t,g);else{ctx.save();ctx.globalAlpha=.22;ctx.strokeStyle=g;ctx.lineWidth=Math.max(2,w/700);for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(w*.5,h*.53,w*(.18+i*.08),Math.PI*1.05+Math.sin(t*.18+i)*.05,Math.PI*1.95);ctx.stroke();}ctx.restore();}if(id.includes('europe')||id.includes('america'))skyline(ctx,w,h,id);if(['world-night','hkem-global','nations-wall'].includes(id)){ctx.save();ctx.globalAlpha=.16;ctx.fillStyle='#fff';for(let i=0;i<60;i++){const x=(i*83%100)/100*w,y=(i*47%55)/100*h+h*.2,r=2+(i%4);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}ctx.restore();}if(id==='media-wall'){ctx.fillStyle='rgba(1,10,34,.72)';ctx.fillRect(w*.12,h*.19,w*.76,h*.54);ctx.strokeStyle=g;ctx.lineWidth=w*.006;ctx.strokeRect(w*.12,h*.19,w*.76,h*.54);}ctx.fillStyle='rgba(0,0,0,.22)';ctx.fillRect(0,h*.82,w,h*.18);ctx.fillStyle=g;ctx.fillRect(0,h*.815,w,h*.007);ctx.textAlign='center';ctx.fillStyle=id==='clean-white'?'#16366f':'#fff';ctx.font=`700 ${Math.max(18,w*.022)}px \"Source Sans 3\",sans-serif`;ctx.fillText(label,w/2,h*.91,w*.86);if(logo?.complete&&logo.naturalWidth){const lw=Math.min(w*.1,h*.14),lh=lw;ctx.drawImage(logo,w*.04,h*.045,lw,lh);}ctx.textAlign='left';}\n\n", "type": "application/javascript;charset=utf-8" }, "/js/studio-model.js": { "content": "if(typeof document!=='undefined'&&!document.querySelector('link[data-studio-premium]')){const l=document.createElement('link');l.rel='stylesheet';l.href='../css/studio-premium-overrides.css?v=1.1.0';l.dataset.studioPremium='true';document.head.append(l);}\nexport const scenes=['camera','screen','media','starting','break','ending'];\nexport const formats={'landscape-480':[854,480],'landscape-720':[1280,720],'landscape-1080':[1920,1080],'portrait-720':[720,1280],'portrait-1080':[1080,1920],'portrait-3-4':[810,1080],'square-720':[720,720],'square-1080':[1080,1080]};\nexport const backgroundPresets=[\n ['hkem-stage','LOW-DATA MOVING \xB7 Cross & Church Revival Stage'],['world-map','LOW-DATA MOVING \xB7 Global Mission Airport / Nations'],['prayer','LOW-DATA MOVING \xB7 Nigerian Prayer & Revival'],\n ['hkem-global','STILL \xB7 Global Mission Studio'],['nations-wall','STILL \xB7 Nations & Flags Studio'],['sanctuary','STILL \xB7 Church Sanctuary Studio'],['europe-paris','STILL \xB7 European City Style A'],['europe-london','STILL \xB7 European City Style B'],['europe-rome','STILL \xB7 European City Style C'],['europe-alps','STILL \xB7 European Scenic Style'],['america-newyork','STILL \xB7 American City Style A'],['america-washington','STILL \xB7 American City Style B'],['america-coast','STILL \xB7 American Coast Style'],['america-city','STILL \xB7 American City Lights Style'],['world-night','STILL \xB7 Global Night Mission'],['mission-clouds','STILL \xB7 Mission Clouds'],['royal-blue','STILL \xB7 Royal Blue Studio'],['wine-gold','STILL \xB7 Wine & Gold Studio'],['clean-white','STILL \xB7 Clean White Studio'],['media-wall','STILL \xB7 Media Presentation Wall']\n];\nexport function normalizePreset(value={}){\n const text=(key,fallback,max)=>typeof value[key]==='string'?value[key].slice(0,max):fallback;\n const number=(key,fallback,min,max)=>Number.isFinite(Number(value[key]))?Math.max(min,Math.min(max,Number(value[key]))):fallback;\n return {title:text('title','Faith of Our Fathers TV',200),presenter:text('presenter','',150),lowerThird:text('lowerThird','Taking Christ to the Nations of the World',240),ticker:text('ticker','Heavenly Key Evangelistic Movement \u2022 Revival \u2022 Holiness \u2022 Power',500),scripture:text('scripture','',1000),format:Object.hasOwn(formats,value.format)?value.format:'landscape-720',destination:['both','radio','video'].includes(value.destination)?value.destination:'both',facing:value.facing==='environment'?'environment':'user',scene:scenes.includes(value.scene)?value.scene:'camera',backgroundMode:['none','blur','virtual','video'].includes(value.backgroundMode)?value.backgroundMode:'none',backgroundPreset:backgroundPresets.some(([id])=>id===value.backgroundPreset)?value.backgroundPreset:'hkem-global',backgroundVideoId:number('backgroundVideoId',0,0,999999999),qualityPreset:['data','balanced','high'].includes(value.qualityPreset)?value.qualityPreset:'balanced',backgroundStrength:number('backgroundStrength',70,0,100),subjectProtection:value.subjectProtection!==false,voicePreset:['condenser','speech','natural'].includes(value.voicePreset)?value.voicePreset:'condenser',noiseSuppression:value.noiseSuppression!==false,echoCancellation:value.echoCancellation!==false,autoGainControl:value.autoGainControl!==false,noiseGate:value.noiseGate!==false,compressor:value.compressor!==false,limiter:value.limiter!==false,voiceClarity:number('voiceClarity',75,0,100),micGain:number('micGain',100,0,150),mediaGain:number('mediaGain',100,0,100),musicGain:number('musicGain',20,0,100),duckMusic:value.duckMusic!==false,screenGain:number('screenGain',50,0,100),countdown:number('countdown',5,1,60),cameraVisible:value.cameraVisible!==false,mirror:value.mirror===true,muteIntermission:value.muteIntermission!==false,showBrand:value.showBrand!==false,showLowerThird:value.showLowerThird!==false,showTicker:value.showTicker!==false};\n}\nexport function fitRect(sourceWidth,sourceHeight,x,y,width,height){if(sourceWidth<=0||sourceHeight<=0||width<=0||height<=0)return {x,y,width:0,height:0};const scale=Math.min(width/sourceWidth,height/sourceHeight);const w=sourceWidth*scale,h=sourceHeight*scale;return {x:x+(width-w)/2,y:y+(height-h)/2,width:w,height:h};}\nexport function microphoneLevel(preset,scene,muted){return muted||(preset.muteIntermission&&['starting','break','ending'].includes(scene))?0:preset.micGain/100;}\nexport function wrapText(context,text,maxWidth){const lines=[];for(const paragraph of String(text).split('\\n')){let line='';for(const word of paragraph.split(/\\s+/)){const next=line?line+' '+word:word;if(line&&context.measureText(next).width>maxWidth){lines.push(line);line=word;}else line=next;}lines.push(line);}return lines;}\nexport function musicLevel(preset,voiceRms,microphoneActive){return preset.musicGain/100*(preset.duckMusic&&microphoneActive&&voiceRms>.035?0.25:1);}\n\n", "type": "application/javascript;charset=utf-8" }, "/js/workspace.js": { "content": "export const sections=[['home','Home'],['live','Live Studio'],['radio','24/7 Radio'],['library','Sources / Media Library'],['connections','Connections'],['editing','AI Editing'],['meetings','Live Meetings'],['autopost','Social Auto Post'],['automation','Social Automation'],['settings','Settings'],['help','Help']];\nexport function initNavigation(doc=document,win=window){\n function show(focus=false){const requested=win.location.hash.slice(1),index=Math.max(0,sections.findIndex(([key])=>key===requested)),key=sections[index][0];\n  for(const panel of doc.querySelectorAll('[data-view]'))panel.hidden=panel.dataset.view!==key;\n  for(const link of doc.querySelectorAll('[data-nav]')){if(link.dataset.nav===key)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}\n  const previous=doc.getElementById('previous-feature'),next=doc.getElementById('next-feature');previous.hidden=index===0;previous.href='#'+sections[Math.max(0,index-1)][0];previous.textContent='\u2190 '+sections[Math.max(0,index-1)][1];next.hidden=index===sections.length-1;next.href='#'+sections[Math.min(sections.length-1,index+1)][0];next.textContent='Next: '+sections[Math.min(sections.length-1,index+1)][1]+' \u2192';doc.getElementById('feature-position').textContent=(index+1)+' / '+sections.length;\n  if(focus)doc.querySelector('#view-'+key+' h2')?.focus({preventScroll:true});\n }\n win.addEventListener('hashchange',()=>{doc.querySelector('.workspace-more')?.removeAttribute('open');show(true);});show();return key=>{if(sections.some(([id])=>id===key)){win.location.hash=key;show(true);}};\n}\nfunction date(value){if(!value)return NaN;return Date.parse(value.includes('T')?value:value.replace(' ','T')+'Z');}\nexport function radioSummary({media=[],live=null,settings=[],playout=[]},now=Date.now()){\n const enabled=Boolean(settings.find(x=>x.channel==='radio')?.playlist_enabled),available=media.filter(x=>x.status==='published'&&(x.keep_media||!x.retention_until||date(x.retention_until)>now));const audio=available.filter(x=>x.media_type==='audio');\n if(live&&['live','reconnecting'].includes(live.status)&&['radio','both'].includes(live.destination||'both'))return {title:live.status==='reconnecting'?'Live radio \xB7 reconnecting':'Live radio programme',description:(live.title||'Live programme')+(live.status==='reconnecting'?' is waiting for the connection to return.':' has priority over recorded playback.')};\n const scheduled=playout.find(x=>['playing','scheduled'].includes(x.status)&&date(x.starts_at)<=now&&date(x.ends_at)>now);\n if(scheduled)return {title:'Scheduled radio programme',description:(scheduled.title||'A scheduled recording')+' has priority over the automatic playlist.'};\n if(!enabled)return {title:'Automatic radio is off',description:'Enable the radio playlist below to allow published recordings to play when no live or scheduled programme has priority.'};\n if(audio.length)return {title:'Automatic radio is enabled',description:audio.length+' published audio recording'+(audio.length===1?' is':'s are')+' available. Confirm actual sound on the listener page.'};\n if(available.some(x=>x.media_type==='video'))return {title:'Automatic radio \xB7 video audio fallback',description:'No published audio recording is available. Radio can use the sound from published video files. Add audio recordings to use less listener data.'};\n return {title:'Radio playlist needs a recording',description:'Automatic radio is enabled. Upload an audio recording, preview it, then add it to the radio playlist.'};\n}\n", "type": "application/javascript;charset=utf-8" }, "/signin.html": { "content": '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in \xB7 Heavenly Key Studio</title><link rel="stylesheet" href="/css/shell.css"></head><body><main class="signin-layout"><p class="eyebrow">HEAVENLY KEY STUDIO</p><h1>Welcome back</h1><p>Continue from your control room or use your existing owner or admin password.</p><a class="btn" href="/auth/start">Continue with control room</a><div class="signin-divider">or sign in here</div><form id="signin-form"><label>Username or email<input name="user" autocomplete="username" required autocapitalize="none" spellcheck="false" placeholder="Owner or admin username"></label><label>Password<input name="pass" type="password" autocomplete="current-password" required maxlength="128"></label><button type="button" id="show-password" aria-pressed="false">Show password</button><button id="signin-submit">Sign in</button><p id="signin-status" role="status" aria-live="polite"></p></form><p>Use the same credentials as the control room. Your existing password stays there.</p><a href="https://heavenlykey.org/">Go back to the main website</a></main><script type="module" src="/js/signin.js"><\/script></body></html>\n', "type": "text/html;charset=utf-8" } };

// src/studio-assets.ts
function fetchStudioAsset(req, env) {
  if (!["GET", "HEAD"].includes(req.method)) return new Response("Method not allowed", { status: 405 });
  const path = new URL(req.url).pathname, item = assets[path === "/" ? "/index.html" : path];
  if (item) return new Response(req.method === "HEAD" ? null : item.content, { headers: { "Content-Type": item.type, "X-Content-Type-Options": "nosniff", "Cache-Control": path === "/" || path === "/signin.html" ? "no-store" : "public,max-age=300" } });
  if (env.ASSETS && Object.keys(assets).length === 0) return env.ASSETS.fetch(req);
  return Response.json({ error: "Studio asset not found. Upload the complete packaged Studio Worker." }, { status: Object.keys(assets).length ? 404 : 503, headers: { "Cache-Control": "no-store" } });
}

// src/studio-auth.ts
var cookieName = "__Host-hk-studio";
var headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
var json = (data, status = 200) => Response.json(data, { status, headers });
var random = () => [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, "0")).join("");
function cookie(req, name) {
  return (req.headers.get("cookie") || "").split(";").map((x) => x.trim()).find((x) => x.startsWith(name + "="))?.slice(name.length + 1) || "";
}
function setCookie(name, value, age) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
}
function redirect(url, cookies = []) {
  const h = new Headers(headers);
  h.set("location", url);
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(null, { status: 303, headers: h });
}
function controlOrigin(env) {
  const u = new URL(env.CONTROL_ROOM_URL || "");
  if (u.protocol !== "https:" || u.username || u.password || u.pathname !== "/" || u.search || u.hash) throw Error("CONTROL_ROOM_URL must be the control room HTTPS origin.");
  return u.origin;
}
function configured(env) {
  try {
    return typeof env.STUDIO_SSO_SECRET === "string" && env.STUDIO_SSO_SECRET.length >= 32 && !!controlOrigin(env);
  } catch {
    return false;
  }
}
async function studioOwner(req, env) {
  const id = cookie(req, cookieName);
  if (!/^[a-f0-9]{64}$/.test(id)) return null;
  const raw = await env.LIVE_STATUS_KV.get("studio-session:" + id);
  if (!raw) return null;
  try {
    const owner = JSON.parse(raw);
    if (!["Super Administrator", "Administrator"].includes(owner.role) || typeof owner.sub !== "string" || !owner.sub.startsWith("control-room:") || !Number.isSafeInteger(owner.exp) || owner.exp <= Math.floor(Date.now() / 1e3)) return null;
    return owner;
  } catch {
    return null;
  }
}
async function establishSession(owner, env) {
  if (!["Super Administrator", "Administrator"].includes(String(owner.role)) || typeof owner.sub !== "string" || !/^control-room:\d+$/.test(owner.sub) || typeof owner.name !== "string") return json({ error: "Control room returned an invalid identity." }, 502);
  const now = Math.floor(Date.now() / 1e3), id = random();
  await env.LIVE_STATUS_KV.put("studio-session:" + id, JSON.stringify({ ...owner, iat: now, exp: now + 43200, nonce: id }), { expirationTtl: 43200 });
  return redirect("/", [setCookie(cookieName, id, 43200), setCookie("__Host-hk-studio-state", "", 0)]);
}
async function studioAuthRoute(req, env) {
  const u = new URL(req.url), p = u.pathname;
  if (p === "/auth/password" && req.method === "POST") {
    if (req.headers.get("origin") !== u.origin) return json({ error: "Cross-origin request denied" }, 403);
    if (!configured(env)) return json({ error: "Studio sign-in is not configured." }, 503);
    if (!req.body) return json({ error: "Enter your username and password" }, 400);
    const reader = req.body.getReader();
    let length = 0, text = "";
    const decoder = new TextDecoder();
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > 2048) {
        await reader.cancel();
        return json({ error: "Sign-in request is too large" }, 413);
      }
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    let input;
    try {
      input = JSON.parse(text);
    } catch {
      return json({ error: "Enter your username and password" }, 400);
    }
    if (!input || typeof input.user !== "string" || input.user.length > 254 || typeof input.pass !== "string" || !input.pass || input.pass.length > 128) return json({ error: "Enter your control room username and password" }, 400);
    let response;
    try {
      response = await fetch(controlOrigin(env) + "/api/studio/password-login", { method: "POST", redirect: "error", signal: AbortSignal.timeout(15e3), headers: { "content-type": "application/json", authorization: "Bearer " + env.STUDIO_SSO_SECRET, "x-studio-client-ip": req.headers.get("cf-connecting-ip") || "studio-unknown" }, body: JSON.stringify({ user: input.user, pass: input.pass, audience: u.origin }) });
    } catch {
      return json({ error: "Control room could not be reached. Please try again." }, 502);
    }
    if (!response.ok) {
      if (response.status === 429) return json({ error: "Too many sign-in attempts. Wait ten minutes, then try again." }, 429);
      if (response.status === 403) return json({ error: "Use an active control room owner or admin account." }, 403);
      if (response.status === 401) return json({ error: "Username or password was not accepted, or the Studio connection needs setup." }, 401);
      return json({ error: "Studio sign-in could not complete. Check the control room connection." }, 503);
    }
    return establishSession(await response.json(), env);
  }
  if (p === "/auth/start" && req.method === "GET") {
    if (!configured(env)) return json({ error: "Studio sign-in needs CONTROL_ROOM_URL and STUDIO_SSO_SECRET configured on this existing Worker." }, 503);
    const state = random(), target = new URL("/studio/connect", controlOrigin(env));
    target.searchParams.set("state", state);
    return redirect(target.href, [setCookie("__Host-hk-studio-state", state, 300)]);
  }
  if (p === "/auth/callback" && req.method === "GET") {
    if (!configured(env)) return json({ error: "Studio sign-in is not configured." }, 503);
    const state = u.searchParams.get("state") || "", code = u.searchParams.get("code") || "";
    if (!/^[a-f0-9]{64}$/.test(state) || !/^[a-f0-9]{64}$/.test(code) || cookie(req, "__Host-hk-studio-state") !== state) return json({ error: "Sign-in could not be confirmed. Open Studio again from the control room." }, 401);
    let response;
    try {
      response = await fetch(controlOrigin(env) + "/api/studio/redeem", { method: "POST", redirect: "error", signal: AbortSignal.timeout(1e4), headers: { "content-type": "application/json", authorization: "Bearer " + env.STUDIO_SSO_SECRET }, body: JSON.stringify({ state, code, audience: u.origin }) });
    } catch {
      return json({ error: "Control room could not be reached. Open Studio again to retry." }, 502);
    }
    if (!response.ok) return json({ error: "Sign-in expired or was denied. Open Studio again from the control room." }, 401);
    const owner = await response.json();
    return establishSession(owner, env);
  }
  if (p === "/auth/logout" && req.method === "POST") {
    if (req.headers.get("origin") !== u.origin) return json({ error: "Cross-origin request denied" }, 403);
    const id = cookie(req, cookieName);
    if (/^[a-f0-9]{64}$/.test(id)) await env.LIVE_STATUS_KV.delete("studio-session:" + id);
    return new Response(null, { status: 204, headers: { ...headers, "Set-Cookie": setCookie(cookieName, "", 0) } });
  }
  if (p === "/api/studio/me" && req.method === "GET") {
    const owner = await studioOwner(req, env);
    return owner ? json({ name: owner.name, expires_at: owner.exp }) : json({ error: "Open Studio from the control room to sign in." }, 401);
  }
  if (p === "/" && ["GET", "HEAD"].includes(req.method)) {
    if (await studioOwner(req, env)) return fetchStudioAsset(req, env);
    return fetchStudioAsset(new Request(new URL("/signin.html", u.origin), { method: req.method }), env);
  }
  if (p === "/signin.html" || p.startsWith("/js/") || p.startsWith("/css/") || p.startsWith("/assets/")) return fetchStudioAsset(req, env);
  return null;
}

// src/uploads.ts
var MAX_MEDIA_BYTES = 2 * 1024 * 1024 * 1024;
var CHUNK = 8 * 1024 * 1024;
var json2 = (value, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
async function multipartUpload(request, env, actor) {
  const match = new URL(request.url).pathname.match(/^\/api\/media\/(\d+)\/multipart(?:\/(status|complete|abort|part\/(\d+)))?$/);
  if (!match) return null;
  const id = Number(match[1]), action = match[2] || "start";
  const media = await env.DB.prepare("SELECT object_key,mime_type,size_bytes,status FROM media_objects WHERE media_id=?").bind(id).first();
  if (!media || media.status === "deleted") return json2({ error: "Media not found" }, 404);
  let upload = await env.DB.prepare("SELECT * FROM media_uploads WHERE media_id=?").bind(id).first();
  if (upload && upload.actor_id !== actor) return json2({ error: "This upload belongs to another administrator" }, 403);
  if (action === "start" && request.method === "POST") {
    if (media.status !== "pending" && media.status !== "failed") return json2({ error: "This media is already uploaded" }, 409);
    if (!Number.isSafeInteger(media.size_bytes) || media.size_bytes < 1 || media.size_bytes > MAX_MEDIA_BYTES) return json2({ error: "Choose a file up to 2 GB" }, 400);
    if (upload?.status === "uploading" && new Date(upload.expires_at).getTime() > Date.now()) return json2({ upload_id: upload.upload_id, chunk_bytes: CHUNK, total_bytes: media.size_bytes });
    if (upload?.status === "uploading") {
      try {
        await env.MEDIA_R2.resumeMultipartUpload(media.object_key, upload.upload_id).abort();
      } catch {
        console.warn("Previous multipart cleanup failed", id);
      }
    }
    const started = await env.MEDIA_R2.createMultipartUpload(media.object_key, { httpMetadata: { contentType: media.mime_type } });
    await env.DB.prepare("DELETE FROM media_upload_parts WHERE media_id=?").bind(id).run();
    await env.DB.prepare("INSERT INTO media_uploads(media_id,upload_id,actor_id,chunk_bytes,total_bytes,status,expires_at) VALUES(?,?,?,?,?,'uploading',?) ON CONFLICT(media_id) DO UPDATE SET upload_id=excluded.upload_id,actor_id=excluded.actor_id,total_bytes=excluded.total_bytes,status='uploading',expires_at=excluded.expires_at").bind(id, started.uploadId, actor, CHUNK, media.size_bytes, new Date(Date.now() + 24 * 36e5).toISOString()).run();
    return json2({ upload_id: started.uploadId, chunk_bytes: CHUNK, total_bytes: media.size_bytes }, 201);
  }
  if (!upload) return json2({ error: "Start the upload first" }, 404);
  if (action === "status" && request.method === "GET") {
    const parts = await env.DB.prepare("SELECT part_number,size_bytes FROM media_upload_parts WHERE media_id=? ORDER BY part_number").bind(id).all();
    return json2({ status: upload.status, chunk_bytes: CHUNK, total_bytes: upload.total_bytes, parts: parts.results, expires_at: upload.expires_at });
  }
  if (upload.status !== "uploading") return json2({ error: "This upload is no longer active" }, 409);
  const transfer = env.MEDIA_R2.resumeMultipartUpload(media.object_key, upload.upload_id);
  if (action === "abort" && request.method === "POST") {
    await transfer.abort();
    await env.DB.prepare("UPDATE media_uploads SET status='aborted' WHERE media_id=?").bind(id).run();
    return json2({ ok: true });
  }
  if (new Date(upload.expires_at).getTime() <= Date.now()) return json2({ error: "Upload expired. Start again." }, 410);
  if (action.startsWith("part/") && request.method === "PUT") {
    const part = Number(match[3]), count = Math.ceil(upload.total_bytes / CHUNK);
    if (!Number.isSafeInteger(part) || part < 1 || part > count || !request.body) return json2({ error: "Invalid upload part" }, 400);
    const expected = Math.min(CHUNK, upload.total_bytes - (part - 1) * CHUNK), reader = request.body.getReader(), chunks = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > expected) {
        await reader.cancel();
        return json2({ error: "Upload part is too large" }, 413);
      }
      chunks.push(next.value);
    }
    if (size !== expected) return json2({ error: "Upload part is incomplete" }, 400);
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const result = await transfer.uploadPart(part, bytes);
    await env.DB.prepare("INSERT INTO media_upload_parts(media_id,part_number,etag,size_bytes) VALUES(?,?,?,?) ON CONFLICT(media_id,part_number) DO UPDATE SET etag=excluded.etag,size_bytes=excluded.size_bytes").bind(id, part, result.etag, size).run();
    return json2({ ok: true, part_number: part, size_bytes: size });
  }
  if (action === "complete" && request.method === "POST") {
    const rows = await env.DB.prepare("SELECT part_number,etag,size_bytes FROM media_upload_parts WHERE media_id=? ORDER BY part_number").bind(id).all();
    const parts = rows.results, count = Math.ceil(upload.total_bytes / CHUNK);
    if (parts.length !== count || parts.some((p, i) => p.part_number !== i + 1) || parts.reduce((sum, p) => sum + p.size_bytes, 0) !== upload.total_bytes) return json2({ error: "Some upload parts are missing. Resume the upload." }, 409);
    await transfer.complete(parts.map((p) => ({ partNumber: p.part_number, etag: p.etag })));
    const object = await env.MEDIA_R2.head(media.object_key);
    if (!object || object.size !== upload.total_bytes) return json2({ error: "Uploaded size could not be verified" }, 409);
    await env.DB.prepare("UPDATE media_objects SET status='approved',updated_at=CURRENT_TIMESTAMP WHERE media_id=?").bind(id).run();
    await env.DB.prepare("UPDATE media_uploads SET status='completed' WHERE media_id=?").bind(id).run();
    await env.DB.prepare("INSERT INTO audit_events(actor_id,action,resource_type,resource_id) VALUES(?,?,?,?)").bind(actor, "media.upload.complete", "media", String(id)).run();
    return json2({ ok: true, media_id: id, size_bytes: object.size });
  }
  return json2({ error: "Unsupported upload action" }, 405);
}

// src/public-broadcast.ts
function youtubeVideoId(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    let id = null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"].includes(u.hostname)) {
      id = u.pathname === "/watch" ? u.searchParams.get("v") : /^\/(?:embed|shorts|live)\/([^/]+)/.exec(u.pathname)?.[1] || null;
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
function isPlaybackURL(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && !(u.hostname === "heavenlykey.alldaywow247.workers.dev" && !u.pathname.startsWith("/api/broadcast/media/"));
  } catch {
    return false;
  }
}
var json3 = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
var ready = "m.status IN ('approved','published') AND (m.status='published' OR m.keep_media=1 OR m.retention_until IS NULL OR julianday(m.retention_until)>julianday('now'))";
async function eligibleMedia(env, id) {
  return env.DB.prepare(`SELECT m.* FROM media_objects m WHERE m.media_id=? AND ${ready} AND
 (m.status='published' OR EXISTS (SELECT 1 FROM playout_items p WHERE p.media_id=m.media_id AND p.status IN ('scheduled','playing') AND julianday(p.starts_at)<=julianday('now') AND julianday(p.ends_at)>julianday('now'))
 OR EXISTS (SELECT 1 FROM live_sessions l WHERE ((l.status='live' AND julianday(l.last_heartbeat_at)>julianday('now','-180 seconds')) OR (l.status='reconnecting' AND julianday(l.reconnect_deadline)>julianday('now'))) AND (l.visual_media_id=m.media_id OR l.fallback_media_id=m.media_id OR l.source_ref='media:'||m.media_id)))`).bind(id).first();
}
function mediaItem(m) {
  return { mediaId: m.media_id, title: m.object_key.split("/").pop() ?? "Ministry programme", type: m.media_type, mimeType: m.mime_type, url: `/api/broadcast/media/${m.media_id}/object` };
}
async function publicProgramme(request, env) {
  const channel = new URL(request.url).searchParams.get("channel") === "radio" ? "audio" : "video";
  const live = await env.DB.prepare("SELECT session_id,title,status,source_type,source_ref,visual_media_id,fallback_media_id,destination,reconnect_deadline FROM live_sessions WHERE ((status='live' AND julianday(last_heartbeat_at)>julianday('now','-180 seconds')) OR (status='reconnecting' AND julianday(reconnect_deadline)>julianday('now'))) ORDER BY session_id DESC LIMIT 1").first();
  if (live && (live.destination === "both" || live.destination === (channel === "audio" ? "radio" : "video"))) {
    if (live.status === "reconnecting") {
      const fallbackId = Number(live.fallback_media_id);
      const fallback = Number.isInteger(fallbackId) && fallbackId > 0 ? await eligibleMedia(env, fallbackId) : null;
      if (fallback && channel === "video") return json3({ mode: "reconnecting", title: live.title + " \xB7 connection break", items: [mediaItem(fallback)], reconnectDeadline: live.reconnect_deadline });
    } else {
      const id = live.visual_media_id ?? Number(String(live.source_ref).replace(/^media:/, ""));
      const media = Number.isInteger(id) && id > 0 ? await eligibleMedia(env, id) : null;
      if (media && (channel === "video" || media.media_type === "audio")) return json3({ mode: "live", title: live.title, items: [mediaItem(media)] });
      if (live.source_type === "camera") {
        const ref = String(live.source_ref ?? "");
        if (ref.startsWith("livekit:")) return json3({ mode: "live", transport: "livekit", title: live.title, sessionId: live.session_id, items: [] });
        const youtube = youtubeVideoId(ref);
        if (youtube && channel === "video") return json3({ mode: "live", transport: "youtube", title: live.title, videoId: youtube, sessionId: live.session_id, items: [] });
        try {
          const url = new URL(ref);
          if (isPlaybackURL(ref)) return json3({ mode: "live", title: live.title, items: [{ title: live.title, type: channel, url: url.href }] });
        } catch {
        }
      }
    }
  }
  const channelFilter = channel === "audio" ? "m.media_type='audio'" : "m.media_type='video'";
  const scheduled = await env.DB.prepare(`SELECT m.*,p.title AS programme_title FROM playout_items p JOIN media_objects m ON m.media_id=p.media_id WHERE p.status IN ('scheduled','playing') AND julianday(p.starts_at)<=julianday('now') AND julianday(p.ends_at)>julianday('now') AND ${channelFilter} AND ${ready} ORDER BY p.starts_at DESC LIMIT 1`).first();
  if (scheduled) return json3({ mode: "scheduled", title: scheduled.programme_title, items: [mediaItem(scheduled)] });
  const settings = await env.DB.prepare("SELECT playlist_enabled FROM broadcast_settings WHERE channel=?").bind(channel === "audio" ? "radio" : "video").first();
  if (settings?.playlist_enabled === 0) return json3({ mode: "offline", title: channel === "audio" ? "ONLINE REVIVAL RADIO" : "FAITH OF OUR FATHERS TV", items: [] });
  const playlist = await env.DB.prepare(`SELECT m.* FROM media_objects m WHERE ${channelFilter} AND m.status='published' AND ${ready} ORDER BY CASE WHEN m.media_type='audio' THEN 0 ELSE 1 END,m.media_id LIMIT 50`).all();
  let entries = playlist.results;
  const orderKey = "playlist-order-" + (channel === "audio" ? "radio" : "video");
  let order = [];
  try {
    const raw = await env.LIVE_STATUS_KV.get(orderKey);
    order = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Invalid public playlist order state", orderKey, e);
    order = [];
  }
  if (Array.isArray(order) && order.length) {
    const rank = new Map(order.map((id, index) => [Number(id), index]));
    entries = [...entries].sort((a, b) => (rank.get(a.media_id) ?? 1e4 + a.media_id) - (rank.get(b.media_id) ?? 1e4 + b.media_id));
  }
  return json3({ mode: entries.length ? "playlist" : "offline", title: channel === "audio" ? "ONLINE REVIVAL RADIO" : "FAITH OF OUR FATHERS TV", items: entries.map(mediaItem) });
}
async function serveBroadcastMedia(request, env, id, adminPreview = false) {
  const media = adminPreview ? await env.DB.prepare("SELECT * FROM media_objects WHERE media_id=? AND status IN ('approved','published') AND (status='published' OR keep_media=1 OR retention_until IS NULL OR julianday(retention_until)>julianday('now'))").bind(id).first() : await eligibleMedia(env, id);
  if (!media || !["audio", "video", "image"].includes(media.media_type)) return json3({ error: "Media unavailable" }, 404);
  const range = request.headers.get("Range");
  if (range && !/^bytes=(\d+-\d*|-\d+)$/.test(range)) return new Response(null, { status: 416 });
  const head = await env.MEDIA_R2.head(media.object_key);
  if (!head) return json3({ error: "Media unavailable" }, 404);
  if (range) {
    const r = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (r && (Number(r[1]) >= head.size || r[2] && Number(r[2]) < Number(r[1])) || range === "bytes=-0") return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + head.size } });
  }
  const object = request.method === "HEAD" ? head : await env.MEDIA_R2.get(media.object_key, range ? { range: request.headers } : void 0);
  if (!object) return json3({ error: "Media unavailable" }, 404);
  const headers2 = new Headers({ "Content-Type": media.mime_type, "Accept-Ranges": "bytes", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" });
  headers2.set("ETag", object.httpEtag);
  const part = object.range;
  let status = 200;
  if (range && part?.offset !== void 0 && part.length !== void 0) {
    status = 206;
    headers2.set("Content-Range", `bytes ${part.offset}-${part.offset + part.length - 1}/${object.size}`);
    headers2.set("Content-Length", String(part.length));
  } else headers2.set("Content-Length", String(object.size));
  return new Response(request.method === "HEAD" ? null : object.body, { status, headers: headers2 });
}

// src/index.ts
var ADMIN_ROLES = /* @__PURE__ */ new Set(["Administrator", "Super Administrator", "Deputy Super Administrator"]);
var json4 = (body, status = 200, headers2) => Response.json(body, { status, headers: headers2 });
function fromHex(value) {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error("Invalid signature");
  const o = new Uint8Array(32);
  for (let i = 0; i < 32; i++) o[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return o;
}
async function verifyCapability(token, secret) {
  if (typeof secret !== "string" || !secret || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;
  let p;
  try {
    p = JSON.parse(atob(encoded));
  } catch {
    return null;
  }
  const key2 = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  let valid = false;
  try {
    valid = await crypto.subtle.verify("HMAC", key2, fromHex(signature), new TextEncoder().encode(encoded));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1e3);
  if (!valid || !p.sub || !p.nonce || !Number.isInteger(p.exp) || p.exp <= now || !Number.isInteger(p.iat) || p.iat > now + 30 || p.exp <= p.iat || p.exp - p.iat > 300 || !ADMIN_ROLES.has(p.role)) return null;
  return p;
}
function audit(env, cap, action, type, id) {
  return env.DB.prepare("INSERT INTO audit_events(actor_id,action,resource_type,resource_id) VALUES(?,?,?,?)").bind(cap.sub, action, type, id ?? null).run();
}
async function requireJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
function expiryHours(hours = 48) {
  return new Date(Date.now() + hours * 36e5).toISOString();
}
var engine = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const studioResponse = await studioAuthRoute(request, env);
    if (studioResponse) return studioResponse;
    if (url.pathname === "/health" && request.method === "GET") return json4({ ok: true, service: "heavenlykey-media-engine", version: env.MEDIA_ENGINE_VERSION ?? "v1" });
    const marker = request.headers.get("X-Heavenly-Key-Internal");
    const auth = request.headers.get("Authorization") ?? "";
    if (marker === "media-engine-public-v1" && request.method === "GET" && url.pathname === "/api/broadcast/live") {
      const row = await env.DB.prepare("SELECT session_id,title,status,source_type,source_ref,visual_media_id,fallback_media_id,started_at,last_heartbeat_at,reconnect_deadline FROM live_sessions WHERE status IN ('live','reconnecting') ORDER BY session_id DESC LIMIT 1").first();
      if (!row) return json4({ live: null });
      const safe = row;
      return json4({ live: { session_id: safe.session_id, title: safe.title, status: safe.status, source_type: safe.source_type, started_at: safe.started_at, reconnect_deadline: safe.reconnect_deadline } });
    }
    if (marker === "media-engine-public-v1" && request.method === "GET" && url.pathname === "/api/broadcast/programme") return publicProgramme(request, env);
    {
      const match = url.pathname.match(/^\/api\/broadcast\/media\/(\d+)\/object$/);
      if (marker === "media-engine-public-v1" && match && ["GET", "HEAD"].includes(request.method)) return serveBroadcastMedia(request, env, Number(match[1]));
    }
    if (url.pathname === "/api/media-engine/livekit/viewer-token" && request.method === "POST" && marker === "media-engine-public-v1") {
      const live = await env.DB.prepare("SELECT session_id,source_ref,title,status FROM live_sessions WHERE source_ref LIKE 'livekit:%' AND ((status='live' AND last_heartbeat_at>datetime('now','-180 seconds')) OR (status='reconnecting' AND reconnect_deadline>datetime('now'))) ORDER BY session_id DESC LIMIT 1").first();
      if (!live) return json4({ error: "No LiveKit broadcast is active" }, 404);
      try {
        const { createLiveKitToken: createLiveKitToken2 } = await Promise.resolve().then(() => (init_livekit(), livekit_exports));
        const room = "heavenlykey-live-" + live.session_id;
        return json4({ ...await createLiveKitToken2(await resolveLiveKitConfig(env) ?? {}, room, "viewer-" + crypto.randomUUID(), false), title: live.title, sessionId: live.session_id });
      } catch (e) {
        return json4({ error: e instanceof Error ? e.message : "Live transport unavailable" }, 503);
      }
    }
    let cap = null;
    if (marker === "media-engine-v1" && auth.startsWith("Bearer ")) cap = await verifyCapability(auth.slice(7), env.MEDIA_ENGINE_SHARED_SECRET);
    else {
      cap = await studioOwner(request, env);
      if (cap && !["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== url.origin) return json4({ error: "Cross-origin request denied" }, 403);
    }
    if (!cap) return json4({ error: "Open Studio from the control room to sign in." }, 401);
    if (url.pathname === "/api/admin/social/live-authorization" && request.method === "GET") return json4({ items: [], accounts: [] });
    if (url.pathname.startsWith("/api/admin/social/")) return json4({ error: "Manage social provider authorization in the ministry website. Studio RTMP connections are available in Streaming connections." }, 409);
    if (url.pathname === "/api/media-engine/diagnostics" && request.method === "GET") return json4(await connectionDiagnostics(env));
    const multipart = await multipartUpload(request, env, cap.sub);
    if (multipart) return multipart;
    {
      const m2 = url.pathname.match(/^\/api\/media\/(\d+)\/preview$/);
      if (m2 && ["GET", "HEAD"].includes(request.method)) return serveBroadcastMedia(request, env, Number(m2[1]), true);
    }
    if (url.pathname === "/api/broadcast/playlist-order" && request.method === "GET") {
      const result = { radio: [], video: [] };
      for (const channel of ["radio", "video"]) {
        const raw = await env.LIVE_STATUS_KV.get("playlist-order-" + channel);
        let ids = [];
        try {
          ids = raw ? JSON.parse(raw) : [];
        } catch (e) {
          console.warn("Invalid playlist order state for " + channel, e);
          ids = [];
        }
        if (!Array.isArray(ids)) ids = [];
        result[channel] = ids.filter((x) => Number.isSafeInteger(x) && x > 0).slice(0, 50);
      }
      return json4(result);
    }
    if (url.pathname === "/api/broadcast/playlist-order" && request.method === "POST") {
      const b = await requireJson(request), channel = String(b?.channel ?? ""), ids = Array.isArray(b?.media_ids) ? b.media_ids.map(Number) : null;
      if (!["radio", "video"].includes(channel) || !ids || ids.length > 50 || ids.some((x) => !Number.isSafeInteger(x) || x < 1) || new Set(ids).size !== ids.length) return json4({ error: "Enter a valid unique playlist order" }, 400);
      if (ids.length) {
        const placeholders = ids.map(() => "?").join(",");
        const rows = await env.DB.prepare(`SELECT media_id,media_type,status FROM media_objects WHERE media_id IN (${placeholders})`).bind(...ids).all();
        if (rows.results.length !== ids.length || rows.results.some((m2) => m2.status !== "published" || channel === "video" && m2.media_type !== "video" || channel === "radio" && m2.media_type !== "audio")) return json4({ error: "Playlist order contains unavailable or incompatible media" }, 400);
      }
      await env.LIVE_STATUS_KV.put("playlist-order-" + channel, JSON.stringify(ids));
      await audit(env, cap, "playlist.order", "channel", channel);
      return json4({ ok: true, channel, media_ids: ids });
    }
    if (url.pathname === "/api/broadcast/settings" && request.method === "GET") {
      const r = await env.DB.prepare("SELECT channel,playlist_enabled FROM broadcast_settings ORDER BY channel").all();
      return json4({ items: r.results });
    }
    if (url.pathname === "/api/broadcast/settings" && request.method === "POST") {
      const b = await requireJson(request);
      if (!b || !["radio", "video"].includes(String(b.channel)) || typeof b.enabled !== "boolean") return json4({ error: "Choose a channel and playlist switch" }, 400);
      await env.DB.prepare("UPDATE broadcast_settings SET playlist_enabled=? WHERE channel=?").bind(b.enabled ? 1 : 0, String(b.channel)).run();
      await audit(env, cap, "playlist.switch", "channel", String(b.channel));
      return json4({ ok: true });
    }
    {
      const match = url.pathname.match(/^\/api\/playout\/(\d+)\/cancel$/);
      if (match && request.method === "POST") {
        const r = await env.DB.prepare("UPDATE playout_items SET status='cancelled' WHERE playout_id=? AND status IN ('scheduled','playing')").bind(Number(match[1])).run();
        if (!r.meta.changes) return json4({ error: "Active programme not found" }, 404);
        await audit(env, cap, "playout.cancel", "playout", match[1]);
        return json4({ ok: true });
      }
    }
    if (url.pathname === "/api/media-engine/studio/preferences" && ["GET", "POST"].includes(request.method)) {
      const key2 = "studio-preset-v1:" + cap.sub;
      if (request.method === "GET") {
        const stored = await env.LIVE_STATUS_KV.get(key2);
        return json4({ preferences: stored ? JSON.parse(stored) : null });
      }
      const body = await requireJson(request), value = body?.preferences;
      if (!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(value).length > 8e3) return json4({ error: "Enter a studio preset up to 8 KB" }, 400);
      const prefs = {};
      const textLimits = { title: 200, presenter: 150, lowerThird: 240, ticker: 500, scripture: 1e3 };
      for (const [k, max] of Object.entries(textLimits)) {
        if (k in value) {
          const v = value[k];
          if (typeof v !== "string" || v.length > max) return json4({ error: "Invalid studio text field: " + k }, 400);
          prefs[k] = v;
        }
      }
      const choices = { format: ["landscape-480", "landscape-720", "landscape-1080", "portrait-720", "portrait-1080", "portrait-3-4", "square-720", "square-1080"], destination: ["both", "radio", "video"], facing: ["user", "environment"], scene: ["camera", "screen", "media", "starting", "break", "ending"], backgroundMode: ["none", "blur", "virtual", "video"], backgroundPreset: ["hkem-global", "hkem-stage", "nations-wall", "world-map", "sanctuary", "prayer", "europe-paris", "europe-london", "europe-rome", "europe-alps", "america-newyork", "america-washington", "america-coast", "america-city", "world-night", "mission-clouds", "royal-blue", "wine-gold", "clean-white", "media-wall"], voicePreset: ["condenser", "speech", "natural"], qualityPreset: ["data", "balanced", "high"] };
      for (const [k, values] of Object.entries(choices)) {
        if (k in value) {
          const v = value[k];
          if (!values.includes(v)) return json4({ error: "Invalid studio selection: " + k }, 400);
          prefs[k] = v;
        }
      }
      for (const k of ["cameraVisible", "mirror", "muteIntermission", "showBrand", "showLowerThird", "showTicker", "duckMusic", "subjectProtection", "noiseSuppression", "echoCancellation", "autoGainControl", "noiseGate", "compressor", "limiter"]) if (k in value) {
        if (typeof value[k] !== "boolean") return json4({ error: "Invalid studio switch" }, 400);
        prefs[k] = value[k];
      }
      for (const [k, max] of [["micGain", 150], ["mediaGain", 100], ["screenGain", 100], ["musicGain", 100], ["countdown", 60], ["backgroundStrength", 100], ["voiceClarity", 100], ["backgroundVideoId", 999999999]]) if (k in value) {
        const v = value[k];
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max) return json4({ error: "Invalid studio mixer/countdown value" }, 400);
        prefs[k] = v;
      }
      await env.LIVE_STATUS_KV.put(key2, JSON.stringify(prefs));
      await audit(env, cap, "studio.preset.save", "studio");
      return json4({ ok: true });
    }
    if (url.pathname === "/api/media-engine/livekit/connection" && ["GET", "POST"].includes(request.method)) {
      if (!["Super Administrator", "Deputy Super Administrator"].includes(cap.role)) return json4({ error: "Owner or deputy access is required to configure streaming credentials" }, 403);
      if (request.method === "GET") return json4(await liveKitConnectionStatus(env));
      const body = await requireJson(request);
      if (!body) return json4({ error: "Invalid JSON" }, 400);
      if (body.action === "reset") {
        await resetLiveKitConnection(env);
        await audit(env, cap, "livekit.reset", "connection");
        return json4({ ok: true, ...await liveKitConnectionStatus(env) });
      }
      try {
        const existing = body.action === "check" ? await resolveLiveKitConfig(env) : await resolveLiveKitConfig(env).catch(() => null);
        const config = body.action === "check" ? existing : validateCloudConnection({ url: body.url || existing?.LIVEKIT_URL, apiKey: body.apiKey || existing?.LIVEKIT_API_KEY, apiSecret: body.apiSecret || existing?.LIVEKIT_API_SECRET });
        if (!config) return json4({ error: "No streaming connection is saved" }, 409);
        await checkLiveKitConnection(config);
        if (body.action !== "check") {
          await saveLiveKitConnection(env, config);
          await audit(env, cap, "livekit.configure", "connection");
        }
        await recordLiveKitVerification(env, true);
        return json4({ ok: true, ...await liveKitConnectionStatus(env) });
      } catch (e) {
        if (e instanceof LiveKitConnectionError) {
          if (body.action === "check") await recordLiveKitVerification(env, false, e.code);
          return json4({ error: e.message, code: e.code }, e.status);
        }
        return json4({ error: "The saved streaming connection could not be read or updated. Re-enter the connection details to replace it.", code: "connection_storage_failed" }, 503);
      }
    }
    if (url.pathname === "/api/media-engine/status" && request.method === "GET") {
      const services = { database: false, storage: false, kv: false };
      try {
        await env.DB.prepare("SELECT 1 AS ok").first();
        services.database = true;
      } catch (e) {
        console.warn("Media Engine DB health check failed", e);
      }
      try {
        await env.MEDIA_R2.list({ limit: 1 });
        services.storage = true;
      } catch (e) {
        console.warn("Media Engine R2 health check failed", e);
      }
      try {
        await env.LIVE_STATUS_KV.get("__hk_health_probe__");
        services.kv = true;
      } catch (e) {
        console.warn("Media Engine KV health check failed", e);
      }
      const ok = services.database && services.storage && services.kv;
      return json4({ ok, account: "media-broadcast", version: env.MEDIA_ENGINE_VERSION ?? "v1", temporary_media: true, services, livekit_configured: !!await resolveLiveKitConfig(env) }, ok ? 200 : 503);
    }
    if (url.pathname === "/api/media-engine/restream" && request.method === "GET") {
      if (!["Super Administrator", "Deputy Super Administrator"].includes(cap.role)) return json4({ error: "Owner or deputy access is required to manage social streaming destinations" }, 403);
      return json4(await restreamStatus(env));
    }
    if (url.pathname === "/api/media-engine/restream/destination" && request.method === "POST") {
      if (!["Super Administrator", "Deputy Super Administrator"].includes(cap.role)) return json4({ error: "Owner or deputy access is required to manage social streaming destinations" }, 403);
      const b = await requireJson(request);
      if (!b) return json4({ error: "Invalid JSON" }, 400);
      try {
        const destination = String(b.destination ?? "");
        const current = await restreamStatus(env);
        if (current.active?.destinations?.includes(destination)) return json4({ error: "This destination is currently on air. Stop social distribution before editing, disabling or removing its stream key." }, 409);
        if (String(b.action ?? "") === "remove") {
          const state = await restreamStatus(env);
          if (state.active?.destinations?.includes(String(b.destination ?? ""))) return json4({ error: "Stop social distribution before removing an active destination." }, 409);
          const result = await removeDestination(env, String(b.destination ?? ""));
          await audit(env, cap, "restream.destination.remove", "destination", String(b.destination ?? ""));
          return json4({ ok: true, ...result });
        }
        if (b.server_url !== void 0 || b.stream_key !== void 0 || b.url !== void 0) {
          let combined = String(b.url ?? "").trim();
          if (!combined) {
            const server = String(b.server_url ?? "").trim(), streamKey = String(b.stream_key ?? "").trim();
            if (!server || !streamKey || streamKey.length > 512) return json4({ error: "Enter the platform server URL and stream key" }, 400);
            let parsed;
            try {
              parsed = new URL(server);
            } catch {
              return json4({ error: "Enter a valid RTMP or RTMPS server URL" }, 400);
            }
            if (!["rtmp:", "rtmps:"].includes(parsed.protocol) || parsed.username || parsed.password) return json4({ error: "Enter a valid RTMP or RTMPS server URL" }, 400);
            combined = server.replace(/\/+$/, "") + "/" + streamKey.replace(/^\/+/, "");
          }
          const result = await saveDestination(env, String(b.destination ?? ""), combined, Boolean(b.enabled));
          await audit(env, cap, "restream.destination.save", "destination", String(b.destination ?? ""));
          return json4({ ok: true, ...result });
        }
        await setDestinationEnabled(env, String(b.destination ?? ""), Boolean(b.enabled));
        await audit(env, cap, "restream.destination.toggle", "destination", String(b.destination ?? ""));
        return json4({ ok: true });
      } catch (e) {
        return json4({ error: e instanceof Error ? e.message : "Destination could not be saved" }, 400);
      }
    }
    if (url.pathname === "/api/media-engine/restream/start" && request.method === "POST") {
      if (!["Super Administrator", "Deputy Super Administrator"].includes(cap.role)) return json4({ error: "Owner or deputy access is required to start social streaming" }, 403);
      const b = await requireJson(request);
      if (!b) return json4({ error: "Invalid JSON" }, 400);
      try {
        const source = String(b.source ?? "live") === "247" ? "247" : "live";
        const channel = String(b.channel ?? "video") === "radio" ? "radio" : "video";
        const siteBase = "https://heavenlykey.alldaywow247.workers.dev";
        const programmeUrl = source === "247" ? siteBase + "/pages/" + (channel === "radio" ? "radio" : "video") + ".html?egress=1" : void 0;
        const result = await startRestream(env, { source, sessionId: b.session_id ? Number(b.session_id) : void 0, programmeUrl, format: String(b.format ?? "landscape-720"), quality: String(b.quality ?? "balanced"), channel });
        await audit(env, cap, "restream.start", "egress", result.egressId);
        return json4(result, 201);
      } catch (e) {
        return json4({ error: e instanceof Error ? e.message : "Social streaming could not start" }, 503);
      }
    }
    if (url.pathname === "/api/media-engine/restream/stop" && request.method === "POST") {
      if (!["Super Administrator", "Deputy Super Administrator"].includes(cap.role)) return json4({ error: "Owner or deputy access is required to stop social streaming" }, 403);
      try {
        const result = await stopRestream(env);
        await audit(env, cap, "restream.stop", "egress");
        return json4(result);
      } catch (e) {
        return json4({ error: e instanceof Error ? e.message : "Social streaming could not stop" }, 503);
      }
    }
    if (url.pathname === "/api/media-engine/livekit/token" && request.method === "POST") {
      const b = await requireJson(request);
      if (!b) return json4({ error: "Invalid JSON" }, 400);
      const room = String(b.room ?? "").trim();
      const identity = String(b.identity ?? "").trim();
      const publish = Boolean(b.publish);
      if (publish) return json4({ error: "Use a session-bound LiveKit publisher token for an active broadcast." }, 403);
      if (!room || !identity || room.length > 120 || identity.length > 120) return json4({ error: "room and identity are required" }, 400);
      try {
        const { createLiveKitToken: createLiveKitToken2 } = await Promise.resolve().then(() => (init_livekit(), livekit_exports));
        return json4(await createLiveKitToken2(await resolveLiveKitConfig(env) ?? {}, room, identity, publish));
      } catch (e) {
        return json4({ error: e instanceof Error ? e.message : "Live transport unavailable" }, 503);
      }
    }
    if (url.pathname === "/api/media-engine/livekit/publisher-token" && request.method === "POST") {
      const b = await requireJson(request);
      const sessionId = Number(b?.session_id);
      if (!Number.isInteger(sessionId)) return json4({ error: "session_id is required" }, 400);
      const live = await env.DB.prepare("SELECT session_id,status,source_type,source_ref FROM live_sessions WHERE session_id=? AND status IN ('live','reconnecting')").bind(sessionId).first();
      if (!live) return json4({ error: "Live session not active" }, 404);
      if (live.source_type !== "camera" || !String(live.source_ref).startsWith("livekit:")) return json4({ error: "This session is not a LiveKit camera broadcast" }, 409);
      const room = "heavenlykey-live-" + sessionId;
      try {
        const { createLiveKitToken: createLiveKitToken2 } = await Promise.resolve().then(() => (init_livekit(), livekit_exports));
        const token = await createLiveKitToken2(await resolveLiveKitConfig(env) ?? {}, room, "publisher-" + cap.sub, true);
        await env.DB.prepare("UPDATE live_sessions SET last_heartbeat_at=CURRENT_TIMESTAMP WHERE session_id=?").bind(sessionId).run();
        return json4(token);
      } catch (e) {
        return json4({ error: e instanceof Error ? e.message : "Live transport unavailable" }, 503);
      }
    }
    if (url.pathname === "/api/media-engine/studio/capabilities" && request.method === "GET") return json4({
      formats: [
        { key: "landscape-480", label: "Low data 480p", width: 854, height: 480 },
        { key: "portrait-1080", label: "Vertical 1080p", width: 1080, height: 1920 },
        { key: "portrait-720", label: "Vertical 720p", width: 720, height: 1280 },
        { key: "portrait-3-4", label: "Portrait 3:4", width: 810, height: 1080 },
        { key: "landscape-720", label: "Landscape 720p", width: 1280, height: 720 },
        { key: "landscape-1080", label: "Landscape 1080p", width: 1920, height: 1080 },
        { key: "square-720", label: "Square 720p", width: 720, height: 720 },
        { key: "square-1080", label: "Square 1080p", width: 1080, height: 1080 }
      ],
      sources: ["camera", "screen", "video", "audio", "picture", "starting", "break", "ending"],
      production: { composed_output: true, preview_programme: true, scene_switching: true, screen_share: true, audio_mixer: true, programme_recording: true, private_presets: true, resumable_uploads: true, network_loss_advert: true, quality_profiles: ["data", "balanced", "high"] },
      camera: { front: true, rear: true, mirror_preview: true, original_mode: true, device_selection: true, virtual_background_mode: true, moving_video_background: true, subject_protection: true },
      audio: {
        microphone_toggle: true,
        permission_handling: true,
        native_noise_suppression: true,
        echo_cancellation: true,
        auto_gain_control: true,
        voice_enhancement: true,
        high_pass_hz: 70,
        presence_boost_db: null,
        compressor_ratio: 3,
        limiter: true,
        low_pass_hz: null
      },
      branding: { programme_banner: true, official_assets_supported: true },
      takeover: { live_to_prerecorded: true, prerecorded_to_live: true, automatic_24_7_resume: true },
      destinations: ["website_video", "website_radio"],
      transport: { live_camera_ingest: !!await resolveLiveKitConfig(env), external_stream_url: true, prerecorded_playback: true, social_publishing: true, multi_destination_rtmp: true, social_output_follows_studio_orientation: true }
    });
    if (url.pathname === "/api/media" && request.method === "POST") {
      const b = await requireJson(request);
      if (!b) return json4({ error: "Invalid JSON" }, 400);
      const objectKey = String(b.object_key ?? "");
      const type = String(b.media_type ?? "");
      const mime = String(b.mime_type ?? "");
      const size = Number(b.size_bytes ?? 0);
      if (!objectKey || !["image", "audio", "video"].includes(type) || !mime || !Number.isSafeInteger(size) || size < 0 || size > MAX_MEDIA_BYTES) return json4({ error: "Invalid media metadata or size" }, 400);
      const keep = Boolean(b.keep_media);
      const retention = keep ? null : expiryHours(Number(b.retention_hours ?? 48));
      const r = await env.DB.prepare("INSERT INTO media_objects(object_key,media_type,mime_type,size_bytes,status,keep_media,retention_until,created_by) VALUES(?,?,?,?,'pending',?,?,?)").bind(objectKey, type, mime, size, keep ? 1 : 0, retention, cap.sub).run();
      const id = Number(r.meta.last_row_id);
      await audit(env, cap, "media.register", "media", String(id));
      return json4({ media_id: id, retention_until: retention, keep_media: keep }, 201);
    }
    if (url.pathname === "/api/media" && request.method === "GET") {
      const r = await env.DB.prepare("SELECT media_id,object_key,media_type,mime_type,size_bytes,status,keep_media,retention_until,created_at FROM media_objects WHERE status!='deleted' ORDER BY created_at DESC LIMIT 50").all();
      return json4({ items: r.results });
    }
    let m = url.pathname.match(/^\/api\/media\/(\d+)\/keep$/);
    if (m && ["GET", "POST"].includes(request.method)) {
      const media = await env.DB.prepare("SELECT object_key,media_type,status,keep_media,retention_until FROM media_objects WHERE media_id=? AND status!='deleted'").bind(Number(m[1])).first();
      if (!media) return json4({ error: "Media not found" }, 404);
      const available = ["approved", "published"].includes(media.status) && !!await env.MEDIA_R2.head(media.object_key);
      if (request.method === "GET") return json4({ media_id: Number(m[1]), media_type: media.media_type, status: media.status, keep_media: !!media.keep_media, retention_until: media.retention_until, available });
      const b = await requireJson(request);
      if (!b || typeof b.keep !== "boolean") return json4({ error: "Specify a valid keep setting" }, 400);
      if (b.keep && !available) return json4({ error: "Media upload is not complete or the stored file is unavailable" }, 409);
      if (!b.keep && media.status === "published") return json4({ error: "Published radio/TV playlist files must remain retained. Unpublish first; the media file will remain stored." }, 409);
      const retention = b.keep ? null : expiryHours(Number(b.retention_hours ?? 48));
      await env.DB.prepare("UPDATE media_objects SET keep_media=?,retention_until=?,updated_at=CURRENT_TIMESTAMP WHERE media_id=? AND status!='deleted'").bind(b.keep ? 1 : 0, retention, Number(m[1])).run();
      await audit(env, cap, "media.keep", "media", m[1]);
      return json4({ ok: true, media_type: media.media_type, status: media.status, keep_media: b.keep });
    }
    m = url.pathname.match(/^\/api\/media\/(\d+)\/upload-url$/);
    if (m && request.method === "POST") {
      const row = await env.DB.prepare("SELECT object_key,status FROM media_objects WHERE media_id=?").bind(Number(m[1])).first();
      if (!row || row.status === "deleted") return json4({ error: "Media not found" }, 404);
      return json4({ media_id: Number(m[1]), object_key: row.object_key, upload_mode: "multipart-r2", max_bytes: MAX_MEDIA_BYTES, chunk_bytes: 8388608 });
    }
    m = url.pathname.match(/^\/api\/media\/(\d+)\/upload$/);
    if (m && request.method === "PUT") {
      const mediaId = Number(m[1]);
      if (!Number.isInteger(mediaId)) return json4({ error: "Invalid media id" }, 400);
      const row = await env.DB.prepare("SELECT object_key,mime_type,status FROM media_objects WHERE media_id=?").bind(mediaId).first();
      if (!row || row.status === "deleted") return json4({ error: "Media not found" }, 404);
      if (!["pending", "failed"].includes(row.status)) return json4({ error: "This media is already uploaded" }, 409);
      const contentType = request.headers.get("Content-Type") ?? "";
      if (contentType !== row.mime_type) return json4({ error: "Content-Type does not match registered media" }, 415);
      if (!request.body) return json4({ error: "Upload body is required" }, 400);
      const reader = request.body.getReader();
      const chunks = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 26214400) {
          await reader.cancel();
          return json4({ error: "Uploads are limited to 25MB" }, 413);
        }
        chunks.push(part.value);
      }
      if (!size) return json4({ error: "Upload body is empty" }, 400);
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      await env.MEDIA_R2.put(row.object_key, bytes, { httpMetadata: { contentType: row.mime_type } });
      await env.DB.prepare("UPDATE media_objects SET status='approved',size_bytes=?,updated_at=CURRENT_TIMESTAMP WHERE media_id=?").bind(size, mediaId).run();
      await audit(env, cap, "media.upload", "media", String(mediaId));
      return json4({ ok: true, media_id: mediaId, size_bytes: size });
    }
    m = url.pathname.match(/^\/api\/media\/(\d+)\/delete$/);
    if (m && request.method === "POST") {
      const mediaId = Number(m[1]);
      const row = await env.DB.prepare("SELECT object_key,status FROM media_objects WHERE media_id=? AND status!='deleted'").bind(mediaId).first();
      if (!row) return json4({ error: "Media not found" }, 404);
      const deletionRequest = await requireJson(request);
      if (deletionRequest?.protect_broadcast && row.status === "published") return json4({ error: "A published radio or TV recording cannot be deleted by social-media cleanup." }, 409);
      const activeLive = await env.DB.prepare("SELECT session_id FROM live_sessions WHERE status IN ('live','reconnecting') AND (visual_media_id=? OR fallback_media_id=? OR source_ref=?) LIMIT 1").bind(mediaId, mediaId, "media:" + mediaId).first();
      if (activeLive) return json4({ error: "This file is being used by the current live programme. End or switch the programme first." }, 409);
      const scheduled = await env.DB.prepare("SELECT playout_id FROM playout_items WHERE media_id=? AND status IN ('scheduled','playing') AND julianday(ends_at)>julianday('now') LIMIT 1").bind(mediaId).first();
      if (scheduled) return json4({ error: "This file is used by an active or upcoming scheduled programme. Cancel that programme first." }, 409);
      const upload = await env.DB.prepare("SELECT upload_id,status FROM media_uploads WHERE media_id=?").bind(mediaId).first();
      if (upload?.status === "uploading") {
        try {
          await env.MEDIA_R2.resumeMultipartUpload(row.object_key, upload.upload_id).abort();
        } catch {
          return json4({ error: "The active upload could not be stopped safely. Retry before deleting this file." }, 502);
        }
      }
      try {
        await env.MEDIA_R2.delete(row.object_key);
      } catch {
        return json4({ error: "Media storage deletion failed. Nothing was removed." }, 502);
      }
      await env.DB.prepare("UPDATE media_objects SET status='deleted',updated_at=CURRENT_TIMESTAMP WHERE media_id=?").bind(mediaId).run();
      await env.DB.prepare("DELETE FROM media_upload_parts WHERE media_id=?").bind(mediaId).run();
      await env.DB.prepare("DELETE FROM media_uploads WHERE media_id=?").bind(mediaId).run();
      await audit(env, cap, "media.delete", "media", String(mediaId));
      return json4({ ok: true });
    }
    m = url.pathname.match(/^\/api\/media\/(\d+)\/publish$/);
    if (m && request.method === "POST") {
      const b = await requireJson(request);
      if (typeof b?.published !== "boolean") return json4({ error: "Choose publish or unpublish" }, 400);
      const row = await env.DB.prepare("SELECT object_key,media_type,status,keep_media,retention_until FROM media_objects WHERE media_id=?").bind(Number(m[1])).first();
      if (!row || !["approved", "published"].includes(row.status)) return json4({ error: "Upload media before publishing" }, 400);
      if (b.published && (!await env.MEDIA_R2.head(row.object_key) || row.keep_media === 0 && row.retention_until && new Date(row.retention_until) <= /* @__PURE__ */ new Date())) return json4({ error: "Media file is missing or expired" }, 400);
      if (b.published && !["audio", "video"].includes(row.media_type)) return json4({ error: "Only audio or video belongs in the broadcast playlist" }, 400);
      await env.DB.prepare("UPDATE media_objects SET status=?,keep_media=1,retention_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE media_id=?").bind(b.published ? "published" : "approved", Number(m[1])).run();
      await audit(env, cap, b.published ? "media.publish" : "media.unpublish", "media", m[1]);
      return json4({ ok: true });
    }
    if (url.pathname === "/api/broadcast/live" && request.method === "POST") {
      const b = await requireJson(request);
      if (!b) return json4({ error: "Invalid JSON" }, 400);
      const title = String(b.title ?? "Live Broadcast");
      const source = String(b.source_type ?? "camera");
      if (!["camera", "video"].includes(source)) return json4({ error: "Choose a camera stream or an uploaded video" }, 400);
      if (source === "camera") {
        const ref = String(b.source_ref ?? "");
        if (ref.startsWith("livekit:") && !await resolveLiveKitConfig(env)) return json4({ error: "Configure LiveKit before starting camera live" }, 503);
        if (!ref.startsWith("livekit:")) {
          try {
            const stream = new URL(ref);
            if (!isPlaybackURL(ref)) throw new Error();
          } catch {
            return json4({ error: "Use a direct HTTPS media stream, not your radio or video webpage. Camera broadcasting uses the Production studio." }, 400);
          }
        }
      }
      if (source === "video") {
        const id2 = Number(b.visual_media_id ?? String(b.source_ref ?? "").replace(/^media:/, ""));
        const media = await env.DB.prepare("SELECT object_key FROM media_objects WHERE media_id=? AND media_type='video' AND status IN ('approved','published') AND (keep_media=1 OR retention_until IS NULL OR julianday(retention_until)>julianday('now'))").bind(id2).first();
        if (!media || !await env.MEDIA_R2.head(media.object_key)) return json4({ error: "Select an uploaded, available video" }, 400);
        b.visual_media_id = id2;
        b.source_ref = "media:" + id2;
      }
      const destination = String(b.destination ?? "both");
      if (!["radio", "video", "both"].includes(destination)) return json4({ error: "Invalid broadcast destination" }, 400);
      if (b.fallback_media_id) {
        const fallbackId = Number(b.fallback_media_id);
        const fallback = await env.DB.prepare("SELECT object_key FROM media_objects WHERE media_id=? AND media_type='video' AND status IN ('approved','published') AND (keep_media=1 OR retention_until IS NULL OR julianday(retention_until)>julianday('now'))").bind(fallbackId).first();
        if (!Number.isInteger(fallbackId) || !fallback || !await env.MEDIA_R2.head(fallback.object_key)) return json4({ error: "Select an uploaded, available standby advert video" }, 400);
        b.fallback_media_id = fallbackId;
      }
      const active = await env.DB.prepare("SELECT session_id FROM live_sessions WHERE status IN ('live','reconnecting') LIMIT 1").first();
      if (active) return json4({ error: "Another live session is active" }, 409);
      const r = await env.DB.prepare("INSERT INTO live_sessions(title,status,source_type,source_ref,visual_media_id,fallback_media_id,started_at,last_heartbeat_at,created_by,destination) VALUES(?,?,?, ?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?)").bind(title, "live", source, b.source_ref ? String(b.source_ref) : null, b.visual_media_id ? Number(b.visual_media_id) : null, b.fallback_media_id ? Number(b.fallback_media_id) : null, cap.sub, destination).run();
      const id = Number(r.meta.last_row_id);
      await audit(env, cap, "broadcast.start", "live_session", String(id));
      return json4({ session_id: id, status: "live" }, 201);
    }
    if (url.pathname === "/api/broadcast/live" && request.method === "GET") {
      const row = await env.DB.prepare("SELECT * FROM live_sessions WHERE status IN ('live','reconnecting') ORDER BY session_id DESC LIMIT 1").first();
      return json4({ live: row ?? null });
    }
    m = url.pathname.match(/^\/api\/broadcast\/live\/(\d+)\/heartbeat$/);
    if (m && request.method === "POST") {
      const r = await env.DB.prepare("UPDATE live_sessions SET status='live',last_heartbeat_at=CURRENT_TIMESTAMP,reconnect_deadline=NULL WHERE session_id=? AND status IN ('live','reconnecting')").bind(Number(m[1])).run();
      if (!r.meta.changes) return json4({ error: "Live session not active" }, 404);
      return json4({ ok: true });
    }
    m = url.pathname.match(/^\/api\/broadcast\/live\/(\d+)\/switch-to-video$/);
    if (m && request.method === "POST") {
      const b = await requireJson(request);
      if (!b) return json4({ error: "Invalid JSON" }, 400);
      const sessionId = Number(m[1]);
      const mediaId = Number(b.media_id);
      if (!Number.isInteger(sessionId) || !Number.isInteger(mediaId)) return json4({ error: "Invalid session or media id" }, 400);
      const media = await env.DB.prepare("SELECT media_id,object_key,status,media_type,keep_media,retention_until FROM media_objects WHERE media_id=?").bind(mediaId).first();
      if (!media || !["approved", "published"].includes(media.status) || media.media_type !== "video" || media.keep_media === 0 && media.retention_until !== null && media.retention_until <= (/* @__PURE__ */ new Date()).toISOString()) return json4({ error: "Prerecorded video is unavailable" }, 400);
      const live = await env.DB.prepare("SELECT session_id,source_type,source_ref,visual_media_id,status FROM live_sessions WHERE session_id=? AND status IN ('live','reconnecting')").bind(sessionId).first();
      if (!live) return json4({ error: "Live session not active" }, 404);
      const r = await env.DB.prepare("UPDATE live_sessions SET source_type='video',source_ref=?,visual_media_id=?,status='live',last_heartbeat_at=CURRENT_TIMESTAMP,reconnect_deadline=NULL WHERE session_id=? AND status IN ('live','reconnecting')").bind("media:" + mediaId, mediaId, sessionId).run();
      if (!r.meta.changes) return json4({ error: "Live session not active" }, 404);
      await audit(env, cap, "broadcast.switch_to_prerecorded", "live_session", String(sessionId));
      return json4({ ok: true, status: "live", source_type: "video", media_id: mediaId, previous_source: { source_type: live.source_type, source_ref: live.source_ref, visual_media_id: live.visual_media_id } });
    }
    m = url.pathname.match(/^\/api\/broadcast\/live\/(\d+)\/switch-to-livekit$/);
    if (m && request.method === "POST") {
      const sessionId = Number(m[1]);
      if (!Number.isInteger(sessionId)) return json4({ error: "Invalid session id" }, 400);
      if (!await resolveLiveKitConfig(env)) return json4({ error: "LiveKit is not configured" }, 503);
      const live = await env.DB.prepare("SELECT session_id,status,source_type,source_ref FROM live_sessions WHERE session_id=? AND status IN ('live','reconnecting')").bind(sessionId).first();
      if (!live) return json4({ error: "Live session not active" }, 404);
      const r = await env.DB.prepare("UPDATE live_sessions SET source_type='camera',source_ref=?,visual_media_id=NULL,status='live',last_heartbeat_at=CURRENT_TIMESTAMP,reconnect_deadline=NULL WHERE session_id=? AND status IN ('live','reconnecting')").bind("livekit:" + sessionId, sessionId).run();
      if (!r.meta.changes) return json4({ error: "Live session not active" }, 404);
      await audit(env, cap, "broadcast.switch_to_live", "live_session", String(sessionId));
      return json4({ ok: true, status: "live", source_type: "camera", source_ref: "livekit:" + sessionId, session_id: sessionId });
    }
    m = url.pathname.match(/^\/api\/broadcast\/live\/(\d+)\/stop$/);
    if (m && request.method === "POST") {
      const r = await env.DB.prepare("UPDATE live_sessions SET status='ended',ended_at=CURRENT_TIMESTAMP WHERE session_id=? AND status IN ('live','reconnecting')").bind(Number(m[1])).run();
      if (!r.meta.changes) return json4({ error: "Live session not active" }, 404);
      await audit(env, cap, "broadcast.stop", "live_session", m[1]);
      return json4({ ok: true, status: "ended" });
    }
    if (url.pathname === "/api/playout" && request.method === "POST") {
      const b = await requireJson(request);
      if (!b) return json4({ error: "Invalid JSON" }, 400);
      const media = Number(b.media_id);
      const start = new Date(String(b.starts_at));
      const end = new Date(String(b.ends_at));
      if (!Number.isInteger(media) || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return json4({ error: "Invalid playout window" }, 400);
      if (end.getTime() <= Date.now()) return json4({ error: "Programme end time must be in the future" }, 400);
      const mr = await env.DB.prepare("SELECT media_id,keep_media,retention_until FROM media_objects WHERE media_id=? AND status IN ('approved','published')").bind(media).first();
      if (!mr) return json4({ error: "Media unavailable" }, 400);
      if (!mr.keep_media && mr.retention_until && new Date(mr.retention_until).getTime() < end.getTime()) return json4({ error: "This temporary media will expire before the programme ends. Keep the file permanently or choose an earlier programme time." }, 409);
      if (!await env.MEDIA_R2.head((await env.DB.prepare("SELECT object_key FROM media_objects WHERE media_id=?").bind(media).first())?.object_key ?? "")) return json4({ error: "Media file is missing from storage" }, 400);
      const conflict = await env.DB.prepare("SELECT playout_id,title,starts_at,ends_at FROM playout_items WHERE status IN ('scheduled','playing') AND julianday(starts_at)<julianday(?) AND julianday(ends_at)>julianday(?) ORDER BY starts_at LIMIT 1").bind(end.toISOString(), start.toISOString()).first();
      if (conflict) return json4({ error: "This time overlaps with another programme: " + conflict.title + " (" + conflict.starts_at + " \u2013 " + conflict.ends_at + ")." }, 409);
      const title = String(b.title ?? "Prerecorded Broadcast").trim().slice(0, 200) || "Prerecorded Broadcast";
      const r = await env.DB.prepare("INSERT INTO playout_items(media_id,title,starts_at,ends_at,created_by) VALUES(?,?,?,?,?)").bind(media, title, start.toISOString(), end.toISOString(), cap.sub).run();
      const id = Number(r.meta.last_row_id);
      await audit(env, cap, "playout.schedule", "playout", String(id));
      return json4({ playout_id: id }, 201);
    }
    if (url.pathname === "/api/playout" && request.method === "GET") {
      const r = await env.DB.prepare("SELECT * FROM playout_items WHERE status IN ('scheduled','playing') ORDER BY starts_at LIMIT 50").all();
      return json4({ items: r.results });
    }
    if (url.pathname === "/api/social/accounts" && request.method === "POST") {
      const b = await requireJson(request);
      if (!b) return json4({ error: "Invalid JSON" }, 400);
      const ch = String(b.channel_name ?? "");
      const ref = String(b.provider_account_ref ?? "");
      if (!ch || !ref) return json4({ error: "Missing account fields" }, 400);
      const r = await env.DB.prepare("INSERT INTO social_accounts(channel_name,provider_account_ref,automatable,created_by) VALUES(?,?,?,?)").bind(ch, ref, b.automatable === false ? 0 : 1, cap.sub).run();
      return json4({ account_id: Number(r.meta.last_row_id) }, 201);
    }
    if (url.pathname === "/api/social/accounts" && request.method === "GET") {
      const r = await env.DB.prepare("SELECT account_id,channel_name,status,automatable,created_at FROM social_accounts ORDER BY account_id DESC LIMIT 100").all();
      return json4({ items: r.results });
    }
    if (url.pathname === "/api/distribution/jobs" && request.method === "GET") {
      const r = await env.DB.prepare("SELECT * FROM distribution_jobs ORDER BY created_at DESC LIMIT 100").all();
      return json4({ items: r.results });
    }
    if (url.pathname === "/api/recordings" && request.method === "POST") {
      const b = await requireJson(request);
      if (!b) return json4({ error: "Invalid JSON" }, 400);
      const objectKey = String(b.object_key ?? "");
      const title = String(b.title ?? "Live Recording");
      const sessionId = b.live_session_id == null ? null : Number(b.live_session_id);
      if (!objectKey || !title || title.length > 200) return json4({ error: "Invalid recording metadata" }, 400);
      const head = await env.MEDIA_R2.head(objectKey);
      if (!head) return json4({ error: "Recording object not found in Media R2" }, 400);
      const keep = Boolean(b.keep_recording);
      const retention = keep ? null : expiryHours(Number(b.retention_hours ?? 48));
      const r = await env.DB.prepare("INSERT INTO recordings(object_key,title,live_session_id,keep_recording,retention_until,created_by) VALUES(?,?,?,?,?,?)").bind(objectKey, title, sessionId, keep ? 1 : 0, retention, cap.sub).run();
      const id = Number(r.meta.last_row_id);
      const accounts = await env.DB.prepare("SELECT account_id,channel_name FROM social_accounts WHERE status='connected' AND automatable=1").all();
      for (const a of accounts.results) await env.DB.prepare("INSERT OR IGNORE INTO distribution_jobs(recording_id,account_id,channel_name) VALUES(?,?,?)").bind(id, a.account_id, a.channel_name).run();
      await audit(env, cap, "recording.register", "recording", String(id));
      return json4({ recording_id: id, retention_until: retention, distribution_jobs: accounts.results.length }, 201);
    }
    let rm = url.pathname.match(/^\/api\/recordings\/(\d+)\/keep$/);
    if (rm && request.method === "POST") {
      const b = await requireJson(request);
      const keep = Boolean(b?.keep);
      const retention = keep ? null : expiryHours(Number(b?.retention_hours ?? 48));
      const r = await env.DB.prepare("UPDATE recordings SET keep_recording=?,retention_until=? WHERE recording_id=? AND status!='deleted'").bind(keep ? 1 : 0, retention, Number(rm[1])).run();
      if (!r.meta.changes) return json4({ error: "Recording not found" }, 404);
      return json4({ ok: true });
    }
    rm = url.pathname.match(/^\/api\/recordings\/(\d+)$/);
    if (rm && request.method === "DELETE") {
      const row = await env.DB.prepare("SELECT object_key FROM recordings WHERE recording_id=? AND status!='deleted'").bind(Number(rm[1])).first();
      if (!row) return json4({ error: "Recording not found" }, 404);
      try {
        await env.MEDIA_R2.delete(row.object_key);
      } catch {
        return json4({ error: "Recording storage deletion failed" }, 502);
      }
      await env.DB.prepare("UPDATE recordings SET status='deleted',retention_until=CURRENT_TIMESTAMP WHERE recording_id=?").bind(Number(rm[1])).run();
      return json4({ ok: true });
    }
    if (url.pathname === "/api/campaigns" && request.method === "POST") {
      const b = await requireJson(request);
      if (!b) return json4({ error: "Invalid JSON" }, 400);
      const when = new Date(String(b.scheduled_for));
      if (!Number.isFinite(when.getTime()) || when.getTime() <= Date.now()) return json4({ error: "Choose a future planning time" }, 400);
      const title = String(b.title ?? "").trim();
      if (!title || title.length > 200) return json4({ error: "Enter a title up to 200 characters" }, 400);
      if (b.media_id != null) {
        const id = Number(b.media_id);
        if (!Number.isSafeInteger(id)) return json4({ error: "Invalid media" }, 400);
        const file = await env.DB.prepare("SELECT object_key FROM media_objects WHERE media_id=? AND status IN ('approved','published') AND (keep_media=1 OR julianday(retention_until)>julianday('now'))").bind(id).first();
        if (!file || !await env.MEDIA_R2.head(file.object_key)) return json4({ error: "Choose an available uploaded file" }, 400);
      }
      const r = await env.DB.prepare("INSERT INTO campaigns(title,scheduled_for,media_id,created_by) VALUES(?,?,?,?)").bind(title, when.toISOString(), b.media_id != null ? Number(b.media_id) : null, cap.sub).run();
      return json4({ campaign_id: Number(r.meta.last_row_id) }, 201);
    }
    {
      const match = url.pathname.match(/^\/api\/campaigns\/(\d+)\/cancel$/);
      if (match && request.method === "POST") {
        const r = await env.DB.prepare("UPDATE campaigns SET status='cancelled' WHERE campaign_id=? AND status='scheduled'").bind(Number(match[1])).run();
        if (!r.meta.changes) return json4({ error: "Active plan not found" }, 404);
        await audit(env, cap, "campaign.cancel", "campaign", match[1]);
        return json4({ ok: true });
      }
    }
    if (url.pathname === "/api/campaigns" && request.method === "GET") {
      const r = await env.DB.prepare("SELECT * FROM campaigns ORDER BY scheduled_for LIMIT 100").all();
      return json4({ items: r.results });
    }
    if (url.pathname === "/api/media-engine/cleanup" && request.method === "POST") {
      const expired = await env.DB.prepare("SELECT media_id,object_key FROM media_objects WHERE status NOT IN ('deleted','published') AND keep_media=0 AND retention_until IS NOT NULL AND julianday(retention_until)<=julianday('now') LIMIT 50").all();
      for (const x of expired.results) {
        try {
          await env.MEDIA_R2.delete(x.object_key);
        } catch {
          continue;
        }
        await env.DB.prepare("UPDATE media_objects SET status='deleted',updated_at=CURRENT_TIMESTAMP WHERE media_id=?").bind(x.media_id).run();
      }
      return json4({ deleted: expired.results.length });
    }
    return json4({ error: "Not found" }, 404);
  },
  async scheduled(_controller, env) {
    const expiredUploads = await env.DB.prepare("SELECT u.media_id,u.upload_id,m.object_key FROM media_uploads u JOIN media_objects m ON m.media_id=u.media_id WHERE u.status='uploading' AND julianday(u.expires_at)<=julianday('now') LIMIT 10").all();
    for (const row of expiredUploads.results) {
      try {
        await env.MEDIA_R2.resumeMultipartUpload(row.object_key, row.upload_id).abort();
        await env.DB.prepare("UPDATE media_uploads SET status='expired' WHERE media_id=?").bind(row.media_id).run();
      } catch {
        console.warn("Expired multipart cleanup will retry", row.media_id);
      }
    }
    const expiredRecordings = await env.DB.prepare("SELECT recording_id,object_key FROM recordings WHERE status!='deleted' AND keep_recording=0 AND retention_until IS NOT NULL AND julianday(retention_until)<=julianday('now') LIMIT 50").all();
    for (const r of expiredRecordings.results) {
      try {
        await env.MEDIA_R2.delete(r.object_key);
      } catch {
        continue;
      }
      await env.DB.prepare("UPDATE recordings SET status='deleted' WHERE recording_id=?").bind(r.recording_id).run();
      await env.DB.prepare("UPDATE distribution_jobs SET status='cancelled',last_error='Recording retention expired',updated_at=CURRENT_TIMESTAMP WHERE recording_id=? AND status IN ('pending','processing','failed')").bind(r.recording_id).run();
    }
    const stale = await env.DB.prepare("SELECT session_id FROM live_sessions WHERE status='live' AND last_heartbeat_at<=datetime('now','-180 seconds')").all();
    for (const x of stale.results) {
      await env.DB.prepare("UPDATE live_sessions SET status='reconnecting',reconnect_deadline=datetime('now','+10 minutes') WHERE session_id=? AND status='live'").bind(x.session_id).run();
    }
    await env.DB.prepare("UPDATE live_sessions SET status='ended',ended_at=CURRENT_TIMESTAMP WHERE status='reconnecting' AND reconnect_deadline<=datetime('now')").run();
    await env.DB.prepare("UPDATE playout_items SET status='playing' WHERE status='scheduled' AND julianday(starts_at)<=julianday('now') AND julianday(ends_at)>julianday('now')").run();
    await env.DB.prepare("UPDATE playout_items SET status='completed' WHERE status='playing' AND julianday(ends_at)<=julianday('now')").run();
    const expired = await env.DB.prepare("SELECT media_id,object_key FROM media_objects WHERE status!='deleted' AND keep_media=0 AND retention_until IS NOT NULL AND julianday(retention_until)<=julianday('now') LIMIT 50").all();
    for (const x of expired.results) {
      try {
        await env.MEDIA_R2.delete(x.object_key);
      } catch {
        continue;
      }
      await env.DB.prepare("UPDATE media_objects SET status='deleted',updated_at=CURRENT_TIMESTAMP WHERE media_id=?").bind(x.media_id).run();
    }
  }
};
var index_default = {
  scheduled: engine.scheduled,
  async fetch(request, env) {
    let response;
    try {
      response = await engine.fetch(request, env);
    } catch {
      return Response.json({ error: "Studio could not complete this request. Check the existing Worker bindings and retry." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const headers2 = new Headers(response.headers);
    headers2.set("Referrer-Policy", "no-referrer");
    headers2.set("X-Content-Type-Options", "nosniff");
    headers2.set("X-Frame-Options", "DENY");
    const path = new URL(request.url).pathname;
    if (path === "/" || path.startsWith("/auth/") || path.startsWith("/api/")) headers2.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: headers2 });
  }
};
export {
  index_default as default
};
