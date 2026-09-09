# THE ABYRON — Firebase Private CMS (Free/Spark setup)

This package is based on the latest THE_ABYRON_PRIVATE_CMS package and is prepared for the Firebase setup completed in the current chat.

## What is included
- Public read-only website
- Private Firebase Email/Password admin login
- Music, Vlogs, Blog and Artists sections
- Add, edit, delete and publish/unpublish content
- Public visitors can see only published content
- Admin can see drafts and manage everything
- Image URL + video/Spotify/article URL fields
- Google-ready favicon/manifest assets

## One-time connection
1. Open `firebase-config.js`.
2. In Firebase Console: Project settings → Your apps → Web app → Config.
3. Copy the six config values into `firebase-config.js`.
4. Do NOT put your Firebase account password or OTP in this file.
5. In Firestore Rules, paste the included `firestore.rules` (the admin email is already set to the email used for the Firebase admin account in the current setup).
6. Upload the package to the GitHub Pages repository.
7. Open `/admin/` and log in with the Firebase admin account.

## Free-plan limitation
Firebase Cloud Storage is not used by this version because the current Firebase Spark/free setup does not provide Cloud Storage. Images/videos are therefore added through external URLs (for example an image host or a public YouTube URL). Firestore + Authentication remain the core CMS services.

## Important
Firebase Web App configuration values are designed to be present in client-side web apps. Security is enforced by Firebase Authentication and Firestore Security Rules, not by hiding a password in HTML.
