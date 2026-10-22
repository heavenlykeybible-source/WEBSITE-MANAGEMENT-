/* Pure controls for a fast, accessible 66-book Bible reader. No server or storage access. */
export const BIBLE_FONT_MIN=16;
export const BIBLE_FONT_MAX=32;
export function bibleFont(value){
 const n=Number(value);
 if(!Number.isFinite(n))return 20;
 return Math.max(BIBLE_FONT_MIN,Math.min(BIBLE_FONT_MAX,Math.round(n/2)*2));
}
export function validBibleRef(books,book,chapter){
 const found=books.find(entry=>entry.id===book),n=Number(chapter);
 return found&&Number.isSafeInteger(n)&&n>=1&&n<=found.chapters&&String(chapter)!==''?
 {book:found.id,chapter:n}:null;
}
export function moveBibleRef(books,book,chapter,step){
 if(step!==1&&step!==-1)return null;
 const current=books.findIndex(entry=>entry.id===book),n=Number(chapter);
 if(current<0||!Number.isSafeInteger(n)||n<1||n>books[current].chapters)return null;
 if(n+step>=1&&n+step<=books[current].chapters)return {book,chapter:n+step};
 const adjacent=books[current+step];
 return adjacent?{book:adjacent.id,chapter:step>0?1:adjacent.chapters}:null;
}
