import {readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const directories=['src','test'];
let count=0;
for(const directory of directories){
 const files=(await readdir(new URL('../'+directory+'/',import.meta.url))).filter(file=>file.endsWith('.js')).sort();
 if(files.length===0)throw Error('No JavaScript files found in '+directory);
 for(const file of files){
  execFileSync(process.execPath,['--check',new URL('../'+directory+'/'+file,import.meta.url).pathname],{stdio:'inherit'});
  count++;
 }
}
console.log('Syntax verified for '+count+' JavaScript source and test files');
