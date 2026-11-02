/**
 * Complete application deployment preflight for Account 4.
 * Detects monorepo projects and prevents partial Worker-only releases.
 * The build executor must run in an isolated trusted CI runner, never inside
 * a Cloudflare request handler. Database migrations require separate approval.
 */
const PROJECT_KINDS=new Set(['website','application','worker']);
function safePath(p){
 return typeof p==='string' && p.length>0 && !p.startsWith('/') &&
 !p.includes('\\') && !p.split('/').some(x=>!x||x==='.'||x==='..');
}
export function planCompleteProject({files,projectRoot='',packageJson=null,wranglerConfig=null}){
 if(!Array.isArray(files)||!files.length||files.length>100000)throw Error('Complete file inventory required');
 if(projectRoot && !safePath(projectRoot))throw Error('Unsafe project root');
 const prefix=projectRoot?projectRoot+'/':'';
 const names=new Set();
 for(const f of files){
  const name=typeof f==='string'?f:f?.path;
  if(!safePath(name)||names.has(name))throw Error('Unsafe or duplicate project file');
  names.add(name);
 }
 const local=[...names].filter(n=>n.startsWith(prefix)).map(n=>n.slice(prefix.length));
 if(!local.length)throw Error('Project root not found');
 const hasPackage=local.includes('package.json');
 const hasWrangler=local.some(n=>/^wrangler\.(toml|json|jsonc)$/.test(n));
 const assets=local.filter(n=>/^(public|dist|build|assets|static)\//.test(n));
 const migrations=local.filter(n=>/(^|\/)migrations\//.test(n));
 const scripts=packageJson?.scripts||{};
 if(hasPackage && (!packageJson||typeof packageJson!=='object'||Array.isArray(packageJson)))throw Error('Package manifest must be inspected');
 if(hasWrangler && (!wranglerConfig||typeof wranglerConfig!=='object'))throw Error('Cloudflare configuration must be inspected');
 const kind=hasWrangler?'application':assets.length?'website':hasPackage?'application':'website';
 if(!PROJECT_KINDS.has(kind))throw Error('Unsupported project kind');
 const buildCommand=hasPackage&&typeof scripts.build==='string'?'npm run build':null;
 const deployCommand=hasPackage&&typeof scripts.deploy==='string'?'npm run deploy':null;
 const required=[
  'verified immutable source snapshot',
  'all files and asset paths retained',
  'trusted isolated build with pinned dependencies',
  'artifact inventory and checksum',
  'preview health verification',
  'explicit owner approval',
  'verified destination and bindings',
  'live health verification and rollback'
 ];
 if(migrations.length)required.push('separate owner approval for database migrations');
 return {
  kind,projectRoot,sourceFileCount:local.length,assetFileCount:assets.length,
  migrationFileCount:migrations.length,hasPackage,hasWrangler,buildCommand,deployCommand,
  requiresCompleteBundle:hasWrangler||assets.length>0||migrations.length>0,
  requiresMigrationApproval:migrations.length>0,required,
  safeToDeploy:false,
  reason:'Build, preview, account authorization and owner approval must be verified'
 };
}
