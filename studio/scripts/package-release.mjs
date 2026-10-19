import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'application/javascript;charset=utf-8','.svg':'image/svg+xml'};
const assets={},sourceFiles={};
const hash=value=>createHash('sha256').update(value).digest('hex');
async function walk(dir,fn){for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full,fn);else if(entry.isFile())await fn(full);}}
await walk(path.join(root,'public'),async file=>{const extension=path.extname(file);if(!types[extension])throw Error('Unsupported public asset type: '+extension);const name='/'+path.relative(path.join(root,'public'),file).split(path.sep).join('/'),content=await fs.readFile(file,'utf8');assets[name]={content,type:types[extension]};});
await walk(path.join(root,'src'),async file=>{sourceFiles[path.relative(root,file)]=hash(await fs.readFile(file));});
await fs.mkdir(path.join(root,'release'),{recursive:true});
const outfile=path.join(root,'release/studio-worker.js');
await build({absWorkingDir:root,entryPoints:[path.join(root,'src/index.ts')],outfile,bundle:true,format:'esm',target:'es2022',platform:'browser',minify:false,plugins:[{name:'embed-studio-public-files',setup(b){b.onLoad({filter:/[/\\]embedded-manifest\.ts$/},()=>({contents:'export const assets='+JSON.stringify(assets)+';',loader:'ts'}));}}]});
const bytes=await fs.readFile(outfile);if(bytes.length>1000000)throw Error('Studio bundle exceeds control room 1 MB upload limit.');
const manifest={format:'heavenly-key-studio-single-worker-v1',worker:'heavenlykey-media',bundle:'studio-worker.js',bytes:bytes.length,sha256:hash(bytes),assetCount:Object.keys(assets).length,assets:Object.fromEntries(Object.entries(assets).map(([name,item])=>[name,hash(item.content)])),sourceFiles,deployChannel:'Account 4 control room -> connected Account 2 -> existing heavenlykey-media Worker',preserve:['DB','MEDIA_R2','LIVE_STATUS_KV','MEDIA_ENGINE_SHARED_SECRET','all existing provider secrets'],databaseChange:'Control room ONLY: additive migrations/0003_studio_signin.sql',noNewAssetBindingRequired:true};
await fs.writeFile(path.join(root,'release/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Packaged '+manifest.assetCount+' assets into '+manifest.bytes+'-byte existing-Worker release; SHA-256 '+manifest.sha256);
