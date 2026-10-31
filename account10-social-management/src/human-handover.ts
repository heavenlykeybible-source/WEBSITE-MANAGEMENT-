// Shared, deliberately narrow intent detector for an explicit request to contact a human.
// Do not infer a request from an ordinary mention of the Evangelist.
export const requestsHumanMinistryContact=(input:string):boolean=>{
 const text=input.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().slice(0,4000);
 return /\b(?:speak|talk|chat|connect|communicate|meet)\s+(?:to|with)\s+(?:(?:the|a)\s+)?(?:evangelist(?:\s+emmanuel)?|pastor|human|real person|person|operator|someone from (?:the )?ministry|staff member)\b/.test(text)
 || /\b(?:want|need|like|request)\s+(?:to\s+)?(?:speak|talk|chat|connect)\s+(?:to|with)\s+(?:evangelist|emmanuel|a human|a real person|the ministry)\b/.test(text)
 || /\bconnect\s+me\s+with\s+(?:a\s+)?(?:human|real person|operator|staff member)\b/.test(text)
 || /\b(?:human\s+(?:takeover|agent|support)|live\s+(?:agent|person)|contact\s+evangelist\s+emmanuel|i\s+want\s+to\s+talk\s+to\s+evangelist\s+emmanuel)\b/.test(text);
};

// Routes explicit menu choice text without claiming a message was delivered to its recipient.
export const contactTargetForMinistryMessage=(input:string):'ministry_agent'|'speak_to_evangelist'|null=>{
 const text=input.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().slice(0,4000);
 if(/\b(?:want|need|like|request|please|can i|could i|may i)?\s*(?:to\s+)?(?:speak|talk|chat|connect|communicate|meet)\s+(?:to|with)\s+(?:the\s+)?(?:evangelist\s+emmanuel(?:\s+ogheneochuko\s+adiohwo)?|evangelist)\b/.test(text))return 'speak_to_evangelist';
 if(/\b(?:want|need|like|request|please|can i|could i|may i)?\s*(?:to\s+)?(?:speak|talk|chat|connect|communicate|meet)\s+(?:to|with)\s+(?:a\s+|an\s+|the\s+)?(?:heavenly\s+key\s+evangelistic\s+movement\s+agent|ministry\s+agent|agent|human|real\s+person|staff\s+member)\b/.test(text))return 'ministry_agent';
 return requestsHumanMinistryContact(text)?'ministry_agent':null;
};
