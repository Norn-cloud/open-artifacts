import type { HandoffSvgs } from "./svgs";

// Shared DOM/UI helpers used by every concern in the dock closure. Pure
// functions + builders; no state of their own. toFrame posts to the sandboxed
// iframe; esc is the runtime HTML-escape for user-supplied strings; el and
// dockBtn are the element/button builders shared with the Live toolbar's
// .oa-dock-btn anatomy; fmt formats ms as m:ss. setStatus and the tickers
// live in status.ts.
export function helpers(_svgs: HandoffSvgs): string {
  return `
  function toFrame(msg){ try{ if(frame.contentWindow) frame.contentWindow.postMessage(msg,'*'); }catch(e){} }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function el(t,c,h){ var d=document.createElement(t); if(c)d.className=c; if(h!=null)d.innerHTML=h; return d; }
  // Fetch truncates an unquoted comma-separated codecs parameter when it
  // creates a Blob. A base media type preserves the complete WebM payload
  // while giving the video element stable source metadata.
  function normalizeMediaBlob(blob){
    var type=blob&&typeof blob.type==='string'?blob.type:'';
    var base=type.split(';')[0].trim().toLowerCase();
    if((base.indexOf('video/')!==0&&base.indexOf('audio/')!==0)||type===base)return blob;
    return blob.slice(0,blob.size,base);
  }
  // Shared dock-button builder: the same .oa-dock-btn anatomy the Live toolbar
  // uses (icon span + label span), so the two docks' controls are the same
  // element. iconSvg is a trusted constant SVG string; label is textContent.
  function dockBtn(cls, iconSvg, label, opts){
    opts=opts||{};
    var b=el('button', 'oa-dock-btn'+(cls?' '+cls:''));
    b.type='button';
    if(opts.id)b.id=opts.id;
    if(opts.title)b.title=opts.title;
    if(opts.ariaLabel)b.setAttribute('aria-label',opts.ariaLabel);
    if(opts.pressed!=null)b.setAttribute('aria-pressed',String(opts.pressed));
    if(iconSvg){var ic=el('span','oa-dock-icon');ic.setAttribute('aria-hidden','true');ic.innerHTML=iconSvg;b.appendChild(ic);}
    if(label){var lb=el('span','oa-dock-label');lb.textContent=label;b.appendChild(lb);}
    return b;
  }
  function fmt(ms){ ms=Math.max(0,ms||0); var s=Math.floor(ms/1000), m=Math.floor(s/60); s=s%60; return m+':'+(s<10?'0':'')+s; }
`;
}
