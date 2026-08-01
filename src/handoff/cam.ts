import type { HandoffSvgs } from "./svgs";

// The camera bubble runs inside an inline host script, so this module returns
// its source rather than importing browser code. A drag owns one pointer and
// one overlay element for its full lifetime; this prevents a second touch or a
// blur-layer swap from stealing the gesture. CSS variables keep translation
// independent from the recording preview's mirror transform.
const CAM_SCRIPT = `
  var CAM_KEY='oa-handoff-cam-pos', camDragBound=false;
  function loadCamPos(){
    try{
      var raw=localStorage.getItem(CAM_KEY), p=raw?JSON.parse(raw):null;
      if(p&&Number.isFinite(p.left)&&Number.isFinite(p.top))return p;
    }catch(e){}
    return null;
  }
  function saveCamPos(p){ try{localStorage.setItem(CAM_KEY,JSON.stringify(p));}catch(e){} }
  function visibleCam(){ return (camBlur&&segCanvas&&!segCanvas.hidden)?segCanvas:cam; }
  function boundCamPos(p,t){
    var r=t.getBoundingClientRect();
    return {
      left:Math.max(0,Math.min(Math.max(0,window.innerWidth-r.width),p.left)),
      top:Math.max(0,Math.min(Math.max(0,window.innerHeight-r.height),p.top))
    };
  }
  function setCamPos(t,p){
    t.style.left=p.left+'px'; t.style.top=p.top+'px';
    t.style.right='auto'; t.style.bottom='auto';
  }
  function applyCamPos(){
    var p=loadCamPos(), t=visibleCam(); if(!p||!t)return;
    var r=t.getBoundingClientRect();
    if(!r.width||!r.height){setCamPos(t,p);return;}
    var bounded=boundCamPos(p,t); setCamPos(t,bounded);
    if(bounded.left!==p.left||bounded.top!==p.top)saveCamPos(bounded);
  }
  function syncCamDisplay(){
    if(!camBlur){ stopSeg(); cam.hidden=false; applyCamPos(); return; }
    startSeg();
  }
  function makeCamDraggable(){
    if(camDragBound)return; camDragBound=true;
    var pointerId=null, target=null, sx=0, sy=0, ox=0, oy=0, next=null;
    function offset(t,x,y){
      t.style.setProperty('--oa-cam-drag-x',x+'px');
      t.style.setProperty('--oa-cam-drag-y',y+'px');
    }
    function down(e){
      var t=visibleCam();
      if(target||!t||e.target!==t||e.isPrimary===false||e.button!==0)return;
      var r=t.getBoundingClientRect(); target=t; pointerId=e.pointerId;
      sx=e.clientX; sy=e.clientY; ox=r.left; oy=r.top; next={left:ox,top:oy};
      t.setAttribute('data-dragging',''); offset(t,0,0);
      try{t.setPointerCapture(pointerId);}catch(err){}
      e.preventDefault();
    }
    function move(e){
      if(!target||e.pointerId!==pointerId)return;
      next=boundCamPos({left:ox+e.clientX-sx,top:oy+e.clientY-sy},target);
      offset(target,next.left-ox,next.top-oy); e.preventDefault();
    }
    function up(e){
      if(!target||e.pointerId!==pointerId)return;
      var t=target, id=pointerId, p=next||{left:ox,top:oy};
      t.style.removeProperty('--oa-cam-drag-x');
      t.style.removeProperty('--oa-cam-drag-y');
      setCamPos(t,p); saveCamPos(p); t.removeAttribute('data-dragging');
      try{if(t.hasPointerCapture(id))t.releasePointerCapture(id);}catch(err){}
      target=null; pointerId=null; next=null; applyCamPos(); e.preventDefault();
    }
    document.addEventListener('pointerdown',down,true);
    document.addEventListener('pointermove',move,true);
    document.addEventListener('pointerup',up,true);
    document.addEventListener('pointercancel',up,true);
    window.addEventListener('resize',function(){if(!target)applyCamPos();});
    applyCamPos();
  }
`;

export function cam(_svgs: HandoffSvgs): string {
  return CAM_SCRIPT;
}
