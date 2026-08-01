const STORAGE='asiri-intelligence-core.v01';
const seed={
  projects:[
    {id:'p1',name:'Asiri Music OS',icon:'♫',status:'active',stage:'Web Stable → iOS Native',progress:72,description:'منصة موسيقية ذكية فوق Spotify مع AI DJ ووضع السيارة.'},
    {id:'p2',name:'Asiri Capital',icon:'↗',status:'planning',stage:'Intelligence Core',progress:34,description:'منصة تحليل ومتابعة فرص السوق الأمريكي.'},
    {id:'p3',name:'AGIP',icon:'◆',status:'planning',stage:'Architecture',progress:26,description:'منصة ذكاء المنافسات الحكومية وإدارة دورة الفرصة.'}
  ],
  tasks:[
    {id:'t1',projectId:'p1',title:'إنشاء مشروع تطبيق iOS أصلي',status:'todo',priority:'high',due:'2026-08-10'},
    {id:'t2',projectId:'p1',title:'ربط Spotify App Remote SDK',status:'todo',priority:'high',due:'2026-08-15'},
    {id:'t3',projectId:'p2',title:'تحديد وحدات الذكاء المشتركة',status:'doing',priority:'medium',due:'2026-08-20'},
    {id:'t4',projectId:'p3',title:'توحيد نموذج المشروع والقرار والذاكرة',status:'done',priority:'medium',due:'2026-08-01'}
  ],
  decisions:[
    {id:'d1',projectId:'p1',title:'إيقاف تشغيل Spotify داخل Safari',reason:'استمرار خطأ Device not found وعدم استقرار Web Playback SDK على iPhone.',decision:'اعتماد Spotify الأصلي للتشغيل مؤقتًا وبناء تطبيق iOS Native.',alternatives:'الاستمرار في ترقيع Web Playback أو الاكتفاء بفتح الروابط.',date:'2026-08-02'},
    {id:'d2',projectId:'p1',title:'اعتماد النسخة المرحلية Staging',reason:'منع تعطل النسخة المستقرة أثناء التطوير.',decision:'اختبار كل مرحلة منفصلة قبل الدمج.',alternatives:'التطوير مباشرة على النسخة الأساسية.',date:'2026-08-01'}
  ],
  memories:[
    {id:'m1',projectId:'p1',type:'solution',title:'مسار تشغيل السيارة الموثوق',content:'إنشاء Playlist خاصة في Spotify وفتحها داخل التطبيق الأصلي يجعل أزرار المقود تعمل.',importance:5},
    {id:'m2',projectId:'p1',type:'lesson',title:'قيد Safari على iOS',content:'نجاح تسجيل جهاز Web Playback لا يعني أن Spotify سيقبل أمر التشغيل عليه بصورة مستقرة.',importance:5},
    {id:'m3',projectId:'core',type:'principle',title:'منهجية التطوير المرحلي',content:'لا يتم الانتقال للمرحلة التالية قبل تسليم الإنجاز والاختبارات وموافقة المستخدم.',importance:5}
  ],
  activity:[
    {text:'تم إنشاء Asiri Intelligence Core v0.1',time:'الآن'},
    {text:'تم تسجيل قرار تشغيل Spotify الأصلي',time:'منذ ساعة'},
    {text:'تم تثبيت Asiri Music OS Web',time:'اليوم'}
  ]
};
let data=load();
let taskFilter='all';
let currentType='project';
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
function load(){try{return JSON.parse(localStorage.getItem(STORAGE))||structuredClone(seed)}catch{return structuredClone(seed)}}
function save(){localStorage.setItem(STORAGE,JSON.stringify(data));renderAll()}
function projectName(id){return data.projects.find(p=>p.id===id)?.name||'النواة الرئيسية'}
function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function openPage(name){$$('.page').forEach(p=>p.classList.toggle('active',p.dataset.page===name));$$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===name));const titles={dashboard:'لوحة التحكم',projects:'المشاريع',tasks:'المهام',decisions:'القرارات',memory:'الذاكرة',search:'البحث الموحد'};$('#pageTitle').textContent=titles[name]||'Asiri Intelligence'}
function statusText(s){return({active:'نشط',planning:'تخطيط',paused:'متوقف',todo:'جديدة',doing:'قيد التنفيذ',done:'مكتملة'})[s]||s}
function renderStats(){const active=data.projects.filter(p=>p.status==='active').length;const open=data.tasks.filter(t=>t.status!=='done').length;$('#stats').innerHTML=[['المشاريع النشطة',active],['المهام المفتوحة',open],['القرارات المسجلة',data.decisions.length],['عناصر الذاكرة',data.memories.length]].map(x=>`<article class="stat"><span>${x[0]}</span><strong>${x[1]}</strong></article>`).join('')}
function renderDashboard(){
  $('#dashboardProjects').innerHTML=data.projects.slice(0,3).map(p=>`<div class="list-item"><div><h4>${p.icon} ${p.name}</h4><small>${p.stage}</small><div class="progress"><span style="width:${p.progress}%"></span></div></div><span class="badge">${p.progress}%</span></div>`).join('');
  $('#dashboardTasks').innerHTML=data.tasks.filter(t=>t.status!=='done').slice(0,4).map(t=>`<div class="list-item"><div><h4>${t.title}</h4><small>${projectName(t.projectId)} • ${t.due}</small></div><span class="badge">${statusText(t.status)}</span></div>`).join('');
  $('#dashboardDecisions').innerHTML=data.decisions.slice(0,3).map(d=>`<div class="list-item"><div><h4>${d.title}</h4><small>${projectName(d.projectId)} • ${d.date}</small></div></div>`).join('');
  $('#activityFeed').innerHTML=data.activity.slice(0,6).map(a=>`<div class="activity"><div>${a.text}</div><small>${a.time}</small></div>`).join('')
}
function renderProjects(){$('#projectsGrid').innerHTML=data.projects.map(p=>`<article class="project-card"><div class="icon">${p.icon}</div><h3>${p.name}</h3><span class="badge">${statusText(p.status)}</span><p>${p.description}</p><small class="meta">المرحلة: ${p.stage}</small><div class="progress"><span style="width:${p.progress}%"></span></div><small class="meta">نسبة الإنجاز ${p.progress}%</small></article>`).join('')}
function renderTasks(){const rows=data.tasks.filter(t=>taskFilter==='all'||t.status===taskFilter);$('#tasksList').innerHTML=rows.map(t=>`<article class="list-item"><div><h4>${t.title}</h4><small>${projectName(t.projectId)} • الموعد ${t.due}</small></div><div><span class="badge">${statusText(t.status)}</span> <span class="badge">${t.priority==='high'?'عالية':t.priority==='medium'?'متوسطة':'منخفضة'}</span></div></article>`).join('')||'<div class="panel">لا توجد مهام في هذا التصنيف.</div>'}
function renderDecisions(){$('#decisionsList').innerHTML=data.decisions.map(d=>`<article class="list-item"><div><h4>${d.title}</h4><small>${projectName(d.projectId)} • ${d.date}</small><p><b>القرار:</b> ${d.decision}</p><p><b>السبب:</b> ${d.reason}</p></div></article>`).join('')}
function renderMemory(){$('#memoryGrid').innerHTML=data.memories.map(m=>`<article class="memory-card"><span class="badge">${m.type}</span><h3>${m.title}</h3><p>${m.content}</p><small class="meta">${projectName(m.projectId)} • أهمية ${m.importance}/5</small></article>`).join('')}
function renderAll(){renderStats();renderDashboard();renderProjects();renderTasks();renderDecisions();renderMemory()}
function input(name,label,type='text',options=[]){if(type==='select')return `<div class="field"><label>${label}</label><select name="${name}" required>${options.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></div>`;if(type==='textarea')return `<div class="field"><label>${label}</label><textarea name="${name}" required></textarea></div>`;return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" required></div>`}
function projectOptions(){return data.projects.map(p=>[p.id,p.name])}
function openModal(type){currentType=type;const fields={project:[input('name','اسم المشروع'),input('stage','المرحلة الحالية'),input('description','الوصف','textarea'),input('progress','نسبة الإنجاز','number')],task:[input('title','عنوان المهمة'),input('projectId','المشروع','select',projectOptions()),input('status','الحالة','select',[['todo','جديدة'],['doing','قيد التنفيذ'],['done','مكتملة']]),input('priority','الأولوية','select',[['high','عالية'],['medium','متوسطة'],['low','منخفضة']]),input('due','الموعد','date')],decision:[input('title','عنوان القرار'),input('projectId','المشروع','select',projectOptions()),input('decision','القرار','textarea'),input('reason','السبب','textarea'),input('alternatives','البدائل','textarea')],memory:[input('title','العنوان'),input('projectId','المشروع','select',[...projectOptions(),['core','النواة الرئيسية']]),input('type','النوع','select',[['fact','معلومة'],['solution','حل'],['lesson','درس'],['principle','مبدأ']]),input('content','المحتوى','textarea'),input('importance','الأهمية من 1 إلى 5','number')]};$('#modalTitle').textContent=({project:'مشروع جديد',task:'مهمة جديدة',decision:'قرار جديد',memory:'إضافة للذاكرة'})[type];$('#formFields').innerHTML=fields[type].join('');$('#modal').showModal()}
function addEntity(e){e.preventDefault();const form=new FormData($('#entityForm'));const obj=Object.fromEntries(form.entries());obj.id=currentType[0]+Date.now();if(currentType==='project'){obj.icon='◫';obj.status='active';obj.progress=Math.min(100,Math.max(0,Number(obj.progress)||0));data.projects.unshift(obj)}if(currentType==='task')data.tasks.unshift(obj);if(currentType==='decision'){obj.date=new Date().toISOString().slice(0,10);data.decisions.unshift(obj)}if(currentType==='memory'){obj.importance=Number(obj.importance)||3;data.memories.unshift(obj)}data.activity.unshift({text:`تمت إضافة ${$('#modalTitle').textContent}`,time:'الآن'});save();$('#modal').close();toast('تم الحفظ بنجاح')}
function doSearch(){const q=$('#globalSearch').value.trim().toLowerCase();if(!q){$('#searchResults').innerHTML='';return}const sets=[['مشروع',data.projects,p=>`${p.name} ${p.description} ${p.stage}`],['مهمة',data.tasks,t=>`${t.title} ${projectName(t.projectId)}`],['قرار',data.decisions,d=>`${d.title} ${d.reason} ${d.decision} ${d.alternatives}`],['ذاكرة',data.memories,m=>`${m.title} ${m.content}`]];let rows=[];sets.forEach(([type,items,text])=>items.filter(x=>text(x).toLowerCase().includes(q)).forEach(x=>rows.push({type,title:x.title||x.name,body:x.content||x.decision||x.description||x.reason,project:projectName(x.projectId)})));$('#searchResults').innerHTML=rows.length?rows.map(r=>`<article class="list-item"><div><span class="badge">${r.type}</span><h4>${r.title}</h4><p>${r.body||''}</p><small>${r.project}</small></div></article>`).join(''):'<div class="panel">لا توجد نتائج مطابقة. جرّب كلمات أقصر مثل: Safari أو Spotify أو السيارة.</div>'}
$$('.nav').forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.page)));$$('[data-open]').forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.open)));$$('[data-add]').forEach(b=>b.addEventListener('click',()=>openModal(b.dataset.add)));$('#quickAdd').addEventListener('click',()=>openModal('task'));$$('[data-task-filter]').forEach(b=>b.addEventListener('click',()=>{taskFilter=b.dataset.taskFilter;$$('[data-task-filter]').forEach(x=>x.classList.toggle('active',x===b));renderTasks()}));$('#entityForm').addEventListener('submit',addEntity);$('#searchButton').addEventListener('click',doSearch);$('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter')doSearch()});renderAll();