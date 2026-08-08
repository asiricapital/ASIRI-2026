const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

class AsiriPlaybackEngineV2 extends EventTarget{
  constructor({getToken,api,onStatus=()=>{},onHealth=()=>{}}){
    super();
    this.getToken=getToken;
    this.api=api;
    this.onStatus=onStatus;
    this.onHealth=onHealth;
    this.player=null;
    this.deviceId='';
    this.queue=[];
    this.index=-1;
    this.connecting=null;
    this.command=Promise.resolve();
    this.generation=0;
    this.lastPlaybackState=null;
    this.remoteQueueMode='batch';
    this.queuedRemoteIndexes=new Set();
  }

  emit(type,detail={}){
    this.dispatchEvent(new CustomEvent(type,{detail}));
    window.dispatchEvent(new CustomEvent(`asiri:${type}`,{detail}));
  }

  async waitForSdk(timeout=12000){
    const started=Date.now();
    while(!window.Spotify?.Player){
      if(Date.now()-started>timeout)throw new Error('تعذر تحميل Spotify Player SDK');
      await sleep(100);
    }
  }

  async connect(){
    if(this.player&&this.deviceId)return this.deviceId;
    if(this.connecting)return this.connecting;
    const generation=++this.generation;
    this.connecting=(async()=>{
      await this.waitForSdk();
      if(!this.player)this.createPlayer(generation);
      const connected=await this.player.connect();
      if(!connected)throw new Error('تعذر اتصال مشغل Spotify');
      for(let i=0;i<60&&!this.deviceId;i++)await sleep(150);
      if(!this.deviceId)throw new Error('لم يرسل Spotify معرف جهاز التشغيل');
      return this.deviceId;
    })().finally(()=>{this.connecting=null});
    return this.connecting;
  }

  createPlayer(generation){
    this.player=new Spotify.Player({
      name:'Asiri Music OS',
      getOAuthToken:async callback=>callback(await this.getToken()),
      volume:.8,
      enableMediaSession:true
    });
    this.player.addListener('ready',({device_id})=>{
      if(generation!==this.generation)return;
      this.deviceId=device_id;
      this.onHealth(true,'Playback Engine v3 جاهز');
      this.emit('playback-ready',{deviceId:device_id});
    });
    this.player.addListener('not_ready',({device_id})=>{
      if(device_id===this.deviceId)this.deviceId='';
      this.onHealth(false,'فقد اتصال جهاز التشغيل');
      this.emit('playback-not-ready',{deviceId:device_id});
    });
    this.player.addListener('player_state_changed',state=>{
      if(!state)return;
      this.lastPlaybackState=state;
      const track=state.track_window?.current_track;
      if(track){
        const previousIndex=this.index;
        const found=this.queue.findIndex(item=>item.id===track.id||item.uri===track.uri);
        if(found>=0)this.index=found;
        if(found>=0&&found!==previousIndex&&this.remoteQueueMode==='single'){
          this.primeNextTrack(this.deviceId).catch(error=>console.warn('[Playback Engine v3] queue prime',error));
        }
      }
      this.emit('player-state',{track,paused:state.paused,position:state.position,duration:state.duration,index:this.index,queue:[...this.queue]});
    });
    this.player.addListener('initialization_error',({message})=>this.fail(message));
    this.player.addListener('authentication_error',({message})=>this.fail(message||'يلزم تسجيل الدخول مجددًا'));
    this.player.addListener('account_error',({message})=>this.fail(message||'يتطلب التشغيل حساب Premium'));
    this.player.addListener('playback_error',({message})=>this.fail(message||'تعذر تشغيل Spotify'));
  }

  fail(message){
    console.error('[Playback Engine v2]',message);
    this.onHealth(false,message);
    this.emit('playback-error',{message});
  }

  async activateFromGesture(){
    if(this.player?.activateElement)return this.player.activateElement();
    await this.connect();
    if(this.player?.activateElement)await this.player.activateElement();
  }

  setQueue(tracks,{startIndex=0,source='unknown'}={}){
    this.queue=[...new Map((tracks||[]).filter(track=>track?.id).map(track=>[track.id,track])).values()];
    if(!this.queue.length)throw new Error('لا توجد أغنيات صالحة للتشغيل');
    this.index=Math.min(Math.max(Number(startIndex)||0,0),this.queue.length-1);
    this.remoteQueueMode='batch';
    this.queuedRemoteIndexes.clear();
    this.emit('queue-changed',{tracks:[...this.queue],currentIndex:this.index,source});
    return [...this.queue];
  }

  enqueue(task){
    this.command=this.command.catch(()=>{}).then(task);
    return this.command;
  }

  async waitUntilDeviceVisible(deviceId,timeout=8000){
    const started=Date.now();
    while(Date.now()-started<timeout){
      try{
        const data=await this.api('/me/player/devices');
        if((data.devices||[]).some(device=>device.id===deviceId))return true;
      }catch{}
      await sleep(300);
    }
    return false;
  }

  async prepareDevice(){
    const deviceId=await this.connect();
    const visible=await this.waitUntilDeviceVisible(deviceId);
    if(!visible)throw new Error('Spotify لم يعتمد جهاز Asiri Music بعد');
    return deviceId;
  }

  trackMatchesState(state,track){
    const current=state?.track_window?.current_track;
    if(!current||!track)return false;
    const wantedIds=new Set([track.id,track.linked_from?.id].filter(Boolean));
    return Boolean(current.uri===track.uri||[current.id,current.linked_from?.id].filter(Boolean).some(id=>wantedIds.has(id)));
  }

  async waitForTrack(track,timeout=2800){
    const started=Date.now();
    let resumed=false;
    while(Date.now()-started<timeout){
      let state=this.lastPlaybackState;
      try{state=await this.player?.getCurrentState?.()||state}catch{}
      if(this.trackMatchesState(state,track)){
        if(!state?.paused)return true;
        if(!resumed&&this.player?.resume){
          resumed=true;
          try{await this.player.resume()}catch{}
        }
      }
      await sleep(140);
    }
    return false;
  }

  async startPlayback(deviceId,uris,startPosition){
    return this.api('/me/player/play?device_id='+encodeURIComponent(deviceId),{
      method:'PUT',
      body:JSON.stringify({uris,position_ms:startPosition})
    });
  }

  trackUri(track){
    return track?.uri||`spotify:track:${track?.id||''}`;
  }

  async primeNextTrack(deviceId){
    const nextIndex=this.index+1;
    if(!deviceId||nextIndex>=this.queue.length||this.queuedRemoteIndexes.has(nextIndex))return;
    const uri=this.trackUri(this.queue[nextIndex]);
    if(!uri)return;
    try{
      await this.api('/me/player/queue?'+new URLSearchParams({uri,device_id:deviceId}),{method:'POST'});
      this.queuedRemoteIndexes.add(nextIndex);
    }catch(error){
      console.warn('[Playback Engine v3] could not prime next track',error);
    }
  }

  async playQueue(tracks,{startIndex=0,source='unknown',userGesture=false,positionMs=0}={}){
    this.setQueue(tracks,{startIndex,source});
    if(userGesture)await this.activateFromGesture();
    return this.playIndex(this.index,{positionMs});
  }

  async playIndex(index,{positionMs=0}={}){
    return this.enqueue(async()=>{
      if(!this.queue.length)throw new Error('لا توجد قائمة تشغيل حالية');
      this.index=(Number(index)+this.queue.length)%this.queue.length;
      const track=this.queue[this.index];
      this.onStatus(`جارٍ تشغيل ${track.name}…`);
      this.emit('track-selected',{track,index:this.index,queue:[...this.queue]});
      const deviceId=await this.prepareDevice();
      const uris=this.queue.slice(this.index).map(item=>this.trackUri(item)).filter(Boolean);
      const selectedUri=this.trackUri(track),startPosition=Math.max(0,Number(positionMs)||0);
      let batchError=null;
      this.lastPlaybackState=null;
      try{
        await this.startPlayback(deviceId,uris,startPosition);
        if(await this.waitForTrack(track)){
          this.remoteQueueMode='batch';
          this.onHealth(true,'Playback Engine v3 يعمل');
          this.onStatus(`يعمل الآن: ${track.name} — ${this.index+1} من ${this.queue.length} • التشغيل المستمر مفعّل`);
          return track;
        }
        batchError=new Error('Spotify لم ينتقل إلى الأغنية المطلوبة بعد إرسال القائمة.');
      }catch(error){batchError=error}

      console.warn('[Playback Engine v3] batch start failed; retrying selected track only',batchError);
      this.lastPlaybackState=null;
      try{
        await this.startPlayback(deviceId,[selectedUri],startPosition);
        if(!await this.waitForTrack(track,4200))throw new Error('Spotify استلم أمر التشغيل لكنه لم ينتقل إلى الأغنية المطلوبة.');
        this.remoteQueueMode='single';
        this.queuedRemoteIndexes.clear();
        await this.primeNextTrack(deviceId);
        this.onHealth(true,'Playback Engine v3 يعمل');
        this.onStatus(`يعمل الآن: ${track.name} • تم تثبيت التشغيل المباشر للأغنية المطلوبة`);
        return track;
      }catch(error){
        console.warn('[Playback Engine v3] selected-track fallback failed',error);
        throw error||batchError||new Error('تعذر تشغيل الأغنية داخل الموقع');
      }
    });
  }

  next(){return this.playIndex(this.index<0?0:this.index+1)}
  previous(){return this.playIndex(this.index<0?0:this.index-1)}
  async toggle(){
    await this.activateFromGesture();
    if(!this.player)throw new Error('المشغل غير جاهز');
    return this.player.togglePlay();
  }

  async seek(positionMs){
    await this.connect();
    if(!this.player)throw new Error('المشغل غير جاهز');
    return this.player.seek(Math.max(0,Number(positionMs)||0));
  }

  getQueue(){return [...this.queue]}
  getCurrentIndex(){return this.index}
}

window.AsiriPlaybackEngineV2=AsiriPlaybackEngineV2;
window.dispatchEvent(new CustomEvent('asiri:playback-engine-v2-loaded'));
