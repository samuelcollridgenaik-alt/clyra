import test from 'node:test';import assert from 'node:assert/strict';import {canTransition,TRANSITIONS} from '../src/services/lifecycle.js';
test('only designated actors may transition',()=>{
 assert.equal(canTransition('UNDER_REVIEW','ASSIGNED','ADMIN'),true);
 assert.equal(canTransition('UNDER_REVIEW','ASSIGNED','STUDENT'),false);
 assert.equal(canTransition('ASSIGNED','ACCEPTED','STAFF'),true);
 assert.equal(canTransition('ASSIGNED','ACCEPTED','FACULTY'),false);
 assert.equal(canTransition('IN_PROGRESS','RESOLVED','ADMIN'),false);
 assert.equal(canTransition('RESOLUTION_SUBMITTED','RESOLVED','ADMIN'),true);
 assert.equal(canTransition('RESOLVED','REOPENED','STUDENT'),false);
 assert.equal(canTransition('REJECTED','ASSIGNED','ADMIN'),false);
});
test('state machine has no unknown targets',()=>{
 const names=new Set(Object.keys(TRANSITIONS));
 for(const edges of Object.values(TRANSITIONS))for(const target of Object.keys(edges))assert.equal(names.has(target),true);
});
