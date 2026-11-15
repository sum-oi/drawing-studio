const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createApp}=require('./server.cjs');
test('real HTTP: login, private artwork, cross-device state, conflicts, restart, export, password rotation',async()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'drawing-studio-test-')),password='Test-only-long-password!';
 let app=createApp({dataDir:base,origins:'http://test.local',initialPassword:password});
 async function listen(){await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+app.server.address().port;}
 let url=await listen();
 async function req(p,{method='GET',data,cookie,origin='http://test.local'}={}){return fetch(url+p,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin,'Content-Type':'application/json'}:{})},body:data===undefined?undefined:JSON.stringify(data)});}
 async function login(){const r=await req('/api/login',{method:'POST',data:{username:'artist',password}});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);return r.headers.get('set-cookie').split(';')[0];}
 try{
  assert.equal((await req('/api/state')).status,401);
  assert.equal((await req('/server.cjs')).status,404);
  assert.equal((await req('/data/studio.sqlite')).status,404);
  assert.equal((await req('/api/login',{method:'POST',origin:'https://evil.test',data:{username:'artist',password}})).status,403);
  const a=await login(),b=await login();
  let s=await (await req('/api/state',{cookie:a})).json();
  const row={id:'one',lesson:'M1',date:'2026-11-15',minutes:30,note:'测试复盘'};
  let r=await req('/api/state',{method:'PUT',cookie:a,data:{revision:s.revision,state:{...s,sessions:[row]}}});assert.equal(r.status,200);s=await r.json();
  assert.equal(s.current,'M1');assert.deepEqual(s.completed,[]);
  const second=await (await req('/api/state',{cookie:b})).json();assert.deepEqual(second.sessions,[row]);
  assert.equal((await req('/api/state',{method:'PUT',cookie:b,data:{revision:0,state:second}})).status,409);
  r=await req('/api/state',{method:'PUT',cookie:a,data:{revision:s.revision,state:{...s,current:'M2',completed:['M1']}}});assert.equal(r.status,200);s=await r.json();
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  r=await req('/api/art',{method:'POST',cookie:a,data:{revision:s.revision,image,title:'构图小稿',type:'草图',lesson:'M1',note:'<script>not executed</script>'}});assert.equal(r.status,201);s=await r.json();const id=s.art[0].id;
  assert.equal((await req('/api/art/'+id)).status,401);
  const bytes=Buffer.from(await (await req('/api/art/'+id,{cookie:b})).arrayBuffer());assert.ok(bytes.equals(Buffer.from(image.split(',')[1],'base64')));
  assert.equal((await req('/api/art',{method:'POST',cookie:a,data:{revision:s.revision,image:'data:image/png;base64,'+Buffer.from('not a valid image body').toString('base64'),title:'bad',type:'草图',lesson:'M1',note:''}})).status,400);
  const exported=await (await req('/api/export',{cookie:a})).json();assert.equal(exported.art[0].image,image);
  await app.close();app=createApp({dataDir:base,origins:'http://test.local'});url=await listen();
  s=await (await req('/api/state',{cookie:b})).json();assert.equal(s.current,'M2');assert.equal(s.art.length,1);assert.equal(s.sessions.length,1);
  r=await req('/api/art/'+id,{method:'DELETE',cookie:b,data:{revision:s.revision}});assert.equal(r.status,200);assert.equal((await r.json()).art.length,0);
  assert.equal((await req('/api/art/'+id,{cookie:b})).status,404);
  r=await req('/api/password',{method:'POST',cookie:b,data:{old:password,password:'Changed-long-password!'}});assert.equal(r.status,200);
  assert.equal((await req('/api/state',{cookie:a})).status,401);assert.equal((await req('/api/state',{cookie:b})).status,401);
  assert.equal((await req('/api/login',{method:'POST',data:{username:'artist',password:'Changed-long-password!'}})).status,200);
 }finally{await app.close();const resolved=path.resolve(base);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'drawing-studio-test-'));fs.rmSync(resolved,{recursive:true,force:true});}
});


test('custom bootstrap account is persisted and malformed JSON objects are rejected',async()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'drawing-studio-test-'));
 let app=createApp({dataDir:base,origins:'https://studio.example.com',secure:true,username:'custom_artist'});
 async function open(){await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+app.server.address().port;}
 let url=await open();
 const credentials=fs.readFileSync(path.join(base,'bootstrap.txt'),'utf8'),password=credentials.match(/^Password: (.+)$/m)[1];
 const request=(data)=>fetch(url+'/api/login',{method:'POST',headers:{Origin:'https://studio.example.com','Content-Type':'application/json'},body:JSON.stringify(data)});
 try{
  assert.match(credentials,/Username: custom_artist/);
  assert.equal((await request(null)).status,400);
  assert.equal((await request([])).status,400);
  let r=await request({username:'custom_artist',password});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/; Secure/);
  await app.close();app=createApp({dataDir:base,origins:'https://studio.example.com',secure:true,username:'ignored_on_restart'});url=await open();
  r=await request({username:'custom_artist',password});assert.equal(r.status,200);
  assert.equal(fs.readFileSync(path.join(base,'bootstrap.txt'),'utf8'),credentials);
 }finally{await app.close();const resolved=path.resolve(base);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'drawing-studio-test-'));fs.rmSync(resolved,{recursive:true,force:true});}
});
