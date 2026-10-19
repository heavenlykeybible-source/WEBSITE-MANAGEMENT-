/**
 * Release gate for the Heavenly Key Website Builder.
 * Run from the trusted release workflow (not as code submitted by an uploader).
 * This is a static compatibility gate, NOT a malware scanner or full integration test.
 */
import {readFileSync,readdirSync,existsSync} from 'node:fs';
const issues=[];
const get=(path)=>{if(!existsSync(path)){issues.push('Missing required CMS file: '+path);return '';}return readFileSync(path,'utf8');};
const expect=(file,pattern,label)=>{const body=get(file);if(!body.includes(pattern))issues.push(label+' is missing or incompatible in '+file);};
const front=[
'heavenly-key-website/js/site-cms.js',
'heavenly-key-website/js/homepage-cms-admin.js',
'heavenly-key-website/js/homepage-layout-admin.js',
'heavenly-key-website/js/home-slider.js',
'heavenly-key-website/js/homepage-layout.js',
'heavenly-key-website/index.html',
'heavenly-key-website/pages/admin.html',
'heavenly-key-website/css/cms-builder.css'
];
front.forEach(get);
const api='src/index.ts';
for(const route of ['/api/admin/cms/page','/api/site-content/cms','/api/admin/cms/assets',
 '/api/site-content/assets/','/api/admin/cms/slider','/api/site-content/slider',
 '/api/admin/cms/layout','/api/site-content/layout']){
 if(route==='/api/site-content/assets/'){
  expect(api,'handleCmsImage(request','Public CMS picture serving');
 }else{
  expect(api,route,'CMS API route '+route);
 }
}
const routeSource='src/routes/site-cms.ts';
for(const hook of ['requireMinimumRole','originOK','validFields','validSlides','validSections',
 'handleCmsAssets','handleCmsImage','handleCmsPage','handleCmsPublicPage','handleCmsSlider','handleCmsLayout',
 'site_cms_revisions','site_cms_slider_revisions','site_cms_layout_revisions']){
 expect(routeSource,hook,'CMS handler '+hook);
}
expect('heavenly-key-website/pages/admin.html','homepage-cms-admin.js','Normal admin Website Builder');
expect('heavenly-key-website/pages/admin.html','homepage-layout-admin.js','Normal admin section manager');
expect('heavenly-key-website/index.html','js/site-cms.js','Homepage visual editor');
expect('heavenly-key-website/index.html','js/home-slider.js','Homepage slider');
expect('heavenly-key-website/index.html','js/homepage-layout.js','Homepage section layout');
expect('wrangler.toml','binding = "DB"','D1 binding');
expect('wrangler.toml','binding = "MEDIA_R2"','R2 CMS upload binding');
expect('wrangler.toml','bucket_name = "heavenlykey-media"','Expected CMS media bucket');
const migration='migrations/0039_visual_cms.sql',sql=get(migration);
for(const table of ['site_cms_drafts','site_cms_revisions','site_cms_slider_state',
'site_cms_slider_revisions','site_cms_assets','site_cms_layout','site_cms_layout_revisions']){
 if(!sql.includes('CREATE TABLE IF NOT EXISTS '+table))issues.push('Missing permanent CMS database table: '+table);
}
const files=readdirSync('migrations').filter(name=>/^\d{4}_.+\.sql$/.test(name)).sort();
const newer=files.filter(name=>Number(name.slice(0,4))>=39);
for(const name of newer){
 const text=readFileSync('migrations/'+name,'utf8');
 if(/\b(?:DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?|DELETE\s+FROM\s+|TRUNCATE\s+TABLE\s+|ALTER\s+TABLE\s+)(?:["\`]?)site_cms_/i.test(text)){
  issues.push('Destructive CMS database operation detected in migration '+name);
 }
}
if(issues.length){
 console.error('CMS PERMANENCE GATE FAILED — release blocked');
 for(const error of issues)console.error('- '+error);
 process.exit(1);
}
console.log('CMS PERMANENCE GATE PASSED — visual editor, routes, D1 tables and R2 binding retained.');
