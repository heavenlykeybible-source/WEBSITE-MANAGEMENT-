/* User-controlled encrypted device notebook. It is separate from Community accounts. */
const encoder=new TextEncoder(),decoder=new TextDecoder(),ITERATIONS=210000;
const b64=bytes=>btoa(String.fromCharCode(...bytes));
function unb64(text){if(typeof text!=='string'||text.length>1800000||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw Error('Invalid notebook file.');return Uint8Array.from(atob(text),x=>x.charCodeAt(0));}
async function keyFor(passphrase,salt,usage){
 if(!globalThis.crypto?.subtle)throw Error('Encrypted saving is unavailable in this browser. Open the installed secure app, or use a temporary session.');
 if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>200)throw Error('Use a separate notebook passphrase of 12–200 characters.');
 const material=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,usage);
}
export async function sealNotebook(data,passphrase){
 const plaintext=encoder.encode(JSON.stringify(data));if(plaintext.length>500000)throw Error('The notebook is too large to save.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await keyFor(passphrase,salt,['encrypt']);
 const bytes=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plaintext));
 // Chunk conversion avoids stack overflow on long journals.
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return {version:1,iterations:ITERATIONS,salt:b64(salt),iv:b64(iv),ciphertext:btoa(binary)};
}
export async function openNotebook(envelope,passphrase){
 if(!envelope||envelope.version!==1||envelope.iterations!==ITERATIONS)throw Error('Unsupported notebook file.');
 const salt=unb64(envelope.salt),iv=unb64(envelope.iv),bytes=unb64(envelope.ciphertext);
 if(salt.length!==16||iv.length!==12||bytes.length<16)throw Error('Invalid notebook file.');
 try{const key=await keyFor(passphrase,salt,['decrypt']);return JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv},key,bytes)));}
 catch{throw Error('The passphrase is incorrect or this notebook is damaged.');}
}
