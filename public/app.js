'use strict';
function requestId(){const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20)}
function feedbackView(){
 const top=header('我的反馈','课程看不懂、练习太难，或按钮有问题，都可以在这里说明。维护者处理后，在这里查看回复。','<button class="primary" onclick="newFeedback()">写反馈</button>');
 if(feedbackLoading&&!feedbackData)return top+'<p role="status">正在读取反馈…</p>';
 if(!feedbackData)return top+'<p role="alert">'+esc(feedbackError||'还没有读取反馈。')+'</p><button onclick="loadFeedback()">重新读取</button>';
 return top+(!feedbackData.configured?'<div class="note">反馈会先保存在这台服务器，还没有发送给维护者。请部署者在“账户与备份”里设置反馈连接。</div>':'<p class="feedback-privacy">反馈内容和课程编号会发送到私有反馈仓库，只有有权限的维护者能查看。作品图片不会自动发送。</p>')+(feedbackError?'<p role="alert">'+esc(feedbackError)+'</p>':'')+'<div class="feedback-list">'+(feedbackData.items.length?feedbackData.items.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(item=>'<article class="feedback-item"><header><span>'+esc(item.lesson||'网站使用')+' · '+esc(new Date(item.createdAt).toLocaleDateString())+'</span><span class="feedback-status">'+(item.status==='local'?'尚未发送':item.status==='closed'?'已处理':'待处理')+'</span></header><h2>'+esc(item.title)+'</h2><p class="user-text">'+esc(item.body)+'</p>'+(item.error?'<p class="formerror">'+esc(item.error)+'</p>':'')+'<div class="feedback-replies">'+(item.comments||[]).map(c=>'<div class="feedback-reply"><small>'+esc(c.author)+' · '+esc(new Date(c.createdAt).toLocaleString())+(c.pending?' · 尚未发送':'')+'</small><p class="user-text">'+esc(c.body)+'</p></div>').join('')+'</div><div class="actions"><button onclick="replyFeedback(\''+esc(item.id)+'\')">补充说明</button><button onclick="syncFeedback(\''+esc(item.id)+'\')">'+(item.status==='local'?'重新发送':'查看最新回复')+'</button></div></article>').join(''):'<p class="empty">还没有反馈。比如：第 2 步让我改人物位置，但没有说明人物该放在哪里。</p>')+'</div>';
}
async function loadFeedback(){
 if(feedbackLoading)return;feedbackLoading=true;feedbackError='';if(page==='feedback')render();
 try{feedbackData=await api('/api/feedback')}catch(e){feedbackError=e.message;if(e.status===401)reauthenticate()}finally{feedbackLoading=false;if(page==='feedback'&&state)render()}
}
function newFeedback(lessonOverride){
 const lesson=typeof lessonOverride==='string'?lessonOverride:page==='today'?state.current:'';
 const draftKey='studio-feedback-'+lesson;let draft={};try{draft=JSON.parse(sessionStorage.getItem(draftKey))||{}}catch{}const submissionId=draft.requestId||requestId();
 modal('<h2>说说哪里有问题</h2><p>'+esc(lesson?lesson+' · '+title():'网站使用或课程建议')+'</p><form id="feedbackform"><div class="field"><label for="feedbacktitle">一句话说明问题</label><input id="feedbacktitle" maxlength="120" required placeholder="例如：不明白第 2 步怎么改人物位置"></div><div class="field"><label for="feedbackbody">具体卡在哪里？希望补充什么？</label><textarea id="feedbackbody" maxlength="6000" required placeholder="可以复制没看懂的原句，再说说你试过什么。"></textarea></div><p>只发送你填写的文字和课程编号，不会自动发送作品。</p><button class="primary">提交反馈</button></form>');
 $('#feedbacktitle').value=draft.title||'';$('#feedbackbody').value=draft.body||'';
 $('#feedbackform').dataset.lesson=lesson;
 $('#feedbackform').oninput=()=>{try{sessionStorage.setItem(draftKey,JSON.stringify({requestId:submissionId,title:$('#feedbacktitle').value,body:$('#feedbackbody').value}))}catch{}};
 $('#feedbackform').onsubmit=e=>{e.preventDefault();$('#feedbackform').oninput();action(async()=>{feedbackData=await api('/api/feedback','POST',{requestId:submissionId,title:$('#feedbacktitle').value.trim(),body:$('#feedbackbody').value.trim(),lesson});try{sessionStorage.removeItem(draftKey)}catch{}$('#modal').close();page='feedback';render();window.scrollTo(0,0);message('反馈已保存，发送情况显示在下方。')})};
}
function replyFeedback(id){
 const key='studio-feedback-reply-'+id;let draft={};try{draft=JSON.parse(sessionStorage.getItem(key))||{}}catch{}const submissionId=draft.requestId||requestId();
 modal('<h2>补充说明</h2><form id="replyform"><div class="field"><label for="replybody">还有哪些情况需要说明？</label><textarea id="replybody" maxlength="6000" required></textarea></div><button class="primary">发送补充</button></form>');
 $('#replybody').value=draft.body||'';
 $('#replyform').dataset.feedbackId=id;
 $('#replyform').oninput=()=>{try{sessionStorage.setItem(key,JSON.stringify({requestId:submissionId,body:$('#replybody').value}))}catch{}};
 $('#replyform').onsubmit=e=>{e.preventDefault();$('#replyform').oninput();action(async()=>{feedbackData=await api('/api/feedback/'+encodeURIComponent(id)+'/reply','POST',{requestId:submissionId,body:$('#replybody').value.trim()});try{sessionStorage.removeItem(key)}catch{}$('#modal').close();render()})};
}
function syncFeedback(id){action(async()=>{feedbackData=await api('/api/feedback/'+encodeURIComponent(id)+'/sync','POST',{});render();message('已检查发送情况和最新回复。')})}
function restartFeedbackDraft(){
 const form=$('#feedbackform'),reply=$('#replyform');
 if(form){const lesson=form.dataset.lesson;sessionStorage.setItem('studio-feedback-'+lesson,JSON.stringify({requestId:requestId(),title:$('#feedbacktitle').value,body:$('#feedbackbody').value}));$('#modal').close();newFeedback(lesson)}
 else if(reply){const id=reply.dataset.feedbackId;sessionStorage.setItem('studio-feedback-reply-'+id,JSON.stringify({requestId:requestId(),body:$('#replybody').value}));$('#modal').close();replyFeedback(id)}
}
function feedbackSettings() {
 action(async () => {
  const config = await api('/api/feedback/settings');
  modal(`
   <h2>连接私有反馈仓库</h2>
   <p>部署者设置后，使用者就可以在绘画练习室提交反馈、查看回复。</p>
   <details class="feedback-guide">
    <summary>查看详细教程：创建令牌并连接</summary>
    <ol>
     <li><strong>打开令牌创建页。</strong> 用拥有私有反馈仓库的 GitHub 账号登录，打开 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">创建细粒度令牌（在新标签页打开）</a>。<b>Token name</b> 可填 Drawing Studio Feedback，再选一个到期日。</li>
     <li><strong>只授权反馈仓库。</strong> 在 <b>Resource owner</b> 选仓库所属账号。在 <b>Repository access</b> 选 <b>Only select repositories</b>，只勾选你用来收反馈的私有仓库。</li>
     <li><strong>允许发送和读取反馈。</strong> 在 <b>Permissions</b> 里点 <b>Add permissions</b>，添加 <b>Issues</b> 并设为 <b>Read and write</b>。保留默认的 <b>Metadata</b> 读取权限。点 <b>Generate token</b>，复制生成的完整令牌。</li>
     <li><strong>回到此窗口填写。</strong> 第一栏填 GitHub 的仓库路径，比如 <code>your-name/drawing-studio-feedback</code>。第二栏粘贴刚复制的令牌。第三栏填绘画练习室的登录密码。点“验证并连接”。</li>
     <li><strong>发送一条测试反馈。</strong> 到“我的反馈 → 写反馈”提交测试文字。看到“待处理”后，打开私有仓库的 <b>Issues</b>，确认收到了。之前显示“尚未发送”的反馈，可以点各自下方的“重新发送”。</li>
    </ol>
    <p><strong>连接不上时</strong>，检查令牌是否过期、是否勾选了正确的私有仓库，以及仓库是否已开启 Issues。令牌到期后，在这里填入新令牌并重新连接。</p>
   </details>
   <form id="feedbacksettings">
    <div class="field">
     <label for="feedbackrepo">GitHub 私有仓库</label>
     <input id="feedbackrepo" required placeholder="账号/仓库名" value="${esc(config.repo)}">
     <small>填写账号和仓库名，省略网址开头与 /issues。</small>
    </div>
    <div class="field">
     <label for="feedbacktoken">仓库访问令牌</label>
     <input id="feedbacktoken" type="password" autocomplete="off" required maxlength="500">
     <small>粘贴 GitHub 生成的完整令牌。令牌保存在服务器，请只在这里填写。</small>
    </div>
    <div class="field">
     <label for="feedbackpassword">绘画练习室的登录密码</label>
     <input id="feedbackpassword" type="password" autocomplete="current-password" required>
    </div>
    <button class="primary">验证并连接</button>
   </form>
   ${config.configured ? '<button class="ghost" onclick="disconnectFeedback()">断开连接</button>' : ''}
  `);
  $('#feedbacksettings').onsubmit = event => {
   event.preventDefault();
   action(async () => {
    await api('/api/feedback/settings', 'POST', {
     repo: $('#feedbackrepo').value.trim(),
     token: $('#feedbacktoken').value.trim(),
     password: $('#feedbackpassword').value
    });
    $('#modal').close();
    feedbackData = null;
    message('已连接私有反馈仓库。可以到“我的反馈”发送一条测试反馈。');
   });
  };
 });
}
function disconnectFeedback(){
 modal('<h2>断开反馈连接</h2><p>服务器里已保存的反馈会保留，断开后不再发送或读取回复。</p><form id="disconnectform"><div class="field"><label for="disconnectpw">当前登录密码</label><input id="disconnectpw" type="password" autocomplete="current-password" required></div><button>确认断开</button></form>');
 $('#disconnectform').onsubmit=e=>{e.preventDefault();action(async()=>{await api('/api/feedback/settings','DELETE',{password:$('#disconnectpw').value});feedbackData=null;$('#modal').close();message('已断开反馈连接。')})};
}
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let feedbackData=null,feedbackError='',feedbackLoading=false;
let state,course,page='today',week=1,month=new Date(new Date().getFullYear(),new Date().getMonth(),1),selected=date(),busy=false,syncTask=null;
function date(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
async function api(path,method='GET',body){let r;try{r=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'})}catch{throw new Error('连接中断，输入仍保留。恢复网络后请重试。')}const data=await r.json();if(!r.ok){const e=new Error(data.error||'请求失败');e.status=r.status;e.code=data.code;throw e}return data}
function message(text){$('#notice').textContent=text;clearTimeout(window.noteTimer);window.noteTimer=setTimeout(()=>$('#notice').textContent='',7000)}
function modal(html){$('#modal').innerHTML='<button class="close" aria-label="关闭" onclick="document.querySelector(\'#modal\').close()">×</button>'+html+'<div class="formerror" role="alert"></div>';$('#modal').showModal()}
async function action(fn){if(syncTask)await syncTask;if(busy)return;busy=true;const buttons=[...document.querySelectorAll('#modal button, #modal input, #modal textarea, #modal select')];buttons.forEach(b=>b.disabled=true);try{await fn()}catch(e){const target=$('#modal[open] .formerror')||$('#error');if(target){target.textContent=e.message;if(e.code==='FEEDBACK_REQUEST_CHANGED'){const button=document.createElement('button');button.type='button';button.textContent='保留这些文字，另建一次提交';button.onclick=restartFeedbackDraft;target.append(document.createElement('br'),button)}if(e.status===409&&$('#modal').open){const button=document.createElement('button');button.type='button';button.textContent='同步最新进度，保留当前输入';button.onclick=()=>action(async()=>{state=await api('/api/state');target.textContent='已读取最新进度，输入已保留。请检查后再次保存。'});target.append(document.createElement('br'),button);}}else message(e.message);if(e.status===401&&state)reauthenticate()}finally{busy=false;buttons.forEach(b=>b.disabled=false)}}
function reauthenticate(){const existing=$('#modal').open;if(!existing)modal('<h2>登录已过期</h2>');const area=$('.formerror');area.innerHTML='<p>重新登录后可以继续保存，当前输入仍保留。</p><form id="reauthform"><div class="field"><label for="reauthuser">账号</label><input id="reauthuser" autocomplete="username" maxlength="32" value="'+esc(state.username)+'" required></div><div class="field"><label for="reauthpw">账号密码</label><input id="reauthpw" type="password" autocomplete="current-password" required maxlength="256"></div><button class="primary">重新登录</button><p id="reautherror" role="alert"></p></form>';$('#reauthform').onsubmit=e=>{e.preventDefault();if(busy)return;busy=true;const button=e.target.querySelector('button');button.disabled=true;(async()=>{try{await api('/api/login','POST',{username:$('#reauthuser').value.trim(),password:$('#reauthpw').value});state=await api('/api/state');render();if(existing)area.textContent='登录成功，已同步最新进度。请检查输入后再次保存。';else $('#modal').close();}catch(error){$('#reautherror').textContent=error.message}finally{busy=false;button.disabled=false}})()};}
async function mutate(next){state=await api('/api/state','PUT',{revision:state.revision,state:next});render()}
async function sync(silent=false){if(busy||syncTask)return;syncTask=action(async()=>{state=await api('/api/state');if(!$('#modal').open)render();if(!silent)message('已同步最新记录。')}).finally(()=>{syncTask=null});await syncTask}
function title(){return course.days[Number(state.current.slice(1))-1]?.title||state.current}
function nav(p){page=p;if(p==='course')week=course.days[Number(state.current.slice(1))-1]?.week||13;render();window.scrollTo(0,0);if(p==='feedback')loadFeedback()}
function login(error='',username='',success=''){
 $('#app').innerHTML='<main class="login-page"><header class="login-top">'+brand()+'<small>绘画课程、练习记录与作品管理</small></header><div class="login-spread"><section class="login-art"><div class="folio">课程 · 练习 · 作品</div><h1>按步骤练习，<br>保存每次作品</h1><p>选择要练的课程，按步骤画草图，再记录用时、上传作品和写下修改计划。</p>'+shelfArt()+'</section><section class="login"><div class="eyebrow">绘画练习室</div><h2>登录</h2><p class="muted">登录后查看课程、练习记录和已上传的作品。</p><form id="loginform"><div class="field"><label for="username">账号</label><input id="username" autocomplete="username" placeholder="请输入账号" value="'+esc(username)+'" maxlength="32" required></div><div class="field"><label for="password">密码</label><input id="password" type="password" autocomplete="current-password" required maxlength="256"></div><p id="error" class="formerror" role="alert">'+esc(error)+'</p>'+(success?'<p class="success" role="status">'+esc(success)+'</p>':'')+'<button class="primary" type="submit">进入练习室</button></form><p class="micro muted">首次密码由部署者提供，登录后可修改账号与密码。</p></section></div><footer class="login-footer"><span>生长之间 · Drawing Studio</span><span>支持电脑与平板访问</span></footer></main>';
 $('#loginform').onsubmit=e=>{e.preventDefault();action(async()=>{await api('/api/login','POST',{username:$('#username').value.trim(),password:$('#password').value});state=await api('/api/state');render()})};
}
function header(h,p,action=''){return '<div class="heading"><div><h1>'+h+'</h1><p>'+p+'</p></div>'+action+'</div>'}

function brand(){return '<div class="brand"><svg class="brandmark" viewBox="0 0 36 48" aria-hidden="true"><path d="M18 43V16M18 28C3 26 3 13 5 8C18 10 23 18 18 28M18 20C30 21 35 9 32 3C21 4 15 11 18 20" fill="#bfb33b" stroke="#222" stroke-width="1.5"/><path d="M8 43H28" stroke="#222" stroke-width="1.5"/></svg><div><strong>生长之间</strong><small>Drawing Studio</small></div></div>'}
function shelfArt(){return '<svg class="shelf-art" viewBox="0 0 460 240" role="img" aria-label="画室静物：植物、摊开的速写本和一罐画笔"><g stroke="#222" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 221H456"/><path d="M8 226H452V234H8Z" fill="#bfb33b" stroke="none"/><path d="M26 180Q57 166 103 183L122 218Q78 202 40 215Z" fill="#f9f5f1"/><path d="M103 183Q128 162 169 165L180 205Q149 205 122 218Z" fill="#bfb33b"/><path d="M103 183L122 218M42 188L79 187M49 196L88 195M134 185L157 180M137 193L163 188" fill="none"/><path d="M177 158H243L234 216H188Z" fill="#bfb33b"/><ellipse cx="210" cy="158" rx="33" ry="8" fill="#f9f5f1"/><path d="M209 158Q197 92 219 30M206 119L173 90M205 99L240 69M211 67L188 47" fill="none"/><path d="M217 44Q195 15 228 8Q241 29 217 44M211 71Q174 78 173 39Q201 35 211 71M210 94Q218 51 253 55Q253 88 210 94M205 127Q166 123 155 91Q185 76 205 127M208 146Q215 108 251 112Q247 146 208 146" fill="#bfb33b"/><path d="M219 30L223 18M188 47L200 62M240 69L220 85M173 101L193 118M235 123L216 137" fill="none"/><path d="M192 178L198 204M204 179L207 206M219 179L218 206M231 177L227 204" fill="none"/><path d="M283 170Q273 188 278 216H314Q319 189 308 170Z" fill="#f9f5f1"/><path d="M281 170H311V163H281Z" fill="#bfb33b"/><path d="M289 163L285 132L291 132L297 163M298 163L312 116L318 118L305 163" fill="#bfb33b"/><path d="M285 132Q274 112 287 101Q301 116 291 132M312 116L316 100L325 103L318 118" fill="#222"/><path d="M351 218L359 120L397 127L389 219Z" fill="#bfb33b"/><path d="M359 120L364 107L399 114L397 127M357 138L393 145M353 185L389 191M357 195L381 200" fill="none"/><path d="M326 216H416L423 207H331Z" fill="#f9f5f1"/><path d="M397 58Q414 58 414 75Q397 75 397 58Z" fill="#bfb33b"/><path d="M407 70L421 86" fill="none"/></g></svg>'}

function lessonView(){
 const d=course.days[Number(state.current.slice(1))-1];
 if(!d)return '<section class="card"><h2>请选择一节课</h2><button onclick="choose(&quot;D85&quot;)">从构图开始</button></section>';
 return '<article class="teaching"><header class="lesson-heading"><div class="folio">D'+d.id+' · '+esc(course.topics[d.topic].name)+'</div><h2>'+esc(d.title)+'</h2><p>'+esc(d.goal)+'</p><div class="meta"><span>约 '+d.minutes+' 分钟</span><span>可以分几次画完</span></div></header><section><h3>先准备这些</h3><p>'+esc(d.prepare)+'</p></section><section><h3>按顺序做</h3><ol class="drawing-steps">'+d.steps.map(s=>'<li><p>'+esc(s.body)+'</p></li>').join('')+'</ol></section><section class="worked-example"><h3>举个例子</h3><p>'+esc(d.example)+'</p></section><section><h3>做完检查一下</h3><ul class="lesson-checks">'+d.checks.map(c=>'<li>'+esc(c)+'</li>').join('')+'</ul></section><details class="lesson-help"><summary>卡住了，可以这样试</summary><p>'+esc(d.rescue)+'</p></details><section><h3>这次留下什么</h3><p>'+esc(d.output)+'</p>'+practiceButtons()+'</section><section class="feedback-invite"><div><h3>这节课哪里没讲清楚？</h3><p>可以指出具体的一句话，或说说你画到哪一步卡住了。</p></div><button onclick="newFeedback()">反馈这节课</button></section></article>';
}
function courseView(){
 const topic=Math.floor((week-1)/4),current=course.topics[topic];
 return header('选一节课开始画','有想法却不知道怎么摆画面，可以先从“构图”开始。每节课都有步骤、例子和检查方法。')+
 '<div class="course-toolbar"><button class="primary" onclick="choose(&quot;D85&quot;)">从构图开始</button><p>课程编号用于保存进度，不要求每天连续完成。</p></div><div class="course-topics" aria-label="选择练习内容">'+course.topics.map((t,i)=>'<button '+(i===topic?'aria-current="true"':'')+' onclick="week='+(i*4+1)+';render()"><span>'+esc(t.name)+'</span><small>'+esc(t.description)+'</small></button>').join('')+'</div><section class="course-list"><h2>'+esc(current.name)+'</h2><div class="field"><label for="week">这次想练什么</label><select id="week" onchange="week=Number(this.value);render()">'+course.weeks.map((w,i)=>({w,i})).filter(x=>Math.floor(x.i/4)===topic).map(({w,i})=>'<option value="'+(i+1)+'" '+(week===i+1?'selected':'')+'>'+esc(w)+'</option>').join('')+'</select></div>'+course.days.filter(d=>d.week===week).map(d=>'<article class="lesson-row"><div><small>D'+d.id+' · 约 '+d.minutes+' 分钟'+(state.completed.includes('D'+d.id)?' · 已完成':'')+'</small><h3>'+esc(d.title)+'</h3><p>'+esc(d.goal)+'</p></div><button onclick="choose(&quot;D'+d.id+'&quot;)">'+(state.current==='D'+d.id?'继续这节课':'打开课程')+'</button></article>').join('')+'<details class="topic-check"><summary>什么时候可以换一个专题？</summary><p>'+esc(current.standard)+'</p><button onclick="assess('+topic+')">记录我的检查结果</button></details></section>';
}
function practiceButtons(){return '<div class="actions"><button class="primary" onclick="record()">保存练习记录</button><button onclick="upload()">上传这次的画</button><button onclick="complete()">这节课练完了</button></div><p class="micro muted">'+(state.completed.includes(state.current)?'你已经完成过这节课，还可以再画一遍。':'没画完也可以先保存记录，下次接着画。')+'</p>'}
function calendar(){const y=month.getFullYear(),m=month.getMonth(),count=new Date(y,m+1,0).getDate();let h='<div class="calendarhead"><h3>'+y+' 年 '+(m+1)+' 月</h3><div><button aria-label="上个月" onclick="shift(-1)">‹</button><button aria-label="下个月" onclick="shift(1)">›</button></div></div><div class="calendar">'+['一','二','三','四','五','六','日'].map(x=>'<small>'+x+'</small>').join('')+'<span></span>'.repeat((new Date(y,m,1).getDay()+6)%7);for(let i=1;i<=count;i++){const day=y+'-'+String(m+1).padStart(2,'0')+'-'+String(i).padStart(2,'0');h+='<button class="'+(day===date()?'today ':'')+(day===selected?'selected ':'')+(state.sessions.some(s=>s.date===day)?'marked':'')+'" onclick="selected=\''+day+'\';nav(\'calendar\')" aria-label="'+day+'">'+i+'</button>'}return h+'</div>'}
function shift(n){month=new Date(month.getFullYear(),month.getMonth()+n,1);render()}
function render(){const labels={today:'今日练习',course:'选课',calendar:'练习日历',gallery:'我的作品',feedback:'我的反馈',account:'账户与备份'};
$('#app').innerHTML='<div class="shell"><header class="sidebar">'+brand()+'<nav class="nav" aria-label="画室栏目">'+Object.entries(labels).map(([k,v])=>'<button class="'+(page===k?'active':'')+'" '+(page===k?'aria-current="page"':'')+' onclick="nav(\''+k+'\')">'+v+'</button>').join('')+'</nav></header><main class="main"><div class="topbar"><span>绘画练习册 / '+labels[page]+'</span><div><span>记录已保存</span><button class="ghost" onclick="sync()">同步记录</button></div></div><div id="view"></div><footer class="pagefoot"><span>生长之间 · 绘画课程与练习记录</span><span>'+esc(state.username)+' 的绘画练习册</span></footer></main></div>';
let h='';if(page==='today')h='<div class="lesson-layout">'+lessonView()+'<aside class="lesson-sidebar"><section class="card"><h3>你的练习</h3><dl class="practice-counts"><div><dt>有记录的天数</dt><dd>'+new Set(state.sessions.map(s=>s.date)).size+'</dd></div><div><dt>练完的课程</dt><dd>'+state.completed.filter(id=>id.startsWith('D')).length+'</dd></div><div><dt>保存的图片</dt><dd>'+state.art.length+'</dd></div></dl><button onclick="nav(&quot;course&quot;)">换一节课</button></section><section class="card">'+calendar()+'</section></aside></div>';
if(page==='course')h=courseView();
if(page==='feedback')h=feedbackView();
if(page==='calendar')h=header('练习日历','点击日期查看当天记录。保存练习记录后会标记日期，不会自动完成课程。')+'<div class="layout"><section class="card">'+calendar()+'</section><section class="card"><h3>'+selected+'</h3>'+records(state.sessions.filter(s=>s.date===selected))+'</section></div>';
if(page==='gallery')h=header('作品与练习记录','上传草图、过程图或成品，记录修改内容；点击图片可查看原图。','<button class="primary" onclick="upload()">添加作品</button>')+(state.art.length?'<div class="gallery">'+state.art.slice().reverse().map(a=>'<article class="card art"><a href="/api/art/'+a.id+'" target="_blank" rel="noopener"><img loading="lazy" src="/api/art/'+a.id+'" alt="'+esc(a.title)+'"></a><div><small>'+a.lesson+' · '+a.type+'</small><h3>'+esc(a.title)+'</h3><p>'+esc(a.note)+'</p><button class="ghost" onclick="removeArt(\''+a.id+'\')">删除作品</button></div></article>').join('')+'</div>':'<section class="card empty">'+shelfArt()+'<p>还没有上传作品。点击“添加作品”，选择图片并填写课程和作品名称。</p></section>')+'<div class="section-title"><h2>练习记录</h2></div><section class="card">'+records(state.sessions)+'</section>';
if(page==='account')h=header('账户与备份','修改登录账号或密码，下载作品与练习记录的备份。')+'<div class="wide"><section class="card"><h3>下载备份与导入旧记录</h3><p style="margin:16px 0">备份文件包含作品原图、练习记录、课程进度和反馈内容。目前可下载留存，尚不支持在网页中一键恢复完整备份。</p><div class="actions"><a class="buttonlink" href="/api/export" download="drawing-backup.json">下载完整备份</a><button onclick="importOld()">导入旧版练习记录</button></div><p class="micro muted">旧版导入仅合并练习记录和已完成课程，作品请另行上传；旧记录不会被删除。</p></section><section class="card account-section"><h3>账号与密码</h3><div class="account-info"><div><small>当前登录账号</small><p class="account-name">'+esc(state.username)+'</p></div><div class="actions"><button class="primary" onclick="changeAccount()">修改账号与密码</button><button onclick="logout()">退出登录</button></div></div><p class="micro muted">可以单独修改账号或密码。修改后需在各设备重新登录，作品与练习记录会保留。</p></section></div>';
$('#view').innerHTML=h;if(page==='account'){const section=document.createElement('section');section.className='card account-section';section.innerHTML='<h3>反馈连接</h3><p>把反馈发到你指定的私有仓库，并在网页里查看回复。</p><button onclick="feedbackSettings()">设置反馈连接</button>';$('#view .wide').append(section)}}
function records(list){return list.length?list.slice().reverse().map(s=>'<div class="reference"><small>'+s.date+' · '+s.lesson+' · '+s.minutes+' 分钟</small><p>'+esc(s.note||'本次未填写练习说明。')+'</p><button class="ghost micro" onclick="record(\''+esc(s.id)+'\')">编辑记录</button></div>').join(''):'<p class="empty">还没有练习记录。画完后，在“今日练习”里保存一次记录，就会出现在这里。</p>'}
function choose(id){action(async()=>{await mutate({...state,current:id});page='today';week=course.days[Number(id.slice(1))-1]?.week||13;render();window.scrollTo(0,0)})}
function record(id){const old=state.sessions.find(s=>s.id===id),lesson=old?.lesson||state.current,k='studio-draft-'+(id||lesson);let draft;try{draft=JSON.parse(sessionStorage.getItem(k))}catch{}modal('<h2>'+ (old?'编辑记录':'记录本次练习')+'</h2><p>'+lesson+' · 保存后仍保留当前课</p><form id="recordform"><div class="field"><label for="minutes">练习时长（分钟）</label><input id="minutes" type="number" min="1" max="1440" required value="'+(old?.minutes||30)+'"></div><div class="field"><label for="reflection">这次画了什么、改了哪里？下次准备怎样改？</label><textarea id="reflection" maxlength="4000"></textarea></div><button class="primary">保存到练习室</button></form>');$('#reflection').value=draft?.note??old?.note??'';if(draft?.minutes)$('#minutes').value=draft.minutes;$('#recordform').oninput=()=>{try{sessionStorage.setItem(k,JSON.stringify({minutes:$('#minutes').value,note:$('#reflection').value}))}catch{}};$('#recordform').onsubmit=e=>{e.preventDefault();action(async()=>{const item={id:old?.id||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),date:old?.date||date(),lesson,minutes:Number($('#minutes').value),note:$('#reflection').value};await mutate({...state,sessions:old?state.sessions.map(s=>s.id===old.id?item:s):[...state.sessions,item]});try{sessionStorage.removeItem(k)}catch{}$('#modal').close();message('已记录，当前课程保持不变。')})}}
function complete(){const id=state.current,next='D'+Math.min(252,+id.slice(1)+1);modal('<h2>这节课练完了</h2><p>你的完成记录会保留。可以接着画下一课，也可以留在这里重复练。</p><div class="actions">'+(id!=='D252'?'<button class="primary" onclick="finish(&quot;'+next+'&quot;)">记录完成，打开下一课</button>':'')+'<button onclick="finish(&quot;'+id+'&quot;)">记录完成，留在本课</button></div>')}
function finish(next){action(async()=>{await mutate({...state,current:next,completed:[...new Set([...state.completed,state.current])]});$('#modal').close()})}
function assess(i){modal('<h2>检查本专题的完成要求</h2><p>'+esc(course.topics[i].standard)+'</p><label class="check"><input id="passed" type="checkbox">我已用自己的作品检查过，达到上面的要求。</label><button class="primary" id="passbtn">保存自评'+(i<8?'，进入下一专题':'')+'</button>');$('#passbtn').onclick=()=>{if(!$('#passed').checked){$('.formerror').textContent='请先确认已达到上述标准，或关闭窗口继续练习。';return}action(async()=>{await mutate({...state,passed:[...new Set([...state.passed,i])],current:i<8?'D'+((i+1)*28+1):state.current});$('#modal').close();nav('today')})}}
function upload(){modal('<h2>上传作品</h2><form id="artform"><div class="field"><label for="file">图片（JPG / PNG / WebP，最大 10 MB）</label><input id="file" type="file" accept="image/jpeg,image/png,image/webp" required></div><div class="field"><label for="arttitle">作品名称</label><input id="arttitle" maxlength="100" required></div><div class="field"><label for="lessonid">关联课程</label><select id="lessonid">'+course.days.map(d=>'D'+d.id).map(id=>'<option value="'+id+'" '+(id===state.current?'selected':'')+'>'+id+' · '+esc(course.days[Number(id.slice(1))-1].title)+'</option>').join('')+'</select></div><div class="field"><label for="arttype">阶段</label><select id="arttype"><option>草图</option><option>过程图</option><option>成品</option></select></div><div class="field"><label for="artnote">作品说明：改了什么、还想改哪里</label><textarea id="artnote" maxlength="4000"></textarea></div><button class="primary">保存原图</button></form>');$('#artform').onsubmit=e=>{e.preventDefault();action(async()=>{const file=$('#file').files[0];if(file.size>10*1024*1024)throw new Error('请选择 10 MB 以内的图片。');const image=await new Promise((resolve,reject)=>{const r=new FileReader;r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('读取图片失败，请重试。'));r.readAsDataURL(file)});state=await api('/api/art','POST',{revision:state.revision,image,title:$('#arttitle').value,type:$('#arttype').value,lesson:$('#lessonid').value,note:$('#artnote').value});$('#modal').close();nav('gallery');message('原图已保存到服务器。')})}}
function removeArt(id){modal('<h2>删除这份作品？</h2><p>这会从练习室删除图片与对应心得。需要保留时，请先在账户页下载备份。</p><div class="actions"><button onclick="document.querySelector(\'#modal\').close()">保留</button><button id="deleteart">确认删除</button></div>');$('#deleteart').onclick=()=>action(async()=>{state=await api('/api/art/'+id,'DELETE',{revision:state.revision});$('#modal').close();render()})}
function changeAccount(){
 modal('<h2>修改账号与密码</h2><p id="account-help">填写当前密码确认身份。新密码留空时，只修改账号。</p><form id="accountform" aria-describedby="account-help"><div class="field"><label for="accountname">账号</label><input id="accountname" autocomplete="username" value="'+esc(state.username)+'" required minlength="3" maxlength="32" pattern="[A-Za-z0-9][A-Za-z0-9_.\\-]{2,31}" aria-describedby="name-help"><small id="name-help">3–32 位，以字母或数字开头，可包含点、下划线和短横线</small></div><div class="field"><label for="oldpw">当前密码</label><input id="oldpw" type="password" autocomplete="current-password" required maxlength="256"></div><div class="field"><label for="newpw">新密码（选填）</label><input id="newpw" type="password" autocomplete="new-password" minlength="12" maxlength="128" aria-describedby="password-help"><small id="password-help">12–128 位；留空则保留当前密码</small></div><div class="field"><label for="confirmpw">确认新密码</label><input id="confirmpw" type="password" autocomplete="new-password" maxlength="128"></div><button class="primary">保存并重新登录</button></form>');
 $('#accountform').onsubmit=e=>{e.preventDefault();action(async()=>{
  const username=$('#accountname').value.trim(),password=$('#newpw').value;
  if(password!==$('#confirmpw').value)throw new Error('两次输入的新密码不一致，请重新确认。');
  if(username===state.username&&!password)throw new Error('请修改账号或填写新密码后再保存。');
  const result=await api('/api/account','POST',{old:$('#oldpw').value,username,...(password?{password}:{})});
  $('#modal').close();state=null;page='today';login('',result.username,'登录信息已更新，请使用新的账号信息登录。');
 })};
}
function logout(){action(async()=>{await api('/api/logout','POST',{});sessionStorage.clear();state=null;login()})}
function importOld(){modal('<h2>导入旧版练习记录</h2><p>在旧版“成长轨迹”导出 JSON，再选择该文件。会合并记录和已完成课程，当前课不变。</p><form id="importform"><div class="field"><label for="oldfile">旧版导出的 JSON（最大 20 MB）</label><input id="oldfile" type="file" accept=".json,application/json" required></div><button class="primary">合并记录</button></form>');$('#importform').onsubmit=e=>{e.preventDefault();action(async()=>{const f=$('#oldfile').files[0];if(f.size>20*1024*1024)throw new Error('文件超过 20 MB。');let old;try{old=JSON.parse(await f.text())}catch{throw new Error('文件不是有效的 JSON。')}if(!Array.isArray(old.sessions)||!Array.isArray(old.completed))throw new Error('请选择原预览导出的记录文件。');const rows=old.sessions.map((s,i)=>({id:'legacy-'+s.date+'-'+s.day+'-'+i,lesson:'D'+s.day,date:s.date,minutes:s.minutes,note:s.note||''}));const ids=new Set(state.sessions.map(s=>s.id));await mutate({...state,sessions:[...state.sessions,...rows.filter(s=>!ids.has(s.id))],completed:[...new Set([...state.completed,...old.completed.map(d=>'D'+d)])]});$('#modal').close();message('记录已合并；旧版作品请另行上传。')})}}
async function boot(){try{course=await api('/course.json');try{state=await api('/api/state');render()}catch(e){if(e.status===401)login();else throw e}}catch(e){$('#app').innerHTML='<main class="main"><h1>暂时无法打开练习室</h1><p>'+esc(e.message)+'</p><button onclick="boot()">重新连接</button></main>'}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state&&!$('#modal').open&&!busy)sync(true)});boot();
