// Keep the rendered candidate prominent; source remains available on demand.
export function improveWaitingPreviews(worker) {
  const start=worker.indexOf('async function waiting('), end=worker.indexOf('async function sites()',start);
  if(start<0||end<0)throw new Error('Waiting Room integration point missing');
  let review=worker.slice(start,end);
  const old="else content=h('div',{},h('p',{class:'tag'},'Worker source is not a rendered website. A truthful proposed-site preview requires a separate staging deployment. No Worker has been executed or published.'),h('button',{class:'sm',onclick:function(){openP(p.id);}},'Review proposed Worker source and settings'));";
  const replacement="else{content=h('section',{'aria-label':'Proposed website demo'});workerDemoCard(p.id,content);}";
  if(!review.includes(old)&&!review.includes(replacement))throw new Error('Worker queue preview integration point missing');
  review=review.replace(old,replacement).replace("p.kind==='worker'?'Worker deployment review (not a live preview)'", "p.kind==='worker'?'Interactive website demo'");
  const anchor="  if(P.status==='waiting'&&own()){\n    if(staged)";
  const layout="  kids=previewFirstReview(kids);\n";
  if(!review.includes(layout)){
    if(!review.includes(anchor))throw new Error('Review layout integration point missing');
    review=review.replace(anchor,layout+anchor);
  }
  worker=worker.slice(0,start)+review+worker.slice(end);
  const menuCSS='/* mobile navigation links */\n.sidenav>a.btn{display:flex;align-items:center;white-space:normal;overflow-wrap:normal;word-break:normal;min-height:44px}\n@media(max-width:1024px){.sidenav{align-items:center}.sidenav>a.btn{flex:0 0 auto;width:auto;max-width:none;white-space:nowrap;align-self:center;margin:4px 5px 4px 0}.sidenav>button{flex-shrink:0}.sidenav{min-height:0}}\n';
  const uiStart=worker.indexOf('const UI =');
  if(!worker.slice(uiStart).includes('/* mobile navigation links */'))worker=worker.slice(0,uiStart)+worker.slice(uiStart).replace('</style>',menuCSS+'</style>');
  return worker;
}
