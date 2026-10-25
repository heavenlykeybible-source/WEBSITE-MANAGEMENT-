function previewFirstReview(kids){
  // Native details stays closed, so even a megabyte bundle cannot dominate review.
  var technical=h('details',{class:'card',style:'min-width:0;max-width:100%;overflow:hidden'},h('summary',{style:'cursor:pointer;font-weight:700;padding:12px 0'},'Code and deployment details (optional)'));
  var rendered=[],details=[],workerDetails=false;
  kids.forEach(function(node){
    var tag=String(node.tagName||node.tag||'').toLowerCase();
    if(tag==='pre'){
      node.setAttribute('style','max-height:360px;max-width:100%;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere');
      details.push(node);workerDetails=true;
    }else if(workerDetails&&tag!=='iframe'&&tag!=='section')details.push(node);
    else rendered.push(node);
  });
  if(details.length){details.forEach(function(node){technical.appendChild(node);});rendered.push(technical);}
  return rendered;
}
