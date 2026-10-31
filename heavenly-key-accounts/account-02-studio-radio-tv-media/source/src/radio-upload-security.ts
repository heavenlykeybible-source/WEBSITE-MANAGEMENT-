/** Account 2 upload metadata guard: prevent traversal, URL confusion and key reuse. */
export function validRadioObjectKey(key:string):boolean{
  if(typeof key!=='string'||key.length<4||key.length>240)return false;
  if(key.startsWith('/')||key.endsWith('/')||key.includes('..')||key.includes('\\\\'))return false;
  if(/[^a-zA-Z0-9/_ .()\-]/.test(key))return false;
  if(key.split('/').some(part=>!part||part==='.'||part==='..'||part.trim()!==part))return false;
  return true;
}
export function validRadioRetentionHours(value:unknown):value is number{
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>=1&&value<=24*365;
}
