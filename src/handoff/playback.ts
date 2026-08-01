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
    Promise.all([
      loadP,
      fetch('/api/artifacts/'+ID+'/handoffs/'+hid+'/events').then(function(r){return r.ok?r.json():Promise.reject(new Error('events '+r.status));}),
      fetch('/api/artifacts/'+ID+'/handoffs/'+hid+'/media').then(function(r){return r.ok?r.blob():Promise.reject(new Error('media '+r.status));})
    ]).then(function(arr){
      var evs=arr[1]||[]; playEvents=Array.isArray(evs)?evs:[]; if(playUrl){URL.revokeObjectURL(playUrl); playUrl=null;} playUrl=URL.createObjectURL(arr[2]); var url=playUrl;
      // Re-render scrubber markers now that playEvents is populated. renderPlay
      // called renderScrubMarkers synchronously in render() before the fetch
      // resolved (playEvents was []); paint the real markers here.
      var sw=document.getElementById('oa-handoff-scrub-wrap'); if(sw) renderScrubMarkers(sw);
      cam.srcObject=null; setBubbleFlag('data-mirror',false); setRecordingIndicator(false); makeCamDraggable(); cam.src=url;
      // If the clip was recorded with blur, the background is already blurred
      // in the file - don't re-composite (would double-blur). If it was
      // recorded without blur but the viewer toggled Blur on, re-composite live.
      var recHasBlur = !!(handoff && handoff.hasBlur);
      cam.hidden=false; applyCamPos();
      if(camBlur && !recHasBlur){ startSeg(); } else { stopSeg(); }
      // Explicit unmute: the <video> carries no muted content attribute, so the
      // recorded audio plays. Re-assert on loadedmetadata in case a new src
      // load resets the muted state, and set volume too.
      cam.muted=false; cam.volume=1;
      // Apply the persisted playback speed to the <video> on load and on each
      // new metadata load (a new src resets playbackRate to 1).
      var sp=loadSpeed(); try{ cam.playbackRate=sp; }catch(e){}
      cam.onloadedmetadata=function(){ try{ cam.muted=false; cam.volume=1; cam.playbackRate=loadSpeed(); }catch(e){} };
      cam.onclick=null;
      cam.ontimeupdate=function(){ var t=cam.currentTime*1000; var tm=document.getElementById('oa-handoff-time'); if(tm)tm.textContent=fmt(t); if(!scrubbing){var s=controls.querySelector('.oa-handoff-scrub'); if(s)s.value=t;} };
      cam.onended=function(){ toFrame({type:'oa:handoff:stop'}); if(playUrl){URL.revokeObjectURL(playUrl); playUrl=null;} clearPreviewElement(); state='IDLE'; render(); syncIdlePreview(); };
      cam.play().then(function(){ toFrame({type:'oa:handoff:play', events:playEvents, durationMs:playDur}); setStatus(''); }).catch(function(){
        // Unmuted autoplay can be blocked when the async media fetch outlasts
        // the Play click's user activation. Fall back to muted autoplay
        // (always allowed) and let the user tap the video to enable sound.
        cam.muted=true;
        cam.play().then(function(){ toFrame({type:'oa:handoff:play', events:playEvents, durationMs:playDur}); setStatus('Tap the video to unmute'); cam.onclick=function(){ cam.muted=false; cam.onclick=null; setStatus(''); }; }).catch(function(e2){ setStatus('Playback failed: '+(e2&&e2.message||'')); });
      });
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
  function exitPlay(){ toFrame({type:'oa:handoff:stop'}); stopSeg(); if(cam){cam.pause(); cam.removeAttribute('src'); cam.srcObject=null; cam.hidden=true; cam.onclick=null;} if(playUrl){URL.revokeObjectURL(playUrl); playUrl=null;} state='IDLE'; render();
    var curV=window.__oaViewedVersion||1; frame.src='/a/'+ID+'/frame?v='+curV; }
`;
}
