#!/usr/bin/env node
// Account 5 release gate. Fail closed: empty inventory or unverified packages block launch.
import fs from 'node:fs';
import path from 'node:path';
const file = path.resolve(process.cwd(), process.argv[2] || 'account5-release-manifest.json');
const fail = (message) => { console.error('ACCOUNT 5 RELEASE BLOCKED: ' + message); process.exitCode = 1; };
if (!fs.existsSync(file)) { fail('Release manifest is missing: ' + file); }
else {
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { fail('Invalid JSON manifest'); }
  if (manifest) {
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.apps) || !manifest.apps.length) fail('Inventory must contain real applications');
    else {
      const ids = new Set();
      for (const app of manifest.apps) {
        if (!app || !/^[a-z0-9][a-z0-9-]*$/.test(app.id || '') || !app.name || !app.sourcePath) { fail('Incomplete app entry'); continue; }
        if (ids.has(app.id)) fail('Duplicate app id: ' + app.id);
        ids.add(app.id);
        const source = path.resolve(process.cwd(), app.sourcePath);
        if (!source.startsWith(process.cwd() + path.sep) || !fs.existsSync(source)) fail('Missing or unsafe source path for ' + app.id);
        if (!Array.isArray(app.packages) || !app.packages.length) { fail('No packages for ' + app.id); continue; }
        for (const pkg of app.packages) {
          if (!['android','ios','windows','macos','linux','pwa'].includes(pkg.platform)) fail('Invalid platform for ' + app.id);
          if (!pkg.version || pkg.verified !== true || !/^https:\/\//.test(pkg.url || '') || !/^[a-f0-9]{64}$/.test(pkg.sha256 || '')) fail('Unverified or incomplete package for ' + app.id);
        }
      }
    }
  }
}
if (!process.exitCode) console.log('Account 5 manifest structure validated. Device installation and package authenticity still require independent verification.');
