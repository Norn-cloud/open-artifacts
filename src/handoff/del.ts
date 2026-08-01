import type { HandoffSvgs } from "./svgs";

// Delete a handoff: the author delete token (oa-handoff-dt-<hid>) wins, else
// the owner write token. Clears the in-memory handoff + the stored delete
// token and re-renders. Named del because `delete` is a reserved word.
export function del(_svgs: HandoffSvgs): string {
  return `
  function delHandoff(hid){
    var dt=getDelToken(hid); var headers=dt?{Authorization:'Bearer '+dt}:authHeaders(); headers['X-OA-CSRF']='1';
    fetch('/api/artifacts/'+ID+'/handoffs/'+hid, {method:'DELETE', headers:headers}).then(function(r){ if(!r.ok)throw new Error('Delete failed ('+r.status+')'); return r.json(); }).then(function(){ handoff=null; try{localStorage.removeItem('oa-handoff-dt-'+hid);}catch(e){} render(); syncIdlePreview(); }).catch(function(err){ setStatus(esc(err.message)); });
  }
`;
}
