import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const ref = name => ({ type: Schema.Types.ObjectId, ref: name });
const opts = { timestamps:true };
export const ROLES = ['STUDENT','FACULTY','STAFF','ADMIN'];
export const CATEGORIES = ['Electrical','Plumbing','Cleaning and Sanitation','Classroom Maintenance','Furniture','Internet and Networking','Security','Infrastructure','Other'];
export const PRIORITIES = ['Critical','High','Medium','Low'];
export const STATES = ['SUBMITTED','UNDER_REVIEW','REJECTED','ASSIGNED','ACCEPTED','IN_PROGRESS','ON_HOLD','RESOLUTION_SUBMITTED','RESOLVED','REOPENED','CLOSED'];

const userSchema = new Schema({
  fullName:{type:String,required:true,trim:true,maxlength:120},
  email:{type:String,required:true,lowercase:true,trim:true},
  passwordHash:{type:String,required:true,select:false},
  phone:{type:String,maxlength:24},role:{type:String,enum:ROLES,required:true},
  registrationId:String,employeeId:String, departmentId:ref('Department'),course:String,designation:String,profileImage:String,
  isActive:{type:Boolean,default:true}
},opts);
userSchema.index({email:1},{unique:true});userSchema.index({role:1});userSchema.index({departmentId:1});
userSchema.set('toJSON',{transform:(_,doc)=>{delete doc.passwordHash;delete doc.__v;return doc;}});
export const User=model('User',userSchema);

const deptSchema = new Schema({name:{type:String,required:true,trim:true},code:{type:String,required:true,uppercase:true,trim:true},description:String,contactEmail:String,contactPhone:String,isActive:{type:Boolean,default:true}},opts);
deptSchema.index({code:1},{unique:true}); deptSchema.index({name:1});
export const Department=model('Department',deptSchema);

const locationSchema=new Schema({name:{type:String,required:true,trim:true},code:{type:String,trim:true},type:{type:String,enum:['CAMPUS','BUILDING','FLOOR','ROOM','COMMON_AREA'],required:true},parentLocationId:ref('Location'),description:String,isActive:{type:Boolean,default:true}},opts);
locationSchema.index({parentLocationId:1});locationSchema.index({type:1});locationSchema.index({code:1},{unique:true,partialFilterExpression:{code:{$type:'string'}}});
export const Location=model('Location',locationSchema);

const complaintSchema=new Schema({complaintCode:{type:String,required:true,unique:true},title:{type:String,required:true,maxlength:160},description:{type:String,required:true,maxlength:5000},submittedBy:{...ref('User'),required:true},category:{type:String,enum:CATEGORIES,default:'Other'},predictedCategory:String,categoryConfidence:Number,priority:{type:String,enum:PRIORITIES,default:'Medium'},predictedPriority:String,priorityConfidence:Number,status:{type:String,enum:STATES,default:'SUBMITTED'},locationId:{...ref('Location'),required:true},imageUrls:[String],departmentId:ref('Department'),duplicateOf:ref('Complaint'),aiAnalysis:Schema.Types.Mixed},opts);
complaintSchema.index({complaintCode:1},{unique:true}); complaintSchema.index({status:1,priority:1});complaintSchema.index({submittedBy:1,createdAt:-1});complaintSchema.index({departmentId:1,status:1});complaintSchema.index({locationId:1,category:1});
export const Complaint=model('Complaint',complaintSchema);

const assignmentSchema=new Schema({complaintId:{...ref('Complaint'),required:true},departmentId:{...ref('Department'),required:true},assignedTo:{...ref('User'),required:true},assignedBy:{...ref('User'),required:true},assignmentStatus:{type:String,enum:['PENDING','ACCEPTED','IN_PROGRESS','ON_HOLD','COMPLETED','REASSIGNED'],default:'PENDING'},assignedAt:{type:Date,default:Date.now},acceptedAt:Date,completedAt:Date,remarks:String,resolutionEvidence:[{url:String,description:String,uploadedAt:Date}]},opts);
assignmentSchema.index({complaintId:1,assignmentStatus:1});assignmentSchema.index({assignedTo:1,assignmentStatus:1});assignmentSchema.index({departmentId:1,assignedAt:-1});
export const Assignment=model('Assignment',assignmentSchema);

const historySchema=new Schema({complaintId:{...ref('Complaint'),required:true},previousStatus:{type:String,enum:[...STATES,null],default:null},newStatus:{type:String,enum:STATES,required:true},updatedBy:{...ref('User'),required:true},remarks:String,evidenceUrls:[String],createdAt:{type:Date,default:Date.now}},{versionKey:false});
historySchema.index({complaintId:1,createdAt:1});
export const StatusHistory=model('StatusHistory',historySchema);

const notificationSchema=new Schema({userId:{...ref('User'),required:true},title:String,message:String,type:String,complaintId:ref('Complaint'),isRead:{type:Boolean,default:false}},opts);
notificationSchema.index({userId:1,createdAt:-1});notificationSchema.index({userId:1,isRead:1});
export const Notification=model('Notification',notificationSchema);

const feedbackSchema=new Schema({complaintId:{...ref('Complaint'),required:true,unique:true},submittedBy:{...ref('User'),required:true},rating:{type:Number,min:1,max:5,required:true},comment:{type:String,maxlength:1000}},opts);
export const Feedback=model('Feedback',feedbackSchema);

const announcementSchema=new Schema({title:{type:String,required:true},description:{type:String,required:true},imageUrl:String,audience:[{type:String,enum:ROLES}],publishedBy:{...ref('User'),required:true},publishAt:Date,expiresAt:Date,isPublished:{type:Boolean,default:false}},opts);
announcementSchema.index({isPublished:1,publishAt:-1});
export const Announcement=model('Announcement',announcementSchema);

const sessionSchema=new Schema({userId:{...ref('User'),required:true},tokenHash:{type:String,required:true,unique:true},expiresAt:{type:Date,required:true},revokedAt:Date,device:String},opts);
sessionSchema.index({expiresAt:1},{expireAfterSeconds:0});
export const Session=model('Session',sessionSchema);

const auditSchema=new Schema({actor:{...ref('User'),required:true},action:{type:String,required:true},resourceType:String,resourceId:Schema.Types.ObjectId,metadata:Schema.Types.Mixed,requestId:String},{timestamps:{createdAt:true,updatedAt:false}});
auditSchema.index({actor:1,createdAt:-1});
export const AuditLog=model('AuditLog',auditSchema);
const counterSchema=new Schema({_id:String,seq:{type:Number,default:0}},{versionKey:false});
export const Counter=model('Counter',counterSchema);
const deviceSchema=new Schema({userId:{...ref('User'),required:true},tokenHash:{type:String,required:true,unique:true},tokenEncrypted:{type:String,required:true,select:false},platform:{type:String,default:'android'}},opts);
export const Device=model('Device',deviceSchema);
const mediaSchema=new Schema({owner:{...ref('User'),required:true},publicId:{type:String,required:true},url:{type:String,required:true},resourceType:{type:String,enum:['COMPLAINT','EVIDENCE']},resourceId:ref('Complaint'),used:{type:Boolean,default:false}},opts);
export const Media=model('Media',mediaSchema);
