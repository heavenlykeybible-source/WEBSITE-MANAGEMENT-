// Account 9 role provisioning. Passwords are supplied only through environment variables.
// Generates SQL for review; never contacts Cloudflare or changes the live database.
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ownerEmail = (process.env.HK_OWNER_EMAIL || 'emmanuelmeta247@gmail.com').trim().toLowerCase();
const adminEmail = (process.env.HK_ADMIN_EMAIL || '').trim().toLowerCase();
const ownerPassword = process.env.HK_OWNER_PASSWORD || '';
const adminPassword = process.env.HK_ADMIN_PASSWORD || '';
const filename = process.argv[2];
function fail(msg) { process.stderr.write(`Error: ${msg}\n`); process.exit(1); }
if (!filename || !filename.endsWith('.sql')) fail('Provide an output .sql filename.');
if (![ownerEmail, adminEmail].every(x => x.length <= 200 && emailPattern.test(x))) fail('Both Owner and Admin require valid separate email addresses.');
if (ownerEmail === adminEmail) fail('Owner and Admin must use different email addresses.');
if (![ownerPassword, adminPassword].every(x => x.length >= 12 && x.length <= 200)) fail('Use separate passwords of at least 12 characters.');
if (ownerPassword === adminPassword) fail('Owner and Admin must not share a password.');
const escapeSQL = s => "'" + s.replaceAll("'", "''") + "'";
function row(email, password, role) {
  const id = randomBytes(16).toString('hex');
  const salt = randomBytes(16).toString('hex');
  const pass = pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return `INSERT INTO users(id,email,pass_hash,salt,created_at,role) VALUES(${[id,email,pass,salt].map(escapeSQL).join(',')},${Date.now()},${escapeSQL(role)});`;
}
writeFileSync(filename, `-- PRIVATE: credentials hashed; treat the generated SQL as sensitive and delete after execution.\nBEGIN TRANSACTION;\n${row(ownerEmail,ownerPassword,'owner')}\n${row(adminEmail,adminPassword,'admin')}\nCOMMIT;\n`, {flag:'wx',mode:0o600});
process.stdout.write(`Created private SQL file ${filename} for Owner and Admin. No passwords printed.\n`);
