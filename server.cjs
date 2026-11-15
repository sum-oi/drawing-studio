'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash}=require('node:crypto');
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=(status,message)=>Object.assign(new Error(message),{status});
function createApp({dataDir=process.env.DATA_DIR||path.join(__dirname,'data'),origins=process.env.APP_ORIGINS||'',secure=process.env.COOKIE_SECURE||'auto',username=process.env.INIT_USERNAME||'artist',initialPassword}={}){
 if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,31}$/.test(username))throw Error('INIT_USERNAME must be 3-32 letters, digits, dots, underscores or hyphens.');
 const originList=origins.split(',').map(s=>s.trim()).filter(Boolean);
 if(![true,false,'true','false','auto'].includes(secure))throw Error('COOKIE_SECURE must be auto, true or false.');
 for(const origin of originList){const u=new URL(origin);if(u.origin!==origin||!['http:','https:'].includes(u.protocol))throw Error('APP_ORIGINS must contain exact http(s) origins without paths.');if((secure===true||secure==='true')&&u.protocol!=='https:')throw Error('COOKIE_SECURE=true requires HTTPS origins.');}
 fs.mkdirSync(dataDir,{recursive:true});
 const db=new DatabaseSync(path.join(dataDir,'studio.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
 db.exec('CREATE TABLE IF NOT EXISTS account(id INTEGER PRIMARY KEY CHECK(id=1),salt TEXT,password TEXT); CREATE TABLE IF NOT EXISTS auth(token TEXT PRIMARY KEY,expires INTEGER); CREATE TABLE IF NOT EXISTS progress(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER,data TEXT); CREATE TABLE IF NOT EXISTS artworks(id TEXT PRIMARY KEY,mime TEXT,body BLOB,meta TEXT);');
 const columns=db.prepare('PRAGMA table_info(account)').all();
 if(!columns.some(c=>c.name==='username'))db.exec('ALTER TABLE account ADD COLUMN username TEXT');
 if(!db.prepare('SELECT id FROM account').get()){
  const password=initialPassword||randomBytes(18).toString('base64url'),salt=randomBytes(16).toString('hex');
  db.prepare('INSERT INTO account(id,salt,password,username) VALUES(1,?,?,?)').run(salt,scryptSync(password,salt,64).toString('hex'),username);
  db.prepare('INSERT INTO progress VALUES(1,0,?)').run(JSON.stringify({current:'M1',completed:[],sessions:[],passed:[]}));
  if(!initialPassword)fs.writeFileSync(path.join(dataDir,'bootstrap.txt'),'Username: '+username+'\nPassword: '+password+'\nChange this password after the first login.\n',{mode:0o600});
 }
 db.prepare('UPDATE account SET username=? WHERE username IS NULL').run(username);
 let accountName=db.prepare('SELECT username FROM account').get().username;
 const allowed=new Set(originList),attempts=new Map();
 function acceptsOrigin(req){
  try{
   const origin=new URL(req.headers.origin);
   if(origin.origin!==req.headers.origin||!['http:','https:'].includes(origin.protocol))return false;
   // Explicit origins restrict access; otherwise the proxy must preserve Host.
   return allowed.size?allowed.has(origin.origin):origin.host===req.headers.host;
  }catch{return false;}
 }
 const cookie=(req,token,age=604800)=>{
  const useSecure=secure==='auto'?(req.socket.encrypted||req.headers.origin?.startsWith('https://')):secure===true||secure==='true';
  return 'studio_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+(useSecure?'; Secure':'');
 };
 function state(){const row=db.prepare('SELECT revision,data FROM progress WHERE id=1').get();return {username:accountName,revision:row.revision,...JSON.parse(row.data),art:db.prepare('SELECT id,meta FROM artworks ORDER BY rowid').all().map(a=>({id:a.id,...JSON.parse(a.meta)}))};}
 function revision(r){if(!Number.isInteger(r)||db.prepare('SELECT revision FROM progress').get().revision!==r)throw fail(409,'另一台设备更新了记录，请先同步最新内容，再重试。');}
 function update(data){db.prepare('UPDATE progress SET data=?,revision=revision+1 WHERE id=1').run(JSON.stringify(data));}
 function validId(id){return typeof id==='string'&&/^(M[1-4]|D([1-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-2]))$/.test(id);}
 function validate(s){
  if(!s||!validId(s.current)||!Array.isArray(s.completed)||s.completed.length>256||!s.completed.every(validId)||!Array.isArray(s.sessions)||s.sessions.length>10000||!Array.isArray(s.passed)||s.passed.length>9||!s.passed.every(n=>Number.isInteger(n)&&n>=0&&n<9))throw fail(400,'进度格式不正确。');
  for(const x of s.sessions)if(!x||typeof x.id!=='string'||x.id.length>80||!validId(x.lesson)||!/^\d{4}-\d{2}-\d{2}$/.test(x.date)||!Number.isInteger(x.minutes)||x.minutes<1||x.minutes>1440||typeof x.note!=='string'||x.note.length>4000)throw fail(400,'练习记录格式不正确。');
  return {current:s.current,completed:[...new Set(s.completed)],sessions:s.sessions,passed:[...new Set(s.passed)]};
 }
 async function body(req,limit=16*1024*1024){let n=0,chunks=[];for await(const chunk of req){n+=chunk.length;if(n>limit)throw fail(413,'文件过大，请使用 10 MB 以内的图片。');chunks.push(chunk);}try{const parsed=JSON.parse(Buffer.concat(chunks).toString());if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('object required');return parsed;}catch{throw fail(400,'请求格式不正确。');}}
 function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
 const files={'/':['public/studio.html','text/html'],'/app.js':['public/app.js','text/javascript'],'/style.css':['public/style.css','text/css'],'/course.json':['public/course.json','application/json'],'/lessons.json':['public/lessons.json','application/json']};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  try{
   const url=new URL(req.url,'http://localhost'),p=url.pathname,write=!['GET','HEAD'].includes(req.method);
   if(write&&!acceptsOrigin(req))throw fail(403,'请求来源与访问地址不一致，请检查反向代理是否保留 Host 请求头。');
   if(p==='/api/login'&&req.method==='POST'){
    const ip=req.socket.remoteAddress,now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
    const a=attempts.get(ip)||{count:0,until:now+900000};if(a.count>=10)throw fail(429,'尝试次数过多，请 15 分钟后再试。');a.count++;attempts.set(ip,a);
    const b=await body(req,4096),account=db.prepare('SELECT * FROM account').get();
    if(typeof b.password!=='string'||b.password.length>256||b.username!==accountName||!timingSafeEqual(scryptSync(b.password,account.salt,64),Buffer.from(account.password,'hex')))throw fail(401,'账号或密码不正确。');
    attempts.delete(ip);const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM auth WHERE expires<?').run(now);db.prepare('INSERT INTO auth VALUES(?,?)').run(hash(token),now+604800000);res.setHeader('Set-Cookie',cookie(req,token));return json(res,200,{username:accountName});
   }
   if(p==='/health'&&req.method==='GET')return json(res,200,{status:'ok',version:require('./package.json').version});
   if(p.startsWith('/api/')){
    const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('studio_session='))?.slice(15)||'';
    if(!db.prepare('SELECT token FROM auth WHERE token=? AND expires>?').get(hash(token),Date.now()))throw fail(401,'请先登录。');
    if(p==='/api/logout'&&req.method==='POST'){db.prepare('DELETE FROM auth WHERE token=?').run(hash(token));res.setHeader('Set-Cookie',cookie(req,'',0));return json(res,200,{ok:true});}
    if((p==='/api/account'||p==='/api/password')&&req.method==='POST'){
     const b=await body(req,4096),a=db.prepare('SELECT * FROM account').get();
     // Recheck after reading the body: another device may have changed credentials.
     if(!db.prepare('SELECT token FROM auth WHERE token=? AND expires>?').get(hash(token),Date.now()))throw fail(401,'登录信息已更新，请重新登录。');
     if(typeof b.old!=='string'||b.old.length>256||!timingSafeEqual(scryptSync(b.old,a.salt,64),Buffer.from(a.password,'hex')))throw fail(400,'当前密码不正确。');
     const nextName=p==='/api/password'?a.username:b.username;
     if(typeof nextName!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,31}$/.test(nextName))throw fail(400,'账号需要 3–32 位英文字母、数字、点、下划线或短横线，并以字母或数字开头。');
     const changePassword=p==='/api/password'||b.password!==undefined;
     if(changePassword&&(typeof b.password!=='string'||b.password.length<12||b.password.length>128))throw fail(400,'新密码需要 12–128 个字符。');
     if(nextName===a.username&&!changePassword)throw fail(400,'请修改账号或填写新密码。');
     const salt=changePassword?randomBytes(16).toString('hex'):a.salt;
     const passwordHash=changePassword?scryptSync(b.password,salt,64).toString('hex'):a.password;
     db.exec('BEGIN IMMEDIATE');
     try{db.prepare('UPDATE account SET username=?,salt=?,password=? WHERE id=1').run(nextName,salt,passwordHash);db.exec('DELETE FROM auth');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
     accountName=nextName;
     res.setHeader('Set-Cookie',cookie(req,'',0));
     fs.rmSync(path.join(dataDir,'bootstrap.txt'),{force:true});
     return json(res,200,{ok:true,username:accountName});
    }
    if(p==='/api/state'&&req.method==='GET')return json(res,200,state());
    if(p==='/api/state'&&req.method==='PUT'){const b=await body(req,2*1024*1024);const data=validate(b.state);revision(b.revision);update(data);return json(res,200,state());}
    if(p==='/api/art'&&req.method==='POST'){
     const b=await body(req);if(typeof b.image!=='string'||!validId(b.lesson)||typeof b.title!=='string'||!b.title.trim()||b.title.length>100||!['草图','过程图','成品'].includes(b.type)||typeof b.note!=='string'||b.note.length>4000)throw fail(400,'请填写作品名称，并选择正确的图片。');
     const match=b.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);if(!match)throw fail(400,'仅支持 JPG、PNG、WebP。');
     const bytes=Buffer.from(match[2],'base64'),mime=match[1];if(bytes.length>10*1024*1024||bytes.length<12)throw fail(400,'图片为空或超过 10 MB。');
     const good=mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')):mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!good)throw fail(400,'图片内容与格式不符。');
     revision(b.revision);const meta={title:b.title.trim(),type:b.type,note:b.note,lesson:b.lesson,createdAt:new Date().toISOString()};
     db.exec('BEGIN IMMEDIATE');try{db.prepare('INSERT INTO artworks VALUES(?,?,?,?)').run(randomUUID(),mime,bytes,JSON.stringify(meta));db.exec('UPDATE progress SET revision=revision+1');db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return json(res,201,state());
    }
    const art=p.match(/^\/api\/art\/([a-f0-9-]{36})$/);
    if(art&&req.method==='GET'){const a=db.prepare('SELECT mime,body FROM artworks WHERE id=?').get(art[1]);if(!a)throw fail(404,'作品不存在。');res.writeHead(200,{'Content-Type':a.mime});return res.end(Buffer.from(a.body));}
    if(art&&req.method==='DELETE'){const b=await body(req,4096);revision(b.revision);db.exec('BEGIN IMMEDIATE');try{db.prepare('DELETE FROM artworks WHERE id=?').run(art[1]);db.exec('UPDATE progress SET revision=revision+1');db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return json(res,200,state());}
    if(p==='/api/export'&&req.method==='GET'){const data=state();data.art=data.art.map(a=>{const row=db.prepare('SELECT mime,body FROM artworks WHERE id=?').get(a.id);return {...a,image:'data:'+row.mime+';base64,'+Buffer.from(row.body).toString('base64')};});res.setHeader('Content-Disposition','attachment; filename="drawing-backup.json"');return json(res,200,{schemaVersion:1,...data});}
    throw fail(404,'接口不存在。');
   }
   if(!['GET','HEAD'].includes(req.method))throw fail(405,'方法不支持。');
   if(!files[p])throw fail(404,'页面不存在。');
   const [f,mime]=files[p];res.writeHead(200,{'Content-Type':mime+'; charset=utf-8'});res.end(req.method==='HEAD'?undefined:fs.readFileSync(path.join(__dirname,f)));
  }catch(e){json(res,e.status||500,{error:e.status?e.message:'保存失败，请稍后重试。'});}
 });
 server.requestTimeout=30000;server.headersTimeout=15000;
 return {server,close:()=>new Promise(resolve=>server.close(()=>{db.close();resolve()}))};
}
if(require.main===module){const app=createApp();app.server.listen(Number(process.env.PORT||4175),process.env.HOST||'0.0.0.0',()=>console.log('Studio listening on port '+(process.env.PORT||4175)));process.on('SIGTERM',()=>app.close().then(()=>process.exit(0)));}
module.exports={createApp};
