import React, {useState} from 'react';
import {MapPin, Search} from 'lucide-react';
import {activeLocations, locationPath, searchLocations} from '../../lib/locations.js';

export function LocationPicker({locations, value, onChange, disabled = false}) {
  const [search, setSearch] = useState('');
  const available = activeLocations(locations || []);
  const matches = searchLocations(available, search);
  const selected = available.find(item => item._id === value);
  const options = selected && !matches.some(item => item._id === value) ? [selected, ...matches] : matches;
  return <fieldset className="space-y-3" disabled={disabled}>
    <legend className="text-sm font-semibold text-slate-700 mb-2">Campus location *</legend>
    <label className="relative block">
      <Search size={16} className="absolute left-3 top-3.5 text-slate-400" aria-hidden="true"/>
      <input aria-label="Search campus locations" className="field !pl-10" placeholder="Search a block, floor, room or common area" value={search} onChange={event => setSearch(event.target.value)}/>
    </label>
    <select aria-label="Campus location" className="field" required value={value} onChange={event => onChange(event.target.value)}>
      <option value="">Choose the exact location</option>
      {options.map(item => <option key={item._id} value={item._id}>{locationPath(item, available)}</option>)}
    </select>
    {selected && <p className="flex gap-2 text-xs text-indigo"><MapPin size={15} className="shrink-0" aria-hidden="true"/>{locationPath(selected, available)}</p>}
    <p className="text-xs text-slate-500" role="status">{available.length === 0 ? 'No active locations are available. Ask an administrator to add your campus locations.' : matches.length === 0 ? 'No matches. Try another block, room or floor name.' : `${matches.length} matching locations. Custom locations are included. If yours is missing, ask an administrator to add it.`}</p>
  </fieldset>;
}
