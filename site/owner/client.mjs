const key='arenalindex.owner-session';let memory;
export function session(){let value=memory;if(!value)try{value=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}if(!value||!/^[a-f0-9]{64}$/.test(value.token||'')||!Number.isFinite(value.expiresAt)||value.expiresAt<=Date.now()){clearSession();return null;}return value;}
export function saveSession(value){memory={token:value.token,email:value.email,expiresAt:value.expiresAt};try{sessionStorage.setItem(key,JSON.stringify(memory));}catch{}}
export function clearSession(){memory=null;try{sessionStorage.removeItem(key);}catch{}}
export async function request(action,body={},authenticated=true){
  const current=authenticated?session():null;if(authenticated&&!current)throw Object.assign(Error('Iniciá sesión para continuar.'),{status:401});
  const url=new URL('owner',window.ArenalConfig.intakeUrl);
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(current?{Authorization:'Bearer '+current.token}:{})},body:JSON.stringify({action,...body}),cache:'no-store',signal:AbortSignal.timeout(60000)});
  const result=await response.json();if(!response.ok){if(authenticated&&response.status===401)clearSession();throw Object.assign(Error(result.error||'No se pudo completar la operación.'),{status:response.status});}return result;
}
export async function logout(){try{if(session())await request('logout');}finally{clearSession();}}
