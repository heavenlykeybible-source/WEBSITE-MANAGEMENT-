const targets = Object.freeze({
  'control.heavenlykey.org': 'https://heavenlykey-owner-dashboard.emmanuel2026miracle.workers.dev',
  'studio.heavenlykey.org': 'https://heavenlykey.alldaywow247.workers.dev',
  'app.heavenlykey.org': 'https://heavenly-key-app-recovery.alldaywow247.workers.dev',
  'global.heavenlykey.org': 'https://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev',
  'bible.heavenlykey.org': 'https://onlinebible.heavenlykeybible.workers.dev'
});

export async function route(request, upstreamFetch = fetch) {
  const publicUrl = new URL(request.url);
  // Deliver only the owner-requested chat assets without changing the production API or bindings.
  if(['heavenlykey.org','www.heavenlykey.org','studio.heavenlykey.org','global.heavenlykey.org','bible.heavenlykey.org','app.heavenlykey.org'].includes(publicUrl.hostname)&&/^\/(?:js\/)?cms-runtime-20261015\.(js|css)$/.test(publicUrl.pathname)){
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
    const assetUrl='https://heavenlykey-owner-dashboard.emmanuel2026miracle.workers.dev/'+publicUrl.pathname.split('/').pop()+publicUrl.search;
    const asset=await upstreamFetch(new Request(assetUrl,{method:request.method}));
    const result=new Response(asset.body,asset);
    result.headers.set('Cache-Control','no-cache, max-age=0, must-revalidate');
    result.headers.set('X-Content-Type-Options','nosniff');
    return result;
  }
  if(publicUrl.hostname==='studio.heavenlykey.org'&&publicUrl.pathname==='/')return Response.redirect(publicUrl.origin+'/pages/admin.html#studio',302);
  const origin = targets[publicUrl.hostname];
  if (!origin) return new Response('Unknown ministry portal', {status: 404});
  const headers = new Headers(request.headers);
  const incomingOrigin = headers.get('Origin');
  // Keep the same-origin write rule before forwarding to the fixed upstream.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    if (headers.get('Sec-Fetch-Site') === 'cross-site' || (incomingOrigin && incomingOrigin !== publicUrl.origin)) {
      return new Response('Cross-site action denied', {status: 403});
    }
  }
  if (incomingOrigin === publicUrl.origin) headers.set('Origin', origin);
  headers.delete('Host');
  headers.delete('X-Forwarded-Host');
  const upstreamUrl = new URL(publicUrl.pathname + publicUrl.search, origin);
  const forwarded = new Request(upstreamUrl, request);
  const init = new Request(forwarded, {headers, redirect: 'manual'});
  let response;
  try {
    response = await upstreamFetch(init);
  } catch {
    return new Response('The ministry portal is temporarily unavailable.', {
      status: 503, headers: {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store'}
    });
  }
  if (response.status === 101) return response;
  const location = response.headers.get('Location');
  if (!location) return response;
  const redirect = new URL(location, upstreamUrl);
  if (redirect.origin !== origin) return response;
  const result = new Response(response.body, response);
  result.headers.set('Location', publicUrl.origin + redirect.pathname + redirect.search + redirect.hash);
  return result;
}

export default {fetch(request) {return route(request);}};
