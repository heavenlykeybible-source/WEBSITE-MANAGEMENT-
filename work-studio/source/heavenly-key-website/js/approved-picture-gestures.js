/* Direct picture gestures: drag the approved pair and pinch to resize it. */
(()=>{'use strict';
window.HKApprovedPictureGestures=function(root,handle){
if(!root||!handle||handle.dataset.hkPictureGesture)return;
handle.dataset.hkPictureGesture='true';handle.style.touchAction='pan-y';handle.style.userSelect='none';
handle.querySelectorAll('img').forEach(img=>img.draggable=false);handle.addEventListener('dragstart',e=>e.preventDefault());
const points=new Map();let gesture,suppress=false;
const distance=()=>{const p=[...points.values()];return Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)};
function begin(){const b=root.getBoundingClientRect(),p=[...points.values()];gesture={left:b.left,top:b.top,width:b.width,height:b.height,x:p[0].x,y:p[0].y,moved:suppress};if(p.length>1){gesture.distance=Math.max(1,distance());gesture.focusX=((p[0].x+p[1].x)/2-b.left)/b.width;gesture.focusY=((p[0].y+p[1].y)/2-b.top)/b.height;gesture.moved=true;suppress=true}}
function position(left,top){const box=root.getBoundingClientRect(),footer=root.parentElement,max=Math.max(12,footer.clientWidth-root.offsetWidth-12),margin=parseFloat(getComputedStyle(root).marginRight)||12;root.style.setProperty('margin-right',Math.max(12,Math.min(max,margin+box.left-left))+'px')}
handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(!points.size)suppress=false;points.set(e.pointerId,{x:e.clientX,y:e.clientY});handle.setPointerCapture?.(e.pointerId);begin()});
handle.addEventListener('pointermove',e=>{if(!points.has(e.pointerId)||!gesture)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size>1&&gesture.distance){const width=Math.max(130,Math.min(innerWidth-24,360,gesture.width*distance()/gesture.distance));root.style.setProperty('width',width+'px','important');position(gesture.left+(gesture.width-width)*gesture.focusX,gesture.top+(gesture.height-root.offsetHeight)*gesture.focusY);suppress=true;e.preventDefault();return}const p=[...points.values()][0],dx=p.x-gesture.x,dy=p.y-gesture.y;if(!gesture.moved&&Math.hypot(dx,dy)<6)return;gesture.moved=true;suppress=true;position(gesture.left+dx,gesture.top+dy);e.preventDefault()});
function finish(e){points.delete(e.pointerId);if(points.size)begin();else gesture=null}
handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
handle.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();suppress=false}},true);
window.addEventListener('resize',()=>{if(innerWidth<100)return;const max=Math.max(12,root.parentElement.clientWidth-root.offsetWidth-12);if(parseFloat(root.style.marginRight)>max)root.style.marginRight=max+'px'});
};
})();
