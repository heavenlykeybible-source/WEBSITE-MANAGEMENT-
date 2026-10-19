import {describe,it,expect} from 'vitest';
import {youtubeVideoId,isPlaybackURL} from '../../media-engine/src/public-broadcast';
describe('broadcast source resolution',()=>{
 it('recognizes trusted YouTube links without accepting impersonated hosts or injected ids',()=>{for(const url of ['https://www.youtube.com/watch?v=r5dtPSD4D-k','https://youtu.be/r5dtPSD4D-k','https://www.youtube.com/live/r5dtPSD4D-k','https://www.youtube.com/embed/r5dtPSD4D-k'])expect(youtubeVideoId(url)).toBe('r5dtPSD4D-k');for(const url of ['https://youtube.com.evil.test/watch?v=r5dtPSD4D-k','https://example.test/watch?v=r5dtPSD4D-k','https://www.youtube.com/watch?v=<script>','http://www.youtube.com/watch?v=r5dtPSD4D-k'])expect(youtubeVideoId(url)).toBeNull();});
 it('rejects website pages as direct media while retaining real media URLs',()=>{expect(isPlaybackURL('https://heavenlykey.alldaywow247.workers.dev/pages/radio')).toBe(false);expect(isPlaybackURL('https://heavenlykey.alldaywow247.workers.dev/api/broadcast/media/1/object')).toBe(true);expect(isPlaybackURL('https://stream.example.test/live.mp4')).toBe(true);expect(isPlaybackURL('https://user:secret@example.test/live.mp4')).toBe(false);});
});
