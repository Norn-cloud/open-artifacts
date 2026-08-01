import type { HandoffSvgs } from "./svgs";

// Auth/token + playback-speed persistence. ownerToken reuses the comments
// write-token storage (oa-cm-wt-<id>); the author delete token is per handoff
// (oa-handoff-dt-<hid>); playback speed is oa-handoff-speed. authHeaders
// sends both the bearer wt (self-host) and X-OA-CSRF: 1 (SaaS session) so
// upload/delete work on either deploy.
export function auth(_svgs: HandoffSvgs): string {
  return `
  function ownerToken(){ try{return localStorage.getItem('oa-cm-wt-'+ID)}catch(e){return null} }
  function getName(){ try{return localStorage.getItem('oa-cm-name')||''}catch(e){return ''} }
  function saveDelToken(hid,t){ try{localStorage.setItem('oa-handoff-dt-'+hid,t)}catch(e){} }
  function getDelToken(hid){ try{return localStorage.getItem('oa-handoff-dt-'+hid)}catch(e){return null} }
  // Playback speed persists across views (Loom defaults to 1.2x; our short
  // walkthroughs default to 1x). Applied to cam.playbackRate on play and on
  // change. Stored as the numeric string ("1","1.5","2").
  var SPEED_KEY='oa-handoff-speed';
  function loadSpeed(){ var v=1; try{ var s=localStorage.getItem(SPEED_KEY); if(s){var n=parseFloat(s); if(n>=1&&n<=1.5)v=n; else saveSpeed(1);} }catch(e){} return v; }
  function saveSpeed(v){ try{localStorage.setItem(SPEED_KEY, String(v));}catch(e){} }
  // X-OA-CSRF: a SaaS deploy (coda0) gates session-based writes on this header
  // (requireCsrf); self-host admits via the bearer wt_ instead. Send both so
  // the upload/delete work either way.
  function authHeaders(){ var wt=ownerToken(); var h=wt?{Authorization:'Bearer '+wt}:{}; h['X-OA-CSRF']='1'; return h; }
`;
}
