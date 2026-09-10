const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"Authorization,Content-Type"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json",...CORS}})}
export default{async fetch(request,env){
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const auth=request.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer "))return json({error:"Missing admin token"},401);
  const token=auth.slice(7);
  const verify=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_WEB_API_KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token})});
  const vd=await verify.json();
  const uid=vd.users?.[0]?.localId;
  if(!uid)return json({error:"Invalid admin token"},401);
  if(env.ADMIN_UID&&uid!==env.ADMIN_UID)return json({error:"Not authorized"},403);

  const form=await request.formData();const file=form.get("file");const type=String(form.get("type")||"general");
  if(!(file instanceof File))return json({error:"No file supplied"},400);
  if(file.size>8*1024*1024)return json({error:"Image must be 8 MB or smaller"},400);
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))return json({error:"Only JPG, PNG and WEBP are allowed"},400);

  const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
  const safeType=type.replace(/[^a-z0-9_-]/gi,"").toLowerCase()||"general";
  const id=crypto.randomUUID();
  const filename=`${id}.${ext}`;
  const path=safeType==="photos"?`uploads/photos/${id}/${filename}`:`uploads/${safeType}/${filename}`;
  const bytes=await file.arrayBuffer();
  const api=`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const body={message:`Upload ${safeType} image ${filename}`,content:bytesToBase64(bytes),branch:env.GITHUB_BRANCH||"main"};
  const gh=await fetch(api,{method:"PUT",headers:{"Authorization":`Bearer ${env.GITHUB_TOKEN}`,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json","User-Agent":"THE-ABYRON-Upload-Worker"},body:JSON.stringify(body)});
  const gd=await gh.json();if(!gh.ok)return json({error:gd.message||"GitHub upload failed"},502);
  return json({url:`https://${env.GITHUB_OWNER}.github.io/${path}`,path});
 }catch(e){return json({error:e?.message||"Server error"},500)}
}};
function bytesToBase64(bytes){let s="",chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)s+=String.fromCharCode(...new Uint8Array(bytes.slice(i,i+chunk)));return btoa(s)}
