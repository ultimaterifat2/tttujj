// Run from the functions directory after `firebase login` and selecting your project.
// Usage: GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node set-admin.js USER_UID
const {initializeApp,applicationDefault}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
initializeApp({credential:applicationDefault()});
(async()=>{
 const uid=process.argv[2];if(!uid)throw new Error("Usage: node set-admin.js USER_UID");
 await getAuth().setCustomUserClaims(uid,{admin:true});
 await getFirestore().doc(`users/${uid}`).set({isAdmin:true,adminGrantedAt:FieldValue.serverTimestamp()},{merge:true});
 console.log(`Admin claim granted to ${uid}. Sign out and sign in again to refresh token.`);
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
