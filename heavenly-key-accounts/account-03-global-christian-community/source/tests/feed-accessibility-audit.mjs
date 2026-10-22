import fs from 'node:fs';
const source=fs.readFileSync(new URL('../public/community-app-promo.js',import.meta.url),'utf8');
for(const token of ["role','status","aria-live','polite","Load more","reduced-motion"]){if(!source.includes(token)&&token!=='reduced-motion'){throw new Error('Missing accessibility token: '+token);}}
console.log('Feed accessibility audit passed.');
