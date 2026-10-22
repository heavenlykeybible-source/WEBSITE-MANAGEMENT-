/* Explicitly approved instrumental bed only. Public-domain melody != recording permission. */
export const BACKGROUND_ID='faith-of-our-fathers-instrumental';
export function approvedBackground(manifest){
 if(manifest?.version!==1||manifest?.publicationApproved!==true||manifest?.track?.id!==BACKGROUND_ID)return null;
 const rights=manifest.rights||{};
 if(!['compositionPublicDomain','arrangementRights','masterRecordingRights','streaming','loopUse'].every(k=>rights[k]===true))return null;
 const t=manifest.track;
 if(t.approved!==true||t.instrumentalOnly!==true||t.mimeType!=='audio/mpeg'||
 typeof t.performer!=='string'||t.performer.trim().length<2||typeof t.url!=='string')return null;
 try{
  const u=new URL(t.url);
  if(u.origin!=='https://audio.heavenlykey.org'||u.pathname!=='/background/faith-of-our-fathers-instrumental.mp3'||u.search||u.hash||u.username||u.password)return null;
  return Object.freeze({url:u.href,performer:t.performer,id:t.id});
 }catch{return null;}
}
