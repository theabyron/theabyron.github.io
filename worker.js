const ALLOWED_ORIGIN = "https://theabyron.github.io";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status = 200, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin)
    }
  });
}

async function github(env, path, init = {}) {
  const r = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/contents/${path}`,
    {
      ...init,
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "THE-ABYRON-UPLOADER",
        ...(init.headers || {})
      }
    }
  );

  const text = await r.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}

  if (!r.ok) {
    throw new Error(`GitHub HTTP ${r.status}: ${data.message || text || "Unknown GitHub error"}`);
  }

  return data;
}

async function verifyFirebaseToken(token, env) {
  if (!env.FIREBASE_WEB_API_KEY) {
    throw new Error("FIREBASE_WEB_API_KEY is not configured in Worker Variables.");
  }

  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token })
    }
  );

  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.users?.[0]) throw new Error("Invalid admin session.");

  const uid = d.users[0].localId;
  if (!env.ADMIN_UID) throw new Error("ADMIN_UID is not configured in Worker Variables.");
  if (uid !== env.ADMIN_UID) throw new Error("Not authorized.");
  return uid;
}

function safeName(name) {
  return String(name || "file")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-90) || "file";
}

function ext(type, name) {
  if (type === "image/jpeg" || /\.jpe?g$/i.test(name)) return ".jpg";
  if (type === "image/png" || /\.png$/i.test(name)) return ".png";
  if (type === "image/webp" || /\.webp$/i.test(name)) return ".webp";
  if (type === "video/mp4" || /\.mp4$/i.test(name)) return ".mp4";
  if (type === "video/webm" || /\.webm$/i.test(name)) return ".webm";
  if (type === "video/quicktime" || /\.mov$/i.test(name)) return ".mov";
  if (type === "audio/mpeg" || /\.mp3$/i.test(name)) return ".mp3";
  if (type === "audio/mp4" || /\.m4a$/i.test(name)) return ".m4a";
  if (type === "audio/wav" || /\.wav$/i.test(name)) return ".wav";
  if (type === "audio/ogg" || /\.ogg$/i.test(name)) return ".ogg";
  return ".bin";
}

function toBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405, origin);
    }

    try {
      const auth = request.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) throw new Error("Missing admin authorization.");

      await verifyFirebaseToken(auth.slice(7), env);

      const form = await request.formData();
      const file = form.get("file");
      const type = String(form.get("type") || "general");

      if (!(file instanceof File)) throw new Error("No file received.");

      const allowed = [
        "image/jpeg", "image/png", "image/webp",
        "video/mp4", "video/webm", "video/quicktime",
        "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg"
      ];

      if (!allowed.includes(file.type)) {
        throw new Error("Unsupported file type. Use JPG/PNG/WEBP, MP4/WEBM/MOV or MP3/M4A/WAV/OGG.");
      }

      const maxBytes = file.type.startsWith("image/")
        ? 8 * 1024 * 1024
        : 25 * 1024 * 1024;

      if (file.size > maxBytes) {
        throw new Error(`File must be ${file.type.startsWith("image/") ? 8 : 25} MB or smaller.`);
      }

      const base = safeName(file.name.replace(/\.[^.]+$/, ""));
      const extension = ext(file.type, file.name);
      const id = crypto.randomUUID();

      const folder = type === "photos"
        ? `uploads/photos/${id}`
        : `uploads/${safeName(type)}`;

      const filename = `${base}-${Date.now()}${extension}`;
      const path = `${folder}/${filename}`;
      const bytes = new Uint8Array(await file.arrayBuffer());

      await github(env, path, {
        method: "PUT",
        body: JSON.stringify({
          message: `Upload ${type} ${filename}`,
          content: toBase64(bytes),
          branch: env.GITHUB_BRANCH || "main"
        })
      });

      // raw.githubusercontent.com is used as the media URL because it serves
      // freshly committed binary assets immediately and avoids GitHub Pages/Jekyll
      // propagation issues. The same file remains in the GitHub Pages repository.
      const rawUrl = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${encodeURIComponent(env.GITHUB_BRANCH || "main")}/${path}`;
      const pageUrl = `https://${env.GITHUB_OWNER}.github.io/${path}`;

      return json({ ok: true, url: rawUrl, pageUrl }, 200, origin);
    } catch (e) {
      return json({ error: e.message || "Upload failed." }, 400, origin);
    }
  }
};
