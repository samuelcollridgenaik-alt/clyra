import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { User,Complaint,Department,Location,Assignment,StatusHistory,Notification,Feedback,Announcement,Session,Counter,AuditLog,CATEGORIES,PRIORITIES,Media,Device } from '../models/index.js';
import { requireAuth,role,asyncRoute,HttpError,validate,success } from '../middleware/security.js';
import * as v from '../validators/index.js';
import { transition,assertReadComplaint,audit,notify,currentAssignment,complaintScope } from '../services/lifecycle.js';
import { atomic } from '../services/transaction.js';
import { locationCatalog,validateLocation,assertAvailableLocation,createCampusLayout } from '../services/locations.js';
import { analyzeComplaint } from '../integrations/ai/client.js';
import { uploadImage,deleteImage,configured as mediaConfigured } from '../integrations/cloudinary/client.js';
import { sendPush } from '../integrations/firebase/client.js';
import { encryptToken,hashToken } from '../utils/encryption.js';
import { fileTypeFromBuffer } from 'file-type';
import multer from 'multer';

const router=Router();
const r=(fn)=>asyncRoute(fn);
const transactionRoute=fn=>r(async(req,res)=>{const result=await atomic(()=>fn(req));success(res,result.data,result.message||'OK');});
const get=async(Model,id)=>{if(!mongoose.isValidObjectId(id))throw new HttpError(400,'Invalid identifier','VALIDATION_ERROR');const item=await Model.findById(id);if(!item)throw new HttpError(404,'Record not found','NOT_FOUND');return item;};
const filterActive=()=>({isActive:true});
const limit=(query)=>v.paging(query);
const limitedList=async(Model,query,sort={createdAt:-1})=>{
 const {page,limit:lim,skip}=limit(query);
 const [items,total]=await Promise.all([Model.find(query.filter||{}).sort(sort).skip(skip).limit(lim).lean(),Model.countDocuments(query.filter||{})]);
 return {items,meta:{page,limit:lim,total,pages:Math.ceil(total/lim)}};
};
function token(user,session){return jwt.sign({role:user.role,sid:String(session._id)},config.jwtSecret,{algorithm:'HS256',subject:String(user._id),issuer:config.issuer,audience:config.audience,expiresIn:'15m'});}
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const cookies={httpOnly:true,secure:config.production,sameSite:'strict',path:'/api/v1/auth',maxAge:7*24*3600*1000};
async function issue(req,res,user){
 const refresh=crypto.randomBytes(48).toString('base64url');
 const session=await Session.create({userId:user._id,tokenHash:hash(refresh),expiresAt:new Date(Date.now()+7*86400000),device:(req.headers['user-agent']||'unknown').slice(0,160)});
 res.cookie('clyra_refresh',refresh,cookies);
 return {accessToken:token(user,session),user:user.toJSON(),...(req.get('X-Client')==='mobile'?{refreshToken:refresh}:{})};
}
const refreshFrom=req=>req.get('X-Client')==='mobile'?req.body?.refreshToken:req.cookies.clyra_refresh||req.body?.refreshToken;
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
 const refresh=refreshFrom(req);
 if(typeof refresh!=='string')throw new HttpError(401,'Refresh token required','INVALID_REFRESH');
 const session=await Session.findOne({tokenHash:hash(refresh),revokedAt:{$exists:false},expiresAt:{$gt:new Date()}});
 if(!session)throw new HttpError(401,'Invalid refresh session','INVALID_REFRESH');
 const user=await User.findById(session.userId);
 if(!user?.isActive)throw new HttpError(401,'Account inactive','ACCOUNT_DISABLED');
 const replacement=crypto.randomBytes(48).toString('base64url');
 const rotated=await Session.findOneAndUpdate({_id:session._id,tokenHash:hash(refresh),revokedAt:{$exists:false},expiresAt:{$gt:new Date()}},{$set:{tokenHash:hash(replacement),expiresAt:new Date(Date.now()+7*86400000)}},{new:true});
 if(!rotated)throw new HttpError(401,'Refresh token already used or revoked','INVALID_REFRESH');
 res.cookie('clyra_refresh',replacement,cookies);
 success(res,{accessToken:token(user,rotated),user:user.toJSON(),...(req.get('X-Client')==='mobile'?{refreshToken:replacement}:{})},'Session renewed');
}));
router.post('/auth/logout',r(async(req,res)=>{
 const refresh=refreshFrom(req);
 if(typeof refresh==='string')await Session.updateOne({tokenHash:hash(refresh)},{$set:{revokedAt:new Date()}});
 res.clearCookie('clyra_refresh',{...cookies,maxAge:undefined});success(res,null,'Signed out');
}));
router.get('/auth/me',requireAuth,r(async(req,res)=>success(res,req.user)));

router.use(requireAuth);
router.get('/capabilities',r(async(req,res)=>success(res,{mediaUploads:mediaConfigured(),textOnlyResolution:config.textOnlyResolution,passwordReset:false})));
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

// LOCATIONS — manual management and additive campus presets share one catalog.
router.get('/locations',r(async(req,res)=>{
 const items=await locationCatalog(req.user.role==='ADMIN');const {page,limit:lim,skip}=limit(req.query);
 success(res,items.slice(skip,skip+lim),'OK',{page,limit:lim,total:items.length,pages:Math.ceil(items.length/lim)});
}));
router.get('/locations/catalog',r(async(req,res)=>success(res,await locationCatalog(req.user.role==='ADMIN'))));
router.post('/locations/campus-layout',role('ADMIN'),validate(v.campusLayout),transactionRoute(async req=>{
 const data=await createCampusLayout(req.body);
 await audit(req,'CAMPUS_LAYOUT_ADDED','Location',req.body.campusId,{created:data.created,existing:data.existing,blocks:req.body.blocks,includeGroundFloor:req.body.includeGroundFloor});
 return {data,message:'Campus layout saved; existing locations preserved'};
}));
router.post('/locations',role('ADMIN'),validate(v.location),r(async(req,res)=>{
 await validateLocation(req.body);const item=await Location.create(req.body);await audit(req,'LOCATION_CREATED','Location',item._id);success(res,item);
}));
router.get('/locations/:id',r(async(req,res)=>{
 const item=await get(Location,req.params.id);
 if(req.user.role!=='ADMIN'){try{await assertAvailableLocation(item);}catch{throw new HttpError(404,'Not found');}}
 success(res,item);
}));
router.patch('/locations/:id',role('ADMIN'),validate(v.locationPatch),r(async(req,res)=>{
 const loc=await get(Location,req.params.id);
 const next={...loc.toObject(),...req.body};await validateLocation(next,loc._id);
 Object.assign(loc,req.body);await loc.save();await audit(req,'LOCATION_UPDATED','Location',loc._id);success(res,loc);
}));
router.patch('/locations/:id/status',role('ADMIN'),r(async(req,res)=>{
 if(typeof req.body?.isActive!=='boolean')throw new HttpError(400,'isActive must be boolean');
 const loc=await get(Location,req.params.id);
 if(!req.body.isActive&&await Location.exists({parentLocationId:loc._id,isActive:true}))throw new HttpError(409,'Deactivate child locations first');
 if(req.body.isActive)await validateLocation({...loc.toObject(),isActive:true},loc._id);
 loc.isActive=req.body.isActive;await loc.save();await audit(req,'LOCATION_STATUS','Location',loc._id);success(res,loc);
}));

// COMPLAINTS
router.post('/complaints',role('STUDENT','FACULTY','ADMIN'),validate(v.complaint),r(async(req,res)=>{
 const loc=await get(Location,req.body.locationId);await assertAvailableLocation(loc);
 if((req.body.imageUrls||[]).length)throw new HttpError(400,'Use the authenticated media upload flow; direct image URLs are not accepted');
 const comparable=await Complaint.find({locationId:loc._id}).select('_id title description locationId').sort({createdAt:-1}).limit(75).lean();
 const analysis=await analyzeComplaint({...req.body,candidates:comparable.map(x=>({complaintId:String(x._id),title:x.title,description:x.description,locationId:String(x.locationId)}))}).catch(()=>null);
 // Model suggestions are intentionally NOT binding decisions. Safety is flagged for manual review.
 const safetyFlag=/\b(fire|electrocution|shock|exposed wire|gas leak|violence|collapse)\b/i.test(req.body.title+' '+req.body.description);
 const item=await atomic(async()=>{
 const year=new Date().getUTCFullYear();
 const sequence=await Counter.findOneAndUpdate({_id:'complaints_'+year},{$inc:{seq:1}},{new:true,upsert:true});
 const complaintCode=`CLY-${year}-${String(sequence.seq).padStart(6,'0')}`;
 const item=await Complaint.create({...req.body,imageUrls:[],complaintCode,submittedBy:req.user._id,category:req.body.category||'Other',priority:safetyFlag?'High':'Medium',status:'SUBMITTED',...(analysis?{predictedCategory:analysis.classification?.category,predictedPriority:analysis.priority?.level,categoryConfidence:analysis.classification?.confidence,priorityConfidence:analysis.priority?.confidence,aiAnalysis:{...analysis,safetyFlag}}:{aiAnalysis:{status:'UNAVAILABLE',safetyFlag}})});
 await StatusHistory.create({complaintId:item._id,previousStatus:null,newStatus:'SUBMITTED',updatedBy:req.user._id});
 await notify(req.user._id,'Complaint submitted',`${complaintCode} received for review`,'SUBMITTED',item._id);
 return item;
 });
 success(res,item,'Complaint submitted');
}));
router.get('/complaints',r(async(req,res)=>{
 const filter=await complaintScope(req.user);
 if(req.query.status)filter.status=String(req.query.status);
 if(req.query.priority)filter.priority=String(req.query.priority);
 if(req.query.category)filter.category=String(req.query.category);
 if(req.query.departmentId&&req.user.role==='ADMIN')filter.departmentId=v.objectId.parse(String(req.query.departmentId));
 if(req.query.search){const search=String(req.query.search).slice(0,80).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');filter.$or=[{title:{$regex:search,$options:'i'}},{complaintCode:{$regex:search,$options:'i'}}];}
 const {items,meta}=await limitedList(Complaint,{...req.query,filter});res.json({success:true,message:'OK',data:items,meta});
}));
router.get('/complaints/summary',r(async(req,res)=>{
 const scope=await complaintScope(req.user);
 const rows=await Complaint.aggregate([{$match:scope},{$group:{_id:null,total:{$sum:1},active:{$sum:{$cond:[{$in:['$status',['RESOLVED','CLOSED','REJECTED']]},0,1]}},resolved:{$sum:{$cond:[{$in:['$status',['RESOLVED','CLOSED']]},1,0]}},critical:{$sum:{$cond:[{$eq:['$priority','Critical']},1,0]}}}}]);
 const {_id,...counts}=rows[0]||{total:0,active:0,resolved:0,critical:0};success(res,counts);
}));
router.get('/complaints/:id',r(async(req,res)=>{
 const item=await get(Complaint,req.params.id);await assertReadComplaint(req.user,item);
 const [location,department,owner,assignment]=await Promise.all([Location.findById(item.locationId),item.departmentId?Department.findById(item.departmentId):null,User.findById(item.submittedBy),currentAssignment(item)]);
 const staff=assignment?await User.findById(assignment.assignedTo):null;
 success(res,{...item.toObject(),locationName:location?.name,departmentName:department?.name,submittedByName:owner?.fullName,currentAssignment:assignment?{...assignment.toObject(),assignedToName:staff?.fullName}:null});
}));
router.get('/complaints/:id/history',r(async(req,res)=>{
 const item=await get(Complaint,req.params.id);await assertReadComplaint(req.user,item);
 success(res,await StatusHistory.find({complaintId:item._id}).sort({createdAt:1}));
}));
router.patch('/complaints/:id',validate(v.complaintPatch),transactionRoute(async(req)=>{
 const item=await get(Complaint,req.params.id);
 if(String(item.submittedBy)!==String(req.user._id)||item.status!=='SUBMITTED')throw new HttpError(403,'Only own submitted complaint can be edited');
 Object.assign(item,req.body);await item.save();await audit(req,'COMPLAINT_EDITED','Complaint',item._id,{fields:Object.keys(req.body)});return {data:item};
}));
router.post('/complaints/:id/review',role('ADMIN'),validate(v.review),transactionRoute(async(req)=>{
 const item=await get(Complaint,req.params.id);
 if(item.status==='SUBMITTED')await transition(req,item,'UNDER_REVIEW','Administrator review started');
 const current=await get(Complaint,item._id);
 if(current.status!=='UNDER_REVIEW')throw new HttpError(409,'Complaint not under review');
 if(req.body.decision==='REJECT'){
  if(!req.body.reason)throw new HttpError(400,'Rejection reason required');
  return {data:await transition(req,current,'REJECTED',req.body.reason),message:'Complaint rejected'};
 }
 const changes={};
 for(const field of ['category','priority'])if(req.body[field]&&req.body[field]!==current[field])changes[field]=req.body[field];
 if(Object.keys(changes).length){if(!req.body.overrideReason)throw new HttpError(400,'Override reason required');
  Object.assign(current,changes);await current.save();await audit(req,'AI_OVERRIDE','Complaint',item._id,{changes,reason:req.body.overrideReason});
 }
 return {data:current,message:'Approved for assignment'};
}));
router.post('/complaints/:id/duplicate-decision',role('ADMIN'),transactionRoute(async(req)=>{
 const c=await get(Complaint,req.params.id);const decision=req.body?.decision;const candidateId=req.body?.candidateId;
 if(!['CONFIRM','DISMISS'].includes(decision)||!mongoose.isValidObjectId(candidateId))throw new HttpError(400,'Invalid duplicate decision');
 if(String(c._id)===String(candidateId))throw new HttpError(400,'Cannot duplicate itself');
 const candidates=c.aiAnalysis?.duplicates||[];
 if(!candidates.some(x=>x.complaintId===candidateId))throw new HttpError(400,'Not an AI-suggested candidate');
 await get(Complaint,candidateId);
 if(decision==='CONFIRM'){c.duplicateOf=candidateId;await c.save();}
 await audit(req,'DUPLICATE_'+decision,'Complaint',c._id,{candidateId});
 return {data:c,message:'Duplicate suggestion reviewed'};
}));
router.post('/complaints/:id/assign',role('ADMIN'),validate(v.assign),transactionRoute(async(req)=>{
 const item=await get(Complaint,req.params.id);
 if(!['UNDER_REVIEW','REOPENED','ASSIGNED'].includes(item.status))throw new HttpError(409,'Not eligible for assignment');
 const dept=await get(Department,req.body.departmentId),staff=await get(User,req.body.assignedTo);
 if(!dept.isActive||!staff.isActive||staff.role!=='STAFF'||String(staff.departmentId)!==String(dept._id))throw new HttpError(400,'Staff must belong to an active selected department');
 const prev=await currentAssignment(item);
 if(prev){if(!req.body.reason)throw new HttpError(400,'Reassignment reason required');if(prev.assignmentStatus!=='COMPLETED'){prev.assignmentStatus='REASSIGNED';await prev.save();}await audit(req,'REASSIGNED','Assignment',prev._id,{reason:req.body.reason});}
 const assignment=await Assignment.create({complaintId:item._id,departmentId:dept._id,assignedTo:staff._id,assignedBy:req.user._id,remarks:req.body.reason});
 if(['UNDER_REVIEW','REOPENED'].includes(item.status))await transition(req,item,'ASSIGNED',req.body.reason||'Assigned to department',{departmentId:dept._id,currentAssignmentId:assignment._id});
 else {item.departmentId=dept._id;item.currentAssignmentId=assignment._id;await item.save();await StatusHistory.create({complaintId:item._id,previousStatus:item.status,newStatus:item.status,updatedBy:req.user._id,remarks:'Reassigned: '+req.body.reason});}
 await audit(req,'ASSIGNMENT_CREATED','Assignment',assignment._id,{complaintId:item._id});
 await notify(staff._id,'New assigned task',`${item.complaintCode}: ${item.title}`,'ASSIGNMENT',item._id);
 return {data:assignment,message:'Assignment created'};
}));
router.post('/complaints/:id/verify-resolution',role('ADMIN'),validate(v.verification),transactionRoute(async(req)=>{
 const item=await get(Complaint,req.params.id);
 if(req.body?.accepted===false){
  const updated=await transition(req,item,'IN_PROGRESS',v.reason.parse({reason:req.body.reason}).reason);
  const assignment=await currentAssignment(item);
  if(!assignment||assignment.assignmentStatus!=='COMPLETED')throw new HttpError(409,'No completed current assignment','CONFLICT');
  assignment.assignmentStatus='IN_PROGRESS';assignment.completedAt=null;await assignment.save();
  await notify(assignment.assignedTo,'Further work requested',`${item.complaintCode}: ${req.body.reason}`,'ASSIGNMENT',item._id);
  return {data:updated,message:'Returned for further work'};
 }
 return {data:await transition(req,item,'RESOLVED',req.body?.remarks||'Resolution verified by administrator'),message:'Resolution verified'};
}));
router.post('/complaints/:id/reopen',role('ADMIN'),validate(v.reason),transactionRoute(async(req)=>{
 const item=await get(Complaint,req.params.id);return {data:await transition(req,item,'REOPENED',req.body.reason),message:'Complaint reopened'};
}));

// STAFF ASSIGNMENTS — enforce active member, not just role.
async function accessibleAssignment(req,id){const a=await get(Assignment,id);if(req.user.role!=='ADMIN'&&(String(a.assignedTo)!==String(req.user._id)||String(a.departmentId)!==String(req.user.departmentId)))throw new HttpError(403,'Not your assignment');return a;}
async function currentAssignmentComplaint(assignment){
 const complaint=await get(Complaint,assignment.complaintId),current=await currentAssignment(complaint);
 if(!current||String(current._id)!==String(assignment._id)||assignment.assignmentStatus==='REASSIGNED')throw new HttpError(409,'This assignment is no longer current','STALE_ASSIGNMENT');
 return complaint;
}
router.get('/assignments',role('STAFF','ADMIN'),r(async(req,res)=>{
 const filter=req.user.role==='ADMIN'?{}:{assignedTo:req.user._id,departmentId:req.user.departmentId};
 if(req.query.section==='history')filter.assignmentStatus={$in:['COMPLETED','REASSIGNED']};
 else if(req.query.section==='active')filter.assignmentStatus={$nin:['COMPLETED','REASSIGNED']};
 else if(req.query.section)throw new HttpError(400,'Unknown assignment section','VALIDATION_ERROR');
 const {items,meta}=await limitedList(Assignment,{...req.query,filter},{assignedAt:-1,_id:-1});
 const data=await Promise.all(items.map(async assignment=>{
  const [complaint,department,staff]=await Promise.all([Complaint.findById(assignment.complaintId),Department.findById(assignment.departmentId),User.findById(assignment.assignedTo)]);
  const current=complaint?await currentAssignment(complaint):null;
  const permitted=req.user.role==='ADMIN'||String(current?._id)===String(assignment._id);
  const location=permitted&&complaint?await Location.findById(complaint.locationId):null;
  return {...assignment,departmentName:department?.name,assignedToName:staff?.fullName,complaint:permitted&&complaint?{_id:complaint._id,title:complaint.title,complaintCode:complaint.complaintCode,description:complaint.description,status:complaint.status,priority:complaint.priority,locationName:location?.name}:null};
 }));
 res.json({success:true,message:'OK',data,meta});
}));
router.get('/assignments/:id',role('STAFF','ADMIN'),r(async(req,res)=>success(res,await accessibleAssignment(req,req.params.id))));
const assignmentAction=(route,expected,next,complaintState,needsReason=false)=>router.post(`/assignments/:id/${route}`,role('STAFF','ADMIN'),transactionRoute(async(req)=>{
 const a=await accessibleAssignment(req,req.params.id);
 if(a.assignmentStatus!==expected)throw new HttpError(409,'Invalid assignment state');
 if(needsReason)v.reason.parse(req.body);
 const c=await currentAssignmentComplaint(a);
 const changed=await transition(req,c,complaintState,req.body?.reason||`Assignment ${route}`);
 a.assignmentStatus=next;
 if(route==='accept')a.acceptedAt=new Date();
 await a.save();await audit(req,'ASSIGNMENT_'+route.toUpperCase(),'Assignment',a._id);return {data:{assignment:a,complaint:changed}};
}));
assignmentAction('accept','PENDING','ACCEPTED','ACCEPTED');
assignmentAction('start','ACCEPTED','IN_PROGRESS','IN_PROGRESS');
assignmentAction('hold','IN_PROGRESS','ON_HOLD','ON_HOLD',true);
assignmentAction('resume','ON_HOLD','IN_PROGRESS','IN_PROGRESS');
router.post('/assignments/:id/decline',role('STAFF'),r(async(req,res)=>{throw new HttpError(403,'Staff declines require an approved campus policy; contact administrator','POLICY_PENDING');}));
router.post('/assignments/:id/submit-resolution',role('STAFF','ADMIN'),validate(v.evidence),transactionRoute(async(req)=>{
 const a=await accessibleAssignment(req,req.params.id);
 if(a.assignmentStatus!=='IN_PROGRESS')throw new HttpError(409,'Task not in progress');
 const c=await currentAssignmentComplaint(a);
 if(!req.body.evidenceUrls.length){
  if(!config.textOnlyResolution)throw new HttpError(400,'Resolution photo evidence is required','EVIDENCE_REQUIRED');
  if((req.body.remarks||'').trim().length<20)throw new HttpError(400,'Describe the completed work in at least 20 characters','RESOLUTION_NOTE_REQUIRED');
 }
 // Evidence URLs must originate from assets uploaded by this user and linked to this complaint.
 const assets=await Media.find({owner:req.user._id,resourceType:'EVIDENCE',resourceId:c._id,url:{$in:req.body.evidenceUrls}});
 if(assets.length!==new Set(req.body.evidenceUrls).size)throw new HttpError(403,'Only authenticated evidence uploads may be attached');
 await transition(req,c,'RESOLUTION_SUBMITTED',req.body.remarks||'Completion submitted',{},req.body.evidenceUrls);
 a.resolutionEvidence.push(...assets.map(x=>({url:x.url,uploadedAt:new Date()})));a.assignmentStatus='COMPLETED';a.completedAt=new Date();await a.save();
 await Media.updateMany({_id:{$in:assets.map(x=>x._id)}},{$set:{used:true}});
 await audit(req,'RESOLUTION_SUBMITTED','Assignment',a._id,{textOnly:!assets.length});return {data:a};
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
