// One shared, testable intent gate for Account 4 assistant proposals.
// No authorization can be inferred from quoted instructions, examples or a question.
export function aiActionAllowed(input,priorTask=''){
 const message=String(input||'').trim();
 const task=String(priorTask||'').trim();
 const verbs=/\b(?:create|build|develop|fix|repair|change|edit|update|upgrade|import|deploy|publish|upload|remove|delete|configure|implement|restore|transfer|add|make|prepare|propose|save)\b/i;
 const continuation=/^(?:continue|proceed|carry on|go ahead|resume)(?:[.! ]*)$/i;
 const prohibited=/\b(?:do\s*not|don't|dont|never|stop|avoid|without|no\s+need\s+to|not\s+to)\s+(?:(?:automatically|yet|now|anything|anymore)\s+)?(?:create|build|develop|fix|repair|change|edit|update|upgrade|import|deploy|publish|upload|remove|delete|configure|implement|restore|transfer|add|make|prepare|propose|save)\b/i;
 const inquiry=/^(?:how|why|what|when|where|who|which|whether|can|could|would|should|is|are|do|does|did|tell\s+me|explain\b|show\s+me\s+how)\b/i;
 const quoted=/^(?:for\s+example|e\.?g\.?,?|suppose|imagine|what\s+if)\b/i;
 if(continuation.test(message))return !!task&&verbs.test(task)&&!prohibited.test(task)&&!inquiry.test(task)&&!quoted.test(task);
 if(!message||prohibited.test(message)||inquiry.test(message)||quoted.test(message))return false;
 return verbs.test(message);
}
