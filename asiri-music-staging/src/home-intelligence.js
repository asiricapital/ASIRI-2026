const $=selector=>document.querySelector(selector);
const STYLE_ID='asiri-home-intelligence-style';
const SURPRISE_PROMPTS=[
  'فاجئني بجلسة سعودية وخليجية أنيقة تناسب هذا الوقت لمدة ساعة',
  'اختر لي جلسة طرب هادئة من ذوقي مع تنويع الفنانين لمدة ساعة',
  'جهز لي جلسة طريق راقية ومريحة من ذوقي لمدة 75 دقيقة',
  'ابنِ لي جلسة خليجية مميزة فيها هدوء وطرب ولمسة حماس'
];

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const link=document.createElement('link');
  link.id=STYLE_ID;
  link.rel='stylesheet';
  link.href='home-intelligence.css?v=20260828-v1';
  document.head.appendChild(link);
}

function readEnvelope(key){
  try{return JSON.parse(localStorage.getItem('asiri-music-pro.v1.'+key)||'null')?.value??null}catch{return null}
}

function lastSession(){return readEnvelope('aiDj.lastSession')}
function cachedMix(){return readEnvelope('smartMix.last.v1')}
function setStatus(message){const node=$('#asiriOneTapStatus');if(node)node.textContent=message||''}

function buildCard(){
  if($('#asiriOneTap'))return $('#asiriOneTap');
  const anchor=$('.os-quick-grid')||$('#asiriMoment');
  if(!anchor)return null;
  const section=document.createElement('section');
  section.id='asiriOneTap';
  section.className='asiri-one-tap';
  section.innerHTML=`
    <div class="asiri-one-tap-head">
      <div><span class="eyebrow">ASIRI ONE-TAP</span><h3>شغّل ما يناسبك فورًا</h3><p>ثلاثة اختصارات ذكية فوق الأنظمة الموجودة — بدون تغيير هوية المنصة.</p></div>
      <span class="asiri-one-tap-badge">MUSIC OS • V2</span>
    </div>
    <div class="asiri-one-tap-grid">
      <button id="asiriResumeSession" class="asiri-one-tap-button primary" type="button"><strong>▶ أكمل آخر جلسة</strong><span>من أول أغنية أو آخر جلسة محفوظة</span></button>
      <button id="asiriPlayMyMix" class="asiri-one-tap-button" type="button"><strong>✨ شغّل مزيجي</strong><span>Smart Mix مبني على ذوقك واستماعك</span></button>
      <button id="asiriSurpriseMe" class="asiri-one-tap-button" type="button"><strong>🎲 فاجئني</strong><span>AI DJ يبني لك جلسة مناسبة الآن</span></button>
    </div>
    <span id="asiriOneTapStatus" class="asiri-one-tap-status" aria-live="polite"></span>`;
  anchor.insertAdjacentElement('afterend',section);
  return section;
}

function refreshState(){
  const session=lastSession();
  const resume=$('#asiriResumeSession');
  if(resume){
    resume.disabled=!session?.tracks?.length;
    const label=resume.querySelector('span');
    if(label)label.textContent=session?.tracks?.length?`${session.tracks.length} أغنية • ${session.prompt||'آخر جلسة محفوظة'}`:'أنشئ جلسة أولًا من AI DJ';
  }
  const mix=cachedMix();
  const mixButton=$('#asiriPlayMyMix');
  if(mixButton){
    const label=mixButton.querySelector('span');
    if(label)label.textContent=mix?.tracks?.length?`${mix.tracks.length} أغنية جاهزة الآن`:'سأبني Smart Mix جديدًا لك تلقائيًا';
  }
}

async function resumeSession(){
  const session=lastSession();
  const bridge=window.AsiriMusicBridge;
  if(!session?.tracks?.length||!bridge)return;
  try{
    setStatus('جارٍ استعادة آخر جلسة وتشغيلها داخل Asiri…');
    await bridge.playQueue(session.tracks,{startIndex:0,source:'home-one-tap-resume',userGesture:true});
    window.dispatchEvent(new Event('asiri:open-now-playing'));
    setStatus('آخر جلسة تعمل الآن داخل Asiri Music.');
  }catch(error){setStatus(error?.message||'تعذر تشغيل آخر جلسة الآن.')}
}

function playMyMix(){
  setStatus(cachedMix()?.tracks?.length?'جارٍ تشغيل مزيجك الشخصي…':'لا يوجد مزيج محفوظ؛ سأبني واحدًا ثم أشغله.');
  window.dispatchEvent(new CustomEvent('asiri:smart-mix-play-request',{detail:{source:'home-one-tap'}}));
}

function surpriseMe(){
  const prompt=SURPRISE_PROMPTS[Math.floor(Math.random()*SURPRISE_PROMPTS.length)];
  setStatus('AI DJ يجهز لك جلسة مفاجئة الآن…');
  window.AsiriPendingDjPrompt=prompt;
  window.AsiriMusicOS?.openPage?.('sessions');
  requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('asiri:ai-dj-prompt',{detail:{prompt,source:'home-one-tap-surprise'}})));
}

function bind(){
  $('#asiriResumeSession')?.addEventListener('click',resumeSession);
  $('#asiriPlayMyMix')?.addEventListener('click',playMyMix);
  $('#asiriSurpriseMe')?.addEventListener('click',surpriseMe);
  window.addEventListener('asiri:session-updated',refreshState);
  window.addEventListener('asiri:smart-mix-updated',()=>{refreshState();setStatus('مزيجك الشخصي أصبح جاهزًا.')});
  window.addEventListener('storage',refreshState);
}

function init(){
  ensureStyle();
  if(!buildCard())return;
  bind();
  refreshState();
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
window.AsiriHomeIntelligence={refresh:refreshState};
