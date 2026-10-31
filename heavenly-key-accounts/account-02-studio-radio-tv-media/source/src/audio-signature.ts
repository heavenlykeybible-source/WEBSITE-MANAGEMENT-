/** Sanity-check common audio container headers, not a full malware/transcoding scan. */
export function supportedAudioSignature(mime:string, bytes:Uint8Array):boolean {
 if(bytes.length<4)return false;
 const eq=(offset:number,signature:number[])=>signature.every((byte,index)=>bytes[offset+index]===byte);
 const normalized=mime.toLowerCase().split(';')[0].trim();
 switch(normalized){
  case 'audio/mpeg':return eq(0,[73,68,51])||(bytes[0]===255&&(bytes[1]&224)===224&&(bytes[1]&6)!==0);
  case 'audio/mp4':return bytes.length>=12&&eq(4,[102,116,121,112]);
  case 'audio/aac':return bytes[0]===255&&(bytes[1]&246)===240;
  case 'audio/ogg':return eq(0,[79,103,103,83]);
  case 'audio/wav':case 'audio/x-wav':return bytes.length>=12&&eq(0,[82,73,70,70])&&eq(8,[87,65,86,69]);
  case 'audio/webm':return eq(0,[26,69,223,163]);
  case 'audio/flac':return eq(0,[102,76,97,67]);
  default:return false;
 }
}
