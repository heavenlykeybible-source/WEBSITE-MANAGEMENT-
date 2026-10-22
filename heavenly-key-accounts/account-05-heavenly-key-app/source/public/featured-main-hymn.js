/* Optional featured recording in the main hymn library; never autoplay. */
import {approvedHymn,FEATURED_HYMN} from './audio-hymn-catalog.js';
import {createLockScreenSession} from './lock-screen-media.js';
const id=s=>document.getElementById(s);
const player=id('main-featured-hymn-player');
const container=id('main-featured-hymn-playback');
const status=id('main-featured-hymn-status');
if(!player||!container||!status)throw Error('Featured hymn player markup unavailable.');
const mediaSession=createLockScreenSession(player);
window.addEventListener('pagehide',()=>{
 mediaSession.dispose();player.pause();player.removeAttribute('src');
});
try{
 const response=await fetch('audio-hymn-manifest.json',{cache:'no-cache'});
 if(!response.ok)throw Error('Publication catalogue unavailable');
 const manifest=await response.json();
 const approved=approvedHymn(manifest,FEATURED_HYMN.id,'featured');
 if(!approved){
  status.textContent='Recording received and prepared. Streaming activation awaits permanent audio hosting and rights verification. Use the supplied original listening file for now.';
 }else{
  player.preload='none';
  player.src=approved.url;
  container.hidden=false;
  mediaSession.update({
   title:FEATURED_HYMN.title,
   artist:approved.performer+' · AI-generated',
   album:'Heavenly Key Audio Hymnal',
   artwork:new URL('assets/discipleship-icon-192.png',location.href).href
  });
  status.textContent='Heavenly Key AI-generated hymn ready. Press Play to listen.';
 }
}catch{
 status.textContent='Audio catalogue temporarily unavailable. The hymn listing and historic hymns remain accessible.';
}
