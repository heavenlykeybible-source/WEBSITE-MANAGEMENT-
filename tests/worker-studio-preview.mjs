import assert from 'node:assert/strict';
import {buildIsolatedWorkerPreview,verifyWorkerPreviewPromotion} from '../workspace/worker-studio-preview.js';
const a='a'.repeat(64),b='b'.repeat(64);
const valid={connection:4,worker:'site-worker',source:'export default {fetch(){return new Response("preview")}}',
 base_sha256:a,module_count:1,preview_name:'review-123',compatibility_date:'2026-10-31',cloudflare_access_verified:true,
 binding_inventory_verified:true,production_binding_names:['DB','CACHE','FILES'],
 variables:{DEMO_MODE:'yes'},resources:[
 {type:'d1',binding:'DB',production_id:'00000000-0000-0000-0000-000000000000',preview_id:'11111111-1111-1111-1111-111111111111'},
 {type:'kv',binding:'CACHE',production_id:'c'.repeat(32),preview_id:'d'.repeat(32)},
 {type:'r2',binding:'FILES',production_id:'production-files',preview_id:'review-files'}
 ]};
const preview=buildIsolatedWorkerPreview(valid);
assert.equal(preview.config.previews.vars.ENVIRONMENT,'preview');
assert.equal(preview.config.previews.d1_databases[0].database_id,'11111111-1111-1111-1111-111111111111');
assert.equal(preview.config.previews.kv_namespaces[0].id,'d'.repeat(32));
assert.equal(preview.config.previews.r2_buckets[0].bucket_name,'review-files');
assert.equal(preview.manifest.status,'not-deployed');
assert.equal(preview.manifest.approval,'required');
assert.equal(preview.manifest.baseline_sha256,a);
assert.deepEqual(preview.manifest.verified_binding_names,['CACHE','DB','FILES']);
assert.equal(preview.configText.includes('production-files'),false);
for(const wrong of [
 {...valid,cloudflare_access_verified:false},
 {...valid,binding_inventory_verified:false},
 {...valid,production_binding_names:undefined},
 {...valid,production_binding_names:['DB','CACHE']},
 {...valid,production_binding_names:['DB','CACHE','FILES','OTHER']},
 {...valid,production_binding_names:['DB','DB','FILES']},
 {...valid,uses_service_bindings:true},
 {...valid,has_unsupported_bindings:true},
 {...valid,resources:[...valid.resources.slice(0,2),{...valid.resources[2],production_id:''}]},
 {...valid,resources:[...valid.resources.slice(0,2),{...valid.resources[2],preview_id:'production-files'}]},
 {...valid,preview_name:'production'},
 {...valid,resources:[{type:'d1',binding:'DB',production_id:'11111111-1111-1111-1111-111111111111',preview_id:'11111111-1111-1111-1111-111111111111'}]},
 {...valid,resources:[{type:'kv',binding:'DB',production_id:'c'.repeat(32),preview_id:'not-a-kv-id'}]},
 {...valid,resources:[...valid.resources,{...valid.resources[0]}]},
 {...valid,variables:{ADMIN_TOKEN:'secret'}},
 {...valid,variables:{ENVIRONMENT:'production'}},
 {...valid,compatibility_date:'yesterday'},
 {...valid,module_count:3}
])assert.throws(()=>buildIsolatedWorkerPreview(wrong));
const gate={connection:4,worker:'site-worker',owner_approved:true,access_verified:true,smoke_tests_passed:true,
 isolated_resources_verified:true,candidate_sha256:a,approved_sha256:a,live_baseline_sha256:b,original_baseline_sha256:b};
assert.equal(verifyWorkerPreviewPromotion(gate).ready_for_explicit_owner_release,true);
for(const change of [
 {owner_approved:false},{access_verified:false},{smoke_tests_passed:false},
 {isolated_resources_verified:false},{approved_sha256:b},{live_baseline_sha256:a},{worker:'../bad'}
])assert.throws(()=>verifyWorkerPreviewPromotion({...gate,...change}));
console.log('PASS AI Worker Studio private preview manifest and immutable owner promotion gate');
