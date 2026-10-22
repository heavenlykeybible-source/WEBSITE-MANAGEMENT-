// One compact catalogue shared by the browser and Worker. No image assets.
export const CATEGORIES = [
 ['business','Business'],['ministry','Ministry'],['faith','Faith'],['revival','Revival'],
 ['reviver','Reviver'],['prayer','Prayer'],['rapture','Rapture'],['eternity','Eternity'],
 ['salvation','Salvation'],['jesus','Jesus Christ'],['repentance','Repentance'],['gospel','The Gospel'],
 ['holiness','Holiness'],['bible-study','Bible Study'],['testimony','Testimony'],['encouragement','Encouragement'],
 ['discipleship','Discipleship'],['missions','Missions & Evangelism'],['family','Christian Family'],
 ['worship','Worship & Thanksgiving'],
 ['holy-bible','The Holy Bible'],['godhead','God & the Godhead'],['new-birth','New Birth'],
 ['righteousness','Righteousness'],['faith-in-god','Faith in God'],['water-baptism','Water Baptism'],
 ['holy-spirit-baptism','Holy Ghost Baptism'],['divine-healing','Divine Healing'],
 ['deliverance','Deliverance'],['church','The Church'],['fellowship','Christian Fellowship'],
 ['marriage','Christian Marriage'],['youth','Christian Youth'],['second-coming','Second Coming of Christ'],
 ['resurrection','Resurrection'],['judgment','Judgment'],['heaven','Heaven'],['hell','Hell'],
 ['end-time','End-Time Revival'],['fathers','Faith of Our Fathers'],['fasting','Fasting'],
 ['prayer-guide','Prayer Guides'],['evangelism','Evangelism'],['holy-living','Holy Living'],
 ['christian-service','Christian Service']
];
export const POST_GUIDES = [
 {id:'blank',name:'Write freely',kind:'any',title:'',body:''},
 {id:'scripture-card',name:'Scripture encouragement',kind:'design_card',title:'GOD IS FAITHFUL',body:'A short word of encouragement for someone today.\n\nGod’s Word reminds us to continue in faith and obedience.'},
 {id:'salvation-card',name:'Salvation invitation',kind:'design_card',title:'JESUS IS THE ANSWER',body:'Come to Jesus in repentance and faith. His invitation is for you today.'},
 {id:'reviver-card',name:'Reviver call',kind:'design_card',title:'LET THE FIRE OF REVIVAL BURN',body:'Lord, revive Your work in our hearts. Raise believers devoted to prayer, holiness and evangelism.'},
 {id:'prayer-card',name:'Prayer points',kind:'design_card',title:'LET US PRAY',body:'Prayer focus:\n1. A renewed hunger for God.\n2. Strength to obey His Word.\n3. Salvation of souls across the nations.'},
 {id:'mission-card',name:'Mission report',kind:'article',title:'Taking Christ to the Nations',body:'Introduction\n\nWhere we went and whom we served\n\nThe gospel shared\n\nTestimonies and lessons\n\nPrayer needs and next steps\n\nConclusion'},
 {id:'study',name:'Bible study',kind:'article',title:'Bible Study: Our Foundation in Christ',body:'Key Bible text:\n\nIntroduction:\n\n1. What the passage teaches\n\n2. How Christ is revealed\n\n3. Practical application\n\nQuestions for reflection:\n\nConclusion:'},
 {id:'sermon',name:'Sermon outline',kind:'article',title:'Sermon: A Call to Faith',body:'Main Bible text:\n\nIntroduction:\n\nPoint 1:\n\nPoint 2:\n\nPoint 3:\n\nConclusion:\n\nInvitation to respond:'},
 {id:'devotional',name:'Daily devotional',kind:'article',title:'Today with God',body:'Scripture reading:\n\nThought for today:\n\nHow to apply this truth:\n\nPrayer:'},
 {id:'belief',name:'What We Believe',kind:'article',title:'What We Believe: The Holy Bible',body:'Biblical foundation:\n\nWhat this doctrine teaches:\n\nWhy it matters to Christian living:\n\nQuestions and reflection:\n\nConclusion:'},
 {id:'testimony',name:'Testimony',kind:'article',title:'To God Be the Glory',body:'Before:\n\nWhat happened:\n\nThe lesson of faith:\n\nThanksgiving:'}
];
export const FEATURED_CARD_PRESETS = [
 ['Scripture','card-0','faith'],['Reviver','card-49','reviver'],['Prayer','card-193','prayer'],
 ['Gospel','card-290','salvation'],['Mission','card-337','missions'],['Hope','card-432','encouragement']
];
export const PALETTES = [
  ['Royal Promise','#173b78','#081c40','#ffffff','#ffdc75'],
  ['Wine & Gold','#781d3b','#3d1026','#ffffff','#ffdf82'],
  ['Living Water','#075e80','#063449','#ffffff','#a8edf1'],
  ['Sunrise Hope','#fff0ce','#ffd7a8','#422c31','#9d3e19'],
  ['Midnight Prayer','#232d67','#101738','#ffffff','#e7c878'],
  ['Scripture Garden','#1d634c','#10382d','#ffffff','#d6edb8'],
  ['Nations Light','#e8f0ff','#c7d9fb','#173b73','#7b2449'],
  ['Glory Rays','#fff5dc','#f8df9b','#513013','#855413'],
  ['Quiet Grace','#f4eafa','#dccbec','#492b60','#785094'],
  ['Ocean Peace','#def6f2','#afe4dc','#124e49','#216f66'],
  ['Covenant Blue','#243f98','#182963','#ffffff','#aee1ff'],
  ['White & Wine','#fff7f4','#f1dedb','#6e2338','#a04758'],
  // New themes are append-only. Previously published card-0 through card-575 remain stable.
  ['Sapphire Revival','#0d285c','#2b246a','#ffffff','#f3d08c'],
  ['Wine Crown','#772446','#361638','#ffffff','#ffe5aa'],
  ['Golden Dawn','#fff3d0','#edc47c','#4d2e3e','#995631'],
  ['Midnight Intercession','#242b66','#151b46','#ffffff','#d9c8ff'],
  ['Ivory Scripture','#fffaf0','#e9dbc3','#382e3c','#846037'],
  ['Emerald Covenant','#175b52','#0d383d','#ffffff','#e5d096'],
  ['Royal Nations','#214fa5','#122f70','#ffffff','#ffdc86'],
  ['Rose of Grace','#fff0ef','#f0cacb','#542d46','#994c72'],
  ['Living Waters','#086077','#083d57','#ffffff','#b8eff1'],
  ['Eternal Glory','#573e85','#292053','#ffffff','#f7d6a2'],
  ['Word of Life','#225380','#173354','#ffffff','#c6e7fb'],
  ['Pure Promise','#fffef8','#e5e6df','#293a57','#97723d']
];
export const PREMIUM_START = 12;
export const LAYOUTS = [['classic','Classic'],['frame','Double Frame'],['banner','Banner'],['arch','Arch'],['corner','Corner Flourish'],['ribbon','Ribbon']];
export const PATTERNS = [['plain','Clean'],['rays','Light Rays'],['dots','Fine Dots'],['waves','Waves'],['diamonds','Diamonds'],['stripes','Stripes'],['rings','Rings'],['stars','Star Pattern']];
export const TEMPLATE_COUNT = PALETTES.length * LAYOUTS.length * PATTERNS.length;
export function templateAt(id) {
  const n=Number(String(id).replace(/^card-/,''));
  if(!/^card-\d+$/.test(String(id))||!Number.isInteger(n)||n<0||n>=TEMPLATE_COUNT) throw Error('Choose a valid Design Card.');
  const themeIndex=Math.floor(n/(LAYOUTS.length*PATTERNS.length));
  const palette=PALETTES[themeIndex];
  const layout=LAYOUTS[Math.floor(n/PATTERNS.length)%LAYOUTS.length],pattern=PATTERNS[n%PATTERNS.length];
  return {id:'card-'+n,palette,layout,pattern,themeIndex,premium:themeIndex>=PREMIUM_START,name:palette[0]+' · '+layout[1]+' · '+pattern[1]};
}
export function normalizeDesign(raw={}) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Choose valid Design Card settings.');
  const id=raw.templateId||'card-0';templateAt(id);
  const choice=(key,values,fallback)=>{const v=raw[key]||fallback;if(!values.includes(v))throw Error('Invalid Design Card '+key+'.');return v;};
  return {templateId:String(id),alignment:choice('alignment',['left','center','right'],'center'),fontSize:choice('fontSize',['standard','large','spacious'],'standard'),size:choice('size',['auto','square','portrait','landscape','social','facebook'],'auto'),decoration:choice('decoration',['subtle','normal','bold'],'normal')};
}
export function parseVideoLink(value) {
  let u;try{u=new URL(String(value).trim());}catch{throw Error('Paste a valid YouTube or Facebook video link.');}
  if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Use an HTTPS YouTube or Facebook video link.');
  const h=u.hostname.toLowerCase(),parts=u.pathname.split('/').filter(Boolean);
  if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(h)) {
    const id=h==='youtu.be'?parts[0]:parts[0]==='watch'?u.searchParams.get('v'):['shorts','embed','live'].includes(parts[0])?parts[1]:null;
    if(!/^[\w-]{11}$/.test(id||''))throw Error('Use a link to one YouTube video.');
    return {provider:'youtube',url:'https://www.youtube.com/watch?v='+id,embedUrl:'https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1',canEmbed:true};
  }
  if(['facebook.com','www.facebook.com','m.facebook.com','web.facebook.com'].includes(h)) {
    const v=u.searchParams.get('v');
    const known=(parts[0]==='watch'&&/^\d+$/.test(v||''))||/\/(?:videos|reel)\/\d+(?:\/|$)/.test(u.pathname);
    if(!known)throw Error('Use a Facebook video, reel or watch link.');
    const canonical='https://www.facebook.com'+u.pathname+(v?'?v='+v:'');
    return {provider:'facebook',url:canonical,embedUrl:'https://www.facebook.com/plugins/video.php?href='+encodeURIComponent(canonical)+'&show_text=false&autoplay=true',canEmbed:true};
  }
  if(h==='fb.watch'&&/^[\w-]+\/?$/.test(u.pathname.slice(1)))return {provider:'facebook',url:'https://fb.watch'+u.pathname,embedUrl:null,canEmbed:false};
  throw Error('Only YouTube and Facebook video links are supported.');
}
export function validatePostPresentation(input) {
  const format=input.postFormat||'article';
  if(!['design_card','article','video_link'].includes(format))throw Error('Choose Design Card, Article or Video Link.');
  const category=input.designCategory||'faith';
  if(!CATEGORIES.some(([id])=>id===category))throw Error('Choose a valid category.');
  const title=String(input.title??'').trim(),body=String(input.body??'').trim(),scripture=String(input.scripture??'').trim();
  if(title.length>180||scripture.length>240)throw Error('Use a title of up to 180 characters and a scripture reference of up to 240 characters.');
  if(body.length<2||body.length>(format==='article'?30000:10000))throw Error(format==='article'?'Write between 2 and 30,000 characters.':'Write between 2 and 10,000 characters.');
  if(format==='article'&&!title)throw Error('Give your article a title for its Design Card cover.');
  if(Array.isArray(input.mediaIds)&&input.mediaIds.length)throw Error('File attachments are disabled. Choose a Design Card or a video link.');
  const design=format==='video_link'?null:normalizeDesign(input.design);
  const video=format==='video_link'?parseVideoLink(input.videoUrl):null;
  return {format,category,title,body,scripture,design,video};
}
export const REPORT_REASONS = [['sexual_content','Pornography / sexual content'],['harassment','Harassment / bullying'],['threat','Threats / violence'],['hate_or_abuse','Hate / abusive language'],['scam','Scam / exploitation'],['spam','Spam'],['impersonation','Impersonation'],['religious_promotion_debate','Against the Christian purpose'],['other','Other policy violation']];
export const COMMUNITY_RULES = [
  'No pornography, nudity or sexually explicit content, including linked videos.',
  'No harassment, bullying, hate speech, abusive language or threats.',
  'No promotion of violence, illegal activity or dangerous conduct.',
  'No scams, impersonation, spam or financial exploitation in the name of ministry.',
  'Respect privacy. Do not share another person’s private information without permission.',
  'Keep posts consistent with this Christian community’s purpose. No promotion of non-Christian worship or hostile religious debates.',
  'Advance the gospel of Christ, equip the saints, uphold the faith of our fathers, and live meaningfully in the will of God.',
  'Report anything against these values immediately and respectfully. Site staff review all reports; group managers also review reports from their groups. Do not attack the author.'
];

