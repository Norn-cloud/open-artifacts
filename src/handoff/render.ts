import type { HandoffSvgs } from "./svgs";

// The three render fns (renderIdle/renderRec/renderPlay) plus the shared
// layout vocabulary: cluster() builds the always-visible status/time cluster,
// group/divider/appendGroup build control clusters, mkExit builds the close
// affordance. Layout grammar (shared across states, mirroring the approved
// comp): terminal action left, status cluster next, utilities right, Exit or
// Discard pinned far right. Always-expanded: every control renders into the
// single #oa-handoff-controls row; nothing hides behind hover.
export function render(svgs: HandoffSvgs): string {
  return `
  // cluster(html) builds the left status cluster (rec-dot + live timer while
  // RECORDING, play glyph + time while PLAYING). It is part of the controls
  // row - there is no separate minimized strip.
  function cluster(html){ var c=el('span','oa-handoff-cluster',html||''); return c; }
  function group(cls){ var g=el('div','oa-handoff-group'+(cls?' oa-handoff-group--'+cls:'')); return g; }
  function divider(){ return el('span','oa-handoff-divider'); }
  function appendGroup(children, cls){ var g=group(cls); children.forEach(function(c){ g.appendChild(c); }); controls.appendChild(g); return g; }
  // Persistent right-aligned Exit (close-dock) control, present in every owner
  // state - the same affordance as Live's Exit. Stops playback first (safe);
  // recording refuses at the manager layer with a toast.
  function requestClose(){
    if(state==='PLAYING') exitPlay();
    if(window.__oaDock) window.__oaDock.close('handoff'); else closeDock();
  }
  function mkExit(){ var b=dockBtn('oa-dock-btn--exit', ${JSON.stringify(svgs.close)}, 'Exit', {title:'Close handoff dock'}); b.onclick=requestClose; return b; }

  // Owner IDLE: Record (none) or Re-record + Play + Copy link + Delete
  // (exists). Viewer IDLE: Play + Copy link. "Cancel" is "Discard" (trash
  // glyph) so it can't read as "cancel blur". Blur is an accent-filled toggle.
  function renderIdle(){
    controls.innerHTML='';
    if(handoff){
      var play=dockBtn('oa-dock-btn--primary', ${JSON.stringify(svgs.play)}, 'Play'); play.onclick=function(){startPlay(handoff.id);};
      // Post-record Share affordance (Loom emphasizes Share after a recording).
      // Copies /a/<id>?v=<handoff.version> so the link lands on the exact
      // version the recording was made against.
      var shareBtn=dockBtn('', ${JSON.stringify(svgs.share)}, 'Copy link', {title:'Copy a link to this version', id:'oa-handoff-share'});
      shareBtn.onclick=function(){ copyShareLink(handoff.version); };
      var dur=cluster(${JSON.stringify(svgs.play)}+'<span class="oa-handoff-dur">'+fmt(handoff.durationMs)+'</span>');
      appendGroup([play, dur, shareBtn], 'primary');
      if(canManage){
        controls.appendChild(divider());
        var sec=group();
        var rerec=dockBtn('oa-dock-btn--record', ${JSON.stringify(svgs.recordDot)}, 'Re-record', {title:'Record a new handoff for this version (replaces the current one)'}); rerec.onclick=startRecord;
        sec.appendChild(rerec);
        if(getDelToken(handoff.id)||ownerToken()){
          var delBtn=dockBtn('oa-dock-btn--discard', ${JSON.stringify(svgs.discard)}, '', {title:'Delete handoff', ariaLabel:'Delete handoff'});
          delBtn.onclick=function(){delHandoff(handoff.id);};
          sec.appendChild(delBtn);
        }
        controls.appendChild(sec);
        controls.appendChild(divider());
        controls.appendChild(mkExit());
      }
      setStatus('');
    }else if(canManage){
      var b=dockBtn('oa-dock-btn--record', ${JSON.stringify(svgs.recordDot)}, 'Record'); b.onclick=startRecord;
      // Record (left) + Exit (right) flank the row. Exit carries
      // oa-dock-btn--exit (margin-left:auto) so it pins right on its own.
      appendGroup([b], 'primary');
      controls.appendChild(mkExit());
      setStatus('');
    }else{
      controls.innerHTML='';
      setStatus('No handoff recording yet');
    }
  }
  function renderRec(){
    controls.innerHTML='';
    var stop=dockBtn('oa-dock-btn--record', ${JSON.stringify(svgs.stop)}, 'Stop'); stop.onclick=stopRecord;
    // "Discard" (not "Cancel") + trash glyph: discards the recording, can't be
    // mistaken for "cancel blur" since Blur is its own accent-filled toggle.
    var discard=dockBtn('oa-dock-btn--discard', ${JSON.stringify(svgs.discard)}, 'Discard', {title:'Discard this recording'}); 
    var discardArmed=false,discardTimer=null;
    function armDiscard(){
      if(discardArmed){cancelRecord();return}
      discardArmed=true;discard.classList.add('oa-dock-btn--discard-armed');
      discard.querySelector('.oa-dock-label').textContent='Confirm discard';
      discard.title='Click again to discard this recording';
      discardTimer=setTimeout(function(){disarmDiscard()},3000);
    }
    function disarmDiscard(){
      discardArmed=false;discard.classList.remove('oa-dock-btn--discard-armed');
      discard.querySelector('.oa-dock-label').textContent='Discard';
      discard.title='Discard this recording';
      if(discardTimer){clearTimeout(discardTimer);discardTimer=null}
    }
    discard.onclick=armDiscard;
    var micWrap=el('label','oa-handoff-mic'); micWrap.title='Microphone level';
    micWrap.setAttribute('aria-label','Microphone level');
    var meter=el('span','oa-handoff-mic-bar'); meter.id='oa-handoff-mic-bar';
    micWrap.appendChild(meter);
    var cl=cluster('<span class="oa-handoff-rec-dot"></span><span class="oa-handoff-timer" id="oa-handoff-timer-txt">0:00</span>');
    // Stop (left, saves) + Discard (right, throws away) - the two terminal
    // actions, mirrored. Status cluster + mic + Blur sit between. Exit stays
    // present mid-record (as before the redesign): clicking it routes through
    // the dock manager, which refuses with a toast - pointer users keep a
    // visible, explanatory path instead of a missing button.
    appendGroup([stop, cl, micWrap], 'primary');
    controls.appendChild(divider());
    appendGroup([mkBlurBtn()]);
    controls.appendChild(divider());
    appendGroup([discard]);
    controls.appendChild(mkExit());
    if(micRAF)requestAnimationFrame(updateMicBar);
  }
  function renderPlay(){
    controls.innerHTML='';
    var pp=dockBtn('oa-dock-btn--primary', ${JSON.stringify(svgs.pause)}, 'Pause', {id:'oa-handoff-pp'}); pp.onclick=togglePause;
    var scrubWrap=el('span','oa-handoff-scrub-wrap');
    var scrub=el('input','oa-handoff-scrub'); scrub.type='range'; scrub.min=0; scrub.max=Math.max(1000,playDur); scrub.value=0; scrub.step=100;
    scrub.oninput=function(){ scrubbing=true; var t=Number(scrub.value); if(cam){try{cam.currentTime=t/1000}catch(e){}} toFrame({type:'oa:handoff:seek',t:t}); };
    scrub.onchange=function(){ scrubbing=false; };
    scrubWrap.appendChild(scrub);
    // Event-derived markers are layered on top of the scrubber in startPlay;
    // they live inside scrubWrap so they track the track.
    scrubWrap.id='oa-handoff-scrub-wrap';
    // Playback speed: a compact <select> (Loom lets viewers override the
    // creator's default). Persisted so the choice sticks across views.
    var curSpeed=loadSpeed();
    var speed=el('select','oa-handoff-speed'); speed.setAttribute('aria-label','Playback speed');
    [1,1.2,1.5].forEach(function(r){ var o=el('option',''); o.value=String(r); o.textContent=r+'x'; if(Math.abs(r-curSpeed)<0.01)o.setAttribute('selected','selected'); speed.appendChild(o); });
    speed.onchange=function(){ var v=parseFloat(speed.value); saveSpeed(v); if(cam){try{cam.playbackRate=v}catch(e){}} };
    var cl=cluster('<span class="oa-handoff-time" id="oa-handoff-time">0:00</span>');
    // Pause (primary accent) anchors the left; scrubber flexes; speed + Exit
    // (or Stop for viewers) right - the same row grammar as record.
    appendGroup([pp, cl, scrubWrap], 'primary');
    controls.appendChild(divider());
    appendGroup([speed]);
    controls.appendChild(divider());
    // Owner: persistent Exit closes the dock (stops playback first). Non-owner:
    // a Stop button exits playback to IDLE (no toggle to reopen a closed dock).
    // No Blur toggle during playback - blur only applies while recording.
    if(canManage){ controls.appendChild(mkExit()); }
    else { var stopBtn=dockBtn('', ${JSON.stringify(svgs.stop)}, 'Stop', {title:'Stop playback'}); stopBtn.onclick=exitPlay; controls.appendChild(stopBtn); }
    // Paint event-derived markers now that the scrubber exists in the DOM.
    renderScrubMarkers(scrubWrap);
  }
`;
}
