import {VERIFIED_HYMNS} from './faith-content.js';
export const FEATURED_HYMN=Object.freeze({
 id:'faith-of-our-fathers',title:'Faith of Our Fathers',
 author:'Heavenly Key Evangelistic Movement (AI-generated rendition)',
 theme:'Faith of our fathers and Christian heritage',scripture:'Hebrews 12:1–2',
 stanza:'This Heavenly Key audio rendition has been supplied for inclusion in the hymn library. Its exact sung words have not been transcribed or independently reviewed.',
 textSource:'https://hymnary.org/text/faith_of_our_fathers_living_still',audioUrl:null
});
export const HYMNS=Object.freeze([...VERIFIED_HYMNS.map(h=>Object.freeze({...h,id:h.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')})),FEATURED_HYMN]);
export const AUDIO_STYLES=Object.freeze(['choir','solo','instrumental','featured']);
export const AUDIO_CACHE='hk-audio-hymnal-v1';
export function approvedFeatured(manifest){
 const featured=manifest?.featured,rights=featured?.rights||{},t=featured?.track;
 if(manifest?.version!==1||featured?.publicationApproved!==true||t?.approved!==true||
 t?.aiGenerated!==true||t?.mimeType!=='audio/mp4'||t?.sha256!=='ec37b08d79a00b227f5fc4166e2b2af721312e5d1754a9374ea0949b58b5e6d7'||
 !['ownerPermission','aiDisclosure','generationDistribution','recordingDistribution','streaming'].every(k=>rights[k]===true))return null;
 if(typeof t.performer!=='string'||t.performer.trim().length<3)return null;
 try{const url=new URL(t.url);
  if(url.origin!=='https://audio.heavenlykey.org'||url.pathname!=='/hymns/faith-of-our-fathers/featured.m4a'||url.search||url.hash||url.username||url.password)return null;
  return Object.freeze({url:url.href,id:FEATURED_HYMN.id,style:'featured',performer:t.performer,aiGenerated:true,
   offlineApproved:rights.offline===true&&t.offlineApproved===true,mimeType:t.mimeType});
 }catch{return null;}
}
export function approvedHymn(manifest,id,style){
 if(id===FEATURED_HYMN.id)return style==='featured'?approvedFeatured(manifest):null;
 if(!HYMNS.some(h=>h.id===id)||!AUDIO_STYLES.includes(style)||
 manifest?.version!==1||manifest.publicationApproved!==true||manifest.narration!=='human')return null;
 const rights=manifest.rights||{};
 if(!['lyrics','tune','arrangement','performerConsent','recordingDistribution','streaming'].every(k=>rights[k]===true))return null;
 const t=manifest.tracks?.[id]?.[style];
 if(!t||t.approved!==true||t.mimeType!=='audio/mpeg'||
 typeof t.performer!=='string'||t.performer.trim().length<2)return null;
 try{const url=new URL(t.url);
 if(url.origin!=='https://audio.heavenlykey.org'||url.pathname!=='/hymns/'+id+'/'+style+'.mp3'||url.search||url.hash||url.username||url.password)return null;
 const offlineApproved=rights.offline===true&&t.offlineApproved===true;
 return Object.freeze({url:url.href,performer:t.performer,id,style,offlineApproved});
 }catch{return null;}
}
export function coverage(manifest){
 let count=0;for(const h of HYMNS)for(const s of AUDIO_STYLES)if(approvedHymn(manifest,h.id,s))count++;
 return count;
}
