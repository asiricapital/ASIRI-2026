import {rememberYoutube,youtubeEmbedUrl,youtubeSearchUrl,youtubeVideoId,youtubeWatchUrl} from './youtube-core.js?v=20260829-youtube-v1';

const HISTORY_KEY='asiri-music.youtube.history.v1';
const $=selector=>document.querySelector(selector);

function ensureStyle(){
  if(document.querySelector('link[data-asiri-youtube-style]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='youtube-hub.css?v=20260829-youtube-v1';link.dataset.asiriYoutubeStyle='1';
  document.head.appendChild(link);
}

function readHistory(){
  try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{return[]}
}
function writeHistory(items){localStorage.setItem(HISTORY_KEY,JSON.stringify(items))}

function injectPage(){
  if($('[data-os-page="youtube"]'))return;
  const main=$('main.shell');
  const nav=$('.os-bottom-nav');
  if(!main||!nav)return;
  const page=document.createElement('section');
  page.className='os-page youtube-hub-page';
  page.dataset.osPage='youtube';
  page.innerHTML=`
    <div class="os-section-title"><div><h2>YouTube داخل Asiri</h2><p>شغّل الفيديوهات والحفلات والجلسات من YouTube داخل هوية Asiri Music.</p></div><span>▶</span></div>
    <section class="youtube-hub-card">
      <div class="youtube-hub-head"><div><span class="eyebrow">ASIRI MEDIA SOURCES</span><h3>Spotify + YouTube</h3><p>Spotify يبقى محرك الصوت الأساسي، وYouTube يضيف الفيديو والحفلات والمحتوى النادر.</p></div><b>YOUTUBE</b></div>
      <div class="youtube-url-row"><input id="youtubeUrlInput" type="url" inputmode="url" autocomplete="off" placeholder="الصق رابط YouTube هنا"><button id="youtubePlayButton" type="button">▶ تشغيل داخل Asiri</button></div>
      <p id="youtubeStatus" class="youtube-status" aria-live="polite">يدعم روابط watch وyoutu.be وShorts وLive.</p>
      <div id="youtubePlayerShell" class="youtube-player-shell hidden"><iframe id="youtubeFrame" title="YouTube داخل Asiri Music" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><div class="youtube-player-actions"><a id="youtubeOpenExternal" target="_blank" rel="noopener">فتح الفيديو في YouTube</a><button id="youtubeClosePlayer" type="button">إغلاق الفيديو</button></div></div>
    </section>
    <section class="youtube-hub-card">
      <div class="youtube-hub-head"><div><span class="eyebrow">YOUTUBE DISCOVERY</span><h3>ابحث عن حفلة أو جلسة</h3><p>اكتب ما تريد، ثم افتح نتائج YouTube الرسمية واختر الفيديو الذي تريد تشغيله داخل Asiri.</p></div></div>
      <form id="youtubeSearchForm" class="youtube-search-row"><input id="youtubeSearchInput" type="search" autocomplete="off" placeholder="مثال: محمد عبده حفلة لندن"><button type="submit">⌕ بحث في YouTube</button></form>
      <div class="youtube-presets"><button type="button" data-youtube-query="محمد عبده حفلات كاملة">محمد عبده • حفلات</button><button type="button" data-youtube-query="راشد الماجد جلسات">راشد الماجد • جلسات</button><button type="button" data-youtube-query="عبادي الجوهر عود جلسة">عبادي الجوهر • عود</button><button type="button" data-youtube-query="طرب سعودي حفلات قديمة">طرب سعودي قديم</button></div>
    </section>
    <section class="youtube-hub-card"><div class="youtube-hub-head"><div><span class="eyebrow">RECENT YOUTUBE</span><h3>شاهدت مؤخرًا</h3></div><button id="youtubeClearHistory" type="button" class="youtube-clear">مسح</button></div><div id="youtubeHistory" class="youtube-history"></div><div id="youtubeHistoryEmpty" class="youtube-empty">ستظهر هنا فيديوهات YouTube التي شغّلتها داخل Asiri.</div></section>`;
  main.appendChild(page);
  const button=document.createElement('button');
  button.className='os-nav-button';button.dataset.osTarget='youtube';button.innerHTML='<b>▶</b>YouTube';
  nav.insertBefore(button,nav.querySelector('[data-os-target="settings"]')||null);
  const quickGrid=$('.os-quick-grid');
  if(quickGrid&&!quickGrid.querySelector('[data-open-page="youtube"]')){
    const quick=document.createElement('button');quick.className='os-quick';quick.dataset.openPage='youtube';quick.innerHTML='<span>▶</span>YouTube';quickGrid.appendChild(quick);
  }
}

function renderHistory(){
  const root=$('#youtubeHistory'),empty=$('#youtubeHistoryEmpty');
  if(!root)return;
  const items=readHistory();root.replaceChildren();
  if(empty)empty.classList.toggle('hidden',items.length>0);
  items.forEach(item=>{
    const button=document.createElement('button');button.type='button';button.className='youtube-history-item';
    const thumb=document.createElement('img');thumb.src=`https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;thumb.alt='';thumb.loading='lazy';
    const copy=document.createElement('span');const title=document.createElement('strong');title.textContent=item.title||'فيديو YouTube';const meta=document.createElement('small');meta.textContent='▶ YouTube';copy.append(title,meta);button.append(thumb,copy);
    button.addEventListener('click',()=>playVideo(item.id,item.title));root.appendChild(button);
  });
}

function playVideo(input,title='فيديو YouTube'){
  const id=youtubeVideoId(input);const embed=youtubeEmbedUrl(id,{autoplay:true});
  if(!id||!embed){$('#youtubeStatus').textContent='الرابط غير صالح. الصق رابط فيديو YouTube مباشرًا.';return false}
  const frame=$('#youtubeFrame'),shell=$('#youtubePlayerShell'),external=$('#youtubeOpenExternal');
  frame.src=embed;shell.classList.remove('hidden');external.href=youtubeWatchUrl(id);
  $('#youtubeStatus').textContent='يعمل الفيديو الآن داخل Asiri Music عبر مشغل YouTube الرسمي.';
  writeHistory(rememberYoutube(readHistory(),{id,title,playedAt:Date.now()}));renderHistory();
  shell.scrollIntoView({behavior:'smooth',block:'center'});return true;
}

function openSearch(query){
  const url=youtubeSearchUrl(query);if(!url)return;
  window.open(url,'_blank','noopener');
  $('#youtubeStatus').textContent='اختر الفيديو من نتائج YouTube، ثم انسخ رابطه والصقه هنا لتشغيله داخل Asiri.';
}

function wire(){
  $('#youtubePlayButton')?.addEventListener('click',()=>playVideo($('#youtubeUrlInput')?.value));
  $('#youtubeUrlInput')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();playVideo(event.currentTarget.value)}});
  $('#youtubeClosePlayer')?.addEventListener('click',()=>{$('#youtubeFrame').src='';$('#youtubePlayerShell').classList.add('hidden')});
  $('#youtubeSearchForm')?.addEventListener('submit',event=>{event.preventDefault();openSearch($('#youtubeSearchInput')?.value)});
  document.querySelectorAll('[data-youtube-query]').forEach(button=>button.addEventListener('click',()=>openSearch(button.dataset.youtubeQuery)));
  $('#youtubeClearHistory')?.addEventListener('click',()=>{writeHistory([]);renderHistory()});
  document.querySelectorAll('.os-nav-button,[data-open-page]').forEach(button=>{
    if(button.dataset.youtubeWired)return;button.dataset.youtubeWired='1';
    button.addEventListener('click',()=>window.AsiriMusicOS?.openPage?.(button.dataset.osTarget||button.dataset.openPage));
  });
}

function init(){ensureStyle();injectPage();wire();renderHistory()}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
window.AsiriYouTubeHub={playVideo,youtubeVideoId};
