const TASTE_KEY='asiri_taste_profile_v1';
const $=s=>document.querySelector(s);

function loadTaste(){
  try{return JSON.parse(localStorage.getItem(TASTE_KEY)||'{"tracks":{},"artists":{},"events":[]}')}
  catch{return{tracks:{},artists:{},events:[]}}
}
function saveTaste(data){localStorage.setItem(TASTE_KEY,JSON.stringify(data))}
function trackIdFromCard(card){
  const href=card.querySelector('.open-spotify')?.href||'';
  return href.match(/track\/([^?/#]+)/)?.[1]||`${card.querySelector('.track-name')?.textContent||''}::${card.querySelector('.track-artist')?.textContent||''}`;
}
function trackFromCard(card){
  return{
    id:trackIdFromCard(card),
    name:card.querySelector('.track-name')?.textContent?.trim()||'أغنية',
    artist:card.querySelector('.track-artist')?.textContent?.trim()||'فنان غير معروف',
    album:card.querySelector('.track-album')?.textContent?.trim()||'',
    cover:card.querySelector('.track-cover')?.src||'',
    url:card.querySelector('.open-spotify')?.href||''
  }
}
function recordPreference(track,value){
  const data=loadTaste();
  data.tracks[track.id]={...track,value,updatedAt:Date.now()};
  const artists=track.artist.split('،').map(x=>x.trim()).filter(Boolean);
  artists.forEach(name=>{
    const current=data.artists[name]||{likes:0,dislikes:0,score:0};
    if(value==='like'){current.likes+=1;current.score+=2}else{current.dislikes+=1;current.score-=2}
    data.artists[name]=current;
  });
  data.events.unshift({type:value,trackId:track.id,artist:track.artist,at:Date.now()});
  data.events=data.events.slice(0,300);
  saveTaste(data);
  renderTasteDashboard();
  syncButtons();
}
function currentValue(id){return loadTaste().tracks[id]?.value||''}

function enhanceCard(card){
  if(card.dataset.tasteReady)return;
  card.dataset.tasteReady='1';
  const actions=card.querySelector('.track-actions');
  if(!actions)return;
  const wrap=document.createElement('div');wrap.className='taste-actions';
  const like=document.createElement('button');like.type='button';like.className='taste-like';like.textContent='👍 أعجبتني';
  const dislike=document.createElement('button');dislike.type='button';dislike.className='taste-dislike';dislike.textContent='👎 لا تناسبني';
  like.onclick=()=>recordPreference(trackFromCard(card),'like');
  dislike.onclick=()=>recordPreference(trackFromCard(card),'dislike');
  wrap.append(like,dislike);actions.appendChild(wrap);
}
function syncButtons(){
  document.querySelectorAll('.track-card').forEach(card=>{
    const value=currentValue(trackIdFromCard(card));
    card.querySelector('.taste-like')?.classList.toggle('active',value==='like');
    card.querySelector('.taste-dislike')?.classList.toggle('active',value==='dislike');
  })
}
function topArtists(data){
  return Object.entries(data.artists).sort((a,b)=>b[1].score-a[1].score).filter(([,v])=>v.score>0).slice(0,5)
}
function renderTasteDashboard(){
  const data=loadTaste();
  const liked=Object.values(data.tracks).filter(x=>x.value==='like');
  const disliked=Object.values(data.tracks).filter(x=>x.value==='dislike');
  const top=topArtists(data);
  const likedCount=$('#tasteLikedCount'),dislikedCount=$('#tasteDislikedCount'),learnedCount=$('#tasteLearnedCount'),artistList=$('#tasteArtists'),message=$('#tasteMessage');
  if(likedCount)likedCount.textContent=liked.length;
  if(dislikedCount)dislikedCount.textContent=disliked.length;
  if(learnedCount)learnedCount.textContent=Object.keys(data.artists).length;
  if(artistList){
    artistList.innerHTML=top.length?top.map(([name,v])=>`<span>${name}<b>${v.score}</b></span>`).join(''):'<em>ابدأ بالضغط على «أعجبتني» ليكتشف التطبيق ذوقك.</em>';
  }
  if(message){
    message.textContent=liked.length>=5?'بدأ Asiri Music يفهم ذوقك وسيستخدمه في الجلسات القادمة.':`نحتاج ${Math.max(0,5-liked.length)} إعجابات إضافية لبناء ملف ذوق أولي.`;
  }
}
function injectDashboard(){
  if($('#tasteProfile'))return;
  const home=$('#homeView');const stats=home?.querySelector('.stats-grid');if(!home||!stats)return;
  const section=document.createElement('section');section.id='tasteProfile';section.className='taste-profile';
  section.innerHTML=`<div class="taste-head"><div><p class="eyebrow">Asiri Taste Engine</p><h2>ذوق أحمد الموسيقي</h2></div><span class="taste-live">يتعلم الآن</span></div><p id="tasteMessage" class="muted"></p><div class="taste-metrics"><article><span>أعجبتني</span><strong id="tasteLikedCount">0</strong></article><article><span>لا تناسبني</span><strong id="tasteDislikedCount">0</strong></article><article><span>فنانون تعلّمهم</span><strong id="tasteLearnedCount">0</strong></article></div><div class="taste-artists"><h3>أقرب الفنانين لذوقك</h3><div id="tasteArtists"></div></div>`;
  stats.before(section);
}

const style=document.createElement('style');
style.textContent=`.taste-profile{margin:22px 0;padding:21px;border-radius:26px;border:1px solid #2d4735;background:linear-gradient(145deg,#17281d,#101411);box-shadow:0 22px 60px rgba(0,0,0,.25)}.taste-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.taste-live{font-size:11px;font-weight:900;color:#061009;background:#1ed760;border-radius:999px;padding:7px 10px}.taste-profile>.muted{margin-top:10px}.taste-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:16px}.taste-metrics article{background:rgba(255,255,255,.045);border:1px solid #2a352d;border-radius:17px;padding:13px}.taste-metrics span{display:block;color:#96a198;font-size:11px}.taste-metrics strong{display:block;margin-top:6px;font-size:24px}.taste-artists{margin-top:17px}.taste-artists h3{font-size:14px;margin:0 0 9px}.taste-artists div{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}.taste-artists div span{flex:0 0 auto;border:1px solid #334039;border-radius:999px;padding:9px 12px;background:#151a16}.taste-artists b{color:#1ed760;margin-right:7px}.taste-artists em{color:#8e978f;font-style:normal;font-size:13px}.taste-actions{display:flex;gap:7px;width:100%}.taste-actions button{border:1px solid #39433c;background:transparent;color:#fff;border-radius:999px;padding:9px 12px;font-size:12px;cursor:pointer}.taste-like.active{border-color:#1ed760;color:#1ed760;background:rgba(30,215,96,.09)}.taste-dislike.active{border-color:#ff7070;color:#ff8d8d;background:rgba(255,85,85,.08)}@media(max-width:520px){.taste-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.taste-metrics article{padding:11px}.taste-metrics strong{font-size:21px}}`;
document.head.appendChild(style);

injectDashboard();
document.querySelectorAll('.track-card').forEach(enhanceCard);syncButtons();renderTasteDashboard();
const observer=new MutationObserver(()=>{document.querySelectorAll('.track-card').forEach(enhanceCard);syncButtons()});
observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('storage',renderTasteDashboard);
