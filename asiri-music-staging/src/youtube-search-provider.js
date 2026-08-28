const API_KEY_STORAGE='asiri-music.youtube.apiKey.v1';

export function getYoutubeApiKey(){
  try{return String(localStorage.getItem(API_KEY_STORAGE)||'').trim()}catch{return''}
}

export function setYoutubeApiKey(value){
  const key=String(value||'').trim();
  try{key?localStorage.setItem(API_KEY_STORAGE,key):localStorage.removeItem(API_KEY_STORAGE)}catch{}
  window.dispatchEvent(new CustomEvent('asiri:youtube-key-changed',{detail:{configured:Boolean(key)}}));
  return Boolean(key);
}

export function hasYoutubeSearchKey(){return Boolean(getYoutubeApiKey())}

function mapVideo(item){
  const id=item?.id?.videoId||'';
  const snippet=item?.snippet||{};
  return{
    source:'youtube',id,title:snippet.title||'YouTube video',channel:snippet.channelTitle||'',publishedAt:snippet.publishedAt||'',description:snippet.description||'',thumbnail:snippet.thumbnails?.medium?.url||snippet.thumbnails?.high?.url||snippet.thumbnails?.default?.url||''
  };
}

export async function searchYouTubeVideos(query,{maxResults=12,signal}={}){
  const q=String(query||'').trim(),key=getYoutubeApiKey();
  if(!q)return[];
  if(!key){const error=new Error('YOUTUBE_SEARCH_NOT_CONNECTED');error.code='YOUTUBE_SEARCH_NOT_CONNECTED';throw error}
  const params=new URLSearchParams({part:'snippet',type:'video',maxResults:String(Math.max(1,Math.min(25,maxResults))),q,key,safeSearch:'moderate'});
  const response=await fetch('https://www.googleapis.com/youtube/v3/search?'+params,{signal,headers:{Accept:'application/json'}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(data?.error?.message||'YOUTUBE_SEARCH_FAILED');
    error.status=response.status;error.code=data?.error?.errors?.[0]?.reason||'YOUTUBE_SEARCH_FAILED';throw error;
  }
  return(data.items||[]).map(mapVideo).filter(item=>item.id);
}

export function prefersYoutube(prompt){
  const text=String(prompt||'').toLowerCase();
  return /(حفله|حفلة|concert|live|فيديو|video|جلسه|جلسة|عود|مسرح|قديم|نادر)/i.test(text);
}
