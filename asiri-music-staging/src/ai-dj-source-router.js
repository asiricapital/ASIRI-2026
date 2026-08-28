import {hasYoutubeSearchKey,prefersYoutube,searchYouTubeVideos} from './youtube-search-provider.js?v=20260829-unified-v1';

const $=selector=>document.querySelector(selector);
let busy=false;

async function routePrompt(prompt,{event}={}){
  const clean=String(prompt||'').trim();
  if(!clean||!prefersYoutube(clean)||!hasYoutubeSearchKey()||busy)return false;
  event?.preventDefault?.();event?.stopImmediatePropagation?.();
  busy=true;
  const status=$('#aiDjStatus');
  if(status)status.textContent='ASIRI DJ اختار YouTube لهذا الطلب لأنه أقرب للحفلات والجلسات والفيديو…';
  try{
    const videos=await searchYouTubeVideos(clean,{maxResults:10});
    if(!videos.length){if(status)status.textContent='لم أجد فيديو مناسبًا؛ سأبقي Spotify متاحًا للبحث اليدوي.';return true}
    const best=videos[0];
    window.AsiriMusicOS?.openPage?.('youtube');
    setTimeout(()=>window.AsiriYouTubeHub?.playVideo?.(best.id,best.title),80);
    if(status)status.textContent='اختار ASIRI DJ YouTube: '+best.title;
    window.dispatchEvent(new CustomEvent('asiri:ai-dj-source-selected',{detail:{source:'youtube',prompt:clean,item:best,candidates:videos}}));
    return true;
  }catch(error){
    console.warn('[AI DJ Source Router]',error);
    if(status)status.textContent='تعذر الوصول إلى YouTube الآن؛ استخدم Spotify أو تحقق من ربط YouTube Search.';
    return true;
  }finally{busy=false}
}

function init(){
  $('#aiDjGenerate')?.addEventListener('click',event=>routePrompt($('#aiDjPrompt')?.value,{event}),true);
  document.querySelectorAll('[data-ai-preset]').forEach(button=>button.addEventListener('click',event=>{
    const prompt=button.dataset.aiPreset||'';
    if(prefersYoutube(prompt)&&hasYoutubeSearchKey()){
      event.preventDefault();event.stopImmediatePropagation();
      if($('#aiDjPrompt'))$('#aiDjPrompt').value=prompt;
      routePrompt(prompt);
    }
  },true));
  window.addEventListener('asiri:ai-dj-prompt',event=>{
    const prompt=event.detail?.prompt||'';
    if(prefersYoutube(prompt)&&hasYoutubeSearchKey()){
      event.stopImmediatePropagation();
      routePrompt(prompt);
    }
  },true);
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
window.AsiriMediaRouter={routePrompt,prefersYoutube};
