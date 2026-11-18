import { config } from '../../config/env.js';
export async function analyzeComplaint(complaint){
 if(!config.aiSecret||config.aiSecret.includes('replace-with'))return null;
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),1800);
 try{
  const response=await fetch(config.aiUrl+'/ai/analyze',{method:'POST',headers:{'Content-Type':'application/json','X-AI-Service-Key':config.aiSecret},body:JSON.stringify({title:complaint.title,description:complaint.description,locationId:complaint.locationId,candidates:complaint.candidates||[]}),signal:controller.signal});
  if(!response.ok)return null;
  const payload=await response.json();
  if(!payload||typeof payload!=='object'||payload.status!=='READY'||typeof payload.modelVersion!=='string')return null;
  return payload;
 }catch{return null;}finally{clearTimeout(timeout);}
}
