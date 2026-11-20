import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import request from 'supertest';

// This suite is opt-in and must never point at a real campus database.
const mongoUri = process.env.CLYRA_TEST_MONGODB_URI;
if (!mongoUri || !/^mongodb:\/\/127\.0\.0\.1:(?:27017|27019)\/clyra_ci_test(?:_[a-zA-Z0-9]+)?(?:\?replicaSet=[a-zA-Z0-9-]+)?$/.test(mongoUri)) {
  throw new Error('Integration tests require an isolated local clyra_ci_test database');
}
process.env.JWT_ACCESS_SECRET = 'clyra-integration-only-not-a-production-secret-12345';
process.env.AI_SHARED_SECRET = '';
process.env.NODE_ENV = 'test';
process.env.ALLOW_TEXT_ONLY_RESOLUTION = 'true';
const {default: app} = await import('../src/app.js');
const {User, Department, Location, Media, Complaint, StatusHistory, Assignment, Notification, Session, AuditLog} = await import('../src/models/index.js');

const api = request(app);
function auth(token) { return {Authorization: 'Bearer ' + token}; }
async function signIn(email) {
  const r = await api.post('/api/v1/auth/login').send({email, password:'OnlyForCiTests!2026'});
  assert.equal(r.status, 200, r.text);
  return r.body.data.accessToken;
}

test('real MongoDB grievance lifecycle, security and transaction regressions', {timeout: 90000}, async t => {
  const disconnected = await api.get('/health/ready');
  assert.equal(disconnected.status, 503);
  assert.deepEqual(disconnected.body, {status:'not_ready',service:'clyra-api',database:'unavailable'});
  await mongoose.connect(mongoUri, {serverSelectionTimeoutMS: 12000});
  try {
    await Promise.all(Object.values(mongoose.models).map(model=>model.init()));
    const passwordHash = await bcrypt.hash('OnlyForCiTests!2026', 8);
    const dept = await Department.create({name:'Campus maintenance', code:'CIMT'});
    const location = await Location.create({name:'Main campus', type:'CAMPUS'});
    const [admin, student, outsider, staff, secondStaff] = await User.create([
      {fullName:'Clyra Admin', email:'admin@clyra-test.invalid', role:'ADMIN', passwordHash},
      {fullName:'Student One', email:'student@clyra-test.invalid', role:'STUDENT', passwordHash},
      {fullName:'Student Two', email:'outsider@clyra-test.invalid', role:'STUDENT', passwordHash},
      {fullName:'Staff One', email:'staff@clyra-test.invalid', role:'STAFF', departmentId:dept._id, passwordHash},
      {fullName:'Staff Two', email:'second-staff@clyra-test.invalid', role:'STAFF', departmentId:dept._id, passwordHash},
    ]);
    const [adminToken, studentToken, outsiderToken, staffToken, secondStaffToken] = await Promise.all([
      signIn(admin.email), signIn(student.email), signIn(outsider.email), signIn(staff.email), signIn(secondStaff.email),
    ]);

    await t.test('readiness checks MongoDB and does not expose connection errors', async () => {
      const ready = await api.get('/health/ready');
      assert.equal(ready.status, 200, ready.text);
      assert.deepEqual(ready.body, {status:'ready',service:'clyra-api',database:'connected'});
      const originalAdmin = mongoose.connection.db.admin;
      mongoose.connection.db.admin = () => ({ping:async()=>{throw new Error('private connection details');}});
      try {
        const failed = await api.get('/health/ready');
        assert.equal(failed.status, 503);
        assert.equal(failed.text.includes('private'), false);
        assert.equal((await api.get('/health')).status, 200);
      } finally { mongoose.connection.db.admin = originalAdmin; }
    });

    const layout = {campusId:String(location._id),blocks:[{code:'D',floorCount:4},{code:'U',floorCount:5}],includeGroundFloor:true};
    const preset = body => api.post('/api/v1/locations/campus-layout').set(auth(adminToken)).send(body);
    await t.test('campus presets require admin permissions and validated D–U block configuration', async () => {
      assert.equal((await api.get('/api/v1/locations/catalog')).status,401);
      assert.equal((await api.post('/api/v1/locations/campus-layout').send(layout)).status,401);
      for (const token of [studentToken,staffToken]) {
        assert.equal((await api.post('/api/v1/locations/campus-layout').set(auth(token)).send(layout)).status,403);
      }
      for (const body of [
        {...layout,blocks:[{code:'C',floorCount:4}]},
        {...layout,blocks:[{code:'V',floorCount:5}]},
        {...layout,blocks:[{code:'D',floorCount:6}]},
        {...layout,blocks:[{code:'D',floorCount:4},{code:'D',floorCount:5}]},
        {...layout,campusId:'invalid'}, {...layout,includeGroundFloor:'true'},
      ]) assert.equal((await preset(body)).status,400);
      const missing = await preset({...layout,campusId:String(new mongoose.Types.ObjectId())});
      assert.equal(missing.status,400,missing.text);
    });

    await t.test('4/5-level presets are additive, idempotent and preserve manually added locations', async () => {
      const manual = await api.post('/api/v1/locations').set(auth(adminToken)).send({name:'Sports court',type:'COMMON_AREA',parentLocationId:String(location._id),description:'Keep this custom location'});
      assert.equal(manual.status,200,manual.text);
      // An existing manually configured D block is reused without renaming or recoding.
      const manualBlock = await api.post('/api/v1/locations').set(auth(adminToken)).send({name:'D Block',code:'MANUAL-D',type:'BUILDING',parentLocationId:String(location._id)});
      assert.equal(manualBlock.status,200,manualBlock.text);
      const first = await preset(layout);
      assert.equal(first.status,200,first.text);
      assert.equal(first.body.data.created,10);
      assert.equal(first.body.data.existing,1);
      for (const [code,floors] of [['D',4],['U',5]]) {
        const block = await Location.findOne({name:`${code} Block`,parentLocationId:location._id});
        const levels = await Location.find({parentLocationId:block._id}).sort({name:1});
        assert.equal(levels.length,floors);
        assert.equal(levels.some(item=>item.name==='Ground Floor'),true);
        assert.equal(levels.some(item=>item.name===`Floor ${floors-1}`),true);
        assert.equal(levels.some(item=>item.name===`Floor ${floors}`),false);
      }
      const count = await Location.countDocuments();
      const repeated = await Promise.all([preset(layout),preset(layout)]);
      for (const response of repeated) {
        assert.equal(response.status,200,response.text);
        assert.equal(response.body.data.created,0);
        assert.equal(response.body.data.existing,11);
      }
      assert.equal(await Location.countDocuments(),count);
      assert.equal((await Location.findById(manual.body.data._id)).description,'Keep this custom location');
      assert.equal((await Location.findById(manualBlock.body.data._id)).code,'MANUAL-D');
    });

    await t.test('catalog covers more than 100 nodes with readable paths and both numbering conventions', async () => {
      const allBlocks = Array.from({length:18},(_,i)=>({code:String.fromCharCode(68+i),floorCount:5}));
      const full = await preset({...layout,blocks:allBlocks});
      assert.equal(full.status,200,full.text);
      const catalog = await api.get('/api/v1/locations/catalog').set(auth(studentToken));
      assert.equal(catalog.status,200,catalog.text);
      assert.ok(catalog.body.data.length>100);
      const uTop = catalog.body.data.find(item=>item.pathName==='Main campus / U Block / Floor 4');
      assert.ok(uTop);
      assert.equal(uTop.isAvailable,true);
      const paged = await api.get('/api/v1/locations?limit=100').set(auth(studentToken));
      assert.equal(paged.body.data.length,100);
      assert.equal(paged.body.meta.total,catalog.body.data.length);
      const another = await Location.create({name:'Numbered floors campus',type:'CAMPUS'});
      const numbered = await preset({...layout,campusId:String(another._id),blocks:[{code:'D',floorCount:4}],includeGroundFloor:false});
      assert.equal(numbered.status,200,numbered.text);
      assert.deepEqual(numbered.body.data.locations.filter(item=>item.type==='FLOOR').map(item=>item.name),['Floor 1','Floor 2','Floor 3','Floor 4']);
    });

    await t.test('preset conflicts roll back all additions and hierarchy edits cannot break existing children', async () => {
      const conflictCampus = await Location.create({name:'Conflict test campus',type:'CAMPUS'});
      await Location.create({name:'G Block',type:'COMMON_AREA',parentLocationId:conflictCampus._id});
      const before = await Location.countDocuments();
      const collision = await preset({...layout,campusId:String(conflictCampus._id),blocks:[{code:'F',floorCount:4},{code:'G',floorCount:4}]});
      assert.equal(collision.status,409,collision.text);
      assert.equal(await Location.countDocuments(),before);
      const block = await Location.findOne({name:'D Block',parentLocationId:location._id});
      const floor = await Location.findOne({parentLocationId:block._id});
      const invalidType = await api.patch(`/api/v1/locations/${block._id}`).set(auth(adminToken)).send({type:'COMMON_AREA'});
      assert.equal(invalidType.status,409,invalidType.text);
      const cycle = await api.patch(`/api/v1/locations/${block._id}`).set(auth(adminToken)).send({type:'COMMON_AREA',parentLocationId:String(floor._id)});
      assert.equal(cycle.status,400,cycle.text);
      const deactivate = await api.patch(`/api/v1/locations/${location._id}/status`).set(auth(adminToken)).send({isActive:false});
      assert.equal(deactivate.status,409,deactivate.text);
    });

    await t.test('inactive ancestors hide descendants and reject manual children and complaint submission', async () => {
      const campus = await Location.create({name:'Inactive ancestry campus',type:'CAMPUS',isActive:false});
      const block = await Location.create({name:'Legacy block',type:'BUILDING',parentLocationId:campus._id});
      const studentCatalog = await api.get('/api/v1/locations/catalog').set(auth(studentToken));
      assert.equal(studentCatalog.body.data.some(item=>item._id===String(block._id)),false);
      const adminCatalog = await api.get('/api/v1/locations/catalog').set(auth(adminToken));
      assert.equal(adminCatalog.body.data.find(item=>item._id===String(block._id)).isAvailable,false);
      assert.equal((await api.get(`/api/v1/locations/${block._id}`).set(auth(studentToken))).status,404);
      const child = await api.post('/api/v1/locations').set(auth(adminToken)).send({name:'Floor 1',type:'FLOOR',parentLocationId:String(block._id)});
      assert.equal(child.status,400,child.text);
      const rejected = await api.post('/api/v1/complaints').set(auth(studentToken)).send({title:'Inactive location report',description:'This old location must not accept new complaints.',locationId:String(block._id)});
      assert.equal(rejected.status,400,rejected.text);
      assert.equal((await preset({...layout,campusId:String(campus._id)})).status,400);
    });

    const created = await api.post('/api/v1/complaints').set(auth(studentToken)).send({
      title:'Water leaking in hallway',
      description:'There is a persistent water leak near the main entrance to the building.',
      locationId: String(location._id),
      category:'Plumbing',
    });
    assert.equal(created.status, 200, created.text);
    const c = created.body.data;
    assert.match(c.complaintCode, /^CLY-\d{4}-\d{6}$/);
    assert.equal(c.status, 'SUBMITTED');
    assert.equal(c.aiAnalysis.status, 'UNAVAILABLE');
    assert.equal(String(c.submittedBy), String(student._id));

    const ownList = await api.get('/api/v1/complaints').set(auth(studentToken));
    assert.equal(ownList.status, 200, ownList.text);
    assert.equal(ownList.body.data.length, 1);
    const forbidden = await api.get('/api/v1/complaints/' + c._id).set(auth(outsiderToken));
    assert.equal(forbidden.status, 403, forbidden.text);
    const outsiderList = await api.get('/api/v1/complaints').set(auth(outsiderToken));
    assert.equal(outsiderList.status, 200);
    assert.equal(outsiderList.body.data.length, 0);

    const studentReview = await api.post('/api/v1/complaints/' + c._id + '/review')
      .set(auth(studentToken)).send({decision:'APPROVE'});
    assert.equal(studentReview.status, 403);

    const review = await api.post('/api/v1/complaints/' + c._id + '/review')
      .set(auth(adminToken)).send({decision:'APPROVE'});
    assert.equal(review.status, 200, review.text);
    assert.equal(review.body.data.status, 'UNDER_REVIEW');

    const assignment = await api.post('/api/v1/complaints/' + c._id + '/assign')
      .set(auth(adminToken)).send({departmentId:String(dept._id),assignedTo:String(staff._id)});
    assert.equal(assignment.status, 200, assignment.text);
    const aid = assignment.body.data._id;

    const accept = await api.post('/api/v1/assignments/' + aid + '/accept').set(auth(staffToken)).send({});
    assert.equal(accept.status, 200, accept.text);
    const start = await api.post('/api/v1/assignments/' + aid + '/start').set(auth(staffToken)).send({});
    assert.equal(start.status, 200, start.text);

    // Model an asset already verified by the separate authenticated upload route.
    // This tests the resolution business workflow, NOT Cloudinary uploading.
    const imageUrl = 'https://example.invalid/clyra-ci-evidence.jpg';
    await Media.create({owner:staff._id, publicId:'clyra-ci-photo',url:imageUrl,
      resourceType:'EVIDENCE',resourceId:c._id,used:false});
    const resolution = await api.post('/api/v1/assignments/' + aid + '/submit-resolution')
      .set(auth(staffToken)).send({evidenceUrls:[imageUrl],remarks:'Leak repaired and area dried'});
    assert.equal(resolution.status, 200, resolution.text);

    const verify = await api.post('/api/v1/complaints/' + c._id + '/verify-resolution')
      .set(auth(adminToken)).send({accepted:true});
    assert.equal(verify.status, 200, verify.text);
    assert.equal(verify.body.data.status, 'RESOLVED');

    const feedback = await api.post('/api/v1/feedback').set(auth(studentToken))
      .send({complaintId:c._id,rating:5,comment:'Resolved quickly'});
    assert.equal(feedback.status, 200, feedback.text);
    const outsiderFeedback = await api.post('/api/v1/feedback').set(auth(outsiderToken))
      .send({complaintId:c._id,rating:1});
    assert.equal(outsiderFeedback.status, 403);

    const detail = await api.get('/api/v1/complaints/' + c._id).set(auth(studentToken));
    assert.equal(detail.status, 200, detail.text);
    assert.equal(detail.body.data.status, 'RESOLVED');
    const history = await api.get('/api/v1/complaints/' + c._id + '/history').set(auth(studentToken));
    assert.equal(history.status, 200, history.text);
    const states = history.body.data.map(x => x.newStatus);
    assert.deepEqual(states, ['SUBMITTED','UNDER_REVIEW','ASSIGNED','ACCEPTED',
      'IN_PROGRESS','RESOLUTION_SUBMITTED','RESOLVED']);
    assert.equal(await StatusHistory.countDocuments({complaintId:c._id}), states.length);
    assert.equal(await Complaint.countDocuments({submittedBy:student._id}), 1);

    const create = async (title='Another hallway maintenance issue') => {
      const response=await api.post('/api/v1/complaints').set(auth(studentToken)).send({title,description:'A maintenance problem requiring a staff inspection and follow-up.',locationId:String(location._id)});
      assert.equal(response.status,200,response.text);return response.body.data;
    };
    const approve=async complaint=>{
      const response=await api.post(`/api/v1/complaints/${complaint._id}/review`).set(auth(adminToken)).send({decision:'APPROVE'});
      assert.equal(response.status,200,response.text);
    };
    const assign=async (complaint,user=staff,reason)=>{
      const response=await api.post(`/api/v1/complaints/${complaint._id}/assign`).set(auth(adminToken)).send({departmentId:String(dept._id),assignedTo:String(user._id),...(reason?{reason}:{})});
      assert.equal(response.status,200,response.text);return response.body.data;
    };
    const action=async (assignment,name,body={},actor=staffToken)=>{
      const response=await api.post(`/api/v1/assignments/${assignment._id}/${name}`).set(auth(actor)).send(body);
      assert.equal(response.status,200,response.text);return response.body.data;
    };

    await t.test('failed review validation leaves complaint, timeline and notifications untouched',async()=>{
      const complaint=await create();
      const before=await Notification.countDocuments({complaintId:complaint._id});
      for(const body of [{decision:'REJECT'},{decision:'APPROVE',priority:'Critical'}]){
        const response=await api.post(`/api/v1/complaints/${complaint._id}/review`).set(auth(adminToken)).send(body);
        assert.equal(response.status,400,response.text);
        assert.equal((await Complaint.findById(complaint._id)).status,'SUBMITTED');
        assert.equal(await StatusHistory.countDocuments({complaintId:complaint._id}),1);
        assert.equal(await Notification.countDocuments({complaintId:complaint._id}),before);
      }
    });

    await t.test('a persistence failure rolls back complaint state, assignment, audit and history',async()=>{
      const complaint=await create();await approve(complaint);
      const before=await AuditLog.countDocuments();
      const original=StatusHistory.create;
      StatusHistory.create=async()=>{throw new Error('Injected history persistence failure');};
      try{
        const response=await api.post(`/api/v1/complaints/${complaint._id}/assign`).set(auth(adminToken)).send({departmentId:String(dept._id),assignedTo:String(staff._id)});
        assert.equal(response.status,500,response.text);
      }finally{StatusHistory.create=original;}
      assert.equal((await Complaint.findById(complaint._id)).status,'UNDER_REVIEW');
      assert.equal(await Assignment.countDocuments({complaintId:complaint._id}),0);
      assert.equal(await StatusHistory.countDocuments({complaintId:complaint._id}),2);
      assert.equal(await AuditLog.countDocuments(),before);
    });

    await t.test('concurrent assignments and acceptance cannot fork the lifecycle',async()=>{
      const complaint=await create();await approve(complaint);
      const results=await Promise.all([staff,secondStaff].map(user=>api.post(`/api/v1/complaints/${complaint._id}/assign`).set(auth(adminToken)).send({departmentId:String(dept._id),assignedTo:String(user._id)})));
      assert.deepEqual(results.map(x=>x.status).sort(),[200,400]);
      const assignment=results.find(x=>x.status===200).body.data;
      const actor=assignment.assignedTo===String(staff._id)?staffToken:secondStaffToken;
      const accepts=await Promise.all([1,2].map(()=>api.post(`/api/v1/assignments/${assignment._id}/accept`).set(auth(actor)).send({})));
      assert.deepEqual(accepts.map(x=>x.status).sort(),[200,409]);
      assert.equal(await Assignment.countDocuments({complaintId:complaint._id}),1);
      assert.equal(await StatusHistory.countDocuments({complaintId:complaint._id,newStatus:'ACCEPTED'}),1);
    });

    await t.test('reassignment removes old staff complaint access and prevents stale actions',async()=>{
      const complaint=await create();await approve(complaint);
      const old=await assign(complaint);const replacement=await assign(complaint,secondStaff,'Reassigned to available technician');
      for(const suffix of ['', '/history']){
        const response=await api.get(`/api/v1/complaints/${complaint._id}${suffix}`).set(auth(staffToken));
        assert.equal(response.status,403,response.text);
      }
      const list=await api.get('/api/v1/complaints?limit=100').set(auth(staffToken));
      assert.equal(list.body.data.some(item=>item._id===complaint._id),false);
      const stale=await api.post(`/api/v1/assignments/${old._id}/accept`).set(auth(staffToken)).send({});
      assert.equal(stale.status,409,stale.text);
      const history=await api.get('/api/v1/assignments?section=history').set(auth(staffToken));
      assert.equal(history.status,200,history.text);
      assert.equal(history.body.data.find(item=>item._id===old._id).complaint,null);
      const current=await api.get(`/api/v1/complaints/${complaint._id}`).set(auth(secondStaffToken));
      assert.equal(current.status,200,current.text);assert.equal(current.body.data.currentAssignment._id,replacement._id);
      assert.equal(current.body.data.locationName,location.name);
      await User.updateOne({_id:secondStaff._id},{$unset:{departmentId:1}});
      const moved=await api.get(`/api/v1/complaints/${complaint._id}`).set(auth(secondStaffToken));assert.equal(moved.status,403,moved.text);
      await User.updateOne({_id:secondStaff._id},{$set:{departmentId:dept._id}});
    });

    await t.test('written demo resolution still requires admin verification, supports return, feedback and reopen',async()=>{
      const complaint=await create();await approve(complaint);const assignment=await assign(complaint);
      await action(assignment,'accept');await action(assignment,'start');
      const invalid=await api.post(`/api/v1/assignments/${assignment._id}/submit-resolution`).set(auth(staffToken)).send({evidenceUrls:[],remarks:'done'});
      assert.equal(invalid.status,400,invalid.text);
      await action(assignment,'hold',{reason:'Waiting for replacement materials'});await action(assignment,'resume');
      const note='Inspected the area, repaired the issue and tested normal operation.';
      await action(assignment,'submit-resolution',{evidenceUrls:[],remarks:note});
      const staffVerification=await api.post(`/api/v1/complaints/${complaint._id}/verify-resolution`).set(auth(staffToken)).send({accepted:true});assert.equal(staffVerification.status,403);
      const missingDecision=await api.post(`/api/v1/complaints/${complaint._id}/verify-resolution`).set(auth(adminToken)).send({});assert.equal(missingDecision.status,400);
      const returned=await api.post(`/api/v1/complaints/${complaint._id}/verify-resolution`).set(auth(adminToken)).send({accepted:false,reason:'Please inspect the adjacent fixture as well'});assert.equal(returned.status,200,returned.text);
      assert.equal((await Assignment.findById(assignment._id)).assignmentStatus,'IN_PROGRESS');
      await action(assignment,'submit-resolution',{evidenceUrls:[],remarks:note});
      const verified=await api.post(`/api/v1/complaints/${complaint._id}/verify-resolution`).set(auth(adminToken)).send({accepted:true});assert.equal(verified.status,200,verified.text);
      const feedbackBody={complaintId:complaint._id,rating:4};
      assert.equal((await api.post('/api/v1/feedback').set(auth(studentToken)).send(feedbackBody)).status,200);
      assert.equal((await api.post('/api/v1/feedback').set(auth(studentToken)).send(feedbackBody)).status,409);
      const reopened=await api.post(`/api/v1/complaints/${complaint._id}/reopen`).set(auth(adminToken)).send({reason:'Issue recurred during follow-up inspection'});assert.equal(reopened.status,200,reopened.text);
      await assign(complaint,secondStaff,'New staff to inspect recurring fault');
      assert.equal((await api.get(`/api/v1/complaints/${complaint._id}`).set(auth(staffToken))).status,403);
      assert.equal((await Assignment.findById(assignment._id)).assignmentStatus,'COMPLETED');
    });

    await t.test('capabilities and summary are authenticated and summarize all scoped records',async()=>{
      assert.equal((await api.get('/api/v1/capabilities')).status,401);
      const capabilities=await api.get('/api/v1/capabilities').set(auth(studentToken));assert.equal(capabilities.status,200,capabilities.text);
      assert.equal(capabilities.body.data.textOnlyResolution,true);assert.equal(capabilities.body.data.passwordReset,false);
      const summary=await api.get('/api/v1/complaints/summary').set(auth(studentToken));assert.equal(summary.status,200,summary.text);
      assert.equal(summary.body.data.total,await Complaint.countDocuments({submittedBy:student._id}));
      assert.equal(summary.body.data.resolved,1);
      const outside=await api.get('/api/v1/complaints/summary').set(auth(outsiderToken));assert.deepEqual(outside.body.data,{total:0,active:0,resolved:0,critical:0});
      const staffList=await api.get('/api/v1/complaints?limit=100').set(auth(staffToken));
      const staffSummary=await api.get('/api/v1/complaints/summary').set(auth(staffToken));assert.equal(staffSummary.body.data.total,staffList.body.meta.total);
    });

    await t.test('concurrent complaint creation generates unique codes with complete histories',async()=>{
      const complaints=await Promise.all(Array.from({length:6},(_,index)=>create(`Concurrent report number ${index}`)));
      assert.equal(new Set(complaints.map(item=>item.complaintCode)).size,6);
      assert.equal(await StatusHistory.countDocuments({complaintId:{$in:complaints.map(item=>item._id)}}),6);
    });

    await t.test('refresh tokens are single-use and logout immediately revokes access',async()=>{
      const signed=await api.post('/api/v1/auth/login').set('X-Client','mobile').send({email:student.email,password:'OnlyForCiTests!2026'});assert.equal(signed.status,200,signed.text);
      assert.equal(signed.body.data.user.passwordHash,undefined);
      const refresh=signed.body.data.refreshToken;
      const renewed=await Promise.all([1,2].map(()=>api.post('/api/v1/auth/refresh').set('X-Client','mobile').send({refreshToken:refresh})));
      assert.deepEqual(renewed.map(item=>item.status).sort(),[200,401]);
      const session=renewed.find(item=>item.status===200).body.data;
      assert.notEqual(session.refreshToken,refresh);
      assert.equal(await Session.countDocuments({tokenHash:refresh}),0);
      const logout=await api.post('/api/v1/auth/logout').set('X-Client','mobile').send({refreshToken:session.refreshToken});assert.equal(logout.status,200,logout.text);
      for(const access of [signed.body.data.accessToken,session.accessToken])assert.equal((await api.get('/api/v1/auth/me').set(auth(access))).status,401);
      const replay=await api.post('/api/v1/auth/refresh').set('X-Client','mobile').send({refreshToken:session.refreshToken});assert.equal(replay.status,401,replay.text);
    });

    await t.test('account changes and deactivation revoke existing sessions',async()=>{
      const changed=await api.patch(`/api/v1/users/${outsider._id}`).set(auth(adminToken)).send({fullName:'Student Two Updated'});assert.equal(changed.status,200,changed.text);
      assert.equal((await api.get('/api/v1/auth/me').set(auth(outsiderToken))).status,401);
      const disabled=await api.patch(`/api/v1/users/${student._id}/status`).set(auth(adminToken)).send({isActive:false});assert.equal(disabled.status,200,disabled.text);
      assert.equal((await api.get('/api/v1/auth/me').set(auth(studentToken))).status,401);
      const login=await api.post('/api/v1/auth/login').send({email:student.email,password:'OnlyForCiTests!2026'});assert.equal(login.status,401,login.text);
    });
  } finally {
    await mongoose.disconnect();
  }
});
