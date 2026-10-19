/** A public viewer; only ministry community origins may embed this route. */
export function handleCommunityPlayer(request:Request):Response{
 const channel=new URL(request.url).searchParams.get("channel")==="video"?"video":"radio";
 const label=channel==="radio"?"Radio":"TV";
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Faith of Our Fathers ${label}</title><link rel="stylesheet" href="/css/community-player.css?v=1.0.0"></head><body><section data-broadcast-player="${channel}" data-simple-player><strong>Faith of Our Fathers · ${label}</strong><p data-programme-title>Checking the programme…</p><${channel==="radio"?"audio":"video"} preload="none" playsinline></${channel==="radio"?"audio":"video"}><div data-simple-play-control></div><p data-player-status role="status">Preparing player…</p></section><script src="/js/community-player.js?v=1.0.1" defer></script></body></html>`;
 return new Response(html,{headers:{
  "Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin",
  "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; connect-src 'self' https: wss:; media-src 'self' blob: https:; img-src 'self'; frame-src https://www.youtube-nocookie.com; frame-ancestors https://global.heavenlykey.org https://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev; object-src 'none'; base-uri 'none'; form-action 'none'"
 }});
}
