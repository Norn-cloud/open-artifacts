import type { HandoffSvgs } from "./svgs";

// Playback: startPlay fetches the events + media blobs, builds a blob URL,
// drives the <video>, and tells the frame to replay the cursor/scroll/click
// events. If the recording was made against a different version, the frame is
// reloaded to that version first so the captured coordinates re-map. The speed
// selector + scrubber are rendered in render.ts's renderPlay; this module owns
// the playback lifecycle + the cam.* event wiring (timeupdate, ended, etc.).
// PAUSE_GLYPH/PLAY_GLYPH are string constants so togglePause can swap the
// button icon without re-rendering the row.
export function playback(svgs: HandoffSvgs): string {
  return `
  var PAUSE_GLYPH=${JSON.stringify(svgs.pause)}, PLAY_GLYPH=${JSON.stringify(svgs.play)};
  // Events fetched for the current playback (set in startPlay, read by
  // renderScrubMarkers). Shared via the IIFE closure.
  var playEvents=[];
  function discardPlaybackSource(){
    if(playUrl&&playUrl.indexOf('blob:')===0)URL.revokeObjectURL(playUrl);
    playUrl=null;
  }
  function isCurrentPlayback(url){return state==='PLAYING'&&playUrl===url;}
  function playbackFailed(url,err){
    if(!isCurrentPlayback(url))return;
    setStatus('Playback failed: '+(err&&err.message||'unsupported recording format'));
  }
  function playbackStarted(url,status){
    if(!isCurrentPlayback(url))return;
    toFrame({type:'oa:handoff:play', events:playEvents, durationMs:playDur});
    setStatus(status||'');
  }
  function playMuted(url){
    if(!isCurrentPlayback(url))return;
    cam.muted=true;
    var attempt; try{attempt=cam.play();}catch(err){playbackFailed(url,err);return;}
    Promise.resolve(attempt).then(function(){
      playbackStarted(url,'Tap the video to unmute');
      cam.onclick=function(){cam.muted=false;cam.onclick=null;setStatus('');};
    }).catch(function(err){playbackFailed(url,err);});
  }
  function playLoadedMedia(url){
    if(!isCurrentPlayback(url))return;
    cam.muted=false; cam.volume=1; cam.playbackRate=loadSpeed();
    var attempt; try{attempt=cam.play();}catch(e){playMuted(url);return;}
    Promise.resolve(attempt).then(function(){playbackStarted(url,'');}).catch(function(){playMuted(url);});
  }
  function loadPlaybackMedia(url){
    cam.onerror=function(){playbackFailed(url,cam.error);};
    cam.onloadedmetadata=function(){
      if(!isCurrentPlayback(url))return;
      cam.onloadedmetadata=null;
      playLoadedMedia(url);
    };
    cam.src=url;
    try{cam.load();}catch(err){playbackFailed(url,err);}
  }
  function startPlay(hid){
    if(recordStarting)return;
    var h=handoff; if(!h||h.id!==hid)return;
    stopPreview();
    state='PLAYING'; playDur=h.durationMs||0; scrubbing=false;
    render();
    setStatus('<span class="oa-handoff-spin"></span>Loading handoff…');
    var wantV=h.version, curV=window.__oaViewedVersion||1;
    var loadP;
    if(wantV!==curV){ loadP=new Promise(function(res){ frame.addEventListener('load',function(){res();},{once:true}); }); frame.src='/a/'+ID+'/frame?v='+wantV; }
    else loadP=Promise.resolve();
    var revision=encodeURIComponent(h.createdAt||'legacy');
    var handoffBase='/api/artifacts/'+ID+'/handoffs/'+hid;
    Promise.all([
      loadP,
      fetch(handoffBase+'/events?r='+revision,{cache:'no-store'}).then(function(r){return r.ok?r.json():Promise.reject(new Error('events '+r.status));}),
      fetch(handoffBase+'/media?r='+revision,{cache:'no-store'}).then(function(r){return r.ok?r.blob():Promise.reject(new Error('media '+r.status));}).then(normalizeMediaBlob)
    ]).then(function(arr){
      var evs=arr[1]||[]; playEvents=Array.isArray(evs)?evs:[]; discardPlaybackSource(); playUrl=URL.createObjectURL(arr[2]); var url=playUrl;
      // Re-render scrubber markers now that playEvents is populated. renderPlay
      // called renderScrubMarkers synchronously in render() before the fetch
      // resolved (playEvents was []); paint the real markers here.
      var sw=document.getElementById('oa-handoff-scrub-wrap'); if(sw) renderScrubMarkers(sw);
      cam.srcObject=null; setBubbleFlag('data-mirror',false); setRecordingIndicator(false); makeCamDraggable();
      // If the clip was recorded with blur, the background is already blurred
      // in the file - don't re-composite (would double-blur). If it was
      // recorded without blur but the viewer toggled Blur on, re-composite live.
      var recHasBlur = !!(handoff && handoff.hasBlur);
      cam.hidden=false; applyCamPos();
      if(camBlur && !recHasBlur){ startSeg(); } else { stopSeg(); }
      cam.onclick=null;
      cam.ontimeupdate=function(){ var t=cam.currentTime*1000; var tm=document.getElementById('oa-handoff-time'); if(tm)tm.textContent=fmt(t); if(!scrubbing){var s=controls.querySelector('.oa-handoff-scrub'); if(s)s.value=t;} };
      cam.onended=function(){ toFrame({type:'oa:handoff:stop'}); discardPlaybackSource(); clearPreviewElement(); state='IDLE'; render(); syncIdlePreview(); };
      // Switching from a MediaStream preview to a blob URL leaves Chromium's
      // media resource selection pending. Explicitly load the new source and
      // wait for metadata before play(), otherwise it can reject at readyState
      // 0 with "The element has no supported sources" for a valid WebM.
      loadPlaybackMedia(url);
    }).catch(function(err){ setStatus('Load failed: '+(err&&err.message||'')); state='IDLE'; render(); syncIdlePreview(); });
  }
  // Derive scrubber markers from playEvents: a tick at each click, plus a tick
  // at scroll-stops (a scroll event after >=1.5s of no scroll). Capped at ~30
  // so a long recording doesn't paint a solid bar. Rendered as absolutely
  // positioned .oa-handoff-mark ticks inside the scrubber wrap; clicking one
  // seeks (reuses the oa:handoff:seek message the scrubber already sends).
  function renderScrubMarkers(scrubWrap){
    if(!scrubWrap||!playDur)return;
    var old=scrubWrap.querySelectorAll('.oa-handoff-mark'); for(var i=0;i<old.length;i++){old[i].remove();}
    var picks=[];
    var lastScrollT=-Infinity;
    for(var i=0;i<playEvents.length;i++){
      var e=playEvents[i]; if(!e||typeof e.t!=='number')continue;
      if(e.kind==='click'){ picks.push({t:e.t, kind:'click'}); }
      else if(e.kind==='scroll'){ if(e.t-lastScrollT>=1500){ picks.push({t:e.t, kind:'scroll'}); lastScrollT=e.t; } }
      if(picks.length>=30)break;
    }
    for(var i=0;i<picks.length;i++){
      var p=picks[i];
      var pct=Math.max(0,Math.min(100,(p.t/playDur)*100));
      var m=el('span','oa-handoff-mark');
      m.style.left=pct+'%';
      m.setAttribute('data-kind',p.kind);
      m.title=(p.kind==='click'?'Click':'Scroll')+' at '+fmt(p.t);
      (function(t){ m.onclick=function(){ scrubbing=true; if(cam){try{cam.currentTime=t/1000}catch(e){}} toFrame({type:'oa:handoff:seek',t:t}); var s=controls.querySelector('.oa-handoff-scrub'); if(s)s.value=t; scrubbing=false; }; })(p.t);
      scrubWrap.appendChild(m);
    }
  }
  function togglePause(){ if(!cam)return;
    var pp=document.getElementById('oa-handoff-pp'); var lb=pp&&pp.querySelector('.oa-dock-label'); var ic=pp&&pp.querySelector('.oa-dock-icon');
    if(cam.paused){ cam.play(); toFrame({type:'oa:handoff:resume'}); if(lb)lb.textContent='Pause'; if(ic)ic.innerHTML=PAUSE_GLYPH; }
    else { cam.pause(); toFrame({type:'oa:handoff:pause'}); if(lb)lb.textContent='Play'; if(ic)ic.innerHTML=PLAY_GLYPH; }
  }
  function exitPlay(){ toFrame({type:'oa:handoff:stop'}); stopSeg(); clearPreviewElement(); discardPlaybackSource(); state='IDLE'; render();
    var curV=window.__oaViewedVersion||1; frame.src='/a/'+ID+'/frame?v='+curV; }
`;
}
