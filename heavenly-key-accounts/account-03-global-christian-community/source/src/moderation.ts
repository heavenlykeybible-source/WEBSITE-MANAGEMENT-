import type {Env,ModerationResult} from "./types";

const normalize=(value:string)=>value.normalize("NFKC").toLowerCase().replace(/[._*~\u200b]+/g," ").replace(/\s+/g," ").trim();
const excerpt=(value:string)=>value.replace(/\s+/g," ").trim().slice(0,180);

// Owner-configured terms are separated by commas, semicolons or newlines.
// Punctuation/whitespace between letters is ignored, but matching respects word boundaries.
function findUnapprovedTerm(raw:string,configured?:string){
  const source=String(raw||"").normalize("NFKC").toLowerCase();
  const terms=String(configured||"").split(/[\n;,]+/).map(value=>normalize(value).replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim()).filter(term=>term.length>=2);
  for(const term of terms){
    const flexible=term.split(/\s+/).map(word=>Array.from(word).join("[\\s\\p{P}\\p{S}\\u200b]*")).join("[\\s\\p{P}\\p{S}\\u200b]+");
    if(new RegExp("(?<![\\p{L}\\p{N}])"+flexible+"(?![\\p{L}\\p{N}])","u").test(source))return term;
  }
  return null;
}

const severeObscenity=[
  /\bf+u+c+k+\b/i,/\bc+u+n+t+\b/i,/\bm+o+t+h+e+r+f+u+c+k+/i
];
const explicitSexual=[
  /\bporn(?:ography)?\b/i,/\bnudes?\b/i,/\bsex\s*(?:video|photo|chat|cam)\b/i,
  /\bexplicit\s+(?:sexual|nude)\b/i,/\bonlyfans\b/i
];
const threats=[
  /\bi(?:'|’)ll\s+(?:kill|shoot|stab|hurt)\s+you\b/i,
  /\b(?:kill|murder|shoot|stab)\s+(?:him|her|them|you)\b/i,
  /\byou\s+(?:will|are going to)\s+die\b/i
];
const scam=[
  /\bsend\s+(?:me\s+)?(?:money|cash|bitcoin|crypto).{0,35}(?:blessing|miracle|prophecy|unlock)/i,
  /\bguaranteed\s+(?:profit|return|income).{0,25}\b/i,
  /\bpay\s+(?:a\s+)?fee.{0,30}(?:receive|claim|unlock).{0,25}(?:prayer|blessing|miracle|grant)/i,
  /\bseed\s+of\s+faith.{0,40}(?:account|transfer|send|pay)/i
];
const hateOrSlur=[
  /\b(?:all|every)\s+(?:members?|people)\s+of\s+.{1,35}\s+(?:are|should be)\s+(?:killed|destroyed|hated|animals?|vermin)\b/i,
  /\b(?:race|tribe|ethnic(?:ity)?|nationality).{0,30}\b(?:inferior|subhuman|vermin)\b/i
];
const nonChristianTerms=/\b(?:islam|muslim|quran|allah|hindu(?:ism)?|buddh(?:a|ism)|traditional\s+religion|idol\s+worship|occult\s+worship|orisha|shrine\s+worship)\b/i;
const allowedChristianContext=/\b(?:converted|conversion|came\s+to\s+christ|accepted\s+jesus|gave\s+my\s+life\s+to\s+christ|former\s+muslim|left\s+islam|testimony|evangelism|mission(?:ary|s)?|biblical\s+teaching|christian\s+apologetics|pray\s+for|salvation\s+of)\b/i;
const promoteOrDebate=/\b(?:join|convert\s+to|follow|promote|defend|prove|debate|argument|versus|vs\.?|better\s+than|true\s+religion|worship|praise|pray\s+to)\b/i;
// A negated mention is not recruitment. Do not exempt an entire mixed-intent message.
const rejectIdolatry=/^(?:please\s+)?(?:do\s+not|don['’]t|never|avoid|stop|reject|condemn)\s+(?:practi[cs](?:e|ing)\s+|promot(?:e|ing)\s+)?(?:idol\s+worship|worship(?:ping)?\s+idols?)[.!\s]*$/i;
const targetedAbuse=/\b(?:idiot|stupid|worthless|useless|fool)\b.{0,35}\b(?:you|your|he|she|they)\b|\b(?:you|your)\b.{0,35}\b(?:idiot|stupid|worthless|useless|fool)\b/i;

export function moderateText(raw:string,surface:"post"|"message"|"profile"|"space"|"group",configuredBlockedWords?:string):ModerationResult{
  const text=normalize(String(raw||""));const reasons:string[]=[];
  if(!text)return {decision:"allow",category:"clean",reasons:[],safeExcerpt:""};
  if(findUnapprovedTerm(raw,configuredBlockedWords))return {decision:"block",category:"unapproved_word",reasons:["unapproved_word_match"],safeExcerpt:excerpt(raw)};
  const immediate:[string,RegExp[]][]=[
    ["explicit_pornography",explicitSexual],
    ["severe_obscenity",severeObscenity],
    ["direct_threat",threats],
    ["hate_or_slur",hateOrSlur],
    ["scam_or_spiritual_financial_exploitation",scam]
  ];
  for(const [category,rules] of immediate)if(rules.some(r=>r.test(text))){
    if(category==="explicit_pornography"&&/^(?:porn(?:ography)? is (?:wrong|sinful|harmful)|(?:do not|don['’]t|never) (?:watch|promote|share) porn(?:ography)?)[.!\s]*$/i.test(text))continue;
    if(category==="explicit_pornography"&&/\b(?:recover(?:y|ing)|overcome|overcame|delivered|addiction|avoid|against|repent|freedom from)\b/.test(text)&&!/\b(?:watch|buy|download|send|sell|link|join)\b/.test(text))return {decision:"hold",category:"sensitive_testimony_review",reasons:["Sensitive testimony needs context review."],safeExcerpt:excerpt(raw)};
    return {decision:"block",category,reasons:[category],safeExcerpt:excerpt(raw)};
  }
  if(nonChristianTerms.test(text)&&promoteOrDebate.test(text)&&!allowedChristianContext.test(text)&&!rejectIdolatry.test(text)){
    return {decision:"hold",category:"non_christian_religious_promotion_or_debate",reasons:["This Christian community does not host promotion of non-Christian worship or inter-religious debate."],safeExcerpt:excerpt(raw)};
  }
  const links=(text.match(/https?:\/\//g)||[]).length;
  if(links>=4)reasons.push("excessive_links");
  if(targetedAbuse.test(text))reasons.push("targeted_insult");
  if(/\b(?:dm me|inbox me|contact me).{0,35}\b(?:investment|profit|opportunity|loan)\b/i.test(text))reasons.push("suspicious_solicitation");
  if(reasons.length)return {decision:"hold",category:reasons[0],reasons,safeExcerpt:excerpt(raw)};
  return {decision:"allow",category:"clean",reasons:[],safeExcerpt:excerpt(raw)};
}

export async function recordModeration(env:Env,userId:number|null,surface:string,sourceId:number|null,result:ModerationResult,contentType?:string){
  if(result.decision==="allow")return;
  await env.DB.prepare("INSERT INTO moderation_events(user_id,surface,source_id,decision,category,reasons,excerpt,content_type) VALUES(?,?,?,?,?,?,?,?)")
    .bind(userId,surface,sourceId,result.decision,result.category,JSON.stringify(result.reasons),result.safeExcerpt,contentType||surface).run();
  await env.DB.prepare("INSERT INTO notifications(user_id,kind,title,body,href) SELECT user_id,'safety_flag','Automated safety flag','Text checks flagged an activity. Review context before taking account action.','/safety.html' FROM users WHERE role IN ('moderator','administrator','owner') AND status='active'").run();
}


