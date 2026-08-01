import type { HandoffSvgs } from "./svgs";

// Portrait-segmentation background blur via MediaPipe Selfie Segmentation
// (self-hosted same-origin at /vendor/mediapipe/*, no CSP widening). When on,
// a hidden <video> feeds MediaPipe per frame; the visible overlay becomes a
// <canvas> composited crisp-person + blurred-background. When off, the raw
// <video> is the overlay. Persisted so record and play share the choice; the
// recorded file carries hasBlur so playback knows not to double-process an
// already-blurred clip. mkBlurBtn builds the icon toggle (accent-filled +
// aria-pressed when on); the oa-dock-btn--blur class carries the on/off
// styling (see styles.ts).
export function blur(svgs: HandoffSvgs): string {
  return `
  var BLUR_KEY='oa-handoff-blur', camBlur=false;
  var seg=null, segReady=false, segLoading=false, segRAF=0, segCanvas=null, segCtx=null, segOnResults=null, segFirstFrame=false;
  function loadBlur(){ try{ camBlur=localStorage.getItem(BLUR_KEY)==='1'; }catch(e){} }
  function saveBlur(v){ try{localStorage.setItem(BLUR_KEY, v?'1':'0');}catch(e){} }
  function toggleBlur(){ camBlur=!camBlur; saveBlur(camBlur); var b=document.getElementById('oa-handoff-blur'); if(b){ b.setAttribute('aria-pressed',String(camBlur)); } if(state==='RECORDING'||state==='PLAYING'){ syncCamDisplay(); } }
  // mkBlurBtn: an icon toggle (accent-filled + aria-pressed when on). The
  // oa-dock-btn--blur class carries the on/off styling (see styles.ts).
  function mkBlurBtn(){ var b=dockBtn('oa-dock-btn--blur', ${JSON.stringify(svgs.blur)}, 'Blur', {id:'oa-handoff-blur', pressed:camBlur, title:'Blur the webcam background'}); b.onclick=toggleBlur; return b; }
  loadBlur();
  // Lazy-load MediaPipe once. Returns a promise resolving to the segmenter.
  function loadSeg(){
    if(segReady) return Promise.resolve(seg);
    if(segLoading) return segLoading;
    segLoading = new Promise(function(res, rej){
      var s=document.createElement('script');
      s.src='/vendor/mediapipe/selfie_segmentation.js';
      s.onload=function(){
        try{
          var SS=window.SelfieSegmentation;
          seg=new SS({locateFile:function(p){ return '/vendor/mediapipe/'+p; }});
          seg.onResults(function(r){ if(segOnResults)segOnResults(r); });
          seg.setOptions({modelSelection:1});
          seg.initialize().then(function(){ segReady=true; res(seg); }).catch(rej);
        }catch(e){ rej(e); }
      };
      s.onerror=function(){ rej(new Error('MediaPipe failed to load')); };
      document.head.appendChild(s);
    });
    segLoading.catch(function(){ segLoading=null; });
    return segLoading;
  }
  // Composite one frame: crisp person + blurred background, using the mask as
  // the alpha stencil. Standard MediaPipe composite idiom.
  function composite(video, mask){
    var c=segCanvas, ctx=segCtx; if(!c||!ctx)return;
    var vw=video.videoWidth, vh=video.videoHeight; if(!vw||!vh)return;
    if(c.width!==vw){ c.width=vw; c.height=vh; }
    ctx.save();
    ctx.globalCompositeOperation='source-over';
    ctx.filter='blur(12px)';
    ctx.drawImage(video, 0, 0, vw, vh);
    ctx.filter='none';
    // Cut the person hole out of the blurred bg, then draw crisp person behind.
    ctx.globalCompositeOperation='destination-out';
    ctx.drawImage(mask, 0, 0, vw, vh);
    ctx.globalCompositeOperation='destination-over';
    ctx.drawImage(video, 0, 0, vw, vh);
    ctx.restore();
  }
  // Drive MediaPipe at rAF while the overlay is visible + blur is on.
  function segLoop(){
    if(!segRAF)return;
    var v=cam;
    if(v.readyState>=2){
      // Until MediaPipe is ready, draw the raw video onto the canvas so the
      // bubble shows the camera (unblurred) instead of collapsing to empty.
      // Once ready, seg.send() fires onResults -> composite (blurred bg).
      if(segReady){ try{ seg.send({image:v}); }catch(e){} }
      else if(segCtx && segCanvas && !segCanvas.hidden){
        var vw=v.videoWidth, vh=v.videoHeight;
        if(vw&&vh){ if(segCanvas.width!==vw){segCanvas.width=vw; segCanvas.height=vh;} segCtx.globalCompositeOperation='source-over'; segCtx.filter='none'; segCtx.drawImage(v,0,0,vw,vh); }
      }
    }
    segRAF=requestAnimationFrame(segLoop);
  }
  function startSeg(){
    if(!camBlur)return;
    if(!segCanvas){ segCanvas=document.getElementById('oa-handoff-cam-canvas'); segCtx=segCanvas?segCanvas.getContext('2d'):null; }
    if(!segCanvas)return;
    if(cam.hasAttribute('data-mirror'))segCanvas.setAttribute('data-mirror',''); else segCanvas.removeAttribute('data-mirror');
    if(cam.hasAttribute('data-rec'))segCanvas.setAttribute('data-rec',''); else segCanvas.removeAttribute('data-rec');
    // Show the canvas overlay with the raw video drawn as a fallback so the
    // circular bubble stays visible while MediaPipe loads + before the first
    // segmentation lands (otherwise a 0x0 canvas collapses and the bubble
    // vanishes). The video is NOT hidden until the first composite succeeds;
    // it is just covered by the canvas. Once MediaPipe returns a frame, the
    // composite path takes over and the video is hidden.
    segCanvas.hidden=false; applyCamPos();
    segFirstFrame=false;
    setStatus('<span class="oa-handoff-spin"></span>Loading blur…');
    segOnResults=function(r){ if(r&&r.segmentationMask&&r.image){ composite(cam, r.segmentationMask); if(!segFirstFrame){ segFirstFrame=true; cam.hidden=true; } setStatus(''); } };
    loadSeg().then(function(){ if(!segRAF && camBlur){ segRAF=requestAnimationFrame(segLoop); } }).catch(function(e){ setStatus('Blur load failed: '+(e&&e.message||'')); });
  }
  function stopSeg(){
    if(segRAF)cancelAnimationFrame(segRAF); segRAF=0; segOnResults=null;
    if(segCanvas){ segCanvas.hidden=true; }
  }
`;
}
