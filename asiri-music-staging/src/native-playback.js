const isiPhoneSafari=/iPhone|iPad|iPod/i.test(navigator.userAgent)&&/Safari/i.test(navigator.userAgent)&&!/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);

function spotifyUrlFromId(id){return id?`https://open.spotify.com/track/${encodeURIComponent(id)}`:''}
function openSpotifyTrack(id){
  const url=spotifyUrlFromId(id);
  if(!url)return false;
  window.location.href=url;
  return true;
}

function trackIdFromTarget(target){
  const card=target.closest('[data-track-id]');
  return card?.dataset?.trackId||'';
}

function setNativeLabels(root=document){
  if(!isiPhoneSafari)return;
  root.querySelectorAll('.track .play').forEach(button=>{button.textContent='فتح في Spotify';button.title='تشغيل موثوق عبر تطبيق Spotify'});
  root.querySelectorAll('.ai-dj-track [data-action="play"]').forEach(button=>{button.textContent='Spotify';button.title='فتح الأغنية في Spotify'});
  const sessionButton=document.querySelector('#aiDjPlay');
  if(sessionButton)sessionButton.textContent='فتح أول أغنية في Spotify';
}

if(isiPhoneSafari){
  document.addEventListener('click',event=>{
    const directTrackButton=event.target.closest('.track .play');
    const aiPlayButton=event.target.closest('.ai-dj-track [data-action="play"], .ai-dj-track .ai-track-info');
    const sessionButton=event.target.closest('#aiDjPlay');
    const target=directTrackButton||aiPlayButton||sessionButton;
    if(!target)return;

    let id='';
    if(sessionButton){
      id=document.querySelector('#aiDjPreview [data-track-id]')?.dataset?.trackId||'';
    }else{
      id=trackIdFromTarget(target);
    }
    if(!id)return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.AsiriMusicBridge?.setStatus?.('جارٍ فتح الأغنية في تطبيق Spotify…');
    openSpotifyTrack(id);
  },true);

  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      mutation.addedNodes.forEach(node=>{if(node.nodeType===1)setNativeLabels(node)});
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('DOMContentLoaded',()=>setNativeLabels());
  setTimeout(()=>setNativeLabels(),500);
}

window.AsiriNativePlayback={enabled:isiPhoneSafari,openTrack:openSpotifyTrack};
