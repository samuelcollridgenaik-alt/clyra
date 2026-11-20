import { Location } from '../models/index.js';
import { HttpError } from '../middleware/security.js';

const parentTypes = {
  CAMPUS: [], BUILDING: ['CAMPUS'], FLOOR: ['BUILDING'], ROOM: ['FLOOR'],
  COMMON_AREA: ['CAMPUS', 'BUILDING', 'FLOOR'],
};
const key = value => value ? String(value) : null;
const normalized = value => value.trim().toLowerCase();

function describe(location, byId) {
  const names = [], visited = new Set();
  let current = location, isAvailable = true;
  while (current) {
    if (visited.has(key(current._id))) { isAvailable = false; break; }
    visited.add(key(current._id));
    names.unshift(current.name);
    if (!current.isActive) isAvailable = false;
    const parent = byId.get(key(current.parentLocationId));
    if (current.type === 'CAMPUS') {
      if (current.parentLocationId) isAvailable = false;
    } else if (!parent || !parentTypes[current.type]?.includes(parent.type)) {
      isAvailable = false;
    }
    current = parent;
  }
  return {...location, pathName: names.join(' / '), isAvailable};
}

// A complete, small reference catalog avoids silently losing blocks beyond page 100.
export async function locationCatalog(includeInactive = false) {
  const records = await Location.find().lean();
  const byId = new Map(records.map(item => [key(item._id), item]));
  return records.map(item => describe(item, byId))
    .filter(item => includeInactive || item.isAvailable)
    .sort((a, b) => a.pathName.localeCompare(b.pathName, 'en', {numeric: true}) || key(a._id).localeCompare(key(b._id)));
}

export async function assertAvailableLocation(location) {
  const visited = new Set();
  let current = location;
  while (current) {
    if (!current.isActive || visited.has(key(current._id))) {
      throw new HttpError(400, 'Location or an ancestor is inactive or invalid', 'INVALID_LOCATION');
    }
    visited.add(key(current._id));
    if (current.type === 'CAMPUS') {
      if (current.parentLocationId) throw new HttpError(400, 'Campus cannot have a parent', 'INVALID_LOCATION');
      return;
    }
    const parent = current.parentLocationId ? await Location.findById(current.parentLocationId) : null;
    if (!parent || !parentTypes[current.type]?.includes(parent.type)) {
      throw new HttpError(400, 'Invalid parent hierarchy', 'INVALID_LOCATION');
    }
    current = parent;
  }
  throw new HttpError(400, 'Location required', 'INVALID_LOCATION');
}

export async function validateLocation(data, existingId) {
  if (data.type === 'CAMPUS') {
    if (data.parentLocationId) throw new HttpError(400, 'Campus cannot have a parent');
  } else {
    if (!data.parentLocationId) throw new HttpError(400, 'Parent location required');
    const parent = await Location.findById(data.parentLocationId);
    if (!parent || !parentTypes[data.type]?.includes(parent.type)) throw new HttpError(400, 'Invalid parent hierarchy');
    const visited = new Set(existingId ? [key(existingId)] : []);
    let ancestor = parent;
    while (ancestor) {
      if (visited.has(key(ancestor._id))) throw new HttpError(400, 'Location hierarchy cannot contain a cycle');
      visited.add(key(ancestor._id));
      ancestor = ancestor.parentLocationId ? await Location.findById(ancestor.parentLocationId) : null;
    }
    await assertAvailableLocation(parent);
  }
  if (existingId) {
    const children = await Location.find({parentLocationId: existingId}).select('type');
    if (children.some(child => !parentTypes[child.type]?.includes(data.type))) {
      throw new HttpError(409, 'Location type is incompatible with existing children');
    }
  }
}

// Caller runs this in atomic(). Locking the campus serializes repeated/concurrent
// presets; no existing names, codes, active states or complaint references change.
export async function createCampusLayout({campusId, blocks, includeGroundFloor}) {
  const campus = await Location.findOneAndUpdate(
    {_id: campusId, type: 'CAMPUS', isActive: true}, {$inc: {__v: 1}}, {new: true},
  );
  if (!campus) throw new HttpError(400, 'Choose an existing active campus', 'INVALID_CAMPUS');
  await assertAvailableLocation(campus);
  let created = 0, existing = 0;
  const locations = [];
  const ensure = async (parent, name, code, type) => {
    const sameCode = await Location.findOne({code});
    const siblings = await Location.find({parentLocationId: parent._id});
    const sameName = siblings.filter(item => normalized(item.name) === normalized(name));
    const candidates = new Map([...sameName, ...(sameCode ? [sameCode] : [])].map(item => [key(item._id), item]));
    if (candidates.size > 1) throw new HttpError(409, `Multiple locations match ${name}; resolve them manually first`, 'LOCATION_CONFLICT');
    let item = [...candidates.values()][0];
    if (item) {
      if (item.type !== type || key(item.parentLocationId) !== key(parent._id) || normalized(item.name) !== normalized(name) || !item.isActive) {
        throw new HttpError(409, `${name} conflicts with an existing location; no layout changes saved`, 'LOCATION_CONFLICT');
      }
      existing++;
    } else {
      item = await Location.create({name, code, type, parentLocationId: parent._id});
      created++;
    }
    locations.push(item);
    return item;
  };
  for (const block of blocks) {
    const prefix = `${campusId}-${block.code}`;
    const building = await ensure(campus, `${block.code} Block`, prefix, 'BUILDING');
    const first = includeGroundFloor ? 0 : 1;
    for (let level = first; level < first + block.floorCount; level++) {
      await ensure(building, level === 0 ? 'Ground Floor' : `Floor ${level}`, `${prefix}-F${level}`, 'FLOOR');
    }
  }
  return {campusId: key(campus._id), created, existing, locations};
}
