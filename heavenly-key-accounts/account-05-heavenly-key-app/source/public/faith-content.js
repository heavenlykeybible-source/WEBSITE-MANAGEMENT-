// Carefully curated public-domain hymn texts for the Heavenly Key community.
// Only use the historical text. Modern recordings, performances, remixes,
// translations and arrangements have separate rights and are NOT included.
// See the official statement of faith before adding any new item.
export const STATEMENT_OF_FAITH="https://www.heavenlykey.org/pages/what-we-believe.html";
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
