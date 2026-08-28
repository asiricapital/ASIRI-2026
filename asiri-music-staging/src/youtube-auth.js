const CLIENT_ID_KEY='asiri-music.youtube.oauth.client-id.v1';
const TOKEN_KEY='asiri-music.youtube.oauth.token.v1';
const CHANNEL_KEY='asiri-music.youtube.oauth.channel.v1';
const SCOPE='https://www.googleapis.com/auth/youtube.readonly';
let gisPromise=null;
let tokenClient=null;

export function getYoutubeClientId(){return localStorage.getItem(CLIENT_ID_KEY)||''}
export function setYoutubeClientId(value){const clean=String(value||'').trim();if(clean)localStorage.setItem(CLIENT_ID_KEY,clean);else localStorage.removeItem(CLIENT_ID_KEY);return clean}
export function getYoutubeToken(){try{const data=JSON.parse(sessionStorage.getItem(TOKEN_KEY)||'null');if(!data?.access_token||!data?.expiresAt||Date.now()>=data.expiresAt)return null;return data}catch{return null}}
export function getYoutubeChannel(){try{return JSON.parse(localStorage.getItem(CHANNEL_KEY)||'null')}catch{return null}}
function saveToken(response){const expiresIn=Math.max(60,Number(response.expires_in)||3600);const data={access_token:response.access_token,scope:response.scope||SCOPE,expiresAt:Date.now()+(expiresIn-30)*1000};sessionStorage.setItem(TOKEN_KEY,JSON.stringify(data));return data}
function saveChannel(channel){if(channel)localStorage.setItem(CHANNEL_KEY,JSON.stringify(channel));else localStorage.removeItem(CHANNEL_KEY)}
function emitAuthChanged(detail){window.dispatchEvent(new CustomEvent('asiri:youtube-auth-changed',{detail}))}

function loadGoogleIdentity(){
  if(window.google?.accounts?.oauth2)return Promise.resolve(window.google);
  if(gisPromise)return gisPromise;
  gisPromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-asiri-google-identity]');
    if(existing){existing.addEventListener('load',()=>resolve(window.google),{once:true});existing.addEventListener('error',reject,{once:true});return}
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.dataset.asiriGoogleIdentity='1';script.onload=()=>resolve(window.google);script.onerror=()=>reject(new Error('GOOGLE_IDENTITY_LOAD_FAILED'));document.head.appendChild(script);
  });
  return gisPromise;
}

async function fetchChannel(accessToken){
  const params=new URLSearchParams({part:'snippet',mine:'true',maxResults:'1'});
  const response=await fetch('https://www.googleapis.com/youtube/v3/channels?'+params,{headers:{Authorization:'Bearer '+accessToken}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||'YOUTUBE_ACCOUNT_FAILED');
  const item=data.items?.[0];
  if(!item)return null;
  const channel={id:item.id,title:item.snippet?.title||'YouTube',thumbnail:item.snippet?.thumbnails?.default?.url||item.snippet?.thumbnails?.medium?.url||''};
  saveChannel(channel);return channel;
}

export async function signInYouTube(){
  const clientId=getYoutubeClientId();
  if(!clientId)throw new Error('YOUTUBE_CLIENT_ID_REQUIRED');
  await loadGoogleIdentity();
  return new Promise((resolve,reject)=>{
    tokenClient=window.google.accounts.oauth2.initTokenClient({
      client_id:clientId,
      scope:SCOPE,
      callback:async response=>{
        if(response?.error)return reject(new Error(response.error));
        try{const token=saveToken(response);const channel=await fetchChannel(token.access_token);emitAuthChanged({signedIn:true,channel});resolve({token,channel})}catch(error){reject(error)}
      },
      error_callback:error=>reject(new Error(error?.type||'GOOGLE_OAUTH_FAILED'))
    });
    tokenClient.requestAccessToken({prompt:'consent'});
  });
}

export async function refreshYoutubeChannel(){const token=getYoutubeToken();if(!token)return getYoutubeChannel();try{const channel=await fetchChannel(token.access_token);emitAuthChanged({signedIn:true,channel});return channel}catch{return getYoutubeChannel()}}
export function signOutYouTube(){
  const token=getYoutubeToken();
  if(token?.access_token&&window.google?.accounts?.oauth2?.revoke)window.google.accounts.oauth2.revoke(token.access_token,()=>{});
  sessionStorage.removeItem(TOKEN_KEY);saveChannel(null);emitAuthChanged({signedIn:false,channel:null});return true;
}
export function isYoutubeSignedIn(){return Boolean(getYoutubeToken()&&getYoutubeChannel())}
