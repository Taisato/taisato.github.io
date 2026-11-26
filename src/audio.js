import { FT } from '../vendor/three.js';
import { footballClamp } from './config.js';

// Decode recordings before play. Frames only adjust already prepared voices.
class FootballAudio {
  static bank=new Map();
  static loading=null;
  static failures=[];
  static load(){
    if(this.loading)return this.loading;
    this.loading=(async()=>{
      try{
        const url=new URL('../assets/audio/manifest.json',import.meta.url);
        const response=await fetch(url);
        if(!response.ok)throw new Error('Audio manifest: HTTP '+response.status);
        const manifest=await response.json();
        if(manifest.format!=='first-touch-audio-v1'||!Array.isArray(manifest.assets))throw new Error('Invalid audio manifest');
        const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
        let decoder=null;
        if(Offline)try{decoder=new Offline(2,1,48000);}catch{}
        await Promise.all(manifest.assets.map(async definition=>{
          try{
            if(typeof definition.id!=='string'||typeof definition.file!=='string')throw new Error('Invalid audio entry');
            const asset=await fetch(new URL(definition.file,url));
            if(!asset.ok)throw new Error('HTTP '+asset.status);
            const encoded=await asset.arrayBuffer();
            const entry={definition,buffer:null,encoded};
            this.bank.set(definition.id,entry);
            if(decoder){
              try{const decoded=await decoder.decodeAudioData(encoded.slice(0));entry.buffer=this.prepare(decoder,decoded,definition);entry.encoded=null;}
              catch(error){console.warn('Audio decode deferred: '+definition.file,error);}
            }
          }catch(error){this.failures.push(definition.file||definition.id);console.warn('Audio file unavailable: '+(definition.file||definition.id),error);}
        }));
      }catch(error){this.failures.push('manifest.json');console.warn('Recorded audio unavailable; impact fallback remains available.',error);}
      return this.bank;
    })();
    return this.loading;
  }
  static onset(buffer){
    const frames=buffer.length,windowSize=Math.max(1,Math.round(buffer.sampleRate*.002));
    const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
    const rms=new Float64Array(Math.ceil(frames/windowSize));let peak=0;
    for(let b=0;b<rms.length;b++){
      const begin=b*windowSize,end=Math.min(frames,begin+windowSize);let sum=0;
      for(const data of channels)for(let i=begin;i<end;i++)sum+=data[i]*data[i];
      rms[b]=Math.sqrt(sum/Math.max(1,(end-begin)*channels.length));peak=Math.max(peak,rms[b]);
    }
    if(peak<1e-6)return 0;
    for(let b=0;b<rms.length;b++)if(rms[b]>=peak*.03)return b*windowSize/buffer.sampleRate;
    return 0;
  }
  static prepare(context,source,definition){
    const sampleRate=source.sampleRate,onset=this.onset(source);
    const mono=definition.channels!=='stereo',channels=mono?1:source.numberOfChannels;
    const input=Array.from({length:source.numberOfChannels},(_,i)=>source.getChannelData(i));
    const read=(channel,index)=>{if(!mono)return input[channel][index];let sum=0;for(let c=0;c<input.length;c++)sum+=input[c][index];return sum/input.length;};
    if(definition.loop){
      const loop=definition.loop,shift=onset-(loop.referenceOnset||0);
      const begin=footballClamp(Math.round((loop.start+shift)*sampleRate),0,source.length-2);
      const end=footballClamp(Math.round((loop.end+shift)*sampleRate),begin+2,source.length);
      const count=end-begin,fade=footballClamp(Math.round(loop.crossfade*sampleRate),1,Math.floor(count/3));
      const buffer=context.createBuffer(channels,count-fade,sampleRate),middle=count-2*fade;
      for(let channel=0;channel<channels;channel++){
        const output=buffer.getChannelData(channel);
        for(let i=0;i<middle;i++)output[i]=read(channel,begin+fade+i);
        for(let i=0;i<fade;i++){
          const angle=i/Math.max(1,fade-1)*Math.PI*.5;
          output[middle+i]=read(channel,end-fade+i)*Math.cos(angle)+read(channel,begin+i)*Math.sin(angle);
        }
      }
      return buffer;
    }
    const begin=definition.trimOnset?Math.max(0,Math.floor((onset-.004)*sampleRate)):0;
    const buffer=context.createBuffer(channels,Math.max(1,source.length-begin),sampleRate);
    const attack=Math.max(1,Math.round(.001*sampleRate)),tail=Math.min(buffer.length,Math.round(.006*sampleRate));
    for(let channel=0;channel<channels;channel++){
      const output=buffer.getChannelData(channel);
      for(let i=0;i<output.length;i++){
        const envelope=Math.min(1,i/attack,(output.length-1-i)/Math.max(1,tail-1));
        output[i]=read(channel,begin+i)*Math.max(0,envelope);
      }
    }
    return buffer;
  }
  constructor(){
    this.context=null;this.gain=null;this.ceiling=null;this.masterLevel=.55;
    this.paused=true;this.disposed=false;this.voices=new Set();this.maxVoices=12;
    this.rolling=null;this.strongVariant=0;this.netVariant=0;this.seed=3729;
    this.forward=new FT.Vector3();this.up=new FT.Vector3();this.listenerPosition=new FT.Vector3();
    this.fallbackKick=null;this.fallbackNet=null;this.decoding=null;
  }
  async start(){
    if(this.disposed)return false;
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
    try{
      if(!this.context){
        this.context=new Audio({latencyHint:'interactive'});
        this.gain=this.context.createGain();this.gain.gain.value=this.paused?0:this.masterLevel;
        this.ceiling=this.context.createWaveShaper();const curve=new Float32Array(1025);
        for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1,a=Math.abs(x);curve[i]=Math.sign(x)*(a<=.8?a:.8+.18*Math.tanh((a-.8)/.18));}
        this.ceiling.curve=curve;this.ceiling.oversample='2x';this.gain.connect(this.ceiling);this.ceiling.connect(this.context.destination);
        this.makeFallbacks();
      }
      // Called in the entry gesture, before any await.
      const resume=this.context.state==='running'?Promise.resolve():this.context.resume();
      await resume;
      await FootballAudio.load();
      if(this.disposed)return false;
      if(!this.decoding)this.decoding=Promise.all([...FootballAudio.bank.values()].map(async entry=>{
        if(entry.buffer||!entry.encoded)return;
        try{const decoded=await this.context.decodeAudioData(entry.encoded.slice(0));if(!this.disposed)entry.buffer=FootballAudio.prepare(this.context,decoded,entry.definition);}
        catch(error){console.warn('Audio decode unavailable: '+entry.definition.file,error);}
        entry.encoded=null;
      }));
      await this.decoding;
      return !this.disposed&&this.context.state==='running';
    }catch(error){console.warn('Audio unavailable',error);return false;}
  }
  makeFallbacks(){
    const sampleRate=this.context.sampleRate,count=Math.ceil(sampleRate*.18);
    this.fallbackKick=this.context.createBuffer(1,count,sampleRate);this.fallbackNet=this.context.createBuffer(1,count,sampleRate);
    const kick=this.fallbackKick.getChannelData(0),net=this.fallbackNet.getChannelData(0);let seed=1277,last=0;
    for(let i=0;i<count;i++){
      const t=i/sampleRate;seed=(seed*1664525+1013904223)>>>0;last=last*.64+(seed/4294967296*2-1)*.36;
      const edge=Math.min(1,t/.001,(.18-t)/.006);
      kick[i]=edge*(last*.55*Math.exp(-t*80)+Math.sin(2*Math.PI*(130*t-100*t*t))*.55*Math.exp(-t*55));
      net[i]=edge*last*.65*Math.exp(-t*20);
    }
  }
  available(){return !this.disposed&&!this.paused&&this.context?.state==='running';}
  speed(value){return Number.isFinite(value)?Math.max(0,value):0;}
  variation(){this.seed=(this.seed*1664525+1013904223)>>>0;return .985+this.seed/4294967296*.03;}
  position(panner,position){
    if(!panner||!position)return;
    const x=Number.isFinite(position.x)?position.x:0,y=Number.isFinite(position.y)?position.y:0,z=Number.isFinite(position.z)?position.z:0;
    if(panner.positionX){panner.positionX.value=x;panner.positionY.value=y;panner.positionZ.value=z;}
    else panner.setPosition(x,y,z);
  }
  makePanner(position){
    if(!position)return null;
    const panner=this.context.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';
    panner.refDistance=2;panner.maxDistance=90;panner.rolloffFactor=1.05;
    this.position(panner,position);return panner;
  }
  finish(voice){
    if(voice.finished)return;voice.finished=true;this.voices.delete(voice);
    if(this.rolling===voice)this.rolling=null;
    voice.source.onended=null;voice.source.disconnect();voice.gain.disconnect();voice.panner?.disconnect();
  }
  stopVoice(voice,fade=.015){
    if(!voice||voice.finished)return;
    const now=this.context.currentTime;
    if(fade>0){
      const stopAt=now+fade;
      if(voice.stopping&&voice.stopAt<=stopAt)return;
      voice.stopping=true;voice.stopAt=stopAt;
      voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setTargetAtTime(0,now,fade/3);
      voice.source.stop(stopAt);
    }else{try{voice.source.stop(now);}catch{}this.finish(voice);}
  }
  voice(buffer,level,position,rate=1,loop=false){
    if(!this.available()||!buffer||!(level>=0))return null;
    while(this.voices.size>=this.maxVoices)this.stopVoice(this.voices.values().next().value,0);
    const context=this.context,source=context.createBufferSource(),gain=context.createGain(),panner=this.makePanner(position);
    source.buffer=buffer;source.playbackRate.value=rate;source.loop=loop;
    gain.gain.value=level;source.connect(gain);if(panner){gain.connect(panner);panner.connect(this.gain);}else gain.connect(this.gain);
    const voice={source,gain,panner,loop,stopping:false,finished:false};this.voices.add(voice);
    source.onended=()=>this.finish(voice);source.start(context.currentTime);return voice;
  }
  play(id,level,position,rate=1){
    const entry=FootballAudio.bank.get(id);
    if(!entry?.buffer)return false;
    return !!this.voice(entry.buffer,level*footballClamp(entry.definition.gain??1,0,4),position,rate);
  }
  kick(value=5,position){
    if(!this.available())return false;const speed=this.speed(value);if(speed<.05)return false;
    const id=speed<1.5?'ball_touch_soft_01':speed<5?'ball_kick_medium_01':speed<14?('ball_kick_strong_0'+(1+(this.strongVariant++%2))):'ball_kick_hard_01';
    const level=footballClamp(.16+.035*speed,.16,1.1);
    return this.play(id,level,position,this.variation())||!!this.voice(this.fallbackKick,level*.7,position);
  }
  frame(value,position){
    if(!this.available())return false;const speed=this.speed(value);if(speed<.1)return false;
    const level=footballClamp(.2+speed*.035,.2,1);
    return this.play(speed<6?'goal_frame_soft_01':'goal_frame_hard_01',level,position,this.variation())||!!this.voice(this.fallbackKick,level*.5,position);
  }
  save(value,position,surface){
    if(!this.available())return false;const speed=this.speed(value);if(speed<.1)return false;
    const level=footballClamp(.2+speed*.035,.2,.95)*(surface==='glove' ? .85 : 1);
    return this.play('keeper_hit_01',level,position,this.variation())||!!this.voice(this.fallbackKick,level*.6,position);
  }
  net(value=1,position,footId){
    if(!this.available())return false;const speed=this.speed(value);if(speed<.1)return false;
    const id='goal_net_0'+(1+(this.netVariant++%3)),level=footballClamp(.15+speed*.018,.15,.72)*(footId!=null ? .55 : 1);
    return this.play(id,level,position,this.variation())||!!this.voice(this.fallbackNet,level,position);
  }
  whistle(){return this.available()&&this.play('whistle_start_01',.65,null);}
  updateListener(controls){
    if(!controls?.headWorld||!controls.viewOrientation)return;
    const listener=this.context.listener;this.listenerPosition.copy(controls.headWorld);
    this.forward.set(0,0,-1).applyQuaternion(controls.viewOrientation);this.up.set(0,1,0).applyQuaternion(controls.viewOrientation);
    const p=this.listenerPosition,f=this.forward,u=this.up;
    if(listener.positionX){
      listener.positionX.value=p.x;listener.positionY.value=p.y;listener.positionZ.value=p.z;
      listener.forwardX.value=f.x;listener.forwardY.value=f.y;listener.forwardZ.value=f.z;
      listener.upX.value=u.x;listener.upY.value=u.y;listener.upZ.value=u.z;
    }else{listener.setPosition(p.x,p.y,p.z);listener.setOrientation(f.x,f.y,f.z,u.x,u.y,u.z);}
  }
  update(ball,controls,active,dt){
    if(!this.context||this.disposed)return;
    this.updateListener(controls);
    if(!active||!this.available()||!ball){this.resetBall();return;}
    const speed=Math.hypot(ball.velocity.x,ball.velocity.z),grounded=ball.position.y<=ball.radius+.018&&Math.abs(ball.velocity.y)<.25;
    if(!Number.isFinite(speed)||!grounded||speed<(this.rolling ? .1 : .18)){this.resetBall();return;}
    const entry=FootballAudio.bank.get('ball_roll_grass_loop');if(!entry?.buffer)return;
    if(!this.rolling)this.rolling=this.voice(entry.buffer,0,ball.position,1,true);
    const voice=this.rolling;if(!voice)return;
    this.position(voice.panner,ball.position);
    const level=(.025+.155*Math.sqrt(Math.min(speed,12)/12))*footballClamp(entry.definition.gain??1,0,4);
    const rate=.8+.35*Math.min(speed/8,1),now=this.context.currentTime;
    voice.gain.gain.setTargetAtTime(level,now,.035);voice.source.playbackRate.setTargetAtTime(rate,now,.06);
  }
  resetBall(){if(this.rolling){const voice=this.rolling;this.rolling=null;this.stopVoice(voice,.08);}}
  pause(paused){
    this.paused=!!paused;if(!this.context)return;
    if(this.paused){this.resetBall();for(const voice of this.voices)this.stopVoice(voice,.015);}
    this.gain.gain.setTargetAtTime(this.paused?0:this.masterLevel,this.context.currentTime,.02);
    if(!this.paused&&this.context.state==='suspended')this.context.resume().catch(()=>{});
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.rolling=null;
    for(const voice of this.voices)this.stopVoice(voice,0);
    this.gain?.disconnect();this.ceiling?.disconnect();this.context?.close().catch(()=>{});
  }
}

export { FootballAudio };
