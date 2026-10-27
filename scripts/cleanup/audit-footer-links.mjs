import fs from 'node:fs';
import {parseHTML} from 'linkedom';

const {html} = JSON.parse(fs.readFileSync('config/approved-homepage-footer.json', 'utf8'));
const {document} = parseHTML(html);
const links = new Set();
for (const anchor of document.querySelectorAll('a[href]')) {
  const href = anchor.getAttribute('href');
  if (!href || /^(?:#|mailto:|tel:)/i.test(href)) continue;
  const url = new URL(href, 'https://www.heavenlykey.org/');
  if (url.hostname === 'heavenlykey.org') url.hostname = 'www.heavenlykey.org';
  if (url.hostname === 'app.heavenlykey.org') url.hostname = 'apps.heavenlykey.org';
  if (url.hostname === 'bible.heavenlykey.org') url.hostname = 'onlinebible.heavenlykey.org';
  if (!/(^|\.)heavenlykey\.org$/.test(url.hostname)) continue;
  url.hash = '';
  links.add(url.href);
}
const urls = [...links];
let next = 0;
async function check() {
  while (next < urls.length) {
    const url = urls[next++];
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
      const contentType = response.headers.get('content-type') || '';
      const text = contentType.includes('text/html') ? await response.text() : '';
      const placeholder = /<title[^>]*>[^<]*under construction/i.test(text);
      console.log(JSON.stringify({url, status: response.status, final: response.url, placeholder}));
    } catch (error) { console.log(JSON.stringify({url, error: error.message})); }
  }
}
await Promise.all(Array.from({length: 4}, check));
