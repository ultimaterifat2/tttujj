# VOLT EARN — Firebase earning application starter

This is a deployable starter implementation, not a turnkey live earning business. It includes real Firebase Authentication, Firestore reads, callable Cloud Functions for wallet-critical operations, and Firestore rules that prevent browser-side balance edits.

## Included
- `index.html`: mobile-first single-file HTML/CSS/JS app.
- `firestore.rules`: owner/admin read access; all sensitive writes blocked from clients.
- `functions/index.js`: profile bootstrap, task proof submission, withdrawal requests, admin task creation, proof review, withdrawal review and referral reward configuration.
- `functions/set-admin.js`: one-time admin custom-claim setup script.

## 1. Create Firebase project
1. Create a Firebase project at https://console.firebase.google.com/.
2. Register a Web App and copy its Firebase web config.
3. Enable Authentication → Email/Password.
4. Create a Cloud Firestore database.
5. Upgrade to the Firebase plan required for deploying Cloud Functions (typically Blaze; check current Firebase pricing and quotas).
6. Set up Firebase CLI on a computer: `npm install -g firebase-tools`, then `firebase login`.

## 2. Configure the frontend
Open `index.html` and replace:
- `YOUR_API_KEY`
- `YOUR_PROJECT.firebaseapp.com`
- `YOUR_PROJECT_ID`
- `YOUR_APP_ID`

The frontend uses Firebase JS SDK 11.6.0 from Google's CDN. Serve over HTTPS or localhost; do not open it as a `file://` URL. Hosting options include Firebase Hosting, Netlify or another HTTPS static host.

## 3. Deploy Firestore rules and Functions
From the project root, initialize Firebase (`firebase init firestore functions`) and choose JavaScript functions, Node 20. Copy the supplied `firestore.rules` to the configured rules path and the supplied `functions` files into the functions directory. Ensure the Firebase project is selected with `firebase use YOUR_PROJECT_ID`.

Then:
```bash
cd functions
npm install
cd ..
firebase deploy --only firestore:rules,functions
```
Deploy Functions in `asia-south1`, matching the frontend callable Functions region.

## 4. Create the first admin
1. Register a normal account through the app.
2. In Firebase Authentication, copy that account's UID.
3. Use a secure environment with Application Default Credentials authorized for the project (or a service account kept outside the web root):
```bash
cd functions
GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json node set-admin.js YOUR_USER_UID
```
4. Sign out and sign in again. The Admin tab should appear.
Never place a service-account key in `index.html`, a public repository, or client storage.

## 5. Test the complete workflow
1. Create a regular test user and an admin user.
2. As admin, publish a task.
3. As regular user, submit proof.
4. As admin, approve/reject proof.
5. Confirm wallet balance and transaction ledger update.
6. Request a withdrawal above the configured minimum.
7. As admin, send the payment manually using the official bKash/Nagad merchant or personal-account process applicable to your business, then mark it paid. If rejected, the backend refunds the reserved balance.
8. Test on a second user and on a mobile browser.

## Important production requirements
- Configure Firebase Authentication authorized domains, App Check, budget alerts, backups, monitoring and rate controls before public launch.
- Review applicable Bangladesh laws, tax, consumer protection, advertising-network terms and payment-provider terms.
- Publish clear task rules, reward conditions, withdrawal minimums, processing times and dispute policy.
- Add server-side rate limiting / abuse controls and a moderation process before accepting public traffic.
- Set a real referral reward only after deciding the business economics. The default is zero.
- No automated bKash/Nagad payout integration is included. The app records requests and admin payment decisions only.
- Task proof is stored as text/URL. It does not verify third-party actions automatically.
- This starter does not include AdMob/AdsGram integration, OTP, password reset UI, email verification enforcement, multi-currency support, or a public user-management console.

## Data model
`users/{uid}`: profile and wallet totals.
`tasks/{taskId}`: task definition.
`submissions/{uid}_{taskId}`: one submission per user/task.
`withdrawals/{withdrawalId}`: payout request.
`transactions/{transactionId}`: wallet ledger.
`settings/main`: referral reward and minimum withdrawal.

## Security notes
Cloud Functions use the Admin SDK and bypass Firestore rules. Only callable functions with verified Firebase Auth tokens can perform wallet operations. Admin functions require the `admin` custom claim. Keep admin credentials private and rotate them if exposed.
