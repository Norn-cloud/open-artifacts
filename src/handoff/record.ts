import type { HandoffSvgs } from "./svgs";

// The recording engine: getUserMedia, MediaRecorder, mic meter, the 3-2-1
// countdown, caps, and stream cleanup. Does NOT own the render functions
// (those live in state.ts) — only the capture lifecycle. startRecord is the
// entry from the Record/Re-record button; stopRecord/cancelRecord from the
// dock controls; onRecStop (in upload.ts) is the MediaRecorder onstop handler.
export function record(_svgs: HandoffSvgs): string {
  return `
  // Live mic level meter so a silent recording is diagnosed at record time,
  // not after. A flat bar means the mic track has no signal (muted by the OS,
  // wrong input device, or permissions) and the recorded audio will be silent.
  var audioCtx=null, analyser=null, micLevel=0, micRAF=0;
  // Client-side ceilings so a long recording uploads cleanly instead of
  // hitting the server's 64 MiB 413 and wasting the clip. 10 min / 60 MiB.
  var MAX_REC_MS=600000, MAX_REC_BYTES=60*1024*1024, recBytes=0, recTimeout=0;
  // Whether the in-progress recording actually captured the composited
  // (blurred) canvas stream, set in beginRecord. Decoupled from the camBlur
  // *preference* because the canvas may not be live yet on the first record
  // (MediaPipe still loading) — recording raw + flagging hasBlur=false keeps
  // playback honest (it re-composites live instead of trusting a missing blur).
  var recUsedBlur=false, recordStarting=false;

  function startRecord(){
    if(!window.MediaRecorder){ setStatus('Recording not supported in this browser'); return; }
    if(recordStarting||state!=='IDLE')return;
    recordStarting=true;
    requestPreview().then(function(s){
      if(!s||state!=='IDLE'||root.hidden){recordStarting=false;return;}
      // syncCamDisplay has already started the optional blur preview. Wait for
      // its first composite before choosing the stream MediaRecorder captures.
      maybeWaitForBlur(s);
    });
  }
  // Wait until the blur composite is actually producing frames before recording,
  // so the encoded stream is the composited canvas (crisp person + blurred bg),
  // not the raw camera. Time-bounded: a slow/broken MediaPipe load falls back to
  // raw camera with hasBlur=false so playback re-composites rather than trusting
  // a blur that never made it into the file.
  function maybeWaitForBlur(s){
    if(!camBlur || segFirstFrame){ beginRecord(s); return; }
    setStatus('<span class="oa-handoff-spin"></span>Starting blur…');
    var waited=0;
    function tick(){
      if(!camBlur){ setStatus(''); beginRecord(s); return; }
      if(segFirstFrame){ setStatus(''); beginRecord(s); return; }
      waited+=60;
      if(waited>=4000){ setStatus('Blur unavailable - recording raw'); beginRecord(s); return; }
      setTimeout(tick,60);
    }
    setTimeout(tick,60);
  }
  function beginRecord(s){
    // Diagnose a silent-mic track now: a track that is muted at the OS level
    // or reports readyState 'ended' captures zero audio. Surface it so the
    // user sees "Mic muted by system" instead of a silent clip after Stop.
    var aTracks=s.getAudioTracks();
    if(!aTracks.length){ setStatus('No audio track - mic unavailable'); }
    else if(aTracks.some(function(t){return t.muted||t.readyState==='ended';})){
      setStatus('Mic muted by system - check your OS mic permissions');
    }
    startMicMeter(s);
    var mime=pickMime();
    // When blur is on AND the composite canvas is live, record the canvas
    // stream (crisp person + blurred bg) so the saved file carries the blur;
    // splice in the mic track since captureStream() carries video only.
    // maybeWaitForBlur (called before this) ensures segFirstFrame is already
    // true when blur is on, so this branch is taken and the blur is persisted
    // into the file. The raw-camera fallback (hasBlur=false) only fires when
    // blur is off or MediaPipe failed/timed out - playback then re-composites
    // live rather than trusting a blur that isn't in the file.
    var recStream = stream;
    var usedBlur = false;
    if(camBlur && segCanvas && !segCanvas.hidden && segFirstFrame){
      var cs = segCanvas.captureStream ? segCanvas.captureStream(30) : null;
      if(cs){
        var at = s.getAudioTracks()[0];
        if(at) try{ cs.addTrack(at); }catch(e){}
        recStream = cs;
        usedBlur = true;
      }
    }
    recUsedBlur = usedBlur;
    // 2.5 Mbps VP8 / 64 kbps opus: 720p is sharp without blowing the 64 MiB
    // server cap (2.5Mbps * 600s ~= 188 MiB, so the 10-min client ceiling is
    // the real limiter; a 1-min clip is ~19 MiB). A 250ms timeslice keeps
    // motion from compressing into blocky 1s chunks.
    try{ mr=new MediaRecorder(recStream, mime?{mimeType:mime, audioBitsPerSecond:64000, videoBitsPerSecond:2500000}:undefined); }
    catch(e){ recordStarting=false; setStatus('MediaRecorder unavailable'); return; }
    chunks=[]; mr.ondataavailable=function(e){ if(e.data&&e.data.size){chunks.push(e.data); recBytes+=e.data.size; if(recBytes>=MAX_REC_BYTES)stopRecord();} }; mr.onstop=onRecStop;
    // 3-2-1 countdown overlay before the recorder starts (Loom's de-facto
    // recorder convention): gives the creator a beat to compose before capture
    // begins, and keeps the initial Record click as the user-gesture that
    // authorizes later autoplay. Reduced-motion skips straight to recording.
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    if(reduced){ startRecordingNow(); }
    else { runCountdown(3, startRecordingNow); }
    function startRecordingNow(){
      if(!recordStarting||root.hidden){cancelRecord(false);return;}
      mr.start(250);
      recBytes=0; if(recTimeout)clearTimeout(recTimeout); recTimeout=setTimeout(stopRecord, MAX_REC_MS);
      recordStarting=false; recStart=performance.now(); events=[]; state='RECORDING';
      setRecordingIndicator(true);
      toFrame({type:'oa:handoff:record:arm'});
      if(timerInt)clearInterval(timerInt); timerInt=setInterval(tickTimer,250);
      render();
    }
    // runCountdown(n, done): show n..1 in the fullscreen overlay, then call
    // done. Cleared on cancel so a cancelled countdown never starts recording.
    function runCountdown(n, done){
      if(!countdownEl){ done(); return; }
      var cur=n;
      function showNum(){
        countdownEl.innerHTML='';
        var span=document.createElement('span');
        span.textContent=String(cur);
        countdownEl.appendChild(span);
        countdownEl.setAttribute('data-num',String(cur));
        countdownEl.setAttribute('data-on','');
      }
      function step(){
        if(cur<=0){ hideCountdown(); done(); return; }
        showNum();
        cur-=1;
        countdownTimer=setTimeout(step,800);
      }
      step();
    }
  }
  // Live RMS meter on the mic track. Writes micLevel (0..1) sampled each rAF
  // tick by renderRec's level bar. Belt-and-suspenders against the static
  // readyState check: a track can report live but still deliver zero frames.
  function startMicMeter(s){
    try{
      var AC=window.AudioContext||window.webkitAudioContext; if(!AC)return;
      audioCtx=new AC(); var src=audioCtx.createMediaStreamSource(s);
      analyser=audioCtx.createAnalyser(); analyser.fftSize=256; analyser.smoothingTimeConstant=0.7;
      src.connect(analyser); var buf=new Uint8Array(analyser.frequencyBinCount); var sum=0;
      function tick(){ if(!analyser){return;} analyser.getByteTimeDomainData(buf); var s=0; for(var i=0;i<buf.length;i++){var v=(buf[i]-128)/128; s+=v*v;} micLevel=Math.sqrt(s/buf.length); micRAF=requestAnimationFrame(tick); }
      tick();
    }catch(e){ /* meter optional */ }
  }
  function stopMicMeter(){ if(micRAF)cancelAnimationFrame(micRAF); micRAF=0; if(audioCtx){audioCtx.close().catch(function(){}); audioCtx=null;} analyser=null; micLevel=0; }
  function pickMime(){
    // vp8+opus first: vp9+opus is known to record silent audio on some Chrome
    // builds (the very symptom this fix targets). vp8+opus is the reliable
    // default across Chrome/Firefox; mp4 is the Safari fallback.
    var cands=['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm','video/mp4'];
    for(var i=0;i<cands.length;i++){ if(MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(cands[i]))return cands[i]; }
    return '';
  }
  function stopRecord(){ if(mr&&mr.state!=='inactive')mr.stop(); }
  function cancelRecord(restorePreview){ hideCountdown(); recordStarting=false; events=[]; if(recTimeout)clearTimeout(recTimeout); if(mr&&mr.state!=='inactive'){mr.onstop=null; mr.stop();} stopMicMeter(); cleanupStream(); toFrame({type:'oa:handoff:record:disarm'}); state='IDLE'; if(timerInt)clearInterval(timerInt); render(); if(restorePreview!==false)requestPreview(); }
`;
}
