const $=selector=>document.querySelector(selector);
let currentVideoId='';
let fallbackTimer=null;

function videoIdFromHref(href=''){
  try{
    const url=new URL(href,location.href);
    if(url.hostname==='youtu.be')return url.pathname.split('/').filter(Boolean)[0]||'';
    return url.searchParams.get('v')||'';
  }catch{return''}
}

function ensureButton(){
  const actions=$('.youtube-player-actions');
  if(!actions||$('#youtubePremiumBackground'))return;
  const button=document.createElement('button');
  button.id='youtubePremiumBackground';
  button.type='button';
  button.className='youtube-premium-background';
  button.textContent='🎧 استمر بالخلفية عبر YouTube Premium';
  button.addEventListener('click',openInPremiumApp);
  actions.insertBefore(button,actions.firstChild);
}

function readCurrentVideo(){
  const external=$('#youtubeOpenExternal');
  const id=videoIdFromHref(external?.href||'');
  if(id)currentVideoId=id;
  return currentVideoId;
}

function openInPremiumApp(){
  const id=readCurrentVideo();
  const status=$('#youtubeStatus');
  if(!id){if(status)status.textContent='شغّل فيديو YouTube أولًا ثم استخدم الاستمرار بالخلفية.';return false}
  const appUrl='youtube://watch?v='+encodeURIComponent(id);
  const webUrl='https://www.youtube.com/watch?v='+encodeURIComponent(id);
  if(status)status.textContent='جارٍ فتح نفس الفيديو في تطبيق YouTube للاستمرار بالخلفية مع Premium…';
  clearTimeout(fallbackTimer);
  const started=Date.now();
  location.href=appUrl;
  fallbackTimer=setTimeout(()=>{
    if(document.visibilityState==='visible'&&Date.now()-started<2500)location.href=webUrl;
  },900);
  return true;
}

function sync(){ensureButton();readCurrentVideo()}

function init(){
  sync();
  const observer=new MutationObserver(sync);
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['href','class']});
  window.addEventListener('pageshow',sync);
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
window.AsiriYouTubePremium={openCurrent:openInPremiumApp,getCurrentVideoId:()=>readCurrentVideo()};
