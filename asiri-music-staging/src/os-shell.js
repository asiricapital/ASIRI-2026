import './native-playback.js?v=20260801-2305';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const STORAGE_KEY='asiri-music-os.activePage';

function greeting(){
  const h=new Date().getHours();
  if(h<5)return 'مساء الخير أحمد';
  if(h<12)return 'صباح الخير أحمد';
  if(h<18)return 'مساء الخير أحمد';
  return 'مساء الخير أحمد';
}

function readTaste(){
  try{return JSON.parse(localStorage.getItem('asiri-music-pro.v1.taste.profile')||'{"tracks":{},"artists":{}}')}
  catch{return{tracks:{},artists:{}}}
}

function readEnvelope(key){
  try{return JSON.parse(localStorage.getItem('asiri-music-pro.v1.'+key)||'null')?.value??null}catch{return null}
}

function refreshHome(){
  const taste=readTaste();
  const tracks=Object.values(taste.tracks||{});
  const likes=tracks.filter(x=>x.value==='like').length;
  const artists=Object.values(taste.artists||{}).filter(x=>(x.score||0)>0).length;
  const session=readEnvelope('aiDj.lastSession');
  $('#osGreeting').textContent=greeting();
  $('#osLikeCount').textContent=String(likes);
  $('#osArtistCount').textContent=String(artists);
  $('#osSessionCount').textContent=session?.tracks?.length?String(session.tracks.length):'0';
  const last=$('#osLastSession');
  if(session?.tracks?.length){
    last.innerHTML=`<strong>${session.prompt||'آخر جلسة ذكية'}</strong><span>${session.tracks.length} أغنية محفوظة</span>`;
    last.onclick=()=>openPage('sessions');
  }else{
    last.innerHTML='<strong>لا توجد جلسة محفوظة</strong><span>أنشئ أول جلسة من AI DJ</span>';
    last.onclick=()=>openPage('sessions');
  }
}

function moveExistingModules(){
  const map=[
    ['healthCard','homeMount'],['profileCard','homeMount'],['tasteDashboard','homeMount'],
    ['aiDjCard','sessionsMount'],['searchModule','searchMount'],['resultsModule','searchMount']
  ];
  map.forEach(([id,mountId])=>{
    const node=document.getElementById(id),mount=document.getElementById(mountId);
    if(node&&mount&&!mount.contains(node)){node.dataset.osMoved='1';mount.appendChild(node)}
  });
  $$('.car-connect-card,.car-native-card').forEach(node=>{
    const mount=$('#carMount');if(mount&&!mount.contains(node)){node.dataset.osMoved='1';mount.appendChild(node)}
  });
}

function openPage(name,{save=true}={}){
  const target=document.querySelector(`[data-os-page="${name}"]`)?name:'home';
  $$('.os-page').forEach(page=>page.classList.toggle('is-active',page.dataset.osPage===target));
  $$('.os-nav-button').forEach(button=>button.classList.toggle('is-active',button.dataset.osTarget===target));
  if(save)localStorage.setItem(STORAGE_KEY,target);
  if(target==='home')refreshHome();
  if(target==='car')setTimeout(moveExistingModules,50);
  window.scrollTo({top:0,behavior:'smooth'});
}

function initNavigation(){
  $$('.os-nav-button,[data-open-page]').forEach(button=>button.addEventListener('click',()=>openPage(button.dataset.osTarget||button.dataset.openPage)));
  openPage(localStorage.getItem(STORAGE_KEY)||'home',{save:false});
}

function observeDynamicModules(){
  const observer=new MutationObserver(()=>moveExistingModules());
  observer.observe(document.body,{childList:true,subtree:true});
}

function init(){
  moveExistingModules();
  initNavigation();
  observeDynamicModules();
  refreshHome();
  window.addEventListener('asiri:taste-updated',refreshHome);
  window.addEventListener('storage',refreshHome);
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
window.AsiriMusicOS={openPage,refreshHome};
