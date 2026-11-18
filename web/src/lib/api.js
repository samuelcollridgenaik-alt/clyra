const base=import.meta.env.VITE_API_BASE_URL||'http://localhost:4000/api/v1';
let accessToken=null;
export const session={set:(token)=>{accessToken=token;},clear:()=>{accessToken=null;}};
async function request(path,{method='GET',body,headers={},retry=true}={}){
 const response=await fetch(base+path,{method,credentials:'include',headers:{...(! (body instanceof FormData)?{'Content-Type':'application/json'}:{}),...(accessToken?{'Authorization':'Bearer '+accessToken}:{}),...headers},body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body)});
 if(response.status===401&&retry&&path!=='/auth/refresh'&&path!=='/auth/login'){
  try{const refreshed=await request('/auth/refresh',{method:'POST',retry:false});accessToken=refreshed.accessToken;return request(path,{method,body,headers,retry:false});}catch{accessToken=null;}
 }
 const isCsv=response.headers.get('content-type')?.includes('text/csv');
 if(isCsv){if(!response.ok)throw new Error('Export failed');return response.blob();}
 let data;try{data=await response.json();}catch{throw new Error('API unavailable or returned invalid data');}
 if(!response.ok||!data.success)throw new Error(data.message||'Request failed');
 return data.data;
}
export const api={get:(p)=>request(p),post:(p,b)=>request(p,{method:'POST',body:b}),patch:(p,b)=>request(p,{method:'PATCH',body:b}),del:(p)=>request(p,{method:'DELETE'}),upload:(body)=>request('/media/upload',{method:'POST',body})};
export const authApi={login:(email,password)=>request('/auth/login',{method:'POST',body:{email,password}}),refresh:()=>request('/auth/refresh',{method:'POST',retry:false}),logout:()=>request('/auth/logout',{method:'POST'})};
