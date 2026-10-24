// Chat protocol primitives. No persistent message storage or encryption yet.
export const CHAT_TYPES=Object.freeze(['text','system','reaction']);
export function validateChatMessage(value){
 if(!value||typeof value!=='object')throw new Error('Invalid message');
 if(value.type!=='text')throw new Error('Only text messages are currently supported');
 if(typeof value.text!=='string'||!value.text.trim()||value.text.length>4000)throw new Error('Message must contain 1–4000 characters');
 return {type:'text',text:value.text.trim()};
}
export function sanitizeDisplayName(name){
 if(typeof name!=='string')throw new Error('Invalid name');
 const trimmed=name.trim();
 if(!trimmed||trimmed.length>80)throw new Error('Invalid name');
 return trimmed;
}
