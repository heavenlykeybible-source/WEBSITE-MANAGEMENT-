// Account 7: dedicated Radio Pages Worker. Bind MEDIA_SERVICE to Account 2 Worker "heavenlykey-media".
// Keep broadcasting credentials and databases on Account 2; expose only its public read endpoints.
const allowed = /^\/api\/broadcast\/(?:programme|live|media\/\d+\/object)$/;
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/broadcast/')) {
      if (!['GET','HEAD'].includes(request.method) || !allowed.test(url.pathname)) {
        return new Response('Not found', {status:404});
      }
      if (!env.MEDIA_SERVICE || typeof env.MEDIA_SERVICE.fetch !== 'function') {
        return Response.json({error:'Radio broadcast service is not connected.'},{status:503,headers:{'Cache-Control':'no-store'}});
      }
      const upstream = new URL(url.pathname + url.search, 'https://heavenlykey-media.internal');
      const headers = new Headers();
      headers.set('X-Heavenly-Key-Internal','media-engine-public-v1');
      if (request.headers.has('Range')) headers.set('Range',request.headers.get('Range'));
      const response = await env.MEDIA_SERVICE.fetch(new Request(upstream,{method:request.method,headers}));
      const outgoing = new Headers(response.headers);
      outgoing.set('Cache-Control','no-store');
      return new Response(response.body,{status:response.status,headers:outgoing});
    }
    if (!env.ASSETS) return new Response('Radio site assets are not configured.',{status:503});
    return env.ASSETS.fetch(request);
  }
};
