// Compile the actual Worker graph without credentials, remote resources or writes.
// esbuild is provided by the lockfile-pinned Wrangler installation.
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const directory=fileURLToPath(new URL('..',import.meta.url));
const result=await build({absWorkingDir:directory,entryPoints:['src/index.ts'],bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',logLevel:'warning'});
if(!result.outputFiles?.some(file=>file.text.includes('fetch')))throw Error('Worker bundle is missing its fetch handler.');
console.log('Actual TypeScript Worker bundle compiled successfully; no deployment performed.');
