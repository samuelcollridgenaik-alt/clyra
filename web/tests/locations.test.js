import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK_CODES, activeLocations, campusLayout, locationChain, locationPath, parentLocations, searchLocations} from '../src/lib/locations.js';

const campus = {_id: 'campus', name: 'Main campus', type: 'CAMPUS', isActive: true};
const block = {_id: 'd', name: 'D block', code: 'D', type: 'BUILDING', parentLocationId: 'campus', isActive: true};
const floor = {_id: 'd1', name: 'Floor 1', type: 'FLOOR', parentLocationId: 'd', isActive: true};
const room = {_id: 'room', name: 'Media Lab', type: 'ROOM', parentLocationId: 'd1', isActive: true};
const garden = {_id: 'garden', name: 'Garden', type: 'COMMON_AREA', parentLocationId: 'campus', isActive: true};
const rows = [campus, block, floor, room, garden];

test('D–U layout includes 18 independent 4/5 level choices and explicit ground-floor convention', () => {
  const choices = Object.fromEntries(BLOCK_CODES.map(code => [code, code === 'U' ? 5 : 4]));
  const layout = campusLayout('campus', choices, true);
  assert.equal(layout.blocks.length, 18);
  assert.deepEqual(layout.blocks[0], {code: 'D', floorCount: 4});
  assert.deepEqual(layout.blocks.at(-1), {code: 'U', floorCount: 5});
  assert.equal(layout.includeGroundFloor, true);
  assert.equal(campusLayout('campus', choices, false).includeGroundFloor, false);
  assert.throws(() => campusLayout('', choices, true), /campus/);
  assert.throws(() => campusLayout('campus', {...choices, D: 6}, true), /4 or 5/);
});

test('path labels distinguish equal floor names and retain custom rooms/common areas', () => {
  const other = {...block, _id: 'u', name: 'U block'};
  const otherFloor = {...floor, _id: 'u1', parentLocationId: 'u'};
  const catalog = [...rows, other, otherFloor];
  assert.equal(locationPath(floor, catalog), 'Main campus › D block › Floor 1');
  assert.equal(locationPath(otherFloor, catalog), 'Main campus › U block › Floor 1');
  assert.equal(locationPath(room, catalog), 'Main campus › D block › Floor 1 › Media Lab');
  assert.equal(locationPath(garden, catalog), 'Main campus › Garden');
  assert.deepEqual(searchLocations(catalog, 'd block media').map(item => item._id), ['room']);
  assert.deepEqual(searchLocations(catalog, 'U floor 1').map(item => item._id), ['u1']);
});

test('full catalog retains locations beyond 100 and finds U block locations', () => {
  const generated = [campus, ...BLOCK_CODES.flatMap(code => {
    const building = {...block, _id: code, name: `${code} block`};
    return [building, ...Array.from({length: 5}, (_, index) => ({...floor, _id: `${code}${index}`, name: `Floor ${index + 1}`, parentLocationId: code}))];
  })];
  assert.equal(searchLocations(generated).length, 109);
  assert.equal(searchLocations(generated, 'U block Floor 5')[0]._id, 'U4');
});

test('manual parents follow hierarchy and exclude inactive branches', () => {
  assert.deepEqual(parentLocations('BUILDING', rows).map(item => item._id), ['campus']);
  assert.deepEqual(parentLocations('FLOOR', rows).map(item => item._id), ['d']);
  assert.deepEqual(parentLocations('ROOM', rows).map(item => item._id), ['d1']);
  assert.deepEqual(parentLocations('COMMON_AREA', rows).map(item => item._id), ['campus', 'd', 'd1']);
  assert.deepEqual(parentLocations('CAMPUS', rows), []);
  const inactive = rows.map(item => item._id === 'd' ? {...item, isActive: false} : item);
  assert.deepEqual(activeLocations(inactive).map(item => item._id), ['campus', 'garden']);
  assert.deepEqual(activeLocations([{...room, isAvailable: false}]), []);
});

test('path fallback tolerates cycles and populated parent IDs without hanging', () => {
  const populated = {...floor, parentLocationId: {_id: 'd'}};
  assert.equal(locationChain(populated, rows).length, 3);
  assert.equal(locationPath({...floor, pathName: 'Stored campus / D / Level 1'}, rows), 'Stored campus / D / Level 1');
  const cycle = [{_id: 'a', name: 'A', parentLocationId: 'b'}, {_id: 'b', name: 'B', parentLocationId: 'a'}];
  assert.equal(locationChain(cycle[0], cycle).length, 2);
});
