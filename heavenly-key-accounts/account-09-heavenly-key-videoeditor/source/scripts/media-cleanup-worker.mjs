// Separate scheduled Worker: never expose a public cleanup endpoint.
export default {
  async scheduled(_event, env) {
    if (!env.DB || !env.MEDIA || typeof env.MEDIA.delete !== 'function') throw Error('Missing cleanup bindings');
    const pending = (await env.DB.prepare('SELECT id,user_id,r2_key FROM media WHERE deleted=1 ORDER BY created_at ASC LIMIT 50').all()).results;
    let cleaned = 0, failed = 0, invalid = 0;
    for (const item of pending) {
      if (typeof item.user_id !== 'string' || !item.user_id ||
          typeof item.r2_key !== 'string' || !item.r2_key.startsWith(item.user_id + '/')) {
        invalid++;
        continue;
      }
      try {
        try { await env.MEDIA.delete(item.r2_key); }
        catch {
          await new Promise(resolve => setTimeout(resolve, 200 + Math.floor(Math.random() * 150)));
          await env.MEDIA.delete(item.r2_key);
        }
        const result = await env.DB.prepare('DELETE FROM media WHERE id=? AND user_id=? AND deleted=1 AND r2_key=?')
          .bind(item.id,item.user_id,item.r2_key).run();
        cleaned += Number(result.meta.changes);
      } catch { failed++; }
    }
    console.log(JSON.stringify({event:'account9_media_cleanup',cleaned,failed,invalid}));
    if (failed) throw Error('R2 cleanup incomplete; next scheduled run will retry');
  }
};
