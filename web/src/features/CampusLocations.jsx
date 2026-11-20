import React, {useEffect, useState} from 'react';
import {Building2, Layers3, MapPin, Pencil, Plus, Search} from 'lucide-react';
import {api} from '../lib/api.js';
import {Field, Notice, PageHeading, State} from '../components/common/UI.jsx';
import {BLOCK_CODES, LOCATION_TYPES, campusLayout, locationPath, locationTypeLabel, parentLocations, searchLocations} from '../lib/locations.js';

const emptyForm = {name: '', code: '', type: 'BUILDING', parentLocationId: '', description: ''};
const pageSize = 20;

export function CampusLocations() {
  const [locations, setLocations] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState('');
  const [campusId, setCampusId] = useState('');
  const [floorCounts, setFloorCounts] = useState(() => Object.fromEntries(BLOCK_CODES.map(code => [code, 4])));
  const [includeGroundFloor, setIncludeGroundFloor] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  async function load() {
    try {
      const rows = await api.get('/locations/catalog');
      setLocations(rows);
      setError('');
      setCampusId(current => rows.some(item => item._id === current && item.isActive) ? current : rows.find(item => item.type === 'CAMPUS' && item.isActive)?._id || '');
    } catch (failure) {
      setError(failure.message);
    }
  }
  useEffect(() => { load(); }, []);

  function beginAdd() {
    setEditing('');
    setForm({...emptyForm, type: campusId ? 'BUILDING' : 'CAMPUS', parentLocationId: campusId});
  }
  function beginEdit(item) {
    setEditing(item._id);
    setForm({name: item.name, description: item.description || '', type: item.type, code: item.code || '', parentLocationId: item.parentLocationId || ''});
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (editing) await api.patch(`/locations/${editing}`, {name: form.name.trim(), description: form.description.trim()});
      else await api.post('/locations', {name: form.name.trim(), type: form.type, ...(form.code.trim() ? {code: form.code.trim()} : {}), ...(form.type !== 'CAMPUS' ? {parentLocationId: form.parentLocationId} : {}), description: form.description.trim()});
      setNotice({message: editing ? 'Location details updated. Existing complaint references are preserved.' : 'Location added. It is now available in both apps.'});
      setForm(null);
      setEditing('');
      await load();
    } catch (failure) { setNotice({type: 'error', message: failure.message}); }
    finally { setBusy(false); }
  }
  async function applyLayout() {
    setBusy(true);
    setNotice(null);
    try {
      await api.post('/locations/campus-layout', campusLayout(campusId, floorCounts, includeGroundFloor));
      setNotice({message: 'D–U block layout applied. Existing locations and complaint history are preserved.'});
      await load();
    } catch (failure) { setNotice({type: 'error', message: failure.message}); }
    finally { setBusy(false); }
  }
  async function toggle(item) {
    setBusy(true);
    setNotice(null);
    try {
      await api.patch(`/locations/${item._id}/status`, {isActive: !item.isActive});
      setNotice({message: `${item.name} ${item.isActive ? 'deactivated' : 'reactivated'}.`});
      await load();
    } catch (failure) { setNotice({type: 'error', message: failure.message}); }
    finally { setBusy(false); }
  }

  const rows = locations || [];
  const campuses = rows.filter(item => item.type === 'CAMPUS' && item.isActive);
  const matches = searchLocations(rows, search).filter(item => !typeFilter || item.type === typeFilter);
  const lastPage = Math.max(1, Math.ceil(matches.length / pageSize));
  const currentPage = Math.min(page, lastPage);
  const visible = matches.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const parents = parentLocations(form?.type, rows);

  return <>
    <PageHeading eyebrow="Campus directory" title="Campus facilities" description="A clear address for every issue. Organize blocks D–U, their floors and the places your campus uses every day." action={<button className="btn-primary" disabled={busy} onClick={beginAdd}><Plus size={17}/>Add location manually</button>}/>
    {notice && <div className="mb-5"><Notice {...notice}/></div>}
    {form && <form onSubmit={save} className="card p-6 mb-6 space-y-5" aria-label={editing ? 'Edit location' : 'Add location manually'}>
      <div><p className="small-label">{editing ? 'Location details' : 'Make room for your campus'}</p><h2 className="text-xl font-bold mt-1">{editing ? 'Edit location' : 'Add a custom location'}</h2><p className="text-sm text-slate-500 mt-2">{editing ? 'Names and descriptions can change without moving existing records.' : 'Add a campus, an extra building, a floor, a room or a shared space. You are not limited to the D–U template.'}</p></div>
      <fieldset disabled={busy} className="grid sm:grid-cols-2 gap-4">
        <Field label="Location name *"><input className="field" required minLength={2} maxLength={120} value={form.name} onChange={event => setForm({...form, name: event.target.value})} placeholder="e.g. Library Reading Room"/></Field>
        {!editing && <Field label="Location type *"><select className="field" value={form.type} onChange={event => setForm({...form, type: event.target.value, parentLocationId: ''})}>{LOCATION_TYPES.map(type => <option key={type} value={type}>{locationTypeLabel(type)}</option>)}</select></Field>}
        {!editing && <Field label="Location code (optional)"><input className="field" maxLength={40} value={form.code} onChange={event => setForm({...form, code: event.target.value})} placeholder="e.g. D-LIB"/></Field>}
        {!editing && form.type !== 'CAMPUS' && <Field label="Parent location *"><select className="field" required value={form.parentLocationId} onChange={event => setForm({...form, parentLocationId: event.target.value})}><option value="">Choose a parent location</option>{parents.map(item => <option key={item._id} value={item._id}>{locationPath(item, rows)}</option>)}</select>{parents.length === 0 && <p className="text-xs text-amber-700">Add an active {form.type === 'BUILDING' ? 'campus' : form.type === 'FLOOR' ? 'building' : form.type === 'ROOM' ? 'floor' : 'campus, building or floor'} first.</p>}</Field>}
        <div className="sm:col-span-2"><Field label="Description (optional)"><textarea className="field min-h-[80px]" maxLength={500} value={form.description} onChange={event => setForm({...form, description: event.target.value})} placeholder="Useful directions, landmarks or access details"/></Field></div>
      </fieldset>
      <div className="flex justify-end gap-3"><button type="button" className="btn-outline" disabled={busy} onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" disabled={busy || (!editing && form.type !== 'CAMPUS' && !form.parentLocationId)}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add location'}</button></div>
    </form>}
    <State loading={!locations && !error} error={error} onRetry={load}>
      <section className="card overflow-hidden mb-6">
        <div className="bg-navy p-6 text-white flex items-start gap-4"><span className="bg-white/10 p-3 rounded-xl"><Building2 size={24}/></span><div><p className="text-xs uppercase tracking-widest text-white/60">Campus layout</p><h2 className="text-xl font-bold mt-1">D block through U block</h2><p className="text-sm text-white/75 mt-2">Choose 4 or 5 total levels for each block, then apply the layout. Nothing is added until you apply.</p></div></div>
        <div className="p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-5 items-end">
            <Field label="Campus for this layout"><select className="field" disabled={busy} value={campusId} onChange={event => setCampusId(event.target.value)}><option value="">Choose an active campus</option>{campuses.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Field>
            <label className="flex items-start gap-3 text-sm p-3 bg-mist rounded-xl"><input className="mt-1" type="checkbox" disabled={busy} checked={includeGroundFloor} onChange={event => setIncludeGroundFloor(event.target.checked)}/><span><strong>Include Ground Floor in the total</strong><span className="block text-xs text-slate-500 mt-1">{includeGroundFloor ? '4 levels = Ground + Floors 1–3. 5 levels = Ground + Floors 1–4.' : '4 levels = Floors 1–4. 5 levels = Floors 1–5.'}</span></span></label>
          </div>
          {!campuses.length && <p className="text-sm text-amber-700">Add a campus using “Add location manually” before applying a block layout.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{BLOCK_CODES.map(code => <label className="rounded-xl border border-line bg-mist/60 p-3" key={code}><span className="flex items-center gap-2 font-bold text-navy text-sm mb-2"><Layers3 size={15} className="text-indigo"/>{code} block</span><select aria-label={`${code} block total levels`} className="field !py-2 !text-xs" disabled={busy} value={floorCounts[code]} onChange={event => setFloorCounts({...floorCounts, [code]: Number(event.target.value)})}><option value={4}>4 total levels</option><option value={5}>5 total levels</option></select></label>)}</div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5"><p className="text-xs text-slate-500 max-w-lg">Existing and custom locations stay intact. Applying the same layout is safe to repeat; reducing a count does not delete floors. Deactivate unused locations separately.</p><button type="button" className="btn-primary" disabled={busy || !campusId} onClick={applyLayout}>{busy ? 'Saving…' : 'Apply D–U layout'}</button></div>
        </div>
      </section>
      <section className="card overflow-hidden">
        <div className="p-5 border-b border-line flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-lg">Location directory</h2><p className="text-xs text-slate-500 mt-1">{rows.length} locations · {rows.filter(item => item.type === 'BUILDING').length} blocks / buildings · {rows.filter(item => item.type === 'FLOOR').length} floors</p></div><button disabled={busy} onClick={beginAdd} className="btn-outline"><Plus size={16}/>Add custom location</button></div>
        <div className="p-4 bg-mist/50 flex flex-wrap gap-3"><label className="flex items-center gap-2 flex-1 min-w-[200px]"><Search size={18} className="text-slate-400"/><input aria-label="Search location directory" className="field" placeholder="Search full path, name or code" value={search} onChange={event => {setSearch(event.target.value); setPage(1);}}/></label><select aria-label="Filter location type" className="field sm:max-w-[200px]" value={typeFilter} onChange={event => {setTypeFilter(event.target.value); setPage(1);}}><option value="">All location types</option>{LOCATION_TYPES.map(type => <option key={type} value={type}>{locationTypeLabel(type)}</option>)}</select></div>
        {visible.length ? <div className="overflow-x-auto"><table className="w-full"><thead><tr>{['Location & path', 'Type / code', 'Status', 'Actions'].map(heading => <th key={heading} className="text-left text-xs uppercase tracking-wide text-slate-500 p-4">{heading}</th>)}</tr></thead><tbody>{visible.map(item => <tr key={item._id} className="border-t border-line"><td className="p-4"><p className="font-semibold text-sm text-navy flex items-center gap-2"><MapPin size={15} className="text-indigo shrink-0"/>{item.name}</p><p className="text-xs text-slate-500 mt-1 max-w-lg">{locationPath(item, rows)}</p>{item.description && <p className="text-xs text-slate-400 mt-1">{item.description}</p>}</td><td className="p-4 text-xs text-slate-600">{locationTypeLabel(item.type)}<span className="block mt-1 text-slate-400">{item.code || 'No code'}</span></td><td className="p-4"><span className={`text-xs px-3 py-1 rounded-full ${item.isActive ? 'bg-teal/10 text-teal' : 'bg-slate-100 text-slate-500'}`}>{item.isActive ? 'Active' : 'Inactive'}</span></td><td className="p-4"><div className="flex flex-wrap gap-3"><button aria-label={`Edit ${locationPath(item, rows)}`} disabled={busy} className="text-indigo text-xs font-semibold inline-flex items-center gap-1" onClick={() => beginEdit(item)}><Pencil size={13}/>Edit</button><button aria-label={`${item.isActive ? 'Deactivate' : 'Reactivate'} ${locationPath(item, rows)}`} disabled={busy} className="text-slate-600 text-xs font-semibold" onClick={() => toggle(item)}>{item.isActive ? 'Deactivate' : 'Reactivate'}</button></div></td></tr>)}</tbody></table></div> : <p className="text-center py-12 text-sm text-slate-500">{rows.length ? 'No locations match your search.' : 'Start by adding your campus, then choose its blocks and floors.'}</p>}
        <div className="p-4 border-t border-line flex justify-between items-center gap-2 text-xs text-slate-500"><span>{matches.length} matches · Page {currentPage} of {lastPage}</span><div className="flex gap-2"><button className="btn-outline !py-2" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="btn-outline !py-2" disabled={currentPage >= lastPage} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
      </section>
    </State>
  </>;
}
