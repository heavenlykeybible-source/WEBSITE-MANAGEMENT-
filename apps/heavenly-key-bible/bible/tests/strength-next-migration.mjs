// Non-destructive conversion of the legacy twelve-topic format into a single-topic editorial draft.
// This module never writes files, grants approval or invents missing material.
export const KINGDOM_CHALLENGE_COUNT = 12;
const clean = value => typeof value === 'string' ? value.trim() : '';
export function migrateLegacyEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new TypeError('Legacy entry must be an object');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date || '') || !Number.isFinite(Date.parse(entry.date)) || new Date(entry.date).toISOString().slice(0,10) !== entry.date) throw new Error('Invalid legacy date');
  if (!Array.isArray(entry.topics) || entry.topics.length !== KINGDOM_CHALLENGE_COUNT) throw new Error('Expected twelve legacy topics');
  const topics = entry.topics.map((topic,index) => {
    if (!clean(topic?.topic) || !clean(topic?.reference) || !clean(topic?.reflection)) throw new Error('Incomplete legacy topic '+(index+1));
    return {theme:clean(topic.topic), text:clean(topic.reflection), sourceReference:clean(topic.reference), originalIndex:index};
  });
  if (new Set(topics.map(item=>item.theme.toLowerCase())).size !== KINGDOM_CHALLENGE_COUNT) throw new Error('Duplicate legacy challenge themes');
  const title = clean(entry.title);
  if (!title) throw new Error('Missing legacy central topic');
  return {
    date:entry.date, status:'draft', review:{doctrinalApproved:false,sourcesVerified:false},
    provenance:{format:'legacy-twelve-topic',sourceDate:entry.date,originalTopicCount:topics.length},
    sections:{
      topic:{title,scripture:clean(entry.scripture),reflection:clean(entry.reflection)},
      bibleReading:{oldTestament:[],newTestament:[]},
      hymn:null,bibleStory:null,worldStory:null,
      eternity:null,decision:null,
      warfare:{permanentReferences:['Matthew 11:12','Luke 18:1'],prayerPoints:[]},
      propheticPrayer:null,healthPrayer:null,salvation:null,
      challenges:topics
    }
  };
}
export function migrateLegacyBatch(batch) {
  if (!batch || !Array.isArray(batch.entries)) throw new TypeError('Legacy batch requires entries');
  const seen = new Set();
  return batch.entries.map(entry=>{
    const draft=migrateLegacyEntry(entry);
    if(seen.has(draft.date)) throw new Error('Duplicate devotional date '+draft.date);
    seen.add(draft.date);
    return draft;
  });
}
