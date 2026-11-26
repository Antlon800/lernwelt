const COOKIE="__Host-lernwelt_session", DAYS=14, ITERATIONS=120000, enc=new TextEncoder();
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{"Cache-Control":"no-store",...headers}});
function randomToken(){const a=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
async function digest(s){const d=await crypto.subtle.digest("SHA-256",enc.encode(s));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function readCookie(req){const s=(req.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="));return s?s.slice(COOKIE.length+1):"";}
const setCookie=(v,age)=>`${COOKIE}=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const b64=a=>btoa(String.fromCharCode(...new Uint8Array(a)));
const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function passwordHash(password,salt=crypto.getRandomValues(new Uint8Array(16))){const k=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);const b=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:ITERATIONS,hash:"SHA-256"},k,256);return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(b)}`;}
async function verifyPassword(password,stored){const [kind,it,salt,hash]=String(stored).split("$");if(kind!=="pbkdf2"||Number(it)!==ITERATIONS)return false;const k=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);const b=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:un64(salt),iterations:ITERATIONS,hash:"SHA-256"},k,256)),e=un64(hash);let diff=b.length^e.length;for(let i=0;i<Math.min(b.length,e.length);i++)diff|=b[i]^e[i];return diff===0;}
function publicUser(u){return {id:u.id,username:u.username||u.display_name,displayName:u.username||u.display_name,role:Number(u.is_owner)===1?"owner":u.role};}
async function userFor(req,env){const t=readCookie(req);if(!t)return null;return await env.DB.prepare("SELECT u.id,u.username,u.display_name,u.role,u.is_owner FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=? AND julianday(s.expires_at) > julianday('now') AND u.is_active=1").bind(await digest(t)).first();}
async function newSession(user,env){const t=randomToken(),expiry=new Date(Date.now()+DAYS*86400000).toISOString();await env.DB.prepare("INSERT INTO sessions(id_hash,user_id,expires_at) VALUES(?,?,?)").bind(await digest(t),user.id,expiry).run();return t;}
async function allowAttempt(req,identifier,env,kind){const ip=req.headers.get("CF-Connecting-IP")||"unknown",key=await digest(kind+":"+ip+":"+identifier.toLowerCase()),now=new Date();const r=await env.DB.prepare("SELECT attempts,window_started_at,blocked_until FROM auth_rate_limits WHERE key_hash=?").bind(key).first();if(r?.blocked_until&&new Date(r.blocked_until)>now)return false;const reset=!r||now-new Date(r.window_started_at)>900000,n=reset?1:Number(r.attempts)+1,blocked=n>=8?new Date(now.getTime()+900000).toISOString():null;await env.DB.prepare("INSERT INTO auth_rate_limits(key_hash,attempts,window_started_at,blocked_until) VALUES(?,?,?,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until").bind(key,n,reset?now.toISOString():r.window_started_at,blocked).run();return !blocked;}
async function auth(req,env,url){const p=url.pathname;
 if(p==="/api/me"&&req.method==="GET"){const u=await userFor(req,env);return json({user:u?publicUser(u):null});}
 if(p==="/api/owner/users"){
  const owner=await userFor(req,env);if(!owner||Number(owner.is_owner)!==1)return json({error:"Nur der Owner darf Benutzerrollen verwalten."},403);
  if(req.method==="GET"){const rows=await env.DB.prepare("SELECT id,username,display_name,role,is_owner,created_at FROM users WHERE is_active=1 ORDER BY created_at ASC").all();return json({users:(rows.results||[]).map(u=>({...publicUser(u),createdAt:u.created_at}))});}
  if(req.method==="PATCH"){
   const origin=req.headers.get("Origin");if(origin&&origin!==url.origin)return json({error:"Ungültige Anfragequelle."},403);
   let b;try{b=await req.json();}catch{return json({error:"Ungültige Anfrage."},400);}
   const targetId=String(b.userId||""),role=String(b.role||"");if(!targetId||!["student","admin"].includes(role))return json({error:"Ungültige Rollenänderung."},400);
   if(targetId===owner.id)return json({error:"Deine eigene Owner-Rolle kann hier nicht geändert werden."},400);
   const target=await env.DB.prepare("SELECT id,is_owner FROM users WHERE id=? AND is_active=1").bind(targetId).first();if(!target)return json({error:"Benutzer nicht gefunden."},404);
   if(Number(target.is_owner)===1)return json({error:"Die Owner-Rolle kann nicht geändert werden."},403);
   await env.DB.prepare("UPDATE users SET role=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(role,targetId).run();
   return json({ok:true});
  }
  return json({error:"Methode nicht erlaubt."},405,{Allow:"GET, PATCH"});
 }
 if(!["/api/register","/api/login","/api/logout"].includes(p))return null;
 if(req.method!=="POST")return json({error:"Methode nicht erlaubt."},405,{Allow:"POST"});
 const origin=req.headers.get("Origin");if(origin&&origin!==url.origin)return json({error:"Ungültige Anfragequelle."},403);
 if(p==="/api/logout"){const t=readCookie(req);if(t)await env.DB.prepare("DELETE FROM sessions WHERE id_hash=?").bind(await digest(t)).run();return json({ok:true},200,{"Set-Cookie":setCookie("",0)});}
 let b;try{b=await req.json();}catch{return json({error:"Ungültige Anfrage."},400);}
 const username=String(b.username||b.displayName||"").trim().replace(/\s+/g," "),pw=String(b.password||"");
 if(username.length<2||username.length>30)return json({error:"Der Benutzername muss 2 bis 30 Zeichen lang sein."},400);
 if(pw.length<10||pw.length>200)return json({error:"Das Passwort muss mindestens 10 Zeichen lang sein."},400);
 if(!await allowAttempt(req,username,env,p==="/api/register"?"register":"login"))return json({error:"Zu viele Versuche. Bitte warte 15 Minuten."},429);
 if(p==="/api/register"){
  if(!/^[\p{L}\p{N}_.-]{2,30}$/u.test(username))return json({error:"Erlaubt sind Buchstaben, Zahlen, Punkt, Bindestrich und Unterstrich (2 bis 30 Zeichen)."},400);
  const exists=await env.DB.prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE").bind(username).first();if(exists)return json({error:"Dieser Benutzername ist bereits vergeben. Bitte wähle einen anderen."},409);
  const codeValid=Boolean(env.ADMIN_SIGNUP_CODE&&b.adminCode&&String(b.adminCode)===env.ADMIN_SIGNUP_CODE);
  const existingOwner=await env.DB.prepare("SELECT id FROM users WHERE is_owner=1 LIMIT 1").first();
  const isOwner=codeValid&&!existingOwner;
  const u={id:crypto.randomUUID(),username,display_name:username,role:"student",is_owner:isOwner?1:0};
  const internalEmail=username.toLowerCase()+"@accounts.lernwelt.invalid";
  try{await env.DB.prepare("INSERT INTO users(id,email,username,display_name,password_hash,role,is_owner) VALUES(?,?,?,?,?,?,?)").bind(u.id,internalEmail,username,username,await passwordHash(pw),u.role,u.is_owner).run();}catch(e){console.error("Lernwelt registration insert:",e);return json({error:"Konto konnte nicht gespeichert werden. Bitte prüfe die Datenbankmigrationen."},500);}
  const t=await newSession(u,env);return json({ok:true,user:publicUser(u)},201,{"Set-Cookie":setCookie(t,DAYS*86400)});
 }
 const u=await env.DB.prepare("SELECT id,username,display_name,role,is_owner,password_hash FROM users WHERE username=? COLLATE NOCASE AND is_active=1").bind(username).first();
 if(!u||!await verifyPassword(pw,u.password_hash))return json({error:"Benutzername oder Passwort ist falsch."},401);
 const t=await newSession(u,env);return json({ok:true,user:publicUser(u)},200,{"Set-Cookie":setCookie(t,DAYS*86400)});
}
export default {async fetch(req,env){const url=new URL(req.url);if(url.pathname==="/api/health"){let ready=false;try{await env.DB.prepare("SELECT 1 AS ok").first();ready=true;}catch{}return json({status:"ok",app:"Lernwelt",databaseConfigured:Boolean(env.DB),databaseReady:ready});}
 if(url.pathname.startsWith("/api/")){try{const r=await auth(req,env,url);return r||json({error:"Dieser API-Endpunkt ist noch nicht eingerichtet."},404);}catch(e){console.error("Lernwelt API:",e);return json({error:"Serverfehler. Bitte versuche es später erneut."},500);}}
 return env.ASSETS.fetch(req);
}};