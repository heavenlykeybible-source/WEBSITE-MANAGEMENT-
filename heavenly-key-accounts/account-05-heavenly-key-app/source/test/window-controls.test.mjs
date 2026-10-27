import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('App window resizes, restores and minimizes without discarding its view',()=>{
 const handlers={}, attributes={}, classes=new Set();
 const expand={textContent:'',setAttribute:(k,v)=>attributes[k]=v};
 const minimize={focus(){this.focused=true}};
 const controls={querySelector(q){return q.includes('expand')?expand:minimize},addEventListener(_,fn){handlers.click=fn}};
 const shell={inert:false,setAttribute(){this.inert=true},removeAttribute(){this.inert=false}};
 const restore={hidden:true,focus(){this.focused=true},addEventListener(_,fn){handlers.restore=fn}};
 const body={dataset:{},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)}};
 const document={body,querySelector(q){return q==='.shell'?shell:q==='.app-window-restore'?restore:controls}};
 vm.runInNewContext(readFileSync(new URL('../public/window-controls.js',import.meta.url),'utf8'),{document});
 const click=value=>handlers.click({target:{closest:()=>({dataset:{window:value}})}});
 assert.equal(body.dataset.windowSize,'normal');click('larger');assert.equal(body.dataset.windowSize,'large');click('expand');assert.equal(body.dataset.windowSize,'expanded');assert.equal(attributes['aria-pressed'],'true');click('expand');assert.equal(body.dataset.windowSize,'large');click('smaller');assert.equal(body.dataset.windowSize,'normal');click('minimize');assert.ok(shell.inert);assert.ok(classes.has('app-minimized'));assert.equal(restore.hidden,false);assert.ok(restore.focused);handlers.restore();assert.equal(shell.inert,false);assert.equal(restore.hidden,true);assert.ok(minimize.focused);
});
