import type { HandoffSvgs } from "./svgs";

// Camera bubble: draggable to any screen corner during record (selfie preview)
// and play (playback). Position kept as {left,top} so it survives between
// record and play; defaults to bottom-right. Pointer-event based so it works
// for mouse, touch, and pen. visibleCam returns the live overlay element
// (the raw <video> or, when blur is on and live, the composite <canvas>);
// syncCamDisplay re-syncs which element is the overlay after a blur toggle.
export function cam(_svgs: HandoffSvgs): string {
  return `
  // Drag the webcam overlay to any of the four screen corners during record
  // (selfie preview) and play (playback). Position is kept as {left,top} so it
  // survives between record and play; defaults to bottom-right. Pointer-event
  // based so it works for mouse, touch, and pen. The corner the closest edge
  // snaps toward is irrelevant - the overlay goes wherever you drop it.
  var CAM_KEY='oa-handoff-cam-pos', camDragBound=false;
  function loadCamPos(){ try{ var s=localStorage.getItem(CAM_KEY); if(s){var p=JSON.parse(s); if(p&&typeof p.left==='number'&&typeof p.top==='number')return p;}}catch(e){} return null; }
  function saveCamPos(p){ try{localStorage.setItem(CAM_KEY, JSON.stringify(p));}catch(e){} }
  function applyCamPos(){ var p=loadCamPos(); if(!p)return; var t=visibleCam(); if(!t)return; t.style.left=p.left+'px'; t.style.top=p.top+'px'; t.style.right='auto'; t.style.bottom='auto'; }
  function visibleCam(){ return (camBlur&&segCanvas&&!segCanvas.hidden) ? segCanvas : cam; }
  function syncCamDisplay(){
    if(!camBlur){ stopSeg(); cam.hidden=false; applyCamPos(); return; }
    startSeg();
  }
  function makeCamDraggable(){
    if(camDragBound)return; camDragBound=true;
    var sx=0, sy=0, ox=0, oy=0, w=0, h=0, dragging=false;
    // Delegate pointerdown at the document level so the drag works on
    // whichever element is the live overlay - the raw <video> when blur is
    // off, or the composite <canvas> when blur is on (the <video> is hidden
    // in that case, so a pointerdown bound only on cam would never fire).
    // The target check filters out clicks on the dock and other chrome.
    // Move on transform (GPU composited, no layout) during the drag for
    // smooth 60fps alongside the backdrop-filtered dock + segLoop canvas;
    // commit left/top once on pointerup so the persisted position lands.
    function down(e){ var t=visibleCam(); if(!t||e.target!==t)return; dragging=true; t.setAttribute('data-dragging',''); var pt=e.touches?e.touches[0]:e; sx=pt.clientX; sy=pt.clientY; var r=t.getBoundingClientRect(); w=r.width; h=r.height; ox=r.left; oy=r.top; t.style.transform='translate3d(0,0,0)'; e.preventDefault(); }
    function move(e){ if(!dragging)return; var t=visibleCam()||cam; var pt=e.touches?e.touches[0]:e; var nx=Math.max(0,Math.min(window.innerWidth-w, ox+(pt.clientX-sx))); var ny=Math.max(0,Math.min(window.innerHeight-h, oy+(pt.clientY-sy))); t.style.transform='translate3d('+(nx-ox)+'px,'+(ny-oy)+'px,0)'; e.preventDefault(); }
    function up(e){ if(!dragging)return; dragging=false; var t=visibleCam(); if(t){ t.removeAttribute('data-dragging'); var r=t.getBoundingClientRect(); var p={left:Math.max(0,Math.min(window.innerWidth-w,r.left)), top:Math.max(0,Math.min(window.innerHeight-h,r.top))}; t.style.transform=''; t.style.left=p.left+'px'; t.style.top=p.top+'px'; t.style.right='auto'; t.style.bottom='auto'; saveCamPos(p); } }
    document.addEventListener('pointerdown',down,true);
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
    window.addEventListener('pointercancel',up);
    applyCamPos();
  }
`;
}
