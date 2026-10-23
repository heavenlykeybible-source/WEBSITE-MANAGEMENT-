import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {publicProgramme} from '../heavenly-key-accounts/account-02-studio-radio-tv-media/source/src/public-broadcast.ts';
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE live_sessions(session_id INTEGER,title TEXT,status TEXT,source_type TEXT,source_ref TEXT,visual_media_id INTEGER,fallback_media_id INTEGER,destination TEXT,reconnect_deadline TEXT,last_heartbeat_at TEXT);
CREATE TABLE media_objects(media_id INTEGER,object_key TEXT,status TEXT,media_type TEXT,mime_type TEXT,keep_media INTEGER,retention_until TEXT);
CREATE TABLE playout_items(media_id INTEGER,status TEXT,starts_at TEXT,ends_at TEXT,title TEXT);
CREATE TABLE broadcast_settings(channel TEXT,playlist_enabled INTEGER);
INSERT INTO live_sessions VALUES(1,'Radio message','live','camera','https://streams.example/radio.mp3',NULL,NULL,'radio',NULL,datetime('now'));
INSERT INTO live_sessions VALUES(2,'TV programme','live','camera','https://streams.example/video.mp4',NULL,NULL,'video',NULL,datetime('now'));
INSERT INTO broadcast_settings VALUES('radio',1),('video',1);`);
function prepare(sql){let args=[];const wrapper={bind(...a){args=a;return wrapper},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}}};return wrapper}
const env={DB:{prepare},LIVE_STATUS_KV:{get:async()=>null}};
let data=await (await publicProgramme(new Request('https://account2.example/api/broadcast/programme?channel=radio'),env)).json();
assert.equal(data.title,'Radio message','Newer TV-only broadcasts must not hide active radio');assert.equal(data.items[0].type,'audio');
db.exec("UPDATE live_sessions SET status='reconnecting',reconnect_deadline=datetime('now','+5 minutes'),fallback_media_id=7 WHERE session_id=1;INSERT INTO media_objects VALUES(7,'fallback.mp3','published','audio','audio/mpeg',1,NULL)");
data=await (await publicProgramme(new Request('https://account2.example/api/broadcast/programme?channel=radio'),env)).json();assert.equal(data.mode,'reconnecting');assert.equal(data.items[0].mediaId,7);
db.close();console.log('Account 2 radio tests passed: channel selection and audio fallback with actual SQLite queries.');
