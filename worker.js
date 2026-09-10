const ALLOWED_ORIGIN = "https://theabyron.github.io";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function json(data,status=200,origin=ALLOWED_ORIGIN){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json",...corsHeaders(origin)}});
}
async function github(path,init={}) {
  const r=await fetch(`https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${path}`,{
    ...init,headers:{
      "Accept":"application/vnd.github+json",
      "Authorization":`Bearer ${GITHUB_TOKEN}`,
      "X-GitHub-Api-Version":"2022-11-28",
      ...(init.headers||{})
    }
  });
  const text=await r.text();let data={};try{data=JSON.parse(text)}catch{}
  if(!r.ok)throw new Error(data.message||`GitHub HTTP ${r.status}`);
  return data;
}
async function verifyFirebaseToken(token){
  const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token})
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.users?.[0])throw new Error("Invalid admin session.");
  const uid=d.users[0].localId;
  if(ADMIN_UID && uid!==ADMIN_UID)throw new Error("Not authorized.");
  return uid;
}
function safeName(name){
  return String(name||"image").toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/-+/g,"-").slice(-90)||"image";
}
function ext(type,name){
  if(type==="image/jpeg"||/\.jpe?g$/i.test(name))return ".jpg";
  if(type==="image/png"||/\.png$/i.test(name))return ".png";
  return ".webp";
}

export default {
  async fetch(request,env){
    const origin=request.headers.get("Origin")||"";
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders(origin)});
    if(request.method!=="POST")return json({error:"Method not allowed."},405,origin);
    try{
      const auth=request.headers.get("Authorization")||"";
      if(!auth.startsWith("Bearer "))throw new Error("Missing admin authorization.");
      await verifyFirebaseToken(auth.slice(7));

      const form=await request.formData();
      const file=form.get("file"), type=String(form.get("type")||"general");
      if(!(file instanceof File))throw new Error("No image file received.");
      if(file.size>8*1024*1024)throw new Error("Image must be 8 MB or smaller.");
      if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Only JPG, PNG and WEBP images are allowed.");

      const base=safeName(file.name.replace(/\.[^.]+$/,""));
      const extension=ext(file.type,file.name);
      const id=crypto.randomUUID();
      const folder=type==="photos"?`uploads/photos/${id}`:`uploads/${type}`;
      const filename=`${base}-${Date.now()}${extension}`;
      const path=`${folder}/${filename}`;
      const bytes=new Uint8Array(await file.arrayBuffer());
      let binary="";
      const chunk=0x8000;
      for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
      const content=btoa(binary);
      await github(path,{method:"PUT",body:JSON.stringify({message:`Upload ${type} image ${filename}`,content,branch:GITHUB_BRANCH})});
      return json({ok:true,url:`https://${GITHUB_OWNER}.github.io/${path}`},200,origin);
    }catch(e){return json({error:e.message||"Upload failed."},400,origin)}
  }
};
