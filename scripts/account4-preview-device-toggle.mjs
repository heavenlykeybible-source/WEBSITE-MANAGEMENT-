import fs from 'node:fs';
const target=new URL('../control-room-worker.js',import.meta.url);
let source=fs.readFileSync(target,'utf8');
const old="preview.appendChild(h('section',{},h('h4',{},'Live isolated website preview'),h('iframe',{title:'Imported website live preview',class:'fr',sandbox:'allow-scripts allow-forms',src:link.url+'index.html'})));";
const updated="var previewFrame=h('iframe',{title:'Imported website preview — desktop or mobile',class:'fr',sandbox:'allow-scripts allow-forms',referrerpolicy:'no-referrer',src:link.url+'index.html'});previewFrame.style.width='100%';previewFrame.style.maxWidth='100%';previewFrame.style.height='560px';var desktop=h('button',{type:'button',class:'sm',onclick:function(){previewFrame.style.width='100%';previewFrame.style.maxWidth='100%';}},'Desktop'),mobile=h('button',{type:'button',class:'sm',onclick:function(){previewFrame.style.width='390px';previewFrame.style.maxWidth='100%';}},'Mobile');preview.appendChild(h('section',{},h('h4',{},'Interactive isolated website preview'),h('p',{class:'tag'},'Switch between desktop and mobile. Test site navigation before approval. Preview does not verify backend APIs.'),h('div',{},desktop,mobile),previewFrame));";
if(!source.includes(updated)){
 if(source.split(old).length!==2)throw Error('Existing importer preview changed; refusing blind edit');
 source=source.replace(old,updated);
}
if(!process.argv.includes('--check'))fs.writeFileSync(target,source);
console.log('PASS desktop and mobile sandboxed import preview '+(process.argv.includes('--check')?'checked':'applied'));
