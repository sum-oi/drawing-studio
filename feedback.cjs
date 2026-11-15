'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const fail=(status,message)=>Object.assign(new Error(message),{status});
module.exports=function feedbackStore({db,dataDir,fetcher=fetch}){
 const settingsPath=path.join(dataDir,'feedback-settings.json');
 let config=fs.existsSync(settingsPath)?JSON.parse(fs.readFileSync(settingsPath,'utf8')):null;
 let queue=Promise.resolve();
 db.exec('CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,data TEXT NOT NULL)');
 const save=item=>db.prepare('INSERT OR REPLACE INTO feedback VALUES(?,?)').run(item.id,JSON.stringify(item));
 const read=id=>{const row=db.prepare('SELECT data FROM feedback WHERE id=?').get(id);if(!row)throw fail(404,'反馈不存在。');return JSON.parse(row.data)};
 const all=()=>db.prepare('SELECT data FROM feedback ORDER BY rowid DESC').all().map(r=>JSON.parse(r.data));
 const visible=x=>{const {repo,uncertain,replyRequests,...item}=x;item.comments=item.comments.map(({pending,uncertain,...c})=>({...c,pending:!!pending}));return item};
 const settings=()=>({configured:!!config,repo:config?.repo||''});
 const list=()=>({...settings(),items:all().map(visible)});
 const lock=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next};
 function validateText(value,max,label){if(typeof value!=='string'||!value.trim()||value.length>max)throw fail(400,label+'不能为空，且不能超过 '+max+' 字。');return value.trim()}
 function requestId(value){if(value===undefined)return randomUUID();if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))throw fail(400,'提交编号不正确，请重新打开反馈表单。');return value.toLowerCase()}
 const digest=value=>createHash('sha256').update(value).digest('hex');
 const changedRequest=()=>Object.assign(fail(400,'之前提交的内容已经保存。你后来修改了文字，可以保留这些文字，另建一次提交。'),{code:'FEEDBACK_REQUEST_CHANGED'});
 async function request(c,suffix,method='GET',data){
  const r=await fetcher('https://api.github.com/repos/'+c.repo+suffix,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+c.token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Drawing-Studio','Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
  if(!r.ok)throw Error('provider');return r.json();
 }
 async function verify(c){const repo=await request(c,'');if(repo.private!==true)throw fail(400,'请选择私有仓库，反馈不会发送到公开仓库。');if(!repo.has_issues)throw fail(400,'请先开启该仓库的 Issues 功能。');if(repo.permissions&&!(repo.permissions.push||repo.permissions.admin||repo.permissions.maintain))throw fail(400,'当前令牌没有该仓库的写入权限。');return repo;}
 async function pages(c,suffix){let result=[];for(let page=1;page<=10;page++){const rows=await request(c,suffix+(suffix.includes('?')?'&':'?')+'per_page=100&page='+page);if(!Array.isArray(rows))throw Error('provider');result.push(...rows);if(rows.length<100)return result;}throw Error('too many results');}
 const marker=id=>'<!-- drawing-studio:'+id+' -->';
 const clean=s=>String(s||'').replace(/\n?<!-- drawing-studio:[a-f0-9-]+ -->/g,'').slice(0,16000);
 async function syncItem(id){
  const item=read(id);if(!config){item.error='已保存在服务器，连接私有反馈仓库后可发送。';save(item);return;}
  const c={...config};
  try{
   if(item.repo&&item.repo!==c.repo)throw fail(400,'这条反馈属于另一个私有仓库，请恢复原连接后重试。');
   await verify(c);
   if(!item.issueNumber){
    item.repo=c.repo;
    let existing;
    if(item.uncertain)existing=(await pages(c,'/issues?state=all')).find(x=>!x.pull_request&&String(x.body).includes(marker(id)));
    if(existing)item.issueNumber=existing.number;
    else{
     item.uncertain=true;save(item);
     const issue=await request(c,'/issues','POST',{title:item.title,body:item.body+'\n\n课程：'+(item.lesson||'网站使用')+'\n'+marker(id)});
     item.issueNumber=issue.number;
    }
    item.uncertain=false;save(item);
   }
   let remote=await pages(c,'/issues/'+item.issueNumber+'/comments');
   for(const comment of item.comments.filter(c=>c.pending)){
    let found=remote.find(x=>String(x.body).includes(marker(comment.id)));
    if(!found){comment.uncertain=true;save(item);found=await request(c,'/issues/'+item.issueNumber+'/comments','POST',{body:comment.body+'\n'+marker(comment.id)});remote.push(found)}
    comment.pending=false;comment.uncertain=false;comment.remoteId=found.id;save(item);
   }
   const issue=await request(c,'/issues/'+item.issueNumber);
   item.status=issue.state==='closed'?'closed':'open';
   const pending=item.comments.filter(c=>c.pending);
   item.comments=[...remote.map(c=>{const clientId=String(c.body||'').match(/<!-- drawing-studio:([a-f0-9-]{36}) -->\s*$/)?.[1];return {id:String(c.id),...(clientId?{clientId}:{}),author:clientId?'使用者':c.user?.login||'维护者',body:clean(c.body),createdAt:c.created_at}}),...pending];
   item.updatedAt=new Date().toISOString();delete item.error;save(item);
  }catch(e){item.error=e.status?e.message:'暂时无法同步到 GitHub。内容已保存在服务器，请稍后点击这条反馈下方的重试按钮。';save(item);}
 }
 return {list,settings,lock,export:()=>all().map(visible),
  async configure(input){
   if(typeof input.repo!=='string'||!/^[-A-Za-z0-9_.]+\/[-A-Za-z0-9_.]+$/.test(input.repo)||input.repo.length>200)throw fail(400,'仓库填写为 账号/仓库名。');
   const token=validateText(input.token,500,'连接令牌');if(/[\r\n]/.test(token))throw fail(400,'连接令牌格式不正确。');
   const next={repo:input.repo,token};try{await verify(next)}catch(e){throw e.status?e:fail(400,'连接失败，请检查令牌是否有该私有仓库的读取和 Issues 读写权限。')}
   fs.writeFileSync(settingsPath+'.tmp',JSON.stringify(next),{mode:0o600});fs.chmodSync(settingsPath+'.tmp',0o600);fs.renameSync(settingsPath+'.tmp',settingsPath);config=next;return settings();
  },
  disconnect(){fs.rmSync(settingsPath,{force:true});config=null;return settings()},
  async create(input){
   const title=validateText(input.title,150,'反馈标题'),body=validateText(input.body,8000,'反馈内容');
   if(input.lesson!==''&&input.lesson!==undefined&&!/^(D([1-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-2])|M[1-4])$/.test(input.lesson))throw fail(400,'课程编号不正确。');
   const id=requestId(input.requestId),lesson=input.lesson||'',previous=db.prepare('SELECT data FROM feedback WHERE id=?').get(id);
   if(previous){const item=JSON.parse(previous.data);if(item.title!==title||item.body!==body||item.lesson!==lesson)throw changedRequest();return list()}
   if(db.prepare('SELECT count(*) AS n FROM feedback').get().n>=2000)throw fail(400,'反馈数量已达上限，请联系维护者整理。');
   const now=new Date().toISOString(),item={id,title,body,lesson,createdAt:now,updatedAt:now,status:'local',issueNumber:null,comments:[]};save(item);await syncItem(item.id);return list();
  },
  async reply(id,input){
   const item=read(id),body=validateText(input.body,8000,'补充内容'),clientId=requestId(input.requestId),bodyHash=digest(body);
   const previous=item.replyRequests?.[clientId],comment=item.comments.find(c=>c.id===clientId||c.clientId===clientId);
   if(previous||comment){if(previous?previous!==bodyHash:comment.body!==body)throw changedRequest();return list()}
   if(item.comments.length>=1000||Object.keys(item.replyRequests||{}).length>=1000)throw fail(400,'这条讨论过长，请新建反馈。');
   item.replyRequests={...item.replyRequests,[clientId]:bodyHash};
   item.comments.push({id:clientId,clientId,author:'使用者',body,createdAt:new Date().toISOString(),pending:true});save(item);await syncItem(id);return list()
  },
  async sync(id){await syncItem(id);return list()}
 };
};
