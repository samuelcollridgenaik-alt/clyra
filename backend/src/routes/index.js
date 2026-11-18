import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { User,Complaint,Department,Location,Assignment,StatusHistory,Notification,Feedback,Announcement,Session,Counter,AuditLog,CATEGORIES,PRIORITIES,Media,Device } from '../models/index.js';
import { requireAuth,role,asyncRoute,HttpError,validate,success } from '../middleware/security.js';
import * as v from '../validators/index.js';
import { transition,assertReadComplaint,audit,notify } from '../services/lifecycle.js';
import { analyzeComplaint } from '../integrations/ai/client.js';
import { uploadImage,deleteImage } from '../integrations/cloudinary/client.js';
import { sendPush } from '../integrations/firebase/client.js';
import { encryptToken,hashToken } from '../utils/encryption.js';
import { fileTypeFromBuffer } from 'file-type';
import multer from 'multer';

const router=Router();
const r=(fn)=>asyncRoute(fn);
const get=async(Model,id)=>{if(!mongoose.isValidObjectId(id))throw new HttpError(400,'Invalid identifier','VALIDATION_ERROR');const item=await Model.findById(id);if(!item)throw new HttpError(404,'Record not found','NOT_FOUND');return item;};
const filterActive=()=>({isActive:true});
const limit=(query)=>v.paging(query);
const limitedList=async(Model,query,sort={createdAt:-1})=>{
 const {page,limit:lim,skip}=limit(query);
 const [items,total]=await Promise.all([Model.find(query.filter||{}).sort(sort).skip(skip).limit(lim).lean(),Model.countDocuments(query.filter||{})]);
 return {items,meta:{page,limit:lim,total,pages:Math.ceil(total/lim)}};
};
function token(user){return jwt.sign({role:user.role},config.jwtSecret,{algorithm:'HS256',subject:String(user._id),issuer:config.issuer,audience:config.audience,expiresIn:'15m'});}
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const cookies={httpOnly:true,secure:config.production,sameSite:'strict',path:'/api/v1/auth',maxAge:7*24*3600*1000};
async function issue(req,res,user){
 const refresh=crypto.randomBytes(48).toString('base64url');
 await Session.create({userId:user._id,tokenHash:hash(refresh),expiresAt:new Date(Date.now()+7*86400000),device:(req.headers['user-agent']||'unknown').slice(0,160)});
 res.cookie('clyra_refresh',refresh,cookies);
 return {accessToken:token(user),user:user.toJSON(),...(req.get('X-Client')==='mobile'?{refreshToken:refresh}:{})};
}
// AUTH — enrollment disabled unless explicitly configured; role is never client-controlled.
router.post('/auth/register',validate(v.register),r(async(req,res)=>{
 if(!config.studentRegistration)throw new HttpError(403,'Self-registration disabled until campus policy approval','REGISTRATION_DISABLED');
 if(config.studentDomain&&!req.body.email.endsWith('@'+config.studentDomain))throw new HttpError(403,'Campus email required','DOMAIN_RESTRICTED');
 const passwordHash=await bcrypt.hash(req.body.password,12);
 const user=await User.create({...req.body,role:'STUDENT',passwordHash});
 success(res,{id:user._id},'Account created');
}));
router.post('/auth/login',validate(v.login),r(async(req,res)=>{
 const user=await User.findOne({email:req.body.email}).select('+passwordHash');
 if(!user||!user.isActive||!(await bcrypt.compare(req.body.password,user.passwordHash)))throw new HttpError(401,'Invalid credentials','INVALID_CREDENTIALS');
 success(res,await issue(req,res,user),'Signed in');
}));
router.post('/auth/refresh',r(async(req,res)=>{
 const refresh=req.cookies.clyra_refresh||req.body?.refreshToken;
 if(typeof refresh!=='string')throw new HttpError(401,'Refresh token required','INVALID_REFRESH');
 const session=await Session.findOne({tokenHash:hash(refresh),revokedAt:{$exists:false},expiresAt:{$gt:new Date()}});
 if(!session)throw new HttpError(401,'Invalid refresh session','INVALID_REFRESH');
 const user=await User.findById(session.userId);
 if(!user?.isActive)throw new HttpError(401,'Account inactive','ACCOUNT_DISABLED');
 session.revokedAt=new Date();await session.save();
 success(res,await issue(req,res,user),'Session renewed');
}));
router.post('/auth/logout',r(async(req,res)=>{
 const refresh=req.cookies.clyra_refresh||req.body?.refreshToken;
 if(typeof refresh==='string')await Session.updateOne({tokenHash:hash(refresh)},{$set:{revokedAt:new Date()}});
 res.clearCookie('clyra_refresh',{...cookies,maxAge:undefined});success(res,null,'Signed out');
}));
router.get('/auth/me',requireAuth,r(async(req,res)=>success(res,req.user)));

router.use(requireAuth);
router.get('/users/me',r(async(req,res)=>success(res,req.user)));
router.patch('/users/me',validate(v.profile),r(async(req,res)=>{
 Object.assign(req.user,req.body);await req.user.save();success(res,req.user,'Profile updated');
}));
router.get('/users',role('ADMIN'),r(async(req,res)=>{
 const {page,limit:lim,skip}=limit(req.query);
 const filter=req.query.role?{role:String(req.query.role)}:{};
 const [items,total]=await Promise.all([User.find(filter).sort({createdAt:-1}).skip(skip).limit(lim),User.countDocuments(filter)]);
 res.json({success:true,message:'OK',data:items,meta:{page,limit:lim,total}});
}));
router.post('/users',role('ADMIN'),validate(v.createUser),r(async(req,res)=>{
 if(req.body.departmentId&&!(await Department.exists({_id:req.body.departmentId,isActive:true})))throw new HttpError(400,'Invalid department');
 const passwordHash=await bcrypt.hash(req.body.password,12);
 const user=await User.create({...req.body,passwordHash});
 await audit(req,'USER_CREATED','User',user._id,{role:user.role});success(res,user,'User created');
}));
router.get('/users/:id',role('ADMIN'),r(async(req,res)=>success(res,await get(User,req.params.id))));
router.patch('/users/:id',role('ADMIN'),r(async(req,res)=>{
 const patch=v.createUser.omit({password:true,fullName:true,email:true}).partial().extend({fullName:v.text(2,120).optional()}).strict().parse(req.body);
 const user=await get(User,req.params.id);
 if(patch.departmentId&&!(await Department.exists({_id:patch.departmentId,isActive:true})))throw new HttpError(400,'Invalid department');
 Object.assign(user,patch);await user.save();
 await Session.updateMany({userId:user._id,revokedAt:{$exists:false}},{$set:{revokedAt:new Date()}});
 await audit(req,'USER_UPDATED','User',user._id,{fields:Object.keys(patch)});success(res,user,'User updated');
}));
router.patch('/users/:id/status',role('ADMIN'),r(async(req,res)=>{
 const {isActive}=req.body||{};
 if(typeof isActive!=='boolean')throw new HttpError(400,'isActive must be boolean');
 const user=await get(User,req.params.id);
 if(String(user._id)===String(req.user._id)&&!isActive)throw new HttpError(409,'Cannot deactivate own admin account');
 user.isActive=isActive;await user.save();
 if(!isActive)await Session.updateMany({userId:user._id},{$set:{revokedAt:new Date()}});
 await audit(req,'USER_STATUS','User',user._id,{isActive});success(res,user);
}));

// DEPARTMENTS
router.get('/departments',r(async(req,res)=>{
 const query=req.user.role==='ADMIN'?{}:filterActive();
 const {items,meta}=await limitedList(Department,{...req.query,filter:query},{name:1});res.json({success:true,message:'OK',data:items,meta});
}));
router.post('/departments',role('ADMIN'),validate(v.department),r(async(req,res)=>{
 const item=await Department.create(req.body);await audit(req,'DEPARTMENT_CREATED','Department',item._id);success(res,item);
}));
router.get('/departments/:id',r(async(req,res)=>{
 const d=await get(Department,req.params.id);if(!d.isActive&&req.user.role!=='ADMIN')throw new HttpError(404,'Not found');success(res,d);
}));
router.patch('/departments/:id',role('ADMIN'),validate(v.departmentPatch),r(async(req,res)=>{
 const d=await get(Department,req.params.id);Object.assign(d,req.body);await d.save();await audit(req,'DEPARTMENT_UPDATED','Department',d._id);success(res,d);
}));
router.patch('/departments/:id/status',role('ADMIN'),r(async(req,res)=>{
 if(typeof req.body?.isActive!=='boolean')throw new HttpError(400,'isActive must be boolean');
 const d=await get(Department,req.params.id);d.isActive=req.body.isActive;await d.save();await audit(req,'DEPARTMENT_STATUS','Department',d._id);success(res,d);
}));

const parentTypes={CAMPUS:null,BUILDING:['CAMPUS'],FLOOR:['BUILDING'],ROOM:['FLOOR'],COMMON_AREA:['CAMPUS','BUILDING','FLOOR']};
async function validateParent(data,existingId){
 if(data.type==='CAMPUS'&&data.parentLocationId)throw new HttpError(400,'Campus cannot have a parent');
 if(data.type!=='CAMPUS'&&!data.parentLocationId)throw new HttpError(400,'Parent location required');
 if(!data.parentLocationId)return;
 const parent=await get(Location,data.parentLocationId);
 if(!parent.isActive||!(parentTypes[data.type]||[]).includes(parent.type))throw new HttpError(400,'Invalid parent hierarchy');
 if(existingId&&String(parent._id)===String(existingId))throw new HttpError(400,'Cannot parent a location to itself');
}
router.get('/locations',r(async(req,res)=>{
 const filter=req.user.role==='ADMIN'?{}:{isActive:true};const {items,meta}=await limitedList(Location,{...req.query,filter},{type:1,name:1});res.json({success:true,message:'OK',data:items,meta});
}));
router.post('/locations',role('ADMIN'),validate(v.location),r(async(req,res)=>{
 await validateParent(req.body);const item=await Location.create(req.body);await audit(req,'LOCATION_CREATED','Location',item._id);success(res,item);
}));
router.get('/locations/:id',r(async(req,res)=>{
 const item=await get(Location,req.params.id);if(!item.isActive&&req.user.role!=='ADMIN')throw new HttpError(404,'Not found');success(res,item);
}));
router.patch('/locations/:id',role('ADMIN'),validate(v.locationPatch),r(async(req,res)=>{
 const loc=await get(Location,req.params.id);
 const next={...loc.toObject(),...req.body};await validateParent(next,loc._id);
 Object.assign(loc,req.body);await loc.save();await audit(req,'LOCATION_UPDATED','Location',loc._id);success(res,loc);
}));
router.patch('/locations/:id/status',role('ADMIN'),r(async(req,res)=>{
 if(typeof req.body?.isActive!=='boolean')throw new HttpError(400,'isActive must be boolean');
 const loc=await get(Location,req.params.id);
 if(!req.body.isActive&&await Location.exists({parentLocationId:loc._id,isActive:true}))throw new HttpError(409,'Deactivate child locations first');
 loc.isActive=req.body.isActive;await loc.save();await audit(req,'LOCATION_STATUS','Location',loc._id);success(res,loc);
}));

// COMPLAINTS
router.post('/complaints',role('STUDENT','FACULTY','ADMIN'),validate(v.complaint),r(async(req,res)=>{
 const loc=await get(Location,req.body.locationId);if(!loc.isActive)throw new HttpError(400,'Location inactive');
 if((req.body.imageUrls||[]).length)throw new HttpError(400,'Use the authenticated media upload flow; direct image URLs are not accepted');
 const sequence=await Counter.findOneAndUpdate({_id:'complaints_'+new Date().getUTCFullYear()},{$inc:{seq:1}},{new:true,upsert:true});
 const complaintCode=`CLY-${new Date().getUTCFullYear()}-${String(sequence.seq).padStart(6,'0')}`;
 const comparable=await Complaint.find({locationId:loc._id}).select('_id title description locationId').sort({createdAt:-1}).limit(75).lean();
 const analysis=await analyzeComplaint({...req.body,candidates:comparable.map(x=>({complaintId:String(x._id),title:x.title,description:x.description,locationId:String(x.locationId)}))}).catch(()=>null);
 // Model suggestions are intentionally NOT binding decisions. Safety is flagged for manual review.
 const safetyFlag=/\b(fire|electrocution|shock|exposed wire|gas leak|violence|collapse)\b/i.test(req.body.title+' '+req.body.description);
 const item=await Complaint.create({...req.body,imageUrls:[],complaintCode,submittedBy:req.user._id,category:req.body.category||'Other',priority:safetyFlag?'High':'Medium',status:'SUBMITTED',...(analysis?{predictedCategory:analysis.classification?.category,predictedPriority:analysis.priority?.level,categoryConfidence:analysis.classification?.confidence,priorityConfidence:analysis.priority?.confidence,aiAnalysis:{...analysis,safetyFlag}}:{aiAnalysis:{status:'UNAVAILABLE',safetyFlag}})});
 await StatusHistory.create({complaintId:item._id,previousStatus:null,newStatus:'SUBMITTED',updatedBy:req.user._id});
 await notify(req.user._id,'Complaint submitted',`${complaintCode} received for review`,'SUBMITTED',item._id);
 success(res,item,'Complaint submitted');
}));
router.get('/complaints',r(async(req,res)=>{
 const filter={};
 if(req.user.role==='STUDENT'||req.user.role==='FACULTY')filter.submittedBy=req.user._id;
 if(req.user.role==='STAFF'){const ids=await Assignment.distinct('complaintId',{assignedTo:req.user._id});filter._id={$in:ids};}
 if(req.query.status)filter.status=String(req.query.status);
 if(req.query.priority)filter.priority=String(req.query.priority);
 if(req.query.category)filter.category=String(req.query.category);
 if(req.query.departmentId&&req.user.role==='ADMIN')filter.departmentId=v.objectId.parse(String(req.query.departmentId));
 if(req.query.search){const search=String(req.query.search).slice(0,80).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');filter.$or=[{title:{$regex:search,$options:'i'}},{complaintCode:{$regex:search,$options:'i'}}];}
 const {items,meta}=await limitedList(Complaint,{...req.query,filter});res.json({success:true,message:'OK',data:items,meta});
}));
router.get('/complaints/:id',r(async(req,res)=>{
 const item=await get(Complaint,req.params.id);await assertReadComplaint(req.user,item);success(res,item);
}));
router.get('/complaints/:id/history',r(async(req,res)=>{
 const item=await get(Complaint,req.params.id);await assertReadComplaint(req.user,item);
 success(res,await StatusHistory.find({complaintId:item._id}).sort({createdAt:1}));
}));
router.patch('/complaints/:id',validate(v.complaintPatch),r(async(req,res)=>{
 const item=await get(Complaint,req.params.id);
 if(String(item.submittedBy)!==String(req.user._id)||item.status!=='SUBMITTED')throw new HttpError(403,'Only own submitted complaint can be edited');
 Object.assign(item,req.body);await item.save();await audit(req,'COMPLAINT_EDITED','Complaint',item._id,{fields:Object.keys(req.body)});success(res,item);
}));
router.post('/complaints/:id/review',role('ADMIN'),validate(v.review),r(async(req,res)=>{
 const item=await get(Complaint,req.params.id);
 if(item.status==='SUBMITTED')await transition(req,item,'UNDER_REVIEW','Administrator review started');
 const current=await get(Complaint,item._id);
 if(current.status!=='UNDER_REVIEW')throw new HttpError(409,'Complaint not under review');
 if(req.body.decision==='REJECT'){
  if(!req.body.reason)throw new HttpError(400,'Rejection reason required');
  return success(res,await transition(req,current,'REJECTED',req.body.reason),'Complaint rejected');
 }
 const changes={};
 for(const field of ['category','priority'])if(req.body[field]&&req.body[field]!==current[field])changes[field]=req.body[field];
 if(Object.keys(changes).length){if(!req.body.overrideReason)throw new HttpError(400,'Override reason required');
  Object.assign(current,changes);await current.save();await audit(req,'AI_OVERRIDE','Complaint',item._id,{changes,reason:req.body.overrideReason});
 }
 success(res,current,'Approved for assignment');
}));
router.post('/complaints/:id/duplicate-decision',role('ADMIN'),r(async(req,res)=>{
 const c=await get(Complaint,req.params.id);const decision=req.body?.decision;const candidateId=req.body?.candidateId;
 if(!['CONFIRM','DISMISS'].includes(decision)||!mongoose.isValidObjectId(candidateId))throw new HttpError(400,'Invalid duplicate decision');
 if(String(c._id)===String(candidateId))throw new HttpError(400,'Cannot duplicate itself');
 const candidates=c.aiAnalysis?.duplicates||[];
 if(!candidates.some(x=>x.complaintId===candidateId))throw new HttpError(400,'Not an AI-suggested candidate');
 await get(Complaint,candidateId);
 if(decision==='CONFIRM'){c.duplicateOf=candidateId;await c.save();}
 await audit(req,'DUPLICATE_'+decision,'Complaint',c._id,{candidateId});
 success(res,c,'Duplicate suggestion reviewed');
}));
router.post('/complaints/:id/assign',role('ADMIN'),validate(v.assign),r(async(req,res)=>{
 const item=await get(Complaint,req.params.id);
 if(!['UNDER_REVIEW','REOPENED','ASSIGNED','ASSIGNED'].includes(item.status))throw new HttpError(409,'Not eligible for assignment');
 const dept=await get(Department,req.body.departmentId),staff=await get(User,req.body.assignedTo);
 if(!dept.isActive||!staff.isActive||staff.role!=='STAFF'||String(staff.departmentId)!==String(dept._id))throw new HttpError(400,'Staff must belong to an active selected department');
 const prev=await Assignment.findOne({complaintId:item._id,assignmentStatus:{$nin:['COMPLETED','REASSIGNED']}});
 if(prev){if(!req.body.reason)throw new HttpError(400,'Reassignment reason required');prev.assignmentStatus='REASSIGNED';await prev.save();await audit(req,'REASSIGNED','Assignment',prev._id,{reason:req.body.reason});}
 const assignment=await Assignment.create({complaintId:item._id,departmentId:dept._id,assignedTo:staff._id,assignedBy:req.user._id,remarks:req.body.reason});
 if(['UNDER_REVIEW','REOPENED'].includes(item.status))await transition(req,item,'ASSIGNED',req.body.reason||'Assigned to department',{departmentId:dept._id});
 else {item.departmentId=dept._id;await item.save();await StatusHistory.create({complaintId:item._id,previousStatus:item.status,newStatus:item.status,updatedBy:req.user._id,remarks:'Reassigned: '+req.body.reason});}
 await notify(staff._id,'New assigned task',`${item.complaintCode}: ${item.title}`,'ASSIGNMENT',item._id);
 success(res,assignment,'Assignment created');
}));
router.post('/complaints/:id/verify-resolution',role('ADMIN'),r(async(req,res)=>{
 const item=await get(Complaint,req.params.id);
 if(req.body?.accepted===false){
  const updated=await transition(req,item,'IN_PROGRESS',v.reason.parse({reason:req.body.reason}).reason);
  await Assignment.updateOne({complaintId:item._id,assignmentStatus:'COMPLETED'},{$set:{assignmentStatus:'IN_PROGRESS',completedAt:null}},{sort:{completedAt:-1}});
  return success(res,updated,'Returned for further work');
 }
 success(res,await transition(req,item,'RESOLVED',req.body?.remarks||'Resolution verified by administrator'),'Resolution verified');
}));
router.post('/complaints/:id/reopen',role('ADMIN'),validate(v.reason),r(async(req,res)=>{
 const item=await get(Complaint,req.params.id);success(res,await transition(req,item,'REOPENED',req.body.reason),'Complaint reopened');
}));

// STAFF ASSIGNMENTS — enforce active member, not just role.
async function accessibleAssignment(req,id){const a=await get(Assignment,id);if(req.user.role!=='ADMIN'&&String(a.assignedTo)!==String(req.user._id))throw new HttpError(403,'Not your assignment');return a;}
router.get('/assignments',role('STAFF','ADMIN'),r(async(req,res)=>{
 const filter=req.user.role==='ADMIN'?{}:{assignedTo:req.user._id};const {items,meta}=await limitedList(Assignment,{...req.query,filter},{assignedAt:-1});res.json({success:true,message:'OK',data:items,meta});
}));
router.get('/assignments/:id',role('STAFF','ADMIN'),r(async(req,res)=>success(res,await accessibleAssignment(req,req.params.id))));
const assignmentAction=(route,expected,next,complaintState,needsReason=false)=>router.post(`/assignments/:id/${route}`,role('STAFF','ADMIN'),r(async(req,res)=>{
 const a=await accessibleAssignment(req,req.params.id);
 if(a.assignmentStatus!==expected)throw new HttpError(409,'Invalid assignment state');
 if(needsReason&&!req.body?.reason?.trim())throw new HttpError(400,'Reason required');
 const c=await get(Complaint,a.complaintId);
 const changed=await transition(req,c,complaintState,req.body?.reason||`Assignment ${route}`);
 a.assignmentStatus=next;
 if(route==='accept')a.acceptedAt=new Date();
 await a.save();await audit(req,'ASSIGNMENT_'+route.toUpperCase(),'Assignment',a._id);success(res,{assignment:a,complaint:changed});
}));
assignmentAction('accept','PENDING','ACCEPTED','ACCEPTED');
assignmentAction('start','ACCEPTED','IN_PROGRESS','IN_PROGRESS');
assignmentAction('hold','IN_PROGRESS','ON_HOLD','ON_HOLD',true);
assignmentAction('resume','ON_HOLD','IN_PROGRESS','IN_PROGRESS');
router.post('/assignments/:id/decline',role('STAFF'),r(async(req,res)=>{throw new HttpError(403,'Staff declines require an approved campus policy; contact administrator','POLICY_PENDING');}));
router.post('/assignments/:id/submit-resolution',role('STAFF','ADMIN'),validate(v.evidence),r(async(req,res)=>{
 const a=await accessibleAssignment(req,req.params.id);
 if(a.assignmentStatus!=='IN_PROGRESS')throw new HttpError(409,'Task not in progress');
 const c=await get(Complaint,a.complaintId);
 // Evidence URLs must originate from assets uploaded by this user and linked to this complaint.
 const assets=await Media.find({owner:req.user._id,resourceType:'EVIDENCE',resourceId:c._id,url:{$in:req.body.evidenceUrls}});
 if(assets.length!==new Set(req.body.evidenceUrls).size)throw new HttpError(403,'Only authenticated evidence uploads may be attached');
 await transition(req,c,'RESOLUTION_SUBMITTED',req.body.remarks||'Completion submitted');
 a.resolutionEvidence.push(...assets.map(x=>({url:x.url,uploadedAt:new Date()})));a.assignmentStatus='COMPLETED';a.completedAt=new Date();await a.save();
 await Media.updateMany({_id:{$in:assets.map(x=>x._id)}},{$set:{used:true}});
 await audit(req,'RESOLUTION_SUBMITTED','Assignment',a._id);success(res,a);
}));

// NOTIFICATIONS / FEEDBACK / ANNOUNCEMENTS
router.get('/notifications',r(async(req,res)=>{
 const {items,meta}=await limitedList(Notification,{...req.query,filter:{userId:req.user._id}});
 res.json({success:true,message:'OK',data:items,meta});
}));
router.patch('/notifications/read-all',r(async(req,res)=>{await Notification.updateMany({userId:req.user._id,isRead:false},{$set:{isRead:true}});success(res,null,'Marked read');}));
router.patch('/notifications/:id/read',r(async(req,res)=>{
 const n=await Notification.findOneAndUpdate({_id:req.params.id,userId:req.user._id},{$set:{isRead:true}},{new:true});if(!n)throw new HttpError(404,'Notification not found');success(res,n);
}));
router.post('/feedback',validate(v.feedback),r(async(req,res)=>{
 const c=await get(Complaint,req.body.complaintId);
 if(String(c.submittedBy)!==String(req.user._id)||!['RESOLVED','CLOSED'].includes(c.status))throw new HttpError(403,'Feedback not permitted for this complaint');
 const f=await Feedback.create({...req.body,submittedBy:req.user._id});success(res,f);
}));
router.get('/feedback/:complaintId',r(async(req,res)=>{
 const c=await get(Complaint,req.params.complaintId);await assertReadComplaint(req.user,c);success(res,await Feedback.findOne({complaintId:c._id}));
}));
router.get('/announcements',r(async(req,res)=>{
 const now=new Date(),filter=req.user.role==='ADMIN'?{}:{isPublished:true,publishAt:{$lte:now},$or:[{expiresAt:{$exists:false}},{expiresAt:null},{expiresAt:{$gt:now}}],audience:req.user.role};
 const {items,meta}=await limitedList(Announcement,{...req.query,filter});res.json({success:true,message:'OK',data:items,meta});
}));
router.get('/announcements/:id',r(async(req,res)=>{
 const a=await get(Announcement,req.params.id);
 if(req.user.role!=='ADMIN'&&(!a.isPublished||!a.audience.includes(req.user.role)||a.publishAt>new Date()||(a.expiresAt&&a.expiresAt<new Date())))throw new HttpError(403,'Not permitted');success(res,a);
}));
router.post('/announcements',role('ADMIN'),validate(v.announcement),r(async(req,res)=>{
 const a=await Announcement.create({...req.body,publishedBy:req.user._id,publishAt:req.body.publishAt||new Date()});await audit(req,'ANNOUNCEMENT_CREATED','Announcement',a._id);success(res,a);
}));
router.patch('/announcements/:id',role('ADMIN'),validate(v.announcement.partial()),r(async(req,res)=>{
 const a=await get(Announcement,req.params.id);Object.assign(a,req.body);await a.save();await audit(req,'ANNOUNCEMENT_UPDATED','Announcement',a._id);success(res,a);
}));
router.delete('/announcements/:id',role('ADMIN'),r(async(req,res)=>{
 const a=await get(Announcement,req.params.id);a.isPublished=false;await a.save();await audit(req,'ANNOUNCEMENT_UNPUBLISHED','Announcement',a._id);success(res,a);
}));

// ANALYTICS (MongoDB aggregations, not client page totals)
router.get('/analytics/dashboard',role('ADMIN'),r(async(req,res)=>{
 const [total,open,critical,resolved,pendingAssignments]=await Promise.all([
 Complaint.countDocuments(),Complaint.countDocuments({status:{$nin:['RESOLVED','CLOSED','REJECTED']}}),Complaint.countDocuments({priority:'Critical'}),Complaint.countDocuments({status:{$in:['RESOLVED','CLOSED']}}),Assignment.countDocuments({assignmentStatus:'PENDING'})]);
 success(res,{total,open,critical,resolved,pendingAssignments,generatedAt:new Date().toISOString()});
}));
const group=(field)=>[{$group:{_id:'$'+field,count:{$sum:1}}},{$sort:{count:-1}}];
router.get('/analytics/complaints',role('ADMIN'),r(async(req,res)=>success(res,{category:await Complaint.aggregate(group('category')),priority:await Complaint.aggregate(group('priority')),status:await Complaint.aggregate(group('status'))})));
router.get('/analytics/departments',role('ADMIN'),r(async(req,res)=>success(res,await Assignment.aggregate([{$group:{_id:'$departmentId',count:{$sum:1}}},{$sort:{count:-1}}]))));
router.get('/analytics/locations',role('ADMIN'),r(async(req,res)=>success(res,await Complaint.aggregate(group('locationId')))));
router.get('/analytics/trends',role('ADMIN'),r(async(req,res)=>success(res,await Complaint.aggregate([{$group:{_id:{$dateToString:{format:'%Y-%m',date:'$createdAt'}},count:{$sum:1}}},{$sort:{_id:1}}]))));
router.get('/analytics/reports',role('ADMIN'),r(async(req,res)=>{
 const records=await Complaint.find().select('complaintCode title category priority status createdAt').sort({createdAt:-1}).limit(10000).lean();
 if(req.query.format==='csv'){
  const fields=['complaintCode','title','category','priority','status','createdAt'];
  const quoted=v=>`"${String(v??'').replace(/^([=+@-])/,'\'$1').replaceAll('"','""')}"`;
  const csv=[fields.join(','),...records.map(x=>fields.map(f=>quoted(x[f])).join(','))].join('\r\n');
  return res.type('text/csv').attachment('clyra-complaints.csv').send(csv);
 }
 success(res,{items:records,limitedTo:10000});
}));

// Media & device adapters (external integrations explicitly optional until configured)
const inbound=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1}}).single('file');
router.post('/media/upload',(req,res,next)=>inbound(req,res,next),r(async(req,res)=>{
 if(!req.file)throw new HttpError(400,'Image required');
 const signature=await fileTypeFromBuffer(req.file.buffer);
 if(!signature||!['image/jpeg','image/png','image/webp'].includes(signature.mime))throw new HttpError(400,'Unsupported image contents');
 const resourceType=req.body.resourceType;
 if(!['COMPLAINT','EVIDENCE'].includes(resourceType))throw new HttpError(400,'Invalid media purpose');
 const c=await get(Complaint,req.body.complaintId);
 if(resourceType==='COMPLAINT'&&(String(c.submittedBy)!==String(req.user._id)||c.status!=='SUBMITTED'))throw new HttpError(403,'Only owner may attach images to a submitted complaint');
 if(resourceType==='EVIDENCE'&&req.user.role!=='ADMIN'&&!(await Assignment.exists({complaintId:c._id,assignedTo:req.user._id,assignmentStatus:{$in:['ACCEPTED','IN_PROGRESS','ON_HOLD']}})))throw new HttpError(403,'Not assigned to this work');
 const uploaded=await uploadImage(req.file.buffer,signature.ext);
 const media=await Media.create({owner:req.user._id,resourceType,resourceId:c._id,...uploaded});
 if(resourceType==='COMPLAINT')await Complaint.updateOne({_id:c._id},{$addToSet:{imageUrls:media.url}});
 success(res,media,'Media uploaded');
}));
router.delete('/media/:id',r(async(req,res)=>{
 const m=await get(Media,req.params.id);
 if(m.used||String(m.owner)!==String(req.user._id))throw new HttpError(403,'Media cannot be deleted');
 await deleteImage(m.publicId);await m.deleteOne();success(res,null,'Unused media deleted');
}));
router.post('/devices/register',r(async(req,res)=>{
 if(typeof req.body?.token!=='string'||req.body.token.length<20||req.body.token.length>2048)throw new HttpError(400,'Valid FCM token required');
 const item=await Device.findOneAndUpdate({tokenHash:hashToken(req.body.token)},{userId:req.user._id,tokenHash:hashToken(req.body.token),tokenEncrypted:encryptToken(req.body.token),platform:'android'},{new:true,upsert:true});
 success(res,{id:item._id},'Device registered');
}));
router.delete('/devices/:id',r(async(req,res)=>{await Device.deleteOne({_id:req.params.id,userId:req.user._id});success(res,null);}));

export default router;
