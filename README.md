# THE ABYRON — Private Studio Website

This build includes a redesigned public label site and private Firebase Studio.

## Public site
- Right-top animated hamburger menu
- Short THE ABYRON intro animation on page load
- Dashboard-style homepage with live Firestore counters
- Music, Vlogs, Blogs, Artists, The Label and Contact sections
- Music/platform URLs are detected automatically on the public cards
- Mobile-first responsive layout

## Private Studio
Open `/admin/` and sign in with the authorised Firebase Authentication account.

Separate publishing forms are provided for:
- Music: release type, cover URL, description, multiple platform links
- Vlogs: video URL, thumbnail URL, description
- Blogs: category, feature image, article text, optional link
- Artists: role, profile image, bio, multiple social/platform links
- Dashboard: content counts and quick actions
- Settings and Contact information

## Free Firebase plan note
This project remains compatible with Firebase Spark. Firebase Storage is intentionally not used. Direct image/video/file uploads require a storage service; for this build, media is added through public URLs so the project does not require Blaze billing.

## GitHub Pages
Upload the contents of this ZIP while preserving:
- `index.html`
- `firebase-config.js`
- `admin/index.html`
- `assets/*`
- the remaining root config/rules files
