import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/lib/api.js';
import {validatePhotos, resolutionError, recordId} from '../src/lib/workflow.js';
const response = (status, data) => new Response(JSON.stringify({success:status===200,data,message:'Session expired'}), {status,headers:{'Content-Type':'application/json'}});
test('parallel expired requests rotate the refresh cookie once and retry', async () => {
 let refreshes=0;
 const client=createApiClient('', async (url,options)=>{
  if(url==='/auth/refresh'){refreshes++;await new Promise(resolve=>setTimeout(resolve,10));return response(200,{accessToken:'new'});}
  return options.headers.Authorization==='Bearer new'?response(200,url):response(401);
 });
 client.session.set('expired');
 assert.deepEqual(await Promise.all([client.api.get('/complaints'),client.api.get('/notifications')]),['/complaints','/notifications']);
 assert.equal(refreshes,1);
});
test('invalid refresh clears the authenticated UI and does not retry forever', async()=>{
 let calls=0,expired=0;
 const client=createApiClient('',async()=>{calls++;return response(401);});
 client.session.set('expired');client.session.onExpired(()=>expired++);
 await assert.rejects(client.api.get('/complaints'),/Session expired/);
 assert.equal(calls,2);assert.equal(expired,1);
});
test('network failures do not masquerade as successful responses',async()=>{
 const client=createApiClient('',async()=>{throw new TypeError('offline');});
 await assert.rejects(client.api.get('/complaints'),/Cannot reach Clyra/);
});
test('resolution follows server capability and validates evidence',()=>{
 assert.match(resolutionError({files:[],remarks:'Completed all repairs',capabilities:{}}),/photo/);
 assert.match(resolutionError({files:[],remarks:'done',capabilities:{textOnlyResolution:true}}),/20 characters/);
 assert.equal(resolutionError({files:[],remarks:'Replaced the broken pipe and tested for leaks.',capabilities:{textOnlyResolution:true}}),'');
 assert.match(validatePhotos([{type:'image/png',size:6*1024*1024}]),/5 MB/);
 assert.match(validatePhotos([{type:'application/pdf',size:100}]),/JPG/);
 assert.equal(recordId({_id:'abc'}),'abc');
});
