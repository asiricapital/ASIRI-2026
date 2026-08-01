const $=s=>document.querySelector(s);

function waitForBridge(){
  return new Promise(resolve=>{
    if(window.AsiriMusicBridge)return resolve(window.AsiriMusicBridge);
    const ready=()=>{window.removeEventListener('asiri:bridge-ready',ready);resolve(window.AsiriMusicBridge)};
    window.addEventListener('asiri:bridge-ready',ready);
  });
}

function buildPanel(){
  const section=document.createElement('section');
  section.className='card car-native-card';
  section.innerHTML=`
    <div class="section-head">
      <div><span class="eyebrow">CAR MODE • NATIVE SPOTIFY</span><h2>تشغيل مضمون مع أزرار السيارة</h2></div>
    </div>
    <p class="muted">يحوّل الطابور الحالي إلى قائمة خاصة داخل Spotify ثم يفتحها في التطبيق الأصلي. بعد بدء التشغيل من Spotify تتحكم أزرار المقود بالتالي والسابق.</p>
    <button id="exportCarPlaylist" type="button">🚗 إنشاء وفتح جلسة السيارة في Spotify</button>
    <p id="carPlaylistStatus" class="muted">أنشئ جلسة أو نفّذ بحثًا أولًا.</p>`;
  const hero=document.querySelector('.hero');
  hero?.parentNode?.insertBefore(section,hero);
  return section;
}

async function createPlaylist(bridge,tracks){
  const playlist=await bridge.api('/me/playlists',{
    method:'POST',
    body:JSON.stringify({
      name:`Asiri Car Session ${new Date().toLocaleDateString('ar-SA')}`,
      description:'تم إنشاؤها بواسطة Asiri Music لتشغيلها داخل Spotify والتحكم بها من السيارة.',
      public:false
    })
  });
  const uris=tracks.map(t=>t.uri||`spotify:track:${t.id}`).filter(Boolean).slice(0,100);
  await bridge.api(`/playlists/${playlist.id}/items`,{
    method:'POST',
    body:JSON.stringify({uris})
  });
  return playlist;
}

async function init(){
  const bridge=await waitForBridge();
  buildPanel();
  $('#exportCarPlaylist').addEventListener('click',async()=>{
    const button=$('#exportCarPlaylist');
    const status=$('#carPlaylistStatus');
    const tracks=bridge.getQueue?.()||[];
    if(!tracks.length){status.textContent='لا توجد قائمة حالية. ابحث أو أنشئ جلسة AI DJ أولًا.';return;}
    button.disabled=true;
    button.textContent='جارٍ إنشاء القائمة داخل Spotify…';
    status.textContent='يتم الآن نسخ الأغاني إلى حسابك.';
    try{
      const playlist=await createPlaylist(bridge,tracks);
      status.textContent='تم إنشاء القائمة. افتحها داخل Spotify واضغط تشغيل مرة واحدة، ثم استخدم أزرار السيارة.';
      const spotifyUri=playlist.uri||`spotify:playlist:${playlist.id}`;
      const webUrl=playlist.external_urls?.spotify||`https://open.spotify.com/playlist/${playlist.id}`;
      location.href=spotifyUri;
      setTimeout(()=>{location.href=webUrl},1200);
    }catch(error){
      console.error('[Car Playlist]',error);
      status.textContent=error.message==='AUTH_REQUIRED'?'سجّل الدخول مجددًا.':error.message||'تعذر إنشاء قائمة السيارة.';
    }finally{
      button.disabled=false;
      button.textContent='🚗 إنشاء وفتح جلسة السيارة في Spotify';
    }
  });
}

init().catch(error=>console.error('[Car Playlist isolated]',error));