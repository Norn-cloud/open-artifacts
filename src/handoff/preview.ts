import type { HandoffSvgs } from "./svgs";

// Owns the idle camera session independently from MediaRecorder. Opening the
// dock starts a neutral live preview; recording reuses the same stream, while
// closing invalidates pending permission requests and stops every late track.
const PREVIEW_SCRIPT = `
  var previewRequest=null, previewGeneration=0;
  function previewConstraints(){
    return {
      video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},
      audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}
    };
  }
  function stopTracks(s){
    if(!s||!s.getTracks)return;
    s.getTracks().forEach(function(track){try{track.stop();}catch(e){}});
  }
  function setBubbleFlag(name,on){
    [cam,segCanvas].forEach(function(node){
      if(!node)return;
      if(on)node.setAttribute(name,''); else node.removeAttribute(name);
    });
  }
  function clearPreviewElement(){
    if(!cam)return;
    try{cam.pause();}catch(e){}
    cam.srcObject=null; cam.removeAttribute('src'); cam.hidden=true;
    cam.onclick=null; cam.onloadedmetadata=null; cam.ontimeupdate=null; cam.onended=null;
    setBubbleFlag('data-mirror',false); setBubbleFlag('data-rec',false);
  }
  function attachPreview(s){
    if(!s||!canManage||state!=='IDLE'||root.hidden){stopTracks(s);return null;}
    stream=s; cam.removeAttribute('src'); cam.muted=true; cam.srcObject=s;
    setBubbleFlag('data-mirror',true); setBubbleFlag('data-rec',false);
    cam.hidden=false; makeCamDraggable(); applyCamPos();
    var show=function(){if(stream===s)syncCamDisplay();};
    try{var playing=cam.play(); if(playing&&playing.then)playing.then(show).catch(show); else show();}
    catch(e){show();}
    return s;
  }
  function requestPreview(){
    if(!canManage||state!=='IDLE'||root.hidden)return Promise.resolve(null);
    if(stream)return Promise.resolve(stream);
    if(previewRequest)return previewRequest;
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
      setStatus('Camera/mic not supported here'); return Promise.resolve(null);
    }
    var generation=previewGeneration;
    setStatus('<span class="oa-handoff-spin"></span>Starting camera…');
    var request=navigator.mediaDevices.getUserMedia(previewConstraints()).then(function(s){
      if(previewRequest===request)previewRequest=null;
      if(generation!==previewGeneration||root.hidden||state!=='IDLE'){stopTracks(s);return null;}
      setStatus(''); return attachPreview(s);
    }).catch(function(err){
      if(previewRequest===request)previewRequest=null;
      if(generation===previewGeneration&&!root.hidden)setStatus('Camera/mic denied: '+(err&&err.message?err.message:'permission needed'));
      return null;
    });
    previewRequest=request; return request;
  }
  // Idle Handoff has two distinct modes: a saved handoff is playback-first
  // and must stay camera-free; an empty handoff is record-first and previews
  // the capture. Re-record remains an explicit camera request in startRecord.
  function syncIdlePreview(){
    if(handoff){stopPreview();return Promise.resolve(null);}
    return requestPreview();
  }
  function stopPreview(){
    previewGeneration+=1; previewRequest=null; stopSeg();
    var active=stream; stream=null; stopTracks(active); clearPreviewElement();
  }
  function cleanupStream(){stopPreview();}
  function setRecordingIndicator(on){setBubbleFlag('data-rec',on);}
`;

export function preview(_svgs: HandoffSvgs): string {
  return PREVIEW_SCRIPT;
}
