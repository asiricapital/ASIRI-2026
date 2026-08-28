import {getYoutubeToken,isYoutubeSignedIn} from './youtube-auth.js?v=20260829-oauth-v1';

const $=selector=>document.querySelector(selector);
const CACHE_KEY='asiri-music.youtube.library.v1';
let state={liked:[],playlists:[],subscriptions:[],syncedAt:0,busy:false};

function api(path,params={}){
  const token=getYoutubeToken();
  if(!token?.access_token)throw new Error('YOUTUBE_SIGN_IN_REQUIRED');
  const query=new URLSearchParams(params);
  return fetch('https://www.googleapis.com/youtube/v3/'+path+'?'+query,{headers:{Authorization:'Bearer '+token.access_token}}).then(async response=>{
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.error?.message||'YOUTUBE_LIBRARY_FAILED');
    return data;
  });
}

function readCache(){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'null')}catch{return null}}
function writeCache(value){localStorage.setItem(CACHE_KEY,JSON.stringify(value))}
function thumb(snippet){return snippet?.thumbnails?.medium?.url||snippet?.thumbnails?.default?.url||''}

async function fetchLiked(){
  const data=await api('videos',{part:'snippet,contentDetails',myRating:'like',maxResults:'25'});
  return (data.items||[]).map(item=>({id:item.id,title:item.snippet?.title||'YouTube',channel:item.snippet?.channelTitle||'',thumbnail:thumb(item.snippet)}));
}

async function fetchPlaylists(){
  const data=await api('playlists',{part:'snippet,contentDetails',mine:'true',maxResults:'25'});
  return (data.items||[]).map(item=>({id:item.id,title:item.snippet?.title||'قائمة YouTube',count:Number(item.contentDetails?.itemCount||0),thumbnail:thumb(item.snippet)}));
}

async function fetchSubscriptions(){
  const data=await api('subscriptions',{part:'snippet',mine:'true',maxResults:'25',order:'relevance'});
  return (data.items||[]).map(item=>({id:item.snippet?.resourceId?.channelId||item.id,title:item.snippet?.title||'قناة YouTube',thumbnail:thumb(item.snippet)}));
}

function inject(){
  if($('#youtubeLibraryPanel'))return;
  const page=document.querySelector('[data-os-page="library"]');
  if(!page)return;
  const panel=document.createElement('section');
  panel.id='youtubeLibraryPanel';panel.className='os-panel youtube-library-panel';
  panel.innerHTML=`<div class="os-panel-head"><div><span class="eyebrow">UNIFIED LIBRARY • YOUTUBE</span><h3>مكتبة YouTube داخل ASIRI</h3><span class="muted">الإعجابات والقوائم والقنوات التي تتابعها من حساب YouTube المتصل.</span></div><button id="youtubeLibrarySync" class="library-sync" type="button">↻ مزامنة YouTube</button></div><p id="youtubeLibraryStatus" class="library-status" aria-live="polite"></p><div class="youtube-library-tabs"><button type="button" data-youtube-library-tab="liked" class="is-active">♥ أعجبتني <b id="youtubeLikedCount">0</b></button><button type="button" data-youtube-library-tab="playlists">☷ القوائم <b id="youtubePlaylistCount">0</b></button><button type="button" data-youtube-library-tab="subscriptions">▶ القنوات <b id="youtubeSubscriptionCount">0</b></button></div><div id="youtubeLibraryContent" class="youtube-library-grid"></div>`;
  const overview=page.querySelector('.library-overview');
  const spotifyPanel=page.querySelector('.os-panel');
  if(spotifyPanel?.parentNode)spotifyPanel.parentNode.insertBefore(panel,spotifyPanel);
  else if(overview)overview.after(panel);else page.appendChild(panel);
}

function setStatus(text){const node=$('#youtubeLibraryStatus');if(node)node.textContent=text||''}
function activeTab(){return document.querySelector('[data-youtube-library-tab].is-active')?.dataset.youtubeLibraryTab||'liked'}
function render(){
  $('#youtubeLikedCount')&&($('#youtubeLikedCount').textContent=String(state.liked.length));
  $('#youtubePlaylistCount')&&($('#youtubePlaylistCount').textContent=String(state.playlists.length));
  $('#youtubeSubscriptionCount')&&($('#youtubeSubscriptionCount').textContent=String(state.subscriptions.length));
  const root=$('#youtubeLibraryContent');if(!root)return;root.replaceChildren();
  const tab=activeTab(),items=state[tab]||[];
  if(!items.length){const empty=document.createElement('div');empty.className='os-empty youtube-library-empty';empty.textContent=isYoutubeSignedIn()?'لا توجد عناصر في هذا القسم حاليًا.':'سجّل الدخول إلى YouTube أولًا من تبويب YouTube.';root.appendChild(empty);return}
  items.forEach(item=>{
    const card=document.createElement('article');card.className='youtube-library-item';
    const image=document.createElement('img');image.alt='';image.loading='lazy';image.src=item.thumbnail||'';
    const copy=document.createElement('div'),title=document.createElement('strong'),meta=document.createElement('span');title.textContent=item.title;
    meta.textContent=tab==='liked'?(item.channel||'YouTube'):tab==='playlists'?`${item.count||0} فيديو`:'قناة YouTube';copy.append(title,meta);
    const action=document.createElement('button');action.type='button';
    if(tab==='liked'){
      action.textContent='▶ تشغيل داخل ASIRI';
      action.addEventListener('click',()=>{window.AsiriYouTubeHub?.playVideo?.(item.id,item.title);window.AsiriMusicOS?.openPage?.('youtube')});
    }else if(tab==='playlists'){
      action.textContent='فتح القائمة';
      action.addEventListener('click',()=>window.open('https://www.youtube.com/playlist?list='+encodeURIComponent(item.id),'_blank','noopener'));
    }else{
      action.textContent='فتح القناة';
      action.addEventListener('click',()=>window.open('https://www.youtube.com/channel/'+encodeURIComponent(item.id),'_blank','noopener'));
    }
    card.append(image,copy,action);root.appendChild(card);
  });
}

async function sync({silent=false}={}){
  if(state.busy)return false;
  if(!isYoutubeSignedIn()){setStatus('سجّل الدخول إلى YouTube أولًا من تبويب YouTube.');render();return false}
  state.busy=true;const button=$('#youtubeLibrarySync');if(button)button.disabled=true;if(!silent)setStatus('جارٍ مزامنة مكتبة YouTube…');
  try{
    const [liked,playlists,subscriptions]=await Promise.all([fetchLiked(),fetchPlaylists(),fetchSubscriptions()]);
    state={liked,playlists,subscriptions,syncedAt:Date.now(),busy:false};writeCache(state);render();
    setStatus(`تم الدمج — ${liked.length} إعجاب، ${playlists.length} قائمة، ${subscriptions.length} قناة.`);
    window.dispatchEvent(new CustomEvent('asiri:youtube-library-updated',{detail:state}));return true;
  }catch(error){console.error('[YouTube Library]',error);setStatus(error.message||'تعذر مزامنة مكتبة YouTube الآن.');return false}
  finally{state.busy=false;if(button)button.disabled=false}
}

function wire(){
  $('#youtubeLibrarySync')?.addEventListener('click',()=>sync());
  document.querySelectorAll('[data-youtube-library-tab]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-youtube-library-tab]').forEach(item=>item.classList.toggle('is-active',item===button));render()}));
  window.addEventListener('asiri:youtube-auth-changed',()=>sync({silent:true}));
}
function init(){inject();const cached=readCache();if(cached)state={...state,...cached,busy:false};wire();render();if(isYoutubeSignedIn())sync({silent:true})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
window.AsiriYouTubeLibrary={sync,getState:()=>({...state})};
