// 66 canonical KJV books, source snapshot: aruljohn/Bible-kjv (MIT licence).
export const KJV_BOOKS=[["Genesis",50],["Exodus",40],["Leviticus",27],["Numbers",36],["Deuteronomy",34],["Joshua",24],["Judges",21],["Ruth",4],["1 Samuel",31],["2 Samuel",24],["1 Kings",22],["2 Kings",25],["1 Chronicles",29],["2 Chronicles",36],["Ezra",10],["Nehemiah",13],["Esther",10],["Job",42],["Psalms",150],["Proverbs",31],["Ecclesiastes",12],["Song of Solomon",8],["Isaiah",66],["Jeremiah",52],["Lamentations",5],["Ezekiel",48],["Daniel",12],["Hosea",14],["Joel",3],["Amos",9],["Obadiah",1],["Jonah",4],["Micah",7],["Nahum",3],["Habakkuk",3],["Zephaniah",3],["Haggai",2],["Zechariah",14],["Malachi",4],["Matthew",28],["Mark",16],["Luke",24],["John",21],["Acts",28],["Romans",16],["1 Corinthians",16],["2 Corinthians",13],["Galatians",6],["Ephesians",6],["Philippians",4],["Colossians",4],["1 Thessalonians",5],["2 Thessalonians",3],["1 Timothy",6],["2 Timothy",4],["Titus",3],["Philemon",1],["Hebrews",13],["James",5],["1 Peter",5],["2 Peter",3],["1 John",5],["2 John",1],["3 John",1],["Jude",1],["Revelation",22]].map(([name,chapters],index)=>Object.freeze({name,chapters,testament:index<39?'Old Testament':'New Testament',slug:name.toLowerCase().replaceAll(' ','-')}));
export const KJV_TOTAL_VERSES=31102;
export const KJV_TOTAL_CHAPTERS=1189;
export function bookPath(book){const found=KJV_BOOKS.find(b=>b.name===book||b.slug===book);if(!found)throw Error('Unknown Bible book');return '/reading/kjv/'+found.slug+'.json';}
// The yearly reading programme is chapter-centred, not an invented 365-verse translation.
const READING_BOOKS=[['Psalms',150],['Proverbs',31],['Matthew',28],['Mark',16],['Luke',24],['John',21],['Acts',28],['Romans',16],['Philippians',4],['1 John',5],['Revelation',22],['Ephesians',6],['James',5],['Isaiah',9]];
export const READING_YEAR=Object.freeze(READING_BOOKS.flatMap(([book,count])=>Array.from({length:count},(_,i)=>Object.freeze({book,chapter:i+1}))));
if(KJV_BOOKS.length!==66||READING_YEAR.length!==365)throw Error('Bible/reading programme incomplete');
export const TODAY_REFLECTIONS=Object.freeze([
 'Read the passage prayerfully. What does it teach about the character of God?',
 'How does this chapter call you to trust and obey the Lord?',
 'Ask the Holy Spirit to help you live out the truth of Scripture.',
 'What do you learn here about holiness and a life pleasing to God?',
 'Take time to thank God for His mercy and grace.',
 'Consider how this passage points you toward faithfulness to Christ.',
 'Is there a warning, instruction or promise to consider carefully in context?',
 'Pray for strength to apply God’s Word with humility today.',
 'Ask how this passage can encourage your family and Christian fellowship.',
 'Read the surrounding verses before drawing conclusions from today’s chapter.',
 'Share an encouragement from the Bible with someone who needs it.',
 'End today’s reading with a prayer for wisdom, compassion and obedience.'
]);
export function nigeriaDay(now=Date.now()){return Math.floor((now+60*60*1000)/86400000);}
export function readingForDay(now=Date.now()){const day=((nigeriaDay(now)%365)+365)%365;return {...READING_YEAR[day],day:day+1,reflection:TODAY_REFLECTIONS[day%TODAY_REFLECTIONS.length]};}
