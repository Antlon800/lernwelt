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
async function userFor(req,env){const t=readCookie(req);if(!t)return null;return await env.DB.prepare("SELECT u.id,u.email,u.display_name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=? AND s.expires_at > datetime('now') AND u.is_active=1").bind(await digest(t)).first();}
async function newSession(user,env){const t=randomToken(),expiry=new Date(Date.now()+DAYS*86400000).toISOString();await env.DB.prepare("INSERT INTO sessions(id_hash,user_id,expires_at) VALUES(?,?,?)").bind(await digest(t),user.id,expiry).run();return t;}
async function allowAttempt(req,email,env,kind){const ip=req.headers.get("CF-Connecting-IP")||"unknown",key=await digest(kind+":"+ip+":"+email),now=new Date();const r=await env.DB.prepare("SELECT attempts,window_started_at,blocked_until FROM auth_rate_limits WHERE key_hash=?").bind(key).first();if(r?.blocked_until&&new Date(r.blocked_until)>now)return false;const reset=!r||now-new Date(r.window_started_at)>900000,n=reset?1:Number(r.attempts)+1,blocked=n>=8?new Date(now.getTime()+900000).toISOString():null;await env.DB.prepare("INSERT INTO auth_rate_limits(key_hash,attempts,window_started_at,blocked_until) VALUES(?,?,?,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until").bind(key,n,reset?now.toISOString():r.window_started_at,blocked).run();return !blocked;}
async function auth(req,env,url){const p=url.pathname;
 if(p==="/api/me"&&req.method==="GET"){const u=await userFor(req,env);return json({user:u?{id:u.id,email:u.email,displayName:u.display_name,role:u.role}:null});}
 if(!["/api/register","/api/login","/api/logout"].includes(p))return null;
 if(req.method!=="POST")return json({error:"Methode nicht erlaubt."},405,{Allow:"POST"});
 const origin=req.headers.get("Origin");if(origin&&origin!==url.origin)return json({error:"Ungültige Anfragequelle."},403);
 if(p==="/api/logout"){const t=readCookie(req);if(t)await env.DB.prepare("DELETE FROM sessions WHERE id_hash=?").bind(await digest(t)).run();return json({ok:true},200,{"Set-Cookie":setCookie("",0)});}
 let b;try{b=await req.json();}catch{return json({error:"Ungültige Anfrage."},400);}
 const email=String(b.email||"").trim().toLowerCase(),pw=String(b.password||"");
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json({error:"Bitte gib eine gültige E-Mail-Adresse ein."},400);
 if(pw.length<10||pw.length>200)return json({error:"Das Passwort muss mindestens 10 Zeichen lang sein."},400);
 if(!await allowAttempt(req,email,env,p==="/api/register"?"register":"login"))return json({error:"Zu viele Versuche. Bitte warte 15 Minuten."},429);
 if(p==="/api/register"){
  const name=String(b.displayName||"").trim().replace(/\s+/g," ");if(name.length<2||name.length>60)return json({error:"Bitte gib einen Namen mit 2 bis 60 Zeichen ein."},400);
  const exists=await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();if(exists)return json({error:"Für diese E-Mail-Adresse gibt es bereits ein Konto."},409);
  const isAdmin=Boolean(env.ADMIN_SIGNUP_CODE&&b.adminCode&&String(b.adminCode)===env.ADMIN_SIGNUP_CODE),u={id:crypto.randomUUID(),email,display_name:name,role:isAdmin?"admin":"student"};
  try{await env.DB.prepare("INSERT INTO users(id,email,display_name,password_hash,role) VALUES(?,?,?,?,?)").bind(u.id,email,name,await passwordHash(pw),u.role).run();}catch{return json({error:"Das Konto konnte nicht erstellt werden. Möglicherweise wird die E-Mail bereits verwendet."},409);}
  const t=await newSession(u,env);return json({ok:true,user:{id:u.id,email,displayName:name,role:u.role}},201,{"Set-Cookie":setCookie(t,DAYS*86400)});
 }
 const u=await env.DB.prepare("SELECT id,email,display_name,role,password_hash FROM users WHERE email=? AND is_active=1").bind(email).first();
 if(!u||!await verifyPassword(pw,u.password_hash))return json({error:"E-Mail-Adresse oder Passwort ist falsch."},401);
 const t=await newSession(u,env);return json({ok:true,user:{id:u.id,email,displayName:u.display_name,role:u.role}},200,{"Set-Cookie":setCookie(t,DAYS*86400)});
}
export default {async fetch(req,env){const url=new URL(req.url);if(url.pathname==="/api/health"){let ready=false;try{await env.DB.prepare("SELECT 1 AS ok").first();ready=true;}catch{}return json({status:"ok",app:"Lernwelt",databaseConfigured:Boolean(env.DB),databaseReady:ready});}
 if(url.pathname.startsWith("/api/")){try{const r=await auth(req,env,url);return r||json({error:"Dieser API-Endpunkt ist noch nicht eingerichtet."},404);}catch(e){console.error("Lernwelt API:",e);return json({error:"Serverfehler. Bitte versuche es später erneut."},500);}}
 return env.ASSETS.fetch(req);
}};
