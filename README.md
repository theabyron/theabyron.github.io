THE ABYRON Studio V4

Structure:
admin/index.html
index.html
worker.js

Key changes:
- Admin is rebuilt as a working authenticated module; no lifecycle/pagehide auto-logout that can break mobile file pickers.
- Upload buttons are explicitly bound to the upload handler.
- Vlogs remain multi-image.
- Artists remain single-image and editing updates the same Firestore document.
- New Photos page: multi-select, one URL per image, one GitHub folder per image, Firestore collection: photos.
- Dashboard is a record-label control room and has a rich HTML editor. Its saved HTML is stored at settings/dashboard.
- Every non-dashboard admin section has its own animated page transition.
- Public site keeps the original visual design and adds a separate Photos section.
- worker.js includes CORS OPTIONS handling and authenticated GitHub upload.

IMPORTANT:
Deploy worker.js to the same existing Cloudflare Worker and keep the existing environment variables/secrets:
FIREBASE_WEB_API_KEY
GITHUB_BRANCH
GITHUB_OWNER
GITHUB_REPO
GITHUB_TOKEN
ADMIN_UID

Existing Firestore documents are not deleted or migrated by these files.
