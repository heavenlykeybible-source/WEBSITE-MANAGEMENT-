/** LOCKED baseline from reviewed production source. A normal code update MUST NOT silently
 * alter authentication, persistent bindings, CMS/media runtime or applied SQL migrations.
 * Deliberate protected-system changes require a separately owner-approved baseline update,
 * reviewed permissions, isolated tests, a backup and a manual deployment.
 * This static code gate is not a substitute for least-privilege Cloudflare credentials. */
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const baseline={
  "global-community/migrations/0001_global_community.sql": "8e19d85390af0efed73a9d522805ad40e434f546",
  "global-community/migrations/0002_participation_safety.sql": "ad6a86d30ac150106cee546fc9fc186cdcf2741e",
  "global-community/migrations/0003_discipleship_growth.sql": "0717e2d8e319feac12c9869fa8fd7ba45e7400f0",
  "global-community/migrations/0004_storage_guard_background_posts.sql": "995ebb97e5d19a04bb54438c19c7034099e666f8",
  "global-community/migrations/0005_design_cards_video_links.sql": "50a0117ca487302c6879a07586b9a251c6a550af",
  "global-community/migrations/0006_social_network_calls.sql": "0961ee04904422c5087636ec1d2f1fbcf236b855",
  "global-community/migrations/0007_safety_accountability.sql": "260527c0ba1e496717568f403c8e431ff87233af",
  "global-community/migrations/0008_group_controls.sql": "a8889be0068bdf1f75643ec82ad909b1464998c3",
  "global-community/migrations/0009_message_retries.sql": "ebc3177d497b2d44b16803019b43fd12bfaf1855",
  "global-community/migrations/0010_christ_centered_safety.sql": "f53dbf34568f31bfc8295e954c30d3aa3dde1df5",
  "global-community/migrations/0011_social_signin_adverts.sql": "20d9617d98ae932e479a6ad69aedbf32569c5170",
  "global-community/src/auth.ts": "581e51c6b13f25da51674602e0966bf9e7ab2b01",
  "global-community/src/social-auth.ts": "a9ff4128006a99940a3a8a5c5e5145012ee75f3f",
  "global-community/wrangler.toml": "6f9203a130db4e2c79b96579f2c49f5a5c612506",
  "heavenly-key-website/js/homepage-cms-admin.js": "29cc1ed6aede3be755a6d67ca3328c287c1b1992",
  "heavenly-key-website/js/site-cms.js": "ad46d64caf3469cee489f11b10b40788cc75f788",
  "media-engine/migrations/0001_media_engine.sql": "58fc45129b197a236de62be5105ed1d8a91cdc4c",
  "media-engine/migrations/0002_broadcast_studio.sql": "44d0972997886427b062f988e8e20cc697dcf7ce",
  "media-engine/migrations/0003_broadcast_controls.sql": "34396ccc68c7055be650227edf989c24c661a8d9",
  "media-engine/migrations/0004_livekit_transport.sql": "a7de382f93d032f47790f4b8d0d42ff168be841f",
  "media-engine/migrations/0005_resumable_media_uploads.sql": "df6844c06f1851efe6605a61065a776bff4051ab",
  "media-engine/src/livekit-config.ts": "c09176aa5f16a2d0b7a1289174e196636198bdc2",
  "media-engine/src/livekit.ts": "d28f16dfc33f52066e34973813537800ada0fc89",
  "media-engine/src/public-broadcast.ts": "f1f4f8d661364d9757333809709fa3e3511b036a",
  "media-engine/wrangler.toml": "111eece5a7eb523999ef20625e0bb0e5ed8792ce",
  "migrations/0001_auth_foundation.sql": "8d31e3460d0104f145dd947d4d929cc31080e08a",
  "migrations/0002_community.sql": "e513e669ef9f137b8b70e9f519fa199f4b34d552",
  "migrations/0003_spiritual_resources.sql": "0f4bc52a3d62e63c613f475aa3274ec599b2a3e3",
  "migrations/0004_spiritual_resources_addendum.sql": "1f32677ae87b53fd565f37ab201aba5df8dc3b6a",
  "migrations/0005_evangelism.sql": "34d1ac0536a08f41a0bea0ce1fa80a6965788729",
  "migrations/0006_encryption_idempotency.sql": "66e45cffe792184e0ce74b71a7f9a24e841d8934",
  "migrations/0007_groups.sql": "c3c63bcd27e09225e673af7bbf74fd3189348593",
  "migrations/0008_community_administration.sql": "3d6ecac3a3be3b1d9317b3b384ed8c6ff6a2483e",
  "migrations/0009_bible_training_base.sql": "47c7ba37c33f19187b263210b92342f57f423968",
  "migrations/0010_discipleship_centre.sql": "d1af08fe611bf70ac506aa4fc8dbe685e2f75b91",
  "migrations/0011_learning_paths.sql": "14df7c97e237d790252b1c2755e72488b351972c",
  "migrations/0012_media_library.sql": "7c677d4b037ab0129b6e49e50a49b60639cc2639",
  "migrations/0013_broadcast_distribution.sql": "70843be9ac517eae0d347f1751a407b15a7e2d8c",
  "migrations/0014_campaign_manager.sql": "603c690002c1d1dbd73107a4493463d6483c9090",
  "migrations/0015_campaign_refinements.sql": "0aed0def4fe2d6bf59a68b89e8167913f62ba27f",
  "migrations/0016_multi_account_social.sql": "9940086b90c06bb2461e35763a1edff18314d79e",
  "migrations/0017_unified_distribution.sql": "98b8ffc373b7a4d8c909c6adb68cd23f26266580",
  "migrations/0018_ministry_relationship_management.sql": "71e1ead3abc186fa4818f4f13f174d586dea5c3b",
  "migrations/0019_audit_logs.sql": "0a8aa4e611f6b6691fe563cf1edfe9d475d6e3e7",
  "migrations/0020_storage_retention.sql": "de50d76ea4860a9415af2ee207d9868f87509803",
  "migrations/0021_distribution_idempotency.sql": "5518ac6a9ce58457b5fb4fea31a928234ed484ea",
  "migrations/0022_media_multipart_uploads.sql": "8513ff8d1cac1c00549791725350dfe45a22ab8d",
  "migrations/0023_live_broadcast_resilience.sql": "64fe33fcab2c9cbe5a3e69299da142fd8fb1aea2",
  "migrations/0024_recording_distribution.sql": "faa5fdb914fae42ae70aaff0de50e85b5d3a7cc5",
  "migrations/0025_spiritual_media_links.sql": "15debc025f502eb8e545e57a08a8447c24244eb7",
  "migrations/0026_live_broadcast_single_session.sql": "7f154721ee690d10f6058ced73f32c2ea78933cb",
  "migrations/0027_broadcast_source_selection.sql": "606c34f7b94636db4e0fe309b6209ce0dcb20d85",
  "migrations/0028_recording_distribution_idempotency.sql": "e891c84e58934606231775d72398fd58fa3874c4",
  "migrations/0029_public_site_submissions.sql": "48cdc04b15b1667475252eadd64eef87397dca5f",
  "migrations/0030_public_site_followup.sql": "8c6cf9d3ab2b93f84b0daef866e49dab1fc4c59b",
  "migrations/0031_whatsapp_social_management.sql": "1dd4cc724c278868d7f782204ebac1e214bbc4d8",
  "migrations/0032_social_provider_apps.sql": "34af9f081f50b9fde339a3f23d0126c959c12641",
  "migrations/0033_social_connection_selection.sql": "66dce8d0dd5c3b1ca69fcda5dc1936df4fb02f7a",
  "migrations/0034_ministry_command_center.sql": "e1b94f588764c736fa0677733bfa524b07494377",
  "migrations/0035_grdpc_reminders.sql": "78847b36dad897536907740c50b8c95ace03cf63",
  "migrations/0036_site_content.sql": "6ada2cc36b169fe6fb34c5604948446e9bc20e69",
  "migrations/0037_site_page_content.sql": "d223dbf2fc0ead94e020ef21e30175a503b0d47b",
  "migrations/0038_system_release_history.sql": "46fc4604aa935c854d6019bb98ee9a7492ce3515",
  "migrations/0039_visual_cms.sql": "faa20292887b23d0f333b7a191a9ad25c3ddb13a",
  "recovery-control/migrations/0001_recovery_control.sql": "c74a8970e3eee3d5598d5877ed705363087b31a4",
  "recovery-control/migrations/0002_direct_upload.sql": "e18b94a5d32c4a74278d6651a7aab3c523a71eac",
  "recovery-control/migrations/0003_security_quota.sql": "ed74e3e45a78b7591ff607b6100671cbab75633a",
  "recovery-control/migrations/0004_legacy_owner_credential_recovery.sql": "3ec6809b2e453e5792fb6253e8cebffed4b9c8c3",
  "recovery-control/src/local-auth.ts": "33fee934429b851236778b373be9dff2f5c5387b",
  "recovery-control/src/password-recovery.ts": "0e0d61f52445b504aead32a6328f8d397e0cb5b1",
  "recovery-control/wrangler.toml": "3043daf691a088c3056b350bd38faa7d39efe8b2",
  "src/middleware/session.ts": "aea56c53f6a6c28ab668a3452b8a30db5078e3eb",
  "src/routes/auth.ts": "3384d80dfc0c5fac9c4e1fffa71f7ce9846a8893",
  "src/routes/site-cms.ts": "0d7b4262cc45a4eb72d979f3a24b9d89bac041aa",
  "src/services/auth-service.ts": "22ee4bbb82e8358419532b76e5cd9f53dcf7bb86",
  "wrangler.toml": "33f5e6d741cecb2f808aa4288a464f527e557013",
  ".github/CODEOWNERS": "ea961a1c556020cc6a4f0465c45ca18d8d87d9b9",
  ".github/workflows/account1-auth-diagnostics.yml": "a8726a176ce75c0601a966e5a58e99167e6870ab",
  ".github/workflows/account4-access-probe.yml": "cba2d974096f6e7aa83d0690e98ceb135fd4f501",
  ".github/workflows/account4-access-repair.yml": "fe4384489a88dbee5d331222f4f41ea0e611959f",
  ".github/workflows/account4-auto-updates.yml": "ce9d7261d881bedb99d8c1c801cadae9363a55cb",
  ".github/workflows/account4-direct-upload-review.yml": "c7f1fb61ffe1f8e41f9d748d51adb036dbdb4e09",
  ".github/workflows/account4-review-bootstrap.yml": "857751466619b230172a5adeb033f32792211a38",
  ".github/workflows/account4-review-ci.yml": "a578f7f3e0a277b5fa6a27a0e1a5d350c012e048",
  ".github/workflows/account4-review-stage.yml": "7f0ae560368bd2e7cb81c857eb68b7b8c15ed1a3",
  ".github/workflows/account4-stage-all.yml": "1c6a28639310e0a23e0621017ce846d4c66839f3",
  ".github/workflows/account4-update-control.yml": "2e43c8698643a214f69b14f33a116f9f3fa8ab07",
  ".github/workflows/account4-verify-all-waiting-rooms.yml": "ec3361581e1d043ade65787d0bb9a85d29a8a7a3",
  ".github/workflows/activate-owner-admin.yml": "29fbed948913f312409aa0d9f4a3024ada39fec8",
  ".github/workflows/ci.yml": "f312cb864228d230806e2daa64cd048116a6429b",
  ".github/workflows/cloudflare-global-community-staging.yml": "a2d23c7f6c92e932cc9b709d03c16f1b92b82ce1",
  ".github/workflows/cloudflare-global-community.yml": "03be592c76cb83c13a747fb880f491c8f7c85825",
  ".github/workflows/cloudflare-media-engine-staging.yml": "b5e4b539313685f1cb337aae6eb658a698a7e6cc",
  ".github/workflows/cloudflare-media-engine.yml": "cbe636b8266b175e316d56e0eaf5e4f6227346b2",
  ".github/workflows/cloudflare-production.yml": "f8158d6d8732f0c1bc972b99864bd3e17316a833",
  ".github/workflows/cloudflare-recovery-control.yml": "a69940691b144678b445e0995be92b9ee17d7bd5",
  ".github/workflows/cloudflare-staging.yml": "e4710beb5db4c70335b8cd1f9ad00aec45834a79",
  ".github/workflows/emergency-restore-account-1.yml": "f0f39e51ab8af8a3381939548c47f5a30c11a765",
  ".github/workflows/emergency-restore-account-2.yml": "0d685f5ab7e7602c0e5f5507d0a365e7f43f83ab",
  ".github/workflows/emergency-restore-account-3.yml": "056a380e38f034ef0d3a24751567a150e19890ee",
  ".github/workflows/export-source.yml": "1f5beb6596aee59f199790aed97b6ab6ca61d28d",
  ".github/workflows/owner-approved-release-2026-10-08.yml": "6ccdca27dce249ab9a3fca242fe902440608e27d",
  ".github/workflows/visual-cms-review.yml": "a54ab999c3f13cac066b4659ba50e86dbacdce61",
  "scripts/account1-auth-permanence-gate.mjs": "016a8e4cb999d83b2cdc2e7bed8ec2b6558e1641",
  "scripts/account4-permanence-gate.mjs": "8ee45ba8d20ec920dd08ee1381537d3f98e599c4",
  "scripts/bootstrap-admin.mjs": "0551feb1e05d5587849ad4a77180126a69fc35cb",
  "scripts/cms-permanence-gate.mjs": "c1f0f902fcfae4c72697ddb63a1bcaa20e7d8b97",
  "scripts/configure-account4-login.mjs": "dc2d59e1b121629c5a8501694e39755c286e287c",
  "scripts/configure-runtime.mjs": "65ae5038c9d6774cfea5c5a6b0be48f59beca8bd",
  "scripts/setup-account4-access.mjs": "140f9ba8c91510e456e84f30f9f6a330cb86ea79",
  "scripts/verify-account4-approval.mjs": "da7bff101f0a2be40e3e7210c1978b2aaef5eae9",
  "scripts/verify-account4-restore.mjs": "6aa17bc50936d395cbda2301389ce5fbf0e5742a",
  "recovery-control/migrations/0005_repair_work_orders.sql": "7f6e785757a4554630b0dd3962c12203d9f51400",
  "recovery-control/migrations/0006_connector_audit.sql": "1c0e9fa022f1e39ecd2c1d74b40a4b13b7f554fd"
};
const problems=[];
function blobSha(file){
 const result=spawnSync('git',['hash-object','--',file],{encoding:'utf8'});
 if(result.status!==0)throw new Error('Cannot verify protected file '+file);
 return result.stdout.trim();
}
for(const [file,expected] of Object.entries(baseline)){
 if(!existsSync(file)){problems.push('Protected file missing: '+file);continue;}
 if(blobSha(file)!==expected)problems.push('Protected file changed: '+file);
}
const fsMigrations=(dir)=>{
 if(!existsSync(dir))return;
 for(const x of readdirSync(dir,{withFileTypes:true})){
  const full=dir+'/'+x.name;
  if(x.isDirectory())fsMigrations(full);
  else if(x.name.endsWith('.sql')&&!baseline[full])problems.push('New production SQL blocked in normal release: '+full);
 }
};
for(const d of ['migrations','global-community/migrations','media-engine/migrations','recovery-control/migrations'])fsMigrations(d);
for(const x of readdirSync('.github/workflows')){
 const full='.github/workflows/'+x;
 if(/\.ya?ml$/.test(x)&&!baseline[full])problems.push('Unapproved new GitHub Actions workflow: '+full);
}
if(problems.length){console.error('PROTECTED STATE GATE FAILED — owner-only security change required');for(const p of problems)console.error('- '+p);process.exit(1);}
console.log('PROTECTED STATE GATE PASSED — '+Object.keys(baseline).length+' immutable protected files and SQL history unchanged.');
