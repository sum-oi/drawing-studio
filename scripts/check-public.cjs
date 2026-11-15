const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const files=cp.execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
if(!files.length)throw Error('No tracked release files');
const forbidden=/(^|\/)(data|node_modules|backups)\//;
for(const name of files){
 if(forbidden.test(name)||/\.(zip|sqlite|db|log|pid)$/.test(name)||/(^|\/)\.env$/.test(name))throw Error('Private artifact tracked: '+name);
 const text=fs.readFileSync(path.resolve(name),'utf8');
 if(/\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bdckr_pat_[A-Za-z0-9_-]{16,}/.test(text))throw Error('Possible credential in '+name);
}
const course=JSON.parse(fs.readFileSync('public/course.json')),lessons=JSON.parse(fs.readFileSync('public/lessons.json'));
if(course.days.length!==252||new Set(course.days.map(d=>d.id)).size!==252||course.weeks.length!==36||course.topics.length!==9||lessons.length!==4)throw Error('Invalid course structure');
for(const [i,d] of course.days.entries()){
 if(d.id!==i+1||d.week!==Math.floor(i/7)+1||d.topic!==Math.floor(i/28))throw Error('Changed course ID mapping: '+d.id);
 for(const key of ['title','goal','prepare','example','rescue','output'])if(typeof d[key]!=='string'||!d[key].trim())throw Error('Missing '+key+' for D'+d.id);
 if(![30,45,60].includes(d.minutes)||!Array.isArray(d.steps)||d.steps.length<3||d.steps.length>5||!d.steps.every(s=>s.title?.trim()&&s.body?.trim())||d.checks?.length!==2||!d.checks.every(s=>typeof s==='string'&&s.trim()))throw Error('Incomplete teaching for D'+d.id);
}
if(new Set(course.days.map(d=>d.example)).size!==252)throw Error('Repeated lesson examples');
console.log('PASS: '+files.length+' tracked public files; curriculum structure intact.');
