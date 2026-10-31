/** Bound optional KV playlist settings so malformed records cannot degrade public radio requests. */
export function readRadioPlaylistOrder(raw:string|null|undefined):number[]{
 if(!raw||raw.length>4096)return [];
 let data:unknown;
 try{data=JSON.parse(raw)}catch{return []}
 if(!Array.isArray(data)||data.length>50)return [];
 const seen=new Set<number>(),ids:number[]=[];
 for(const value of data){
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1)return [];
  if(!seen.has(value)){seen.add(value);ids.push(value)}
 }
 return ids;
}
