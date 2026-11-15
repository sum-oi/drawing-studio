'use strict';
const {execFileSync}=require('node:child_process'),assert=require('node:assert/strict'),{randomBytes}=require('node:crypto');
const image=process.argv[2]||'drawing-studio:test',name='drawing-test-'+randomBytes(6).toString('hex'),volume=name+'-data';
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
let created=false;
(async()=>{try{
 docker('volume','create',volume);
 docker('run','-d','--name',name,'-p','127.0.0.1::4175','--mount','type=volume,source='+volume+',target=/app/data',image);created=true;
 let base;
 async function ready(){
  // Docker can reassign an ephemeral host port when the container restarts.
  const port=docker('inspect','--format','{{(index (index .NetworkSettings.Ports "4175/tcp") 0).HostPort}}',name);
  base='http://127.0.0.1:'+port;
  let reason='No response from /health';
  for(let n=0;n<30;n++){
   try{
    const response=await fetch(base+'/health',{signal:AbortSignal.timeout(2000)});
    if(response.ok)return;
    reason='GET /health returned HTTP '+response.status;
   }catch(error){reason=error.cause?.message||error.message;}
   if(docker('inspect','--format','{{.State.Running}}',name)!=='true')break;
   await new Promise(r=>setTimeout(r,1000));
  }
  console.error(docker('inspect','--format','{{json .State}}',name));
  const logs=require('node:child_process').spawnSync('docker',['logs',name],{encoding:'utf8'});
  console.error(logs.stdout,logs.stderr);
  throw Error('Container did not become healthy: '+reason);
 }
 await ready();
 const bootstrap=docker('exec',name,'cat','/app/data/bootstrap.txt'),password=bootstrap.match(/^Password: (.+)$/m)?.[1];assert.ok(password);
 const req=(p,method='GET',data,cookie)=>fetch(base+p,{method,headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const login=await req('/api/login','POST',{username:'artist',password});assert.equal(login.status,200);
 assert.doesNotMatch(login.headers.get('set-cookie'),/; Secure/);
 const cookie=login.headers.get('set-cookie').split(';')[0];let state=await (await req('/api/state','GET',undefined,cookie)).json();
 assert.equal(state.current,'D85');
 const teaching=await (await req('/course.json')).json();assert.equal(teaching.days.length,252);assert.equal(teaching.days[84].steps.length>=3,true);
 const feedbackRequest={requestId:require('node:crypto').randomUUID(),title:'Container feedback',body:'A saved lesson question.',lesson:'D85'};
 let feedback=await (await req('/api/feedback','POST',feedbackRequest,cookie)).json();assert.equal(feedback.items.length,1);assert.equal(feedback.items[0].status,'local');
 feedback=await (await req('/api/feedback','POST',feedbackRequest,cookie)).json();assert.equal(feedback.items.length,1);
 assert.equal(state.username,'artist');state.sessions.push({id:'smoke-record',lesson:'M1',date:'2026-01-01',minutes:25,note:'Container persistence check'});
 let r=await req('/api/state','PUT',{revision:state.revision,state},cookie);assert.equal(r.status,200);state=await r.json();
 const art='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 r=await req('/api/art','POST',{revision:state.revision,image:art,title:'Smoke test',type:'草图',lesson:'M1',note:''},cookie);assert.equal(r.status,201);state=await r.json();const id=state.art[0].id;
 assert.equal((await req('/api/art/'+id)).status,401);assert.equal((await req('/api/state','PUT',{revision:0,state},cookie)).status,409);
 docker('restart',name);await ready();
 state=await (await req('/api/state','GET',undefined,cookie)).json();assert.equal(state.sessions.length,1);assert.equal(state.art.length,1);
 feedback=await (await req('/api/feedback','GET',undefined,cookie)).json();assert.equal(feedback.items.length,1);assert.equal(feedback.items[0].body,feedbackRequest.body);
 const bytes=Buffer.from(await (await req('/api/art/'+id,'GET',undefined,cookie)).arrayBuffer());assert.ok(bytes.equals(Buffer.from(art.split(',')[1],'base64')));
 const backup=await (await req('/api/export','GET',undefined,cookie)).json();assert.equal(backup.art[0].image,art);
 assert.equal((await req('/data/bootstrap.txt')).status,404);
 const changedPassword='Container-changed-password!';
 assert.equal((await req('/api/account','POST',{old:password,username:'container_artist',password:changedPassword},cookie)).status,200);
 assert.equal((await req('/api/state','GET',undefined,cookie)).status,401);
 docker('restart',name);await ready();
 assert.equal((await req('/api/login','POST',{username:'artist',password})).status,401);
 const renamedLogin=await req('/api/login','POST',{username:'container_artist',password:changedPassword});assert.equal(renamedLogin.status,200);
 const renamedCookie=renamedLogin.headers.get('set-cookie').split(';')[0];
 const preserved=await (await req('/api/state','GET',undefined,renamedCookie)).json();
 assert.equal(preserved.username,'container_artist');assert.equal(preserved.sessions.length,1);assert.equal(preserved.art[0].id,id);
 console.log('PASS: container lessons, feedback deduplication/persistence, login, save, upload, private access, conflicts, restart, export and account changes.');
}finally{if(created)docker('rm','-f',name);docker('volume','rm',volume);}
})().catch(e=>{console.error(e.message);process.exitCode=1});
