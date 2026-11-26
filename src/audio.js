import { footballClamp } from "./config.js";

class FootballAudio {
  constructor(){this.context=null;this.gain=null;this.noise=null;this.ceiling=null;this.masterLevel=.46;}
  async start(){
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    try{
      if(!this.context){
        this.context=new Audio();this.gain=this.context.createGain();this.gain.gain.value=this.masterLevel;
        this.ceiling=this.context.createWaveShaper();const curve=new Float32Array(513);
        for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1,a=Math.abs(x);curve[i]=Math.sign(x)*(a<=.6?a:.6+.18*Math.tanh((a-.6)/.18));}
        this.ceiling.curve=curve;this.gain.connect(this.ceiling);this.ceiling.connect(this.context.destination);
        this.noise=this.context.createBuffer(1,Math.ceil(this.context.sampleRate*.15),this.context.sampleRate);
        const data=this.noise.getChannelData(0);let seed=1277,last=0;
        for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;last=last*.64+((seed/4294967296)*2-1)*.36;data[i]=last;}
      }
      if(this.context.state==='suspended')await this.context.resume();
    }catch(error){console.warn('Audio unavailable',error);}
  }
  kick(speed=5){
    if(!this.context||this.context.state!=='running')return;
    const c=this.context,now=c.currentTime,level=footballClamp(speed/15,.12,.85);
    const source=c.createBufferSource();source.buffer=this.noise;
    const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1100+level*500;filter.Q.value=-3.0103;
    const gain=c.createGain();gain.gain.setValueAtTime(level*.65,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.035);
    source.connect(filter);filter.connect(gain);gain.connect(this.gain);source.start(now);source.stop(now+.045);
    // A compact low thud carries the impact; the quiet tail adds body without delaying it.
    const osc=c.createOscillator(),body=c.createGain();osc.frequency.setValueAtTime(130,now);osc.frequency.exponentialRampToValueAtTime(105,now+.035);
    body.gain.setValueAtTime(.0001,now);body.gain.linearRampToValueAtTime(level*.9,now+.0015);body.gain.exponentialRampToValueAtTime(.0001,now+.072);
    osc.connect(body);body.connect(this.gain);osc.start(now);osc.stop(now+.075);
    const tail=c.createOscillator(),resonance=c.createGain();tail.frequency.setValueAtTime(100,now+.04);tail.frequency.exponentialRampToValueAtTime(80,now+.18);
    resonance.gain.setValueAtTime(.0001,now+.04);resonance.gain.linearRampToValueAtTime(level*.05,now+.055);
    resonance.gain.linearRampToValueAtTime(level*.0375,now+.12);resonance.gain.exponentialRampToValueAtTime(.0001,now+.165);
    tail.connect(resonance);resonance.connect(this.gain);tail.start(now+.04);tail.stop(now+.175);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    osc.onended=()=>{osc.disconnect();body.disconnect();};
    tail.onended=()=>{tail.disconnect();resonance.disconnect();};
  }
  net(speed=1){
    if(!this.context||this.context.state!=='running')return;
    const c=this.context,now=c.currentTime,level=footballClamp(speed/28,.035,.34);
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();
    source.buffer=this.noise;source.playbackRate.value=.72;
    filter.type='bandpass';filter.frequency.value=1050;filter.Q.value=.55;
    gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(level,now+.006);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.18);
    source.connect(filter);filter.connect(gain);gain.connect(this.gain);source.start(now);source.stop(now+.19);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  pause(paused){if(this.gain&&this.context)this.gain.gain.setTargetAtTime(paused?0:this.masterLevel,this.context.currentTime,.04);}
  dispose(){this.context?.close().catch(()=>{});}
}

export { FootballAudio };
