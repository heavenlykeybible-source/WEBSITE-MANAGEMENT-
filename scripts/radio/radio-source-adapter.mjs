// Adds authenticated, listener-only radio access to the existing Media Engine.
// Every other request and every scheduled/queue handler stays with the original.
export function radioSourceAdapter(upstream) {
  return {
    ...upstream,
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const listener = ['GET', 'HEAD'].includes(request.method) && /^\/api\/broadcast\/(?:programme|live|media\/\d+\/object)$/.test(url.pathname);
      const viewer = request.method === 'POST' && url.pathname === '/api/media-engine/livekit/viewer-token';
      if ((listener || viewer) && env.RADIO_PUBLIC_API_KEY) {
        const presented = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
        const enc = new TextEncoder();
        const [a, b] = await Promise.all([env.RADIO_PUBLIC_API_KEY, presented].map(value => crypto.subtle.digest('SHA-256', enc.encode(value)).then(buffer => new Uint8Array(buffer))));
        let diff = 0;
        for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
        if (presented && diff === 0) {
          const headers = new Headers(request.headers);
          headers.set('X-Heavenly-Key-Internal', 'media-engine-public-v1');
          url.searchParams.set('channel', 'radio');
          request = new Request(url, new Request(request, {headers}));
        }
      }
      return upstream.fetch.call(upstream, request, env, ctx);
    }
  };
}
