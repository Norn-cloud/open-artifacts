import type { HandoffSvgs } from "./svgs";

// Status line + tickers + countdown. The status element is an absolutely
// positioned pill that sits above the dock (see styles.ts) so transient
// messages ("Saving handoff…", "Mic muted by system") never shift the
// controls row. setStatus toggles it; tickTimer/updateMicBar are the rAF/
// interval tickers driven by the render fns; hideCountdown clears the 3-2-1
// overlay (the runner itself lives in record.ts, next to the recorder).
export function status(_svgs: HandoffSvgs): string {
  return `
  function hideCountdown(){ if(countdownEl){countdownEl.removeAttribute('data-on'); countdownEl.removeAttribute('data-num'); countdownEl.innerHTML='';} if(countdownTimer){clearTimeout(countdownTimer); countdownTimer=null;} }
  // setStatus writes the floating status pill above the dock; empty hides it.
  function setStatus(s){ if(!statusEl)return; statusEl.innerHTML=s||''; if(s)statusEl.removeAttribute('hidden'); else statusEl.setAttribute('hidden',''); }
  function tickTimer(){ var t=document.getElementById('oa-handoff-timer-txt'); if(t)t.textContent=fmt(performance.now()-recStart); }
  function updateMicBar(){ var bar=document.getElementById('oa-handoff-mic-bar'); if(!bar)return; if(!micRAF)return; bar.style.transform='scaleX('+Math.min(1,Math.max(0.02,micLevel*3))+')'; if(micLevel>0.003)bar.classList.remove('oa-handoff-mic-silent'); else bar.classList.add('oa-handoff-mic-silent'); requestAnimationFrame(updateMicBar); }
`;
}
