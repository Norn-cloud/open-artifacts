import type { HandoffSvgs } from "./svgs";

// Copy a share link to the version the recording was made against. Loom
// emphasizes Share after a recording; here it's a persistent Copy-link button
// in IDLE so the link is available any time the dock is open. Shows a
// "Copied" state on the button for 1.5s. legacyCopy is the execCommand fallback
// for browsers without navigator.clipboard.
export function share(_svgs: HandoffSvgs): string {
  return `
  function copyShareLink(version){
    var link=window.location.origin+'/a/'+ID+'?v='+version;
    var btn=document.getElementById('oa-handoff-share');
    var lb=btn&&btn.querySelector('.oa-dock-label');
    var done=function(){ if(btn)btn.classList.add('oa-dock-btn--copied'); if(lb)lb.textContent='Copied'; setTimeout(function(){ if(btn)btn.classList.remove('oa-dock-btn--copied'); if(lb)lb.textContent='Copy link'; },1500); };
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(link).then(done).catch(function(){ legacyCopy(link); done(); }); }
    else { legacyCopy(link); done(); }
  }
  function legacyCopy(text){ var t=document.createElement('textarea'); t.value=text; document.body.appendChild(t); t.select(); try{ document.execCommand('copy'); }catch(e){} document.body.removeChild(t); }
`;
}
