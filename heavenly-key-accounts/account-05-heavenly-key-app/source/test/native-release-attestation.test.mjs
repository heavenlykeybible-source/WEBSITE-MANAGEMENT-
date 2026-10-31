import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=name=>readFileSync(new URL('../../../../.github/workflows/'+name,import.meta.url),'utf8');

test('native release promotion requires cryptographic identity evidence for Android Windows and Mac',()=>{
 const source=workflow('promote-account5-native-release.yml');
 assert.match(source,/environment: production-release/);
 assert.match(source,/release_sha="\$\(jq -r '\.head_sha'/);
 assert.match(source,/test "\$release_sha" = "\$GITHUB_SHA"/);
 assert.match(source,/test "\$\(jq -r '\.head_branch'[^\n]* = main/);
 assert.match(source,/test -s "\$evidence"/);
 assert.match(source,/grep -qx 'signatureVerified=true' "\$evidence"/);
 assert.match(source,/grep -qx "scannedSha256=\$actual" "\$evidence"/);
 assert.match(source,/grep -qx 'notarizationVerified=true' "\$evidence"/);
 assert.match(source,/grep -qx 'malwareScan=passed' "\$evidence"/);
 assert.match(source,/test "\$current" = "\$APPROVED_DIGEST"/);
 assert.match(source,/--bucket heavenly-key-native-releases/);
});

test('Windows release workflow produces signed and hash-bound verification evidence',()=>{
 const source=workflow('release-account5-windows.yml');
 assert.match(source,/signtool verify \/pa \/v/);
 assert.match(source,/Get-AuthenticodeSignature/);
 assert.match(source,/signatureVerified=true/);
 assert.match(source,/scannedSha256=\$digest/);
 assert.match(source,/malwareScan=passed/);
 assert.match(source,/HeavenlyKeyWindows\.msix\.security\.txt/);
});

test('macOS release workflow requires notarization and records matching digest',()=>{
 const source=workflow('release-account5-macos.yml');
 assert.match(source,/codesign --verify --deep --strict/);
 assert.match(source,/xcrun stapler validate/);
 assert.match(source,/signatureVerified=true/);
 assert.match(source,/notarizationVerified=true/);
 assert.match(source,/scannedSha256=%s/);
 assert.match(source,/HeavenlyKeyMac\.dmg\.security\.txt/);
});
