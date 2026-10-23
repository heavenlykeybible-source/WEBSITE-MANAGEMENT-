// Carefully curated public-domain hymn texts for the Heavenly Key community.
// Only use the historical text. Modern recordings, performances, remixes,
// translations and arrangements have separate rights and are NOT included.
// See the official statement of faith before adding any new item.
export const STATEMENT_OF_FAITH="https://www.heavenlykey.org/statement-of-faith";
export const HYMN_TEXTS=Object.freeze([
  {
    title:"Amazing Grace",author:"John Newton",theme:"Salvation by God's grace",
    stanza:"Amazing grace! how sweet the sound,\nThat saved a wretch like me!\nI once was lost, but now am found,\nWas blind, but now I see.",
    scripture:"Ephesians 2:8–9",
    textRights:"public_domain",faithReview:"aligned_with_published_statement",
    textSource:"https://www.hymnary.org/hymn/LUYH2013/691",audioUrl:null
  },
  {
    title:"Rock of Ages",author:"Augustus M. Toplady",theme:"Salvation and refuge in Jesus Christ",
    stanza:"Rock of ages, cleft for me,\nLet me hide myself in Thee;\nLet the water and the blood,\nFrom Thy riven side which flowed,\nBe of sin the double cure,\nSave me, Lord, and make me pure.",
    scripture:"Psalm 61:2",
    textRights:"public_domain",faithReview:"aligned_with_published_statement",
    textSource:"https://hymnary.org/hymn/HOoS1926/422",audioUrl:null
  },
  {
    title:"Holy, Holy, Holy! Lord God Almighty!",author:"Reginald Heber",theme:"The holiness of God and the Godhead",
    stanza:"Holy, holy, holy! Lord God Almighty!\nEarly in the morning our song shall rise to Thee;\nHoly, holy, holy! merciful and mighty!\nGod in Three Persons, blessed Trinity!",
    scripture:"Revelation 4:8",
    textRights:"public_domain",faithReview:"aligned_with_published_statement",
    textSource:"https://hymnary.org/hymn/CCHS1916/15",audioUrl:null
  },
  {
    title:"All Hail the Power of Jesus' Name",author:"Edward Perronet",theme:"The lordship of Jesus Christ",
    stanza:"All hail the power of Jesus' name!\nLet angels prostrate fall;\nBring forth the royal diadem,\nAnd crown Him Lord of all.",
    scripture:"Philippians 2:9–11",
    textRights:"public_domain",faithReview:"aligned_with_published_statement",
    textSource:"https://www.hymnary.org/hymn/LUYH2013/601",audioUrl:null
  },
  {
    title:"Nearer, My God, to Thee",author:"Sarah Flower Adams",theme:"Consecration and drawing closer to God",
    stanza:"Nearer, my God, to Thee,\nNearer to Thee!\nE'en though it be a cross\nThat raiseth me;\nStill all my song shall be,\nNearer, my God, to Thee,\nNearer to Thee.",
    scripture:"James 4:8",
    textRights:"public_domain",faithReview:"aligned_with_published_statement",
    textSource:"https://hymnary.org/hymn/CHCS1898/219b",audioUrl:null
  }
]);
export const VERIFIED_HYMNS=Object.freeze(HYMN_TEXTS.filter(h=>
  h.textRights==="public_domain"&&
  h.faithReview==="aligned_with_published_statement"&&
  h.textSource?.startsWith("https://")&&
  h.stanza&&h.audioUrl===null
));
export function dayNumber(now=Date.now()){
  // One daily selection worldwide, changing at midnight in Nigeria (WAT, UTC+1).
  return Math.floor((now+60*60*1000)/(24*60*60*1000));
}
export function hymnForDay(now=Date.now()){
  if(!VERIFIED_HYMNS.length)throw Error("No rights-cleared, faith-reviewed hymns are available.");
  return VERIFIED_HYMNS[dayNumber(now)%VERIFIED_HYMNS.length];
}

// Official public, versioned doctrinal reference. This does not replace KJV text.
// Other modules may call it when they need fresh ministry doctrinal context.
export const OFFICIAL_DOCTRINE_URL="https://www.heavenlykey.org/doctrine/approved.json";
export async function loadOfficialDoctrine(fetcher=fetch){
  const response=await fetcher(OFFICIAL_DOCTRINE_URL,{headers:{Accept:"application/json"},cache:"no-cache"});
  if(!response.ok)throw new Error("Approved doctrine feed unavailable");
  const text=await response.text();
  if(text.length>30000)throw new Error("Approved doctrine feed oversized");
  const data=JSON.parse(text);
  if(data.schema!=="hkem-doctrine-v1"||data.authority!=="Heavenly Key Evangelistic Movement"
    ||data.scriptureTranslation!=="Authorized King James Version (KJV)"
    ||!Array.isArray(data.articles)||data.articles.length!==22
    ||data.articles.some((article,index)=>article.article!==index+1))throw new Error("Unrecognized doctrine version");
  return data;
}
