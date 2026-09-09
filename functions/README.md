# Secure GitHub Pages image uploader

Deploy `worker.js` as a Cloudflare Worker.

Worker environment variables:
- GITHUB_OWNER = theabyron (change if your repository owner differs)
- GITHUB_REPO = theabyron.github.io (change if your repository name differs)
- GITHUB_BRANCH = main
- FIREBASE_PROJECT_ID = the-abyron
- FIREBASE_WEB_API_KEY = your Firebase Web API key from firebase-config.js

Secret:
- GITHUB_TOKEN = a GitHub token with the minimum repository Contents write permission needed for this repository.

Then put the Worker HTTPS URL into `UPLOAD_ENDPOINT` in `admin/index.html`.

The admin page authenticates the current Firebase user and sends its Firebase ID token to the Worker. The Worker verifies it through Google's tokeninfo endpoint before writing the image to `uploads/` through the GitHub Contents API.
