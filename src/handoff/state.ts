import type { HandoffSvgs } from "./svgs";

// The orchestrator: owns the IIFE bootstrap (DOM lookups, shared vars, state),
// the dock manager registration + toggle wiring, the render() dispatcher, and
// the inbound message listener that buffers interaction events during
// RECORDING. The render fns themselves live in render.ts; countdown/ticker
// helpers live in status.ts. Inlines SVG glyphs via JSON.stringify so the
// trusted constants are escaped at serve time. Placed last in the
// concatenation order (see index.ts) so it reads naturally as the top-level
// glue; function/var hoisting means runtime order is not sensitive to it.
//
// Always-expanded posture: the dock renders one controls row, always visible
// while the dock is open. The old strip-inline hover-expand + localStorage
// pin (oa-handoff-expanded) is gone - hover gating broke touch/keyboard, and
// the dock is small enough to just show.
export function state(_svgs: HandoffSvgs): string {
  return `
  var dataEl=document.getElementById('oa-handoff-data');
  if(!dataEl)return;
  // One handoff per artifact+version: a single object (or null) inlined at
  // serve time matching the viewed version.
  var handoff=null;
  try{handoff=JSON.parse(dataEl.textContent||'null')}catch(e){handoff=null}
  var root=document.getElementById('oa-handoff-root');
  var dock=document.getElementById('oa-handoff-dock');
  var controls=document.getElementById('oa-handoff-controls');
  var statusEl=document.getElementById('oa-handoff-status');
  var cam=document.getElementById('oa-handoff-cam');
  var toggle=document.querySelector('.oa-handoff-toggle');
  var frame=document.getElementById('oa-frame');
  var ID=window.__oaBridgeId;
  if(!root||!dock||!controls||!cam||!frame||!ID)return;

  var state='IDLE';
  var mr=null, chunks=[], stream=null, recStart=0, events=[], timerInt=null;
  var playDur=0, scrubbing=false, playUrl=null;
  // 3-2-1 countdown overlay state (module-level so cancelRecord can clear it).
  var countdownEl=document.getElementById('oa-handoff-countdown');
  var countdownTimer=null;

  // canManage gates Record/Re-record/Delete (write-gated server-side). Every
  // saved handoff opens playback-first; owners retain the header toggle while
  // viewers receive the same Play-only surface without management controls.
  var canManage = window.__oaCanManage === true;

  function openDock(){
    root.removeAttribute('hidden');
    if(toggle) toggle.setAttribute('aria-expanded','true');
    render();
    syncIdlePreview();
    // Move focus into the dock toolbar so keyboard users land on the primary
    // action (Record / Play). Deferred so render() has populated controls.
    setTimeout(function(){ var b=controls.querySelector('button'); if(b) b.focus(); },0);
  }
  function closeDock(){
    // Recording/playing hold irreplaceable in-flight work - refuse to yield.
    if(state!=='IDLE') return false;
    if(recordStarting)cancelRecord(false); else stopPreview();
    root.hidden=true;
    if(toggle) toggle.setAttribute('aria-expanded','false');
    return true;
  }
  // Register with the dock manager only when there is a header toggle (owners).
  // Non-owner viewers get an ambient Play-only dock with no toggle and no
  // manager entry, so Escape and mutual exclusion leave it alone.
  if(window.__oaDock && canManage){
    window.__oaDock.register('handoff', {
      open: openDock,
      close: closeDock,
      restoreFocus: function(){ if(window.__oaRestoreHeaderControlFocus)window.__oaRestoreHeaderControlFocus(toggle);else if(toggle)toggle.focus(); },
      refuseMessage: function(){
        if(state==='RECORDING') return 'Stop the recording before closing.';
        if(state==='SAVING') return 'Saving the handoff - please wait...';
        return 'Stop playback before closing.';
      }
    });
  }
  if(toggle) toggle.addEventListener('click', function(){
    // Toggle (open/close) through the dock manager: it tears Live down first
    // (mutual exclusion) and toasts when this dock refuses to yield.
    if(window.__oaDock) window.__oaDock.toggle('handoff'); else { root.hidden ? openDock() : closeDock(); }
  });

  function render(){ if(!controls)return;
    if(state==='IDLE')renderIdle();
    else if(state==='RECORDING')renderRec();
    else if(state==='PLAYING')renderPlay();
  }
  // A saved handoff is the artifact's default mode for both owners and viewers.
  // Route owner startup through the manager so its active-dock bookkeeping
  // stays correct and the header toggle closes on its first click.
  if(handoff){ if(window.__oaDock&&canManage)window.__oaDock.open('handoff'); else openDock(); }

  // Frame -> host: buffer interaction events during RECORDING.
  window.addEventListener('message', function(e){
    if(!e.data||typeof e.data.type!=='string')return;
    if(e.source!==frame.contentWindow)return;
    var d=e.data;
    if(d.type==='oa:handoff:event'&&state==='RECORDING'){
      // Keep the raw values for old-player compatibility and the normalized
      // geometry for recordings that must replay across responsive viewports.
      // Undefined properties disappear from JSON, so events produced by an
      // older frame or a future partial frame remain valid.
      events.push({t:d.t, kind:d.kind, x:d.x, y:d.y, sx:d.sx, sy:d.sy,
        vw:d.vw, vh:d.vh, sxMax:d.sxMax, syMax:d.syMax,
        nx:d.nx, ny:d.ny, nsx:d.nsx, nsy:d.nsy});
    }
  });
`;
}
