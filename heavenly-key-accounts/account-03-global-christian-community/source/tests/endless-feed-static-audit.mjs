import fs from 'node:fs';
const promo=fs.readFileSync(new URL('../public/community-app-promo.js',import.meta.url),'utf8');
const required=['IntersectionObserver','rootMargin','hk-feed-near-end','data-load-more','aria-live','feedState','pending','lastRequest'];
const missing=required.filter(x=>!promo.includes(x));
if(missing.length){console.error('Missing endless-feed safeguards:',missing.join(', '));process.exit(1);}
console.log('Endless-feed static audit passed.');
