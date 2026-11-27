const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {initializeApp}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const crypto=require("crypto");
initializeApp();
const db=getFirestore();
const REGION="asia-south1";
const money=n=>Number.isFinite(n)&&n>0&&n<=1000000;
function uidOf(req){if(!req.auth)throw new HttpsError("unauthenticated","Please sign in.");return req.auth.uid}
function adminOnly(req){const uid=uidOf(req);if(req.auth.token.admin!==true)throw new HttpsError("permission-denied","Administrator access required.");return uid}
function code(){return crypto.randomBytes(5).toString("hex").toUpperCase()}
exports.bootstrapProfile=onCall({region:REGION},async req=>{
 const uid=uidOf(req),name=String(req.data?.displayName||"Member").trim().slice(0,60);
 const ref=db.doc(`users/${uid}`);
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(snap.exists)return;
  const input=String(req.data?.referralCode||"").trim().toUpperCase();
  let referrer=null,referrerRef=null,referrerSnap=null,reward=0;
  if(input){
   const q=db.collection("users").where("referralCode","==",input).limit(1);
   const matches=await tx.get(q);
   if(!matches.empty&&matches.docs[0].id!==uid){
    referrer=matches.docs[0].id;referrerRef=db.doc(`users/${referrer}`);
    referrerSnap=await tx.get(referrerRef);
   }
  }
  const settingsSnap=await tx.get(db.doc("settings/main"));
  reward=Number(settingsSnap.data()?.referralReward||0);
  const referralCode=code();
  tx.create(ref,{uid,email:req.auth.token.email||"",displayName:name,balance:0,pendingBalance:0,totalEarned:0,referralCode,isAdmin:false,referredBy:referrer,createdAt:FieldValue.serverTimestamp()});
  if(referrer&&referrerSnap?.exists&&reward>0&&money(reward)){
   tx.update(referrerRef,{balance:FieldValue.increment(reward),totalEarned:FieldValue.increment(reward)});
   const ledger=db.collection("transactions").doc();
   tx.create(ledger,{uid:referrer,type:"referral",direction:"credit",amount:reward,description:"Referral reward",createdAt:FieldValue.serverTimestamp()});
  }
 });
 return {ok:true};
});
exports.submitTaskProof=onCall({region:REGION},async req=>{
 const uid=uidOf(req),taskId=String(req.data?.taskId||""),proof=String(req.data?.proof||"").trim();
 if(!/^[A-Za-z0-9_-]{1,150}$/.test(taskId)||proof.length<5||proof.length>2000)throw new HttpsError("invalid-argument","Invalid task or proof.");
 const taskRef=db.doc(`tasks/${taskId}`),subRef=db.doc(`submissions/${uid}_${taskId}`);
 await db.runTransaction(async tx=>{
  const [task,sub]=await Promise.all([tx.get(taskRef),tx.get(subRef)]);
  if(!task.exists||task.data().active!==true)throw new HttpsError("not-found","Task is unavailable.");
  if(sub.exists)throw new HttpsError("already-exists","You have already submitted this task.");
  tx.create(subRef,{uid,taskId,taskTitle:task.data().title,reward:Number(task.data().reward),proof,status:"pending",createdAt:FieldValue.serverTimestamp()});
 });
 return {ok:true};
});
exports.requestWithdrawal=onCall({region:REGION},async req=>{
 const uid=uidOf(req),amount=Number(req.data?.amount),method=String(req.data?.method||""),account=String(req.data?.account||"").trim();
 if(!money(amount)||amount<50||!Number.isInteger(amount))throw new HttpsError("invalid-argument","Minimum withdrawal is ৳50 and amount must be a whole number.");
 if(!["bKash","Nagad"].includes(method)||!/^01[3-9]\d{8}$/.test(account))throw new HttpsError("invalid-argument","Enter a valid bKash/Nagad number.");
 const userRef=db.doc(`users/${uid}`),wdRef=db.collection("withdrawals").doc(),ledgerRef=db.collection("transactions").doc();
 await db.runTransaction(async tx=>{
  const u=await tx.get(userRef);if(!u.exists)throw new HttpsError("failed-precondition","Profile not found.");
  const data=u.data();const min=Number((await tx.get(db.doc("settings/main"))).data()?.minWithdrawal||50);
  if(amount<min)throw new HttpsError("failed-precondition",`Minimum withdrawal is ৳${min}.`);
  if(Number(data.balance||0)<amount)throw new HttpsError("failed-precondition","Insufficient available balance.");
  tx.update(userRef,{balance:FieldValue.increment(-amount),pendingBalance:FieldValue.increment(amount)});
  tx.create(wdRef,{uid,amount,method,account,status:"pending",createdAt:FieldValue.serverTimestamp()});
  tx.create(ledgerRef,{uid,type:"withdrawal",direction:"debit",amount,description:`Withdrawal requested (${method})`,createdAt:FieldValue.serverTimestamp()});
 });
 return {ok:true};
});
exports.createTask=onCall({region:REGION},async req=>{
 adminOnly(req);const title=String(req.data?.title||"").trim(),description=String(req.data?.description||"").trim(),reward=Number(req.data?.reward);
 if(title.length<3||title.length>100||description.length<5||description.length>2000||!money(reward))throw new HttpsError("invalid-argument","Check task title, instructions and reward.");
 const ref=db.collection("tasks").doc();await ref.set({title,description,reward,active:true,createdAt:FieldValue.serverTimestamp(),createdBy:req.auth.uid});
 return {taskId:ref.id};
});
exports.reviewSubmission=onCall({region:REGION},async req=>{
 const admin=adminOnly(req),id=String(req.data?.submissionId||""),decision=String(req.data?.decision||"");
 if(!["approve","reject"].includes(decision))throw new HttpsError("invalid-argument","Invalid decision.");
 const sref=db.doc(`submissions/${id}`);
 await db.runTransaction(async tx=>{
  const s=await tx.get(sref);if(!s.exists||s.data().status!=="pending")throw new HttpsError("failed-precondition","Submission is no longer pending.");
  const d=s.data();tx.update(sref,{status:decision==="approve"?"approved":"rejected",reviewedAt:FieldValue.serverTimestamp(),reviewedBy:admin});
  if(decision==="approve"){
   const uref=db.doc(`users/${d.uid}`);tx.update(uref,{balance:FieldValue.increment(d.reward),totalEarned:FieldValue.increment(d.reward)});
   const lref=db.collection("transactions").doc();tx.create(lref,{uid:d.uid,type:"task_reward",direction:"credit",amount:d.reward,description:`Task reward: ${d.taskTitle}`,createdAt:FieldValue.serverTimestamp()});
  }
 });
 return {ok:true};
});
exports.reviewWithdrawal=onCall({region:REGION},async req=>{
 const admin=adminOnly(req),id=String(req.data?.withdrawalId||""),decision=String(req.data?.decision||"");
 if(!["paid","reject"].includes(decision))throw new HttpsError("invalid-argument","Invalid decision.");
 const wref=db.doc(`withdrawals/${id}`);
 await db.runTransaction(async tx=>{
  const w=await tx.get(wref);if(!w.exists||w.data().status!=="pending")throw new HttpsError("failed-precondition","Withdrawal is no longer pending.");
  const d=w.data(),uref=db.doc(`users/${d.uid}`);
  tx.update(wref,{status:decision==="paid"?"paid":"rejected",reviewedAt:FieldValue.serverTimestamp(),reviewedBy:admin});
  tx.update(uref,{pendingBalance:FieldValue.increment(-d.amount),...(decision==="reject"?{balance:FieldValue.increment(d.amount)}:{})});
  const lref=db.collection("transactions").doc();tx.create(lref,{uid:d.uid,type:decision==="paid"?"withdrawal_paid":"withdrawal_refund",direction:decision==="paid"?"debit":"credit",amount:d.amount,description:decision==="paid"?"Withdrawal marked paid":"Withdrawal rejected and refunded",createdAt:FieldValue.serverTimestamp()});
 });
 return {ok:true};
});
exports.setReferralReward=onCall({region:REGION},async req=>{
 adminOnly(req);const reward=Number(req.data?.reward);if(!Number.isInteger(reward)||reward<0||reward>10000)throw new HttpsError("invalid-argument","Invalid reward.");
 await db.doc("settings/main").set({referralReward:reward,minWithdrawal:50},{merge:true});return {ok:true};
});
