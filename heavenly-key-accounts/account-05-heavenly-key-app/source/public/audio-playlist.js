/* Pure opt-in playlist navigation. No media is fetched or played here. */
import {HYMNS,approvedHymn} from './audio-hymn-catalog.js';
export const PLAYLIST_MODES=Object.freeze(['off','next','repeat']);
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
