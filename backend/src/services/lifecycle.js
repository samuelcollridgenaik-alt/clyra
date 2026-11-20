import { HttpError } from '../middleware/security.js';
import { Complaint,StatusHistory,Notification,AuditLog,Assignment } from '../models/index.js';
import {pushToUser} from './notifications.js';
import {afterCommit} from './transaction.js';
export const TRANSITIONS={
 SUBMITTED:{UNDER_REVIEW:['ADMIN']},
 UNDER_REVIEW:{ASSIGNED:['ADMIN'],REJECTED:['ADMIN']},
 ASSIGNED:{ACCEPTED:['STAFF']},
 ACCEPTED:{IN_PROGRESS:['STAFF']},
 IN_PROGRESS:{ON_HOLD:['STAFF','ADMIN'],RESOLUTION_SUBMITTED:['STAFF']},
 ON_HOLD:{IN_PROGRESS:['STAFF','ADMIN']},
 RESOLUTION_SUBMITTED:{RESOLVED:['ADMIN'],IN_PROGRESS:['ADMIN']},
 RESOLVED:{REOPENED:['ADMIN'],CLOSED:['ADMIN']},
 REOPENED:{ASSIGNED:['ADMIN']},
 REJECTED:{},CLOSED:{}
};
export function canTransition(from,to,role){return Boolean(TRANSITIONS[from]?.[to]?.includes(role));}
export async function audit(req,action,type,id,metadata={},session){
 await AuditLog.create([{actor:req.user._id,action,resourceType:type,resourceId:id,metadata,requestId:req.id}],session?{session}:{});
}
export async function notify(userId,title,message,type,complaintId,session){
 if(!userId)return;
 await Notification.create([{userId,title,message,type,complaintId}],session?{session}:{});
 // Never rollback a persisted business transition for external push delivery.
 afterCommit(()=>pushToUser(userId,title,message));
}
export async function transition(req,complaint,to,remarks='',options={},evidenceUrls=[]){
 const from=complaint.status;
 if(!canTransition(from,to,req.user.role))throw new HttpError(409,'Illegal complaint transition','ILLEGAL_TRANSITION');
 if(['REJECTED','ON_HOLD','REOPENED'].includes(to)&&(!remarks||remarks.trim().length<4))throw new HttpError(400,'Reason required','REASON_REQUIRED');
 const updated=await Complaint.findOneAndUpdate({_id:complaint._id,status:from},{$set:{status:to,...options}},{new:true});
 if(!updated)throw new HttpError(409,'Complaint changed; reload and retry','CONFLICT');
 await StatusHistory.create({complaintId:complaint._id,previousStatus:from,newStatus:to,updatedBy:req.user._id,remarks,evidenceUrls});
 await audit(req,'COMPLAINT_STATUS', 'Complaint',complaint._id,{from,to,remarks});
 await notify(complaint.submittedBy,'Complaint updated',`${complaint.complaintCode}: ${to.replaceAll('_',' ').toLowerCase()}`,'STATUS',complaint._id);
 return updated;
}
export async function canReadComplaint(user,complaint){
 if(user.role==='ADMIN'||String(user._id)===String(complaint.submittedBy))return true;
 if(user.role!=='STAFF')return false;
 const assignment=await currentAssignment(complaint);
 return Boolean(assignment&&assignment.assignmentStatus!=='REASSIGNED'&&String(assignment.assignedTo)===String(user._id)&&String(assignment.departmentId)===String(user.departmentId));
}
export async function assertReadComplaint(user,complaint){if(!(await canReadComplaint(user,complaint)))throw new HttpError(403,'Not permitted to access complaint','FORBIDDEN');}

export async function currentAssignment(complaint){
 if(complaint.currentAssignmentId)return Assignment.findById(complaint.currentAssignmentId);
 // Older records retain their history; use only the most recent assignment.
 return Assignment.findOne({complaintId:complaint._id}).sort({assignedAt:-1,_id:-1});
}

export async function complaintScope(user){
 if(user.role==='ADMIN')return {};
 if(user.role!=='STAFF')return {submittedBy:user._id};
 const latest=await Assignment.aggregate([
  {$sort:{assignedAt:-1,_id:-1}},
  {$group:{_id:'$complaintId',assignment:{$first:'$$ROOT'}}},
  {$match:{'assignment.assignedTo':user._id,'assignment.departmentId':user.departmentId,'assignment.assignmentStatus':{$ne:'REASSIGNED'}}}
 ]);
 return {_id:{$in:latest.map(item=>item._id)}};
}
