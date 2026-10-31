// Account 7 radio edge proxy. Account 2 remains the sole broadcast source of truth.
const PUBLIC_MARKER = "media-engine-public-v1";
const ROUTES = {
  programme: /^\/api\/broadcast\/programme$/,
  live: /^\/api\/broadcast\/live$/,
  media: /^\/api\/broadcast\/media\/(\d+)\/object$/,
  livekit: /^\/api\/media-engine\/livekit\/viewer-token$/
};
const securityHeaders = {
  "Cache-Control": "no-store",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"
};
function jsonError(message, status) {
  return Response.json({ error: message }, { status, headers: securityHeaders });
}
function resolveOrigin(value) {
  try {
    const origin = new URL(value);
    if (origin.protocol !== "https:" || origin.username || origin.password ||
        origin.pathname !== "/" || origin.search || origin.hash) return null;
    return origin;
  } catch { return null; }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const isProgramme = ROUTES.programme.test(url.pathname);
    const isLive = ROUTES.live.test(url.pathname);
    const mediaMatch = ROUTES.media.exec(url.pathname);
    const isLiveKit = ROUTES.livekit.test(url.pathname);
    const apiPath = url.pathname.startsWith("/api/");
    if (!apiPath) {
      if (!env.ASSETS) return new Response("Radio assets are not configured.", { status: 503 });
      return env.ASSETS.fetch(request);
    }
    if (!(isProgramme || isLive || mediaMatch || isLiveKit)) return jsonError("Not found", 404);
    if (isProgramme && method !== "GET") return jsonError("Method not allowed", 405);
    if (isLive && method !== "GET") return jsonError("Method not allowed", 405);
    if (mediaMatch && !["GET", "HEAD"].includes(method)) return jsonError("Method not allowed", 405);
    if (isLiveKit && method !== "POST") return jsonError("Method not allowed", 405);
    if (isProgramme && [...url.searchParams.keys()].some(k => k !== "channel")) return jsonError("Invalid query", 400);
    if (isProgramme && url.searchParams.get("channel") !== "radio") return jsonError("Radio channel required", 400);
    if (!isProgramme && url.search) return jsonError("Unexpected query", 400);

    const origin = resolveOrigin(env.MEDIA_PUBLIC_ORIGIN);
    if (!origin) return jsonError("Broadcast origin is not configured or is invalid", 503);
    let targetPath;
    if (isProgramme) targetPath = "/api/broadcast/programme?channel=radio";
    else if (isLive) targetPath = "/api/broadcast/live";
    else if (mediaMatch) targetPath = url.pathname;
    else targetPath = "/api/media-engine/livekit/viewer-token";

    const headers = new Headers({ "X-Heavenly-Key-Internal": PUBLIC_MARKER, "Accept": "application/json, audio/*, video/*, application/octet-stream" });
    if (request.headers.has("Range") && mediaMatch) headers.set("Range", request.headers.get("Range"));
    if (request.headers.has("If-Range") && mediaMatch) headers.set("If-Range", request.headers.get("If-Range"));
    const upstreamUrl = new URL(targetPath, origin);
    let upstream;
    try {
      upstream = await fetch(new Request(upstreamUrl, {
        method,
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(20000)
      }));
    } catch {
      return jsonError("Broadcast engine is temporarily unreachable", 502);
    }
    if (upstream.status >= 300 && upstream.status < 400) return jsonError("Unexpected broadcast redirect", 502);

    const responseHeaders = new Headers(upstream.headers);
    for (const name of ["set-cookie", "set-cookie2", "access-control-allow-origin", "access-control-allow-credentials", "access-control-allow-headers", "access-control-allow-methods"]) responseHeaders.delete(name);
    for (const [name, value] of Object.entries(securityHeaders)) responseHeaders.set(name, value);
    responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") || (isProgramme || isLive || isLiveKit ? "application/json; charset=utf-8" : "application/octet-stream"));
    return new Response(method === "HEAD" ? null : upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
  }
};
