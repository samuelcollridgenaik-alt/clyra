import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import request from 'supertest';

// This suite is opt-in and must never point at a real campus database.
const mongoUri = process.env.CLYRA_TEST_MONGODB_URI;
if (!mongoUri || !/^mongodb:\/\/127\.0\.0\.1:27017\/clyra_ci_test(?:_[a-zA-Z0-9]+)?$/.test(mongoUri)) {
  throw new Error('Integration tests require an isolated local clyra_ci_test database');
}
process.env.JWT_ACCESS_SECRET = 'clyra-integration-only-not-a-production-secret-12345';
process.env.AI_SHARED_SECRET = '';
process.env.NODE_ENV = 'test';
const {default: app} = await import('../src/app.js');
const {User, Department, Location, Media, Complaint, StatusHistory} = await import('../src/models/index.js');

const api = request(app);
function auth(token) { return {Authorization: 'Bearer ' + token}; }
async function signIn(email) {
  const r = await api.post('/api/v1/auth/login').send({email, password:'OnlyForCiTests!2026'});
  assert.equal(r.status, 200, r.text);
  return r.body.data.accessToken;
}

test('real MongoDB grievance lifecycle and complaint ownership', {timeout: 90000}, async () => {
  await mongoose.connect(mongoUri, {serverSelectionTimeoutMS: 12000});
  try {
    const passwordHash = await bcrypt.hash('OnlyForCiTests!2026', 8);
    const dept = await Department.create({name:'Campus maintenance', code:'CIMT'});
    const location = await Location.create({name:'Main campus', type:'CAMPUS'});
    const [admin, student, outsider, staff] = await User.create([
      {fullName:'Clyra Admin', email:'admin@clyra-test.invalid', role:'ADMIN', passwordHash},
      {fullName:'Student One', email:'student@clyra-test.invalid', role:'STUDENT', passwordHash},
      {fullName:'Student Two', email:'outsider@clyra-test.invalid', role:'STUDENT', passwordHash},
      {fullName:'Staff One', email:'staff@clyra-test.invalid', role:'STAFF', departmentId:dept._id, passwordHash},
    ]);
    const [adminToken, studentToken, outsiderToken, staffToken] = await Promise.all([
      signIn(admin.email), signIn(student.email), signIn(outsider.email), signIn(staff.email),
    ]);

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
  } finally {
    await mongoose.disconnect();
  }
});
