/* Audio Bible release gate. Do not treat track URLs or unchecked human-rights claims as licensed. */
import {KJV_BOOKS,KJV_TOTAL_CHAPTERS} from './bible-catalog.js';
export const AUDIO_CHAPTER_TOTAL=KJV_TOTAL_CHAPTERS;
export const AUDIO_CACHE='hk-approved-audio-bible-v1';
export const AUDIO_TYPES=Object.freeze({'audio/mpeg':'.mp3','audio/mp4':'.m4a','audio/ogg':'.ogg'});
export function bookId(book){return book.name.toLowerCase().replaceAll(' ','-');}
export function chapterInBible(book,chapter){
 const entry=KJV_BOOKS.find(b=>bookId(b)===book);
 return !!entry&&Number.isInteger(Number(chapter))&&Number(chapter)>=1&&Number(chapter)<=entry.chapters&&String(Number(chapter))===String(chapter);
}
export function approvedTrack(manifest,book,chapter,siteOrigin='https://global.heavenlykey.org'){
 if(!chapterInBible(book,chapter)||manifest?.version!==1||manifest?.translation!=='KJV'||manifest?.language!=='en-NG'||(!['human','authorized_voice_clone'].includes(manifest?.narration))||manifest?.publicationApproved!==true)return null;
 const rights=manifest.rights||{};
 if(!['bibleText','narratorConsent','recordingDistribution','streaming'].every(key=>rights[key]===true))return null;
 if(manifest.narration==='authorized_voice_clone' && (rights.voiceCloneConsent!==true||rights.aiDisclosure!==true))return null;
 if(typeof manifest.narrator?.displayName!=='string'||manifest.narrator.displayName.trim().length<3)return null;
 const track=manifest.tracks?.[book]?.[String(chapter)];
 if(!track||track.approved!==true||typeof track.url!=='string'||!Object.hasOwn(AUDIO_TYPES,track.mimeType))return null;
 let url;
 try{
  const parsed=new URL(track.url,siteOrigin);
  const validHost=parsed.origin==='https://audio.heavenlykey.org';
  const validPath=parsed.pathname==='/bible/'+book+'/'+chapter+AUDIO_TYPES[track.mimeType];
  if(!validHost||!validPath||parsed.search||parsed.hash||parsed.username||parsed.password)return null;
  url=parsed.href;
 }catch{return null;}
 const offlineApproved=rights.offline===true&&track.offlineApproved===true;
 return Object.freeze({url,mimeType:track.mimeType,book,chapter:Number(chapter),narrator:manifest.narrator.displayName,narration:manifest.narration,offlineApproved});
}
export function audioCoverage(manifest,siteOrigin='https://global.heavenlykey.org'){
 let total=0;
 for(const b of KJV_BOOKS)for(let c=1;c<=b.chapters;c++)if(approvedTrack(manifest,bookId(b),c,siteOrigin))total++;
 return total;
}
export function adjacentChapter(book,chapter,direction){
 const idx=KJV_BOOKS.findIndex(b=>bookId(b)===book);
 if(idx<0||![-1,1].includes(direction))return null;
 const current=KJV_BOOKS[idx],next=Number(chapter)+direction;
 if(next>=1&&next<=current.chapters)return {book,chapter:next};
 const nextIndex=idx+direction;
 if(nextIndex<0||nextIndex>=KJV_BOOKS.length)return null;
 const target=KJV_BOOKS[nextIndex];
 return {book:bookId(target),chapter:direction===1?1:target.chapters};
}
