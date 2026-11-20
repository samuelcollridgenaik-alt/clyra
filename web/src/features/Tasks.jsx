import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {CheckSquare2,ArrowUpRight,MapPin,RefreshCw} from 'lucide-react';
import {api} from '../lib/api.js';
import {recordId,resolutionError} from '../lib/workflow.js';
import {Chip,Field,Notice,State,PageHeading,niceDate} from '../components/common/UI.jsx';

export default function Tasks({historyOnly=false}) {
 const [tasks,setTasks]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const [notice,setNotice]=useState({}),[notes,setNotes]=useState({}),[uploads,setUploads]=useState({});
 const [capabilities,setCapabilities]=useState(null),[page,setPage]=useState(1);
 async function refresh() {
  setError('');
  try {
   const [items,caps]=await Promise.all([api.get('/assignments?limit=20&page='+page),api.get('/capabilities')]);
   setTasks(items);setCapabilities(caps);
  } catch(e) {setError(e.message);}
 }
 useEffect(()=>{setTasks(null);refresh();},[page,historyOnly]);
 async function act(id,route,payload) {
  setBusy(id);setNotice({});
  try {
   await api.post('/assignments/'+id+'/'+route,payload);
   setNotice({message:'Task updated. The complaint timeline now reflects this change.'});
   await refresh();
  } catch(e) {setNotice({message:e.message,type:'error'});}
  finally {setBusy('');}
 }
 async function resolution(t) {
  const files=uploads[t._id]||[],remarks=(notes[t._id]||'').trim();
  const problem=resolutionError({files,remarks,capabilities});
  if(problem){setNotice({message:problem,type:'error'});return;}
  setBusy(t._id);setNotice({});
  try {
   const urls=[];
   for(const file of files) {
    const fd=new FormData();fd.append('file',file);fd.append('resourceType','EVIDENCE');fd.append('complaintId',recordId(t.complaintId));
    const media=await api.upload(fd);urls.push(media.url);
   }
   await api.post('/assignments/'+t._id+'/submit-resolution',{evidenceUrls:urls,remarks:remarks||'Work completed; see attached evidence.'});
   setUploads(current=>({...current,[t._id]:[]}));
   setNotice({message:'Resolution submitted. An administrator will verify the completed work.'});
   await refresh();
  } catch(e) {setNotice({message:e.message,type:'error'});}
  finally {setBusy('');}
 }
 const shown=tasks?.filter(t=>historyOnly?['COMPLETED','REASSIGNED'].includes(t.assignmentStatus):!['COMPLETED','REASSIGNED'].includes(t.assignmentStatus));
 return <>
  <PageHeading eyebrow="Campus service desk" title={historyOnly?'Work history':'Your work queue'} description={historyOnly?'Completed and reassigned work stays in the audit trail.':'Accept a task, record your progress, then submit the completed work for verification.'} action={<button className="btn-outline" onClick={refresh} disabled={!!busy}><RefreshCw size={16}/>Refresh</button>}/>
  <div className="mb-5"><Notice {...notice}/></div>
  <State loading={!tasks&&!error} error={error} onRetry={refresh}>
   <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
    <span className="rounded-full bg-indigo/10 px-3 py-1.5 font-semibold text-indigo">{shown?.length||0} {historyOnly?'past':'active'} tasks on this page</span>
    {!historyOnly&&<span>Only your current assignments can be updated.</span>}
   </div>
   <State empty={shown?.length===0} emptyTitle={historyOnly?'No finished work on this page':'Your queue is clear on this page'} emptyDescription="Use the page controls below to browse more assignments.">
    <div className="grid xl:grid-cols-2 gap-5">{shown?.map(t=>{
     const c=t.complaint||{},note=notes[t._id]||'',pending=busy===t._id;
     return <article className="card p-6" key={t._id}>
      <div className="flex justify-between items-start gap-3"><span className="rounded-xl p-2.5 bg-indigo/10 text-indigo"><CheckSquare2 size={20}/></span><div className="flex flex-wrap justify-end gap-2">{c.priority&&<Chip value={c.priority}/>}<Chip value={t.assignmentStatus}/></div></div>
      <p className="small-label mt-5">{c.complaintCode||'Assignment #'+t._id.slice(-8)}</p>
      <h2 className="text-xl font-bold mt-2">{c.title||'Assigned campus work'}</h2>
      <p className="flex items-center gap-2 text-sm text-slate-600 mt-3"><MapPin size={16}/>{c.locationName||'See complaint for location'}</p>
      <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{c.description}</p>
      <div className="rounded-xl bg-mist p-3 mt-4 text-xs text-slate-500 space-y-1"><p>Assigned {niceDate(t.assignedAt)}{t.departmentName?' · '+t.departmentName:''}</p>{t.remarks&&<p className="text-slate-700">Instructions: {t.remarks}</p>}</div>
      {t.assignmentStatus!=='REASSIGNED'&&<Link to={'/complaints/'+recordId(t.complaintId)} className="text-sm font-semibold text-indigo mt-4 inline-flex gap-2 items-center">Complaint & timeline <ArrowUpRight size={16}/></Link>}
      {!historyOnly&&<div className="border-t border-line pt-5 mt-5 space-y-4">
       {t.assignmentStatus==='PENDING'&&<button disabled={!!busy} className="btn-primary" onClick={()=>act(t._id,'accept')}>{pending?'Accepting…':'Accept task'}</button>}
       {t.assignmentStatus==='ACCEPTED'&&<button disabled={!!busy} className="btn-primary" onClick={()=>act(t._id,'start')}>{pending?'Starting…':'Start work'}</button>}
       {['IN_PROGRESS','ON_HOLD'].includes(t.assignmentStatus)&&<Field label="Work notes / reason for hold"><textarea className="field min-h-24" maxLength={2000} value={note} onChange={e=>setNotes({...notes,[t._id]:e.target.value})} placeholder="Explain what was repaired, how you checked it, or what is blocking progress."/></Field>}
       {t.assignmentStatus==='IN_PROGRESS'&&<>
        <button disabled={!!busy||note.trim().length<4} className="btn-outline" onClick={()=>act(t._id,'hold',{reason:note.trim()})}>Put on hold</button>
        {capabilities?.mediaUploads?<Field label={'Resolution photos'+(capabilities?.textOnlyResolution?' (optional)':' *')}><input className="field" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={e=>setUploads({...uploads,[t._id]:[...e.target.files]})}/><span className="text-xs text-slate-500">Up to 5 images, 5 MB each.</span></Field>:<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Photo uploads are unavailable. {capabilities?.textOnlyResolution?'This demo permits a written completion report of at least 20 characters.':'Ask your administrator to enable image storage before submitting a resolution.'}</p>}
        <button disabled={!!busy||(!capabilities?.mediaUploads&&!capabilities?.textOnlyResolution)} className="btn-primary w-full" onClick={()=>resolution(t)}>{pending?'Submitting…':'Submit resolution for review'}</button>
       </>}
       {t.assignmentStatus==='ON_HOLD'&&<button disabled={!!busy} className="btn-primary" onClick={()=>act(t._id,'resume')}>{pending?'Resuming…':'Resume work'}</button>}
       {t.assignmentStatus==='RESOLUTION_SUBMITTED'&&<p className="rounded-xl bg-indigo/10 text-indigo text-sm p-4">Completion submitted. Waiting for administrator verification.</p>}
      </div>}
     </article>;
    })}</div>
   </State>
   <div className="flex justify-between items-center mt-5 text-sm text-slate-500"><span>Assignments · Page {page}</span><div className="flex gap-2"><button className="btn-outline" disabled={page===1||!!busy} onClick={()=>setPage(page-1)}>Previous</button><button className="btn-outline" disabled={(tasks?.length||0)<20||!!busy} onClick={()=>setPage(page+1)}>Next</button></div></div>
  </State>
 </>;
}
