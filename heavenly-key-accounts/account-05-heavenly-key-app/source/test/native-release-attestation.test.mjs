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
 assert.match(source,/s3api get-object/);
 assert.match(source,/account5-r2-readback/);
 assert.match(source,/stage_key="staging\/\$GITHUB_RUN_ID\/\$PLATFORM\/release\.\$APPROVED_EXTENSION"/);
 assert.match(source,/--key "\$stage_key"/);
 assert.match(source,/account5-r2-staged/);
 assert.match(source,/Staged installer SHA-256 mismatch/);
 assert.match(source,/s3api copy-object/);
 assert.match(source,/--metadata-directive COPY/);
 assert.ok(source.indexOf('s3api copy-object')>source.indexOf('Staged installer SHA-256 mismatch'),'Public key must only be updated after staged bytes verify');
 assert.match(source,/trap cleanup_stage EXIT/);
 assert.match(source,/sha256sum "\$stored_copy"/);
 assert.match(source,/test "\$\(sha256sum "\$stored_copy"/);
 assert.match(source,/test "\$\(stat -c %s "\$stored_copy"/);
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
