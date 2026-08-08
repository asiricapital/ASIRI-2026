const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const FALLBACK_QUEUE_WINDOW=8;

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
      this.onHealth(true,'Playback Engine v2 جاهز');
      this.emit('playback-ready',{deviceId:device_id});
    });
    this.player.addListener('not_ready',({device_id})=>{
      if(device_id===this.deviceId)this.deviceId='';
      this.onHealth(false,'فقد اتصال جهاز التشغيل');
      this.emit('playback-not-ready',{deviceId:device_id});
    });
    this.player.addListener('player_state_changed',state=>{
      if(!state)return;
      const track=state.track_window?.current_track;
      if(track){
        const found=this.queue.findIndex(item=>item.id===track.id||item.uri===track.uri);
        if(found>=0)this.index=found;
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
    await this.api('/me/player',{method:'PUT',body:JSON.stringify({device_ids:[deviceId],play:false})});
    const visible=await this.waitUntilDeviceVisible(deviceId);
    if(!visible)throw new Error('Spotify لم يعتمد جهاز Asiri Music بعد');
    return deviceId;
  }

  trackUri(track){
    const id=String(track?.id||'').trim();
    const uri=String(track?.uri||'').trim();
    if(/^spotify:track:[A-Za-z0-9]+$/.test(uri))return uri;
    return /^[A-Za-z0-9]+$/.test(id)?`spotify:track:${id}`:'';
  }

  async startPlayback(deviceId,uris,startPosition){
    const endpoint='/me/player/play?device_id='+encodeURIComponent(deviceId);
    try{
      await this.api(endpoint,{
        method:'PUT',
        body:JSON.stringify({uris,position_ms:startPosition})
      });
      return {mode:'continuous',queued:uris.length};
    }catch(error){
      const status=Number(error?.status)||0;
      if(uris.length<2||(status!==400&&status!==403))throw error;

      const selectedUri=uris[0];
      console.warn('[Playback Engine v2] queue batch rejected; retrying selected track safely',error);
      await this.api(endpoint,{
        method:'PUT',
        body:JSON.stringify({uris:[selectedUri],position_ms:startPosition})
      });

      let queued=1;
      for(const uri of uris.slice(1,1+FALLBACK_QUEUE_WINDOW)){
        try{
          await this.api('/me/player/queue?uri='+encodeURIComponent(uri)+'&device_id='+encodeURIComponent(deviceId),{method:'POST'});
          queued++;
        }catch(queueError){
          const queueStatus=Number(queueError?.status)||0;
          console.warn('[Playback Engine v2] skipped unavailable fallback queue item',queueError);
          if(queueStatus===401||queueStatus===429||queueStatus>=500)break;
        }
      }
      return {mode:'resilient',queued};
    }
  }

  async recover(){
    this.deviceId='';
    this.generation++;
    if(this.player){try{this.player.disconnect()}catch{}}
    this.player=null;
    await sleep(350);
    return this.connect();
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
      let lastError;
      for(let attempt=1;attempt<=2;attempt++){
        try{
          const deviceId=await this.prepareDevice();
          const uris=this.queue.slice(this.index).map(item=>this.trackUri(item)).filter(Boolean);
          if(!uris.length)throw new Error('لا توجد أغنيات صالحة لبدء التشغيل');
          const startPosition=Math.max(0,Number(positionMs)||0);
          const playback=await this.startPlayback(deviceId,uris,startPosition);
          const playbackLabel=playback.mode==='continuous'?'التشغيل المستمر مفعّل':'وضع التشغيل الموثوق مفعّل';
          this.onHealth(true,'Playback Engine v2 يعمل');
          this.onStatus(`يعمل الآن: ${track.name} — ${this.index+1} من ${this.queue.length} • ${playbackLabel}`);
          this.emit('queue-mode',{mode:playback.mode,queued:playback.queued,total:uris.length});
          return track;
        }catch(error){
          lastError=error;
          console.warn(`[Playback Engine v2] attempt ${attempt}`,error);
          if(attempt<2)await this.recover();
        }
      }
      throw lastError||new Error('تعذر التشغيل داخل الموقع');
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
