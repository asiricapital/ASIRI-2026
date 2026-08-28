import {QUICK_MOMENTS,momentForHour,personalizeMomentPrompt} from './moment-core.js?v=20260808-moment-v1';
import './home-intelligence.js?v=20260828-v1';
import './youtube-hub.js?v=20260829-youtube-v1';
import './youtube-library.js?v=20260829-v1';
import './ai-dj-source-router.js?v=20260829-unified-v1';

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

function favoriteTasteArtist(taste){
  return Object.entries(taste?.artists||{})
    .filter(([,value])=>(Number(value?.score)||0)>0)
    .sort((a,b)=>(Number(b[1]?.score)||0)-(Number(a[1]?.score)||0))[0]?.[0]||'';
}

function renderMoment(){
  const card=$('#asiriMoment');
  if(!card)return;
  const moment=momentForHour();
  const taste=readTaste();
  const favorite=favoriteTasteArtist(taste);
  const prompt=personalizeMomentPrompt(moment.prompt,favorite);
  card.dataset.moment=moment.id;
  $('#osMomentEmoji').textContent=moment.emoji;
  $('#osMomentEyebrow').textContent=moment.eyebrow;
  $('#osMomentTitle').textContent=moment.title;
  $('#osMomentDescription').textContent=moment.description+(favorite?' • بلمسة من '+favorite:'');
  $('#osMomentPrimary').dataset.momentPrompt=prompt;
  try{$('#osMomentClock').textContent=new Intl.DateTimeFormat('ar-SA',{hour:'numeric',minute:'2-digit'}).format(new Date())}
  catch{$('#osMomentClock').textContent='الآن'}
}

function launchMoment(prompt,{personalize=true}={}){
  const clean=String(prompt||'').trim();
  if(!clean)return;
  const favorite=personalize?favoriteTasteArtist(readTaste()):'';
  const personalized=personalizeMomentPrompt(clean,favorite);
  const input=$('#aiDjPrompt');
  if(input)input.value=personalized;
  window.AsiriPendingDjPrompt=personalized;
  openPage('sessions');
  requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('asiri:ai-dj-prompt',{detail:{prompt:personalized,source:'asiri-moment'}})));
}

function initMoment(){
  renderMoment();
  $('#osMomentPrimary')?.addEventListener('click',event=>launchMoment(event.currentTarget.dataset.momentPrompt,{personalize:false}));
  $$('#asiriMoment [data-quick-moment]').forEach((button,index)=>{
    const preset=QUICK_MOMENTS[index];
    if(preset)button.dataset.momentPrompt=preset.prompt;
    button.addEventListener('click',()=>launchMoment(button.dataset.momentPrompt));
  });
}

function refreshHome(){
  const taste=readTaste();
  const tracks=Object.values(taste.tracks||{});
  const likes=tracks.filter(x=>x.value==='like').length;
  const artists=Object.values(taste.artists||{}).filter(x=>(x.score||0)>0).length;
  const session=readEnvelope('aiDj.lastSession');
  renderMoment();
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
  initMoment();
  observeDynamicModules();
  refreshHome();
  window.addEventListener('asiri:taste-updated',refreshHome);
  window.addEventListener('storage',refreshHome);
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
window.AsiriMusicOS={openPage,refreshHome};
