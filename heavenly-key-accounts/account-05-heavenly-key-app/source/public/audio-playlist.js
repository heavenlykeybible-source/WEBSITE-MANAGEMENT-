/* Pure opt-in playlist navigation. No media is fetched or played here. */
import {KJV_BOOKS} from './bible-catalog.js';
import {approvedTrack,adjacentChapter,bookId} from './audio-bible-catalog.js';
import {HYMNS,approvedHymn} from './audio-hymn-catalog.js';
export const PLAYLIST_MODES=Object.freeze(['off','next','repeat']);
export function nextApprovedBible(manifest,ref,mode,origin='https://global.heavenlykey.org'){
 if(!['next','repeat'].includes(mode)||!ref)return null;
 let candidate=ref;
 const max=KJV_BOOKS.reduce((n,b)=>n+b.chapters,0);
 for(let count=0;count<max;count++){
  let next=adjacentChapter(candidate.book,candidate.chapter,1);
  if(!next&&mode==='repeat')next={book:bookId(KJV_BOOKS[0]),chapter:1};
  if(!next)return null;
  candidate=next;
  if(mode==='next'&&candidate.book===ref.book&&candidate.chapter===ref.chapter)return null;
  if(approvedTrack(manifest,candidate.book,candidate.chapter,origin))return candidate;
  if(candidate.book===ref.book&&candidate.chapter===ref.chapter)return null;
 }
 return null;
}
export function nextApprovedHymn(manifest,index,style,mode){
 if(!['next','repeat'].includes(mode)||!Number.isSafeInteger(index)||index<0||index>=HYMNS.length)return null;
 const max=mode==='repeat'?HYMNS.length:HYMNS.length-1;
 for(let offset=1;offset<=max;offset++){
  const n=index+offset;
  if(mode==='next'&&n>=HYMNS.length)return null;
  const next=n%HYMNS.length,hymn=HYMNS[next];
  if(approvedHymn(manifest,hymn.id,style))return {index:next,id:hymn.id};
 }
 return null;
}
