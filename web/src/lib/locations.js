export const LOCATION_TYPES = ['CAMPUS', 'BUILDING', 'FLOOR', 'ROOM', 'COMMON_AREA'];
export const BLOCK_CODES = Array.from({length: 18}, (_, index) => String.fromCharCode(68 + index));
const PARENT_TYPES = {CAMPUS: [], BUILDING: ['CAMPUS'], FLOOR: ['BUILDING'], ROOM: ['FLOOR'], COMMON_AREA: ['CAMPUS', 'BUILDING', 'FLOOR']};
export const locationId = value => String(value?._id || value || '');
export const locationTypeLabel = type => ({CAMPUS: 'Campus', BUILDING: 'Block / building', FLOOR: 'Floor', ROOM: 'Room', COMMON_AREA: 'Common area'}[type] || type);

export function locationChain(location, locations) {
  const index = new Map(locations.map(item => [locationId(item), item]));
  const chain = [], seen = new Set();
  let current = location;
  while (current && !seen.has(locationId(current))) {
    seen.add(locationId(current));
    chain.unshift(current);
    current = index.get(locationId(current.parentLocationId));
  }
  return chain;
}

export function locationPath(location, locations) {
  return location.pathName || locationChain(location, locations).map(item => item.name).join(' › ');
}

export function activeLocations(locations) {
  return locations.filter(item => item.isAvailable !== false && locationChain(item, locations).every(ancestor => ancestor.isActive !== false && ancestor.isAvailable !== false));
}

export function parentLocations(type, locations) {
  return activeLocations(locations).filter(item => (PARENT_TYPES[type] || []).includes(item.type));
}

export function searchLocations(locations, query = '', campusId = '') {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return locations.filter(item => {
    if (campusId && !locationChain(item, locations).some(ancestor => locationId(ancestor) === campusId)) return false;
    const text = `${locationPath(item, locations)} ${item.code || ''} ${locationTypeLabel(item.type)}`.toLocaleLowerCase();
    const words = text.split(/[^\p{L}\p{N}]+/u);
    // A one-letter block search must not match an arbitrary letter in “campus”.
    return terms.every(term => term.length === 1 ? words.includes(term) : text.includes(term));
  }).sort((a, b) => locationPath(a, locations).localeCompare(locationPath(b, locations), undefined, {numeric: true}));
}

export function campusLayout(campusId, floorCounts, includeGroundFloor) {
  if (!campusId) throw new Error('Choose an active campus first.');
  const blocks = BLOCK_CODES.map(code => ({code, floorCount: Number(floorCounts[code])}));
  if (blocks.some(block => ![4, 5].includes(block.floorCount))) throw new Error('Each block must have 4 or 5 total levels.');
  return {campusId, blocks, includeGroundFloor: Boolean(includeGroundFloor)};
}
