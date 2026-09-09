// Cloudflare Worker: secure image upload for THE ABYRON GitHub Pages site.
// Required secrets: GITHUB_TOKEN, FIREBASE_PROJECT_ID
// Required vars: GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (optional; defaults main)

const ALLOWED_TYPES = new Set(["image/jpeg","image/png","image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;

function b64urlToBytes(input){input=input.replace(/-/g,"+").replace(/_/g,"/");while(input.length%4)input+="=";const bin=atob(input);return Uint8Array.from(bin,c=>c.charCodeAt(0));}
function bytesToBase64(bytes){let s="";const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)s+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(s);}
async function verifyFirebaseIdToken(token,env){
  const parts=token.split(".");if(parts.length!==3)throw new Error("Invalid Firebase token");
  const header=JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  const payload=JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  if(header.alg!=="RS256")throw new Error("Unsupported token algorithm");
  const now=Math.floor(Date.now()/1000);if(payload.exp<now||payload.iat>now+60)throw new Error("Expired token");
  if(payload.aud!==env.FIREBASE_PROJECT_ID||payload.iss!==`https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`)throw new Error("Wrong token issuer");
  const jwks=await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com").then(r=>r.json());
  const pem=jwks[header.kid];if(!pem)throw new Error("Signing key not found");
  const body=atob(pem.split("-----BEGIN CERTIFICATE-----")[1].split("-----END CERTIFICATE-----")[0].replace(/\s/g,""));
  const der=Uint8Array.from(body,c=>c.charCodeAt(0));
  const cert=await crypto.subtle.importKey("spki",der,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]).catch(()=>null);
  // Google publishes X.509 certs, not raw SPKI; use WebCrypto's certificate parser workaround is not available.
  // Prefer Google's tokeninfo endpoint for robust verification in this worker.
  return await verifyViaGoogle(token,env);
}
async function verifyViaGoogle(token,env){
  const r=await fetch("https://oauth2.googleapis.com/tokeninfo?id_token="+encodeURIComponent(token));
  if(!r.ok)throw new Error("Firebase authentication failed");
  const p=await r.json();
  if(p.aud!==env.FIREBASE_WEB_API_KEY)throw new Error("Token audience mismatch");
  if(p.iss!=="https://securetoken.google.com/"+env.FIREBASE_PROJECT_ID)throw new Error("Token issuer mismatch");
  if(!p.sub)throw new Error("Token subject missing");
  return p;
}
function slug(s){return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,70)||"image"}
function ext(type){return type==="image/png"?"png":type==="image/webp"?"webp":"jpg"}
async function sha256(bytes){const h=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}

export default {async fetch(req,env){
  const cors={"Access-Control-Allow-Origin":"https://theabyron.github.io","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"Authorization,Content-Type"};
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:cors});
  try{
    const auth=req.headers.get("Authorization")||"";if(!auth.startsWith("Bearer "))throw new Error("Admin authentication required");
    await verifyFirebaseIdToken(auth.slice(7),env);
    const form=await req.formData();const file=form.get("file");const type=String(form.get("type")||"blogs");
    if(!(file instanceof File))throw new Error("No image supplied");if(!ALLOWED_TYPES.has(file.type))throw new Error("Only JPG, PNG and WEBP images are allowed");if(file.size>MAX_BYTES)throw new Error("Image must be 8 MB or smaller");
    const bytes=new Uint8Array(await file.arrayBuffer());const digest=(await sha256(bytes)).slice(0,12);const base=slug(file.name.replace(/\.[^.]+$/,""));const path=`uploads/${base}-${digest}.${ext(file.type)}`;
    const owner=env.GITHUB_OWNER,repo=env.GITHUB_REPO,branch=env.GITHUB_BRANCH||"main";const api=`https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const ghHeaders={Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"the-abyron-image-uploader"};
    const existing=await fetch(api+`?ref=${encodeURIComponent(branch)}`,{headers:ghHeaders});let sha;
    if(existing.ok)sha=(await existing.json()).sha;
    const payload={message:`Upload image: ${path.split("/").pop()}`,content:bytesToBase64(bytes),branch};if(sha)payload.sha=sha;
    const put=await fetch(api,{method:"PUT",headers:{...ghHeaders,"Content-Type":"application/json"},body:JSON.stringify(payload)});const out=await put.json();if(!put.ok)throw new Error(out.message||"GitHub upload failed");
    return new Response(JSON.stringify({ok:true,url:`https://${owner}.github.io/${repo}/uploads/${path.split("/").pop()}`,path}),{status:200,headers:{...cors,"Content-Type":"application/json"}});
  }catch(e){return new Response(JSON.stringify({error:e.message||"Upload failed"}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
}};
