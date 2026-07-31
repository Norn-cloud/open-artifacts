import type { HandoffSvgs } from "./svgs";

// onRecStop: the MediaRecorder onstop handler. Builds the multipart FormData
// (media blob + events JSON + meta JSON with the pinned version), POSTs to the
// handoffs API, stores the author delete token, updates the in-memory handoff
// to the saved recording, and reloads the frame so the captured coordinates
// re-map cleanly. Failures fall back to IDLE with a status message.
export function upload(_svgs: HandoffSvgs): string {
  return `
  function onRecStop(){
    var dur=performance.now()-recStart;
    toFrame({type:'oa:handoff:record:disarm'});
    stopMicMeter();
    stopSeg();
    cleanupStream();
    if(timerInt)clearInterval(timerInt);
    if(recTimeout)clearTimeout(recTimeout);
    var blob=new Blob(chunks, {type:(mr&&mr.mimeType)||'video/webm'});
    var eventsJson=JSON.stringify(events);
    var meta={durationMs:Math.round(dur),hasVideo:true,hasAudio:true,hasBlur:recUsedBlur,author:getName()||null,version:window.__oaViewedVersion||1};
    var fd=new FormData();
    fd.append('media', blob, 'media.webm');
    fd.append('events', eventsJson);
    fd.append('meta', JSON.stringify(meta));
    setStatus('<span class="oa-handoff-spin"></span>Saving handoff…');
    state='SAVING';
    fetch('/api/artifacts/'+ID+'/handoffs', {method:'POST', headers:authHeaders(), body:fd}).then(function(r){
      if(r.status===401||r.status===403) throw new Error('You need owner access to record');
      if(!r.ok) throw new Error('Upload failed ('+r.status+')');
      return r.json();
    }).then(function(h){
      if(h.deleteToken)saveDelToken(h.id, h.deleteToken);
      handoff={id:h.id,version:h.version,durationMs:h.durationMs,hasVideo:h.hasVideo,hasAudio:h.hasAudio,hasBlur:!!h.hasBlur,author:h.author,createdAt:h.createdAt};
      state='IDLE'; setStatus('Handoff saved'); render();
      try{frame.contentWindow.location.reload();}catch(e){frame.src=frame.src;}
    }).catch(function(err){ state='IDLE'; setStatus(esc(err.message||'Upload failed')); render(); });
  }
`;
}
