import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {eligibleMedia} from '../../media-engine/src/public-broadcast';

describe('broadcast playlist permanence',()=>{
 it('passes a published-media exemption into the public eligibility query',async()=>{
  let captured='',value:number|undefined;
  const env={DB:{prepare(sql:string){captured=sql;return {bind(id:number){value=id;return {async first(){return {media_id:id,status:'published',keep_media:0,retention_until:'2020-01-01'};}}}};}}} as any;
  const row=await eligibleMedia(env,91);
  expect(value).toBe(91);
  expect(row?.media_id).toBe(91);
  expect(captured).toContain("m.status='published' OR m.keep_media=1");
  expect(captured).toContain("m.status='published' OR EXISTS");
  expect(captured).toContain("m.status IN ('approved','published')");
 });
 it('checks that inactive temporary files remain excluded from public broadcasts',()=>{
  const src=readFileSync('media-engine/src/public-broadcast.ts','utf8');
  expect(src).toContain("julianday(m.retention_until)>julianday('now')");
  expect(src).toContain("m.status IN ('approved','published')");
  expect(src).toContain("m.status='published' OR EXISTS");
  expect(src).toContain("status='published' OR keep_media=1");
 });
 it('prevents automatic deletion and manual removal of KEEP status for a published playlist',()=>{
  const source=readFileSync('media-engine/src/index.ts','utf8');
  expect(source).toContain("if(!b.keep&&media.status==='published')");
  expect(source).toContain("status NOT IN ('deleted','published')");
  expect(source).toContain('SET status=?,keep_media=1,retention_until=NULL');
 });
});
