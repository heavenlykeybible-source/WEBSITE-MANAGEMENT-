export function allowedUrl(value, hosts) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || !hosts.includes(u.hostname)) throw Error('URL is outside the approved HTTPS hosts');
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(u.hostname) || /\.(localhost|local|internal|test|invalid)$/.test(u.hostname)) throw Error('Public domain required');
  return u;
}
export function publicAddress(ip) {
  if (ip.includes(':')) return /^2[0-9a-f]{3}:/i.test(ip) && !/^2001:(db8|0|10|2):/i.test(ip);
  const p=ip.split('.').map(Number);if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
  return !(p[0]===0||p[0]===10||p[0]===127||p[0]>=224||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&(p[1]===168||p[1]===0||p[1]===2)||p[0]===100&&p[1]>=64&&p[1]<=127||p[0]===198&&(p[1]===18||p[1]===19||p[1]===51)||p[0]===203&&p[1]===0);
}
export function validateAction(a) {
  if (!a || !['observe','navigate','click','fill','select','press','close'].includes(a.type)) throw Error('Unsupported browser action');
  if (['click','fill','select'].includes(a.type) && (!Number.isInteger(a.element)||a.element<0||a.element>199)) throw Error('Choose an element from the latest observation');
  if (['fill','select'].includes(a.type) && (typeof a.value!=='string'||a.value.length>4000)) throw Error('Field value too long');
  if (a.type==='press' && !['Tab','ArrowDown','ArrowUp','Escape'].includes(a.key)) throw Error('Unsupported key');
}
