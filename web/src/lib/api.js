// Coalesce refreshes so concurrent requests do not replay a rotated cookie.
export function createApiClient(base, fetcher = (...args) => fetch(...args)) {
 let accessToken = null, refreshFlight = null, generation = 0;
 const listeners = new Set();
 const session = {
  set(token) { generation++; accessToken = token; },
  clear() { generation++; accessToken = null; listeners.forEach(fn => fn()); },
  onExpired(fn) { listeners.add(fn); return () => listeners.delete(fn); }
 };
 async function refresh() {
  if (!refreshFlight) {
   const started = generation;
   refreshFlight = request('/auth/refresh', {method:'POST', retry:false}).then(data => {
    if (generation !== started) throw new Error('Session changed. Please sign in again.');
    accessToken = data.accessToken;
    return data;
   }).finally(() => { refreshFlight = null; });
  }
  return refreshFlight;
 }
 async function request(path, {method='GET', body, headers={}, retry=true} = {}) {
  if (base == null) throw new Error('The online backend is not connected yet. Sign-in and complaints are currently available only in the local demo.');
  const sentToken = accessToken;
  let response;
  try {
   response = await fetcher(base + path, {method, credentials:'include', headers:{
    ...(!(body instanceof FormData) ? {'Content-Type':'application/json'} : {}),
    ...(sentToken ? {Authorization:'Bearer ' + sentToken} : {}), ...headers
   }, body:body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body)});
  } catch { throw new Error('Cannot reach Clyra. Check your connection and try again.'); }
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
   try {
    // A slower 401 may arrive after another request already refreshed the token.
    if (!accessToken || accessToken === sentToken) await refresh();
    return await request(path, {method, body, headers, retry:false});
   } catch (error) {
    if (error.status === 401 || !accessToken) session.clear();
    throw error;
   }
  }
  if (response.headers.get('content-type')?.includes('text/csv')) {
   if (!response.ok) throw new Error('Export failed');
   return response.blob();
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('API unavailable or returned invalid data'); }
  if (!response.ok || !data.success) {
   const error = new Error(data.message || 'Request failed');
   error.status = response.status;
   error.code = data.code;
   throw error;
  }
  return data.data;
 }
 return {session, api:{get:p=>request(p), post:(p,b)=>request(p,{method:'POST',body:b}), patch:(p,b)=>request(p,{method:'PATCH',body:b}), del:p=>request(p,{method:'DELETE'}), upload:body=>request('/media/upload',{method:'POST',body})},
  authApi:{login:(email,password)=>request('/auth/login',{method:'POST',body:{email,password}}), refresh, logout:()=>request('/auth/logout',{method:'POST',retry:false})}};
}
const configuredBase = import.meta.env?.VITE_API_BASE_URL;
export const apiConfigured = Boolean(configuredBase) || !import.meta.env?.PROD;
export const {api, authApi, session} = createApiClient(configuredBase || (import.meta.env?.PROD ? null : 'http://localhost:4000/api/v1'));
