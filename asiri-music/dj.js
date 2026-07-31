const $ = selector => document.querySelector(selector);
const form = $('#aiDjForm');
const input = $('#aiDjInput');
const button = $('#aiDjButton');
const response = $('#aiDjResponse');
const title = $('#aiDjTitle');
const message = $('#aiDjMessage');
const CLIENT_ID = '3ac122f971744e508bfd33ad0637d421';
let currentSession = [];
let currentSessionName = '';

const style = document.createElement('style');
style.textContent = `
.ai-dj-card{position:relative;overflow:hidden;margin:22px 0;padding:22px;border:1px solid rgba(87,255,147,.24);border-radius:28px;background:linear-gradient(145deg,rgba(25,53,35,.96),rgba(14,19,16,.98) 58%,rgba(17,15,27,.98));box-shadow:0 24px 70px rgba(0,0,0,.3)}
.ai-dj-card:before{content:"";position:absolute;width:180px;height:180px;border-radius:50%;top:-90px;left:-55px;background:rgba(30,215,96,.16);filter:blur(12px)}
.ai-dj-heading{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.ai-badge{font-size:10px;font-weight:900;letter-spacing:1px;color:#07110a;background:#1ed760;padding:6px 9px;border-radius:999px}.ai-dj-form{position:relative;display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:18px}.ai-dj-form textarea{resize:none;min-width:0;border:1px solid #38443b;background:rgba(4,8,5,.62);color:#fff;border-radius:18px;padding:14px 15px;outline:none;line-height:1.5}.ai-dj-form textarea:focus{border-color:#1ed760}.ai-dj-form button{border:0;border-radius:18px;background:#1ed760;color:#041006;padding:12px 17px;font-weight:900;cursor:pointer}.ai-dj-form button:disabled{opacity:.6}.ai-dj-suggestions{position:relative;display:flex;gap:8px;overflow-x:auto;margin-top:12px;padding-bottom:3px;scrollbar-width:none}.ai-dj-suggestions button{flex:0 0 auto;border:1px solid #344039;background:rgba(255,255,255,.055);color:#e9f0eb;border-radius:999px;padding:9px 12px;font-size:12px}.ai-dj-response{position:relative;display:flex;align-items:center;gap:12px;margin-top:16px;padding:13px;border:1px solid rgba(30,215,96,.22);border-radius:18px;background:rgba(5,12,7,.54)}.ai-dj-avatar{display:grid;place-items:center;flex:0 0 44px;height:44px;border-radius:14px;background:#1ed760;color:#041006;font-size:12px;font-weight:950}.ai-dj-response p{color:#b5c0b8;font-size:13px;line-height:1.6;margin-top:3px}
.ai-session{position:relative;margin-top:16px;padding:15px;border:1px solid rgba(255,255,255,.1);border-radius:22px;background:rgba(3,8,5,.58)}.ai-session-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.ai-session-head strong{font-size:17px}.ai-session-count{color:#1ed760;font-weight:900;font-size:12px}.ai-session-list{display:flex;gap:9px;overflow-x:auto;margin-top:13px;padding-bottom:5px;scrollbar-width:none}.ai-session-track{flex:0 0 112px}.ai-session-track img{width:112px;height:112px;border-radius:15px;object-fit:cover;background:#252a26}.ai-session-track strong,.ai-session-track span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ai-session-track strong{font-size:12px;margin-top:7px}.ai-session-track span{font-size:10px;color:#9da69f;margin-top:3px}.ai-session-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}.ai-session-actions button{border:0;border-radius:999px;padding:12px;font-weight:900;cursor:pointer}.ai-session-play{background:#1ed760;color:#041006}.ai-session-save{background:#fff;color:#050706}.ai-session-status{margin-top:10px;color:#9ca69f;font-size:12px;text-align:center;min-height:18px}
@media(max-width:620px){.ai-dj-form{grid-template-columns:1fr}.ai-dj-form button{min-height:48px}.ai-dj-card{padding:18px}.ai-session-actions{grid-template-columns:1fr}}
`;
document.head.appendChild(style);

const sessionPanel = document.createElement('section');
sessionPanel.id = 'aiSessionPanel';
sessionPanel.className = 'ai-session hidden';
sessionPanel.innerHTML = `<div class="ai-session-head"><strong id="aiSessionName">جلسة Asiri</strong><span id="aiSessionCount" class="ai-session-count"></span></div><div id="aiSessionList" class="ai-session-list"></div><div class="ai-session-actions"><button id="aiSessionPlay" class="ai-session-play">▶ تشغيل الجلسة كاملة</button><button id="aiSessionSave" class="ai-session-save">＋ حفظها في Spotify</button></div><p id="aiSessionStatus" class="ai-session-status"></p>`;
response?.insertAdjacentElement('afterend', sessionPanel);
const sessionName = $('#aiSessionName'), sessionCount = $('#aiSessionCount'), sessionList = $('#aiSessionList'), sessionPlay = $('#aiSessionPlay'), sessionSave = $('#aiSessionSave'), sessionStatus = $('#aiSessionStatus');

function normalizeArabic(text){return text.toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ً-ْ]/g,'').replace(/\s+/g,' ').trim()}

function understandPrompt(raw){
  const text=normalizeArabic(raw),terms=[];let mood='جلسة موسيقية مختارة لك';
  const rules=[
    {words:['قهوه','جلسه'],queries:['كلاسيكيات خليجية هادئة','طرب خليجي هادئ','اغاني جلسات خليجية','عود خليجي'],label:'جلسة قهوة خليجية'},
    {words:['سياره','طريق','سفر','قياده'],queries:['أغاني خليجية حماسية','اغاني عربية للسيارة','خليجي سريع','طريق سفر عربي'],label:'جلسة طريق وحماس'},
    {words:['نوم','استرخاء','هادي','هادئ','هدوء','مساء'],queries:['أغاني عربية هادئة','موسيقى عربية استرخاء','خليجي هادئ','اغاني قبل النوم'],label:'جلسة هدوء واسترخاء'},
    {words:['حماس','رياضه','نادي','طاقه'],queries:['أغاني عربية حماسية','خليجي سريع','اغاني طاقة عربية','حفلات خليجية'],label:'جلسة طاقة وحماس'},
    {words:['طرب','اصيل','عود'],queries:['طرب خليجي كلاسيكي','محمد عبده عبادي الجوهر','جلسات عود خليجية','كلاسيكيات سعودية'],label:'جلسة طرب أصيل'},
    {words:['رومانسي','حب','رومانسيه'],queries:['أغاني خليجية رومانسية','اغاني حب عربية','رومانسي عربي هادئ','خليجي عاطفي'],label:'جلسة رومانسية'},
    {words:['قديم','كلاسيك','زمن جميل'],queries:['كلاسيكيات خليجية قديمة','اغاني سعودية قديمة','طرب عربي قديم','زمن الفن الجميل خليجي'],label:'كلاسيكيات الزمن الجميل'}
  ];
  const matched=rules.find(rule=>rule.words.some(word=>text.includes(normalizeArabic(word))));
  if(matched){terms.push(...matched.queries);mood=matched.label}
  const artists=['محمد عبده','عبادي الجوهر','رابح صقر','عبدالمجيد عبدالله','فلاح المسردي','خالد عبدالرحمن','راشد الماجد'];
  artists.filter(a=>text.includes(normalizeArabic(a))).forEach(a=>terms.unshift(a));
  const quoted=raw.match(/[«"']([^»"']+)[»"']/);if(quoted?.[1])terms.unshift(quoted[1]);
  if(!terms.length){const cleaned=raw.replace(/شغ[ّ]?ل|شغل لي|ابغى|أبغى|اريد|أريد|اعطني|أعطني|موسيقى|اغاني|أغاني|جلسة|جلسه/gi,' ').replace(/\s+/g,' ').trim();terms.push(cleaned||raw,`${cleaned||raw} خليجي`,`${cleaned||raw} عربي`,`${cleaned||raw} هادئ`)}
  return {queries:[...new Set(terms)].slice(0,5),label:mood};
}

async function refreshToken(){const rt=localStorage.getItem('spotify_refresh_token');if(!rt)return null;const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:CLIENT_ID,grant_type:'refresh_token',refresh_token:rt})});if(!r.ok)return null;const p=await r.json();localStorage.setItem('spotify_access_token',p.access_token);localStorage.setItem('spotify_expires_at',String(Date.now()+p.expires_in*1000-60000));if(p.refresh_token)localStorage.setItem('spotify_refresh_token',p.refresh_token);return p.access_token}
async function token(){const t=localStorage.getItem('spotify_access_token'),e=Number(localStorage.getItem('spotify_expires_at')||0);return t&&Date.now()<e?t:refreshToken()}
async function api(path,options={}){const t=await token();if(!t)throw new Error('AUTH_REQUIRED');const r=await fetch(`https://api.spotify.com/v1${path}`,{...options,headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json',...(options.headers||{})}});if(!r.ok)throw new Error(`SPOTIFY_${r.status}`);return r.status===204?null:r.json()}

function renderSession(){
  sessionName.textContent=currentSessionName;sessionCount.textContent=`${currentSession.length} أغنية`;sessionList.innerHTML='';
  currentSession.slice(0,12).forEach(track=>{const item=document.createElement('article');item.className='ai-session-track';item.innerHTML=`<img alt=""><strong></strong><span></span>`;item.querySelector('img').src=track.album?.images?.[0]?.url||'';item.querySelector('strong').textContent=track.name;item.querySelector('span').textContent=track.artists?.map(a=>a.name).join('، ')||'';sessionList.appendChild(item)});
  sessionPanel.classList.remove('hidden');sessionStatus.textContent='الجلسة جاهزة للتشغيل أو الحفظ.';
}

async function buildSession(prompt){
  const parsed=understandPrompt(prompt);currentSessionName=parsed.label;title.textContent='يبني الجلسة الآن';message.textContent='أجمع اختيارات متنوعة وأزيل التكرار...';response.classList.remove('hidden');sessionPanel.classList.add('hidden');
  const collected=[],seen=new Set();
  for(const query of parsed.queries){
    try{const params=new URLSearchParams({q:query,type:'track',limit:'10',offset:'0'});const data=await api(`/search?${params}`);for(const track of data.tracks?.items||[]){if(track?.id&&!seen.has(track.id)){seen.add(track.id);collected.push(track)}if(collected.length>=30)break}}catch(error){console.error(error)}
    if(collected.length>=30)break;
  }
  currentSession=collected.slice(0,30);
  if(!currentSession.length)throw new Error('NO_RESULTS');
  title.textContent=currentSessionName;message.textContent=`جهزت لك جلسة من ${currentSession.length} أغنية متنوعة، ويمكن تشغيلها كاملة أو حفظها في Spotify.`;renderSession();
}

sessionPlay?.addEventListener('click',async()=>{
  if(!currentSession.length)return;sessionPlay.disabled=true;sessionStatus.textContent='جارٍ تجهيز المشغل...';
  try{const devices=await api('/me/player/devices');const device=devices.devices?.find(d=>d.name==='Asiri Music Player')||devices.devices?.find(d=>d.is_active);if(!device)throw new Error('NO_DEVICE');await api(`/me/player/play?device_id=${encodeURIComponent(device.id)}`,{method:'PUT',body:JSON.stringify({uris:currentSession.map(t=>t.uri||`spotify:track:${t.id}`)})});sessionStatus.textContent='بدأ تشغيل الجلسة كاملة ✓'}catch(error){console.error(error);sessionStatus.textContent='تعذر بدء الجلسة. شغّل أي أغنية مرة واحدة ثم حاول مجددًا.'}finally{sessionPlay.disabled=false}
});

sessionSave?.addEventListener('click',async()=>{
  if(!currentSession.length)return;sessionSave.disabled=true;sessionStatus.textContent='جارٍ إنشاء القائمة في Spotify...';
  try{const me=await api('/me');const playlist=await api(`/users/${encodeURIComponent(me.id)}/playlists`,{method:'POST',body:JSON.stringify({name:`Asiri AI DJ — ${currentSessionName}`,description:'جلسة ذكية أنشأها Asiri Music',public:false})});await api(`/playlists/${playlist.id}/tracks`,{method:'POST',body:JSON.stringify({uris:currentSession.map(t=>t.uri||`spotify:track:${t.id}`)})});sessionStatus.textContent='تم حفظ الجلسة في Spotify ✓';sessionSave.textContent='تم الحفظ ✓'}catch(error){console.error(error);sessionStatus.textContent='تعذر الحفظ الآن. أعد تسجيل الدخول ثم حاول مجددًا.'}finally{sessionSave.disabled=false}
});

form?.addEventListener('submit',async event=>{
  event.preventDefault();const prompt=input.value.trim();if(!prompt)return;button.disabled=true;button.textContent='يبني جلستك...';
  try{await buildSession(prompt)}catch(error){console.error(error);title.textContent='تعذر إنشاء الجلسة';message.textContent='حاول وصفًا أبسط أو اسم فنان واضح.';response.classList.remove('hidden')}finally{button.disabled=false;button.textContent='✨ أنشئ الجلسة'}
});

document.querySelectorAll('[data-dj-prompt]').forEach(item=>item.addEventListener('click',()=>{input.value=item.dataset.djPrompt;form.requestSubmit()}));
