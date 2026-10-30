// Pure, server-side AI chat tool selection, separately regression tested.
export function account4NeedsReadTools(message){
 const m=String(message||'').trim();
 // Only a request about managed resources can disclose site metadata via tools.
 if(!m || /^(?:hi|hello|hey|thanks|thank you|good (?:morning|afternoon|evening|night)|ok(?:ay)?|bye|how are you)[!.?\s]*$/i.test(m))return false;
 if(/^(?:what (?:is|are)|explain|define)\s+(?:a|an|the)\s+(?:website|webpage|worker|repository|database|deployment|api|domain|cloudflare|github)(?:\s*\?)?$/i.test(m))return false;
 // General advice should remain a normal conversation, not an Account 4 resource scan.
 if(/^(?:how (?:do|can|should|would)|what (?:is|are|does)|why|explain|tell me about|can you explain)\b/i.test(m)&&!/\b(?:my|our|this|connected|saved|existing|account|worker|github|website|site|repository|project|dashboard|cloudflare|proposal|waiting room|deployment)\b/i.test(m))return false;
 return /\b(?:my|our|this|connected|saved|existing|account|worker|github|website|site|repository|project|dashboard|cloudflare|proposal|waiting room|deployment|inspect|scan|check|list|read|find|show)\b/i.test(m);
}
