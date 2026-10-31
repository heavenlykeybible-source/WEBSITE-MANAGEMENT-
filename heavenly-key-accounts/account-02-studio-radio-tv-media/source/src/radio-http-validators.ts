/** RFC 9110 ETag comparisons for public audio responses. */
export function radioNotModified(header:string|null,etag:string):boolean{
 if(!header)return false;
 const normalized=etag.startsWith('W/')?etag.slice(2):etag;
 return header.split(',').some(value=>{
  const part=value.trim();
  return part==='*'||(part.startsWith('W/')?part.slice(2):part)===normalized;
 });
}
export function radioCanResumeRange(header:string|null,etag:string):boolean{
 if(!header)return true;
 return !header.startsWith('W/')&&header===etag;
}
