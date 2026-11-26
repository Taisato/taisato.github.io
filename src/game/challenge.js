import { FB, footballClamp } from '../config.js';

class FootballChallenge {
  constructor({random=Math.random}={}) {
    this.random=random;
    this.active=false;this.phase='idle';this.score=0;this.lives=3;this.touches=3;
    this.round=0;this.outcome=null;this.resultAge=0;this.chance=null;
    this.time=0;this.lastTouchTime=0;this.settledAge=0;this.saveStoppedAge=0;
    this.savePending=false;this._contacts=new Map();
    this._motion=null;this._motionObserved=false;
    this._snapshot={mode:'challenge',phase:'idle',score:0,lives:3,touches:3,round:0,outcome:null};
  }

  get snapshot() {
    const s=this._snapshot;
    s.phase=this.phase;s.score=this.score;s.lives=this.lives;s.touches=this.touches;
    s.round=this.round;s.outcome=this.outcome;
    return s;
  }

  start() {
    this.active=true;this.score=0;this.lives=3;this.round=0;this.time=0;
    this.chance=null;
    return this._newChance();
  }

  next() {
    if(!this.active||this.phase!=='result'||this.lives<=0)return null;
    return this._newChance();
  }

  stop() {
    this.active=false;this.phase='idle';this.outcome=null;this.resultAge=0;
    this._motion=null;this._motionObserved=false;this._contacts.clear();
  }

  _random() {
    const n=this.random();return Number.isFinite(n)?footballClamp(n,0,1-.000000001):.5;
  }

  _newChance() {
    const progress=1-Math.exp(-Math.max(0,this.score)/6);
    let depth=11+progress*5+this._random()*(4+progress*6);
    let x=(this._random()*2-1)*(3+progress*10);
    // Later chances mix longer approaches with genuinely tighter angles. All
    // balls remain in front of the guarded goal and clear of his starting body.
    if(progress>.15&&this._random()<progress*.62){
      depth=8.5+this._random()*8;
      x=(this._random()<.5?-1:1)*(4+progress*6+this._random()*(3+progress*5));
    }
    const z=-FB.halfLength+depth,previous=this.chance?.ball;
    if(previous&&Math.hypot(x-previous.x,z-previous.z)<2){
      x=Math.abs(x)>2?-x:(x<=0?2.8:-2.8);
    }
    const distance=Math.hypot(x,depth),forwardX=-x/distance,forwardZ=-depth/distance;
    this.chance={
      ball:{x,y:FB.ballRadius,z},
      player:{x:x-forwardX*.84,y:0,z:z-forwardZ*.84},
      yaw:Math.atan2(-forwardX,-forwardZ),difficulty:this.score
    };
    this.round++;this.touches=3;this.phase='ready';this.outcome=null;this.resultAge=0;
    this.lastTouchTime=this.time;this.settledAge=0;this.saveStoppedAge=0;this.savePending=false;
    this._contacts.clear();this._motion=null;this._motionObserved=false;
    return this.chance;
  }

  _crossing(from,to,plane) {
    return from<plane&&to>=plane?(plane-from)/(to-from):Infinity;
  }

  observeMotion(previous,current,radius=FB.ballRadius,events=null) {
    if(!this.active||(this.phase!=='ready'&&this.phase!=='live')||!previous||!current)return;
    this._motionObserved=true;
    if(this._motion||!Number.isFinite(previous.x+previous.y+previous.z+current.x+current.y+current.z))return;
    const r=Number.isFinite(radius)?Math.max(0,radius):FB.ballRadius;
    let first=Infinity,kind=null;
    const end=this._crossing(-previous.z,-current.z,FB.halfLength+r);
    if(end<first){
      const x=previous.x+(current.x-previous.x)*end;
      const y=previous.y+(current.y-previous.y)*end;
      first=end;
      kind=Math.abs(x)<=FB.goalWidth*.5-r+.000001&&y>=r-.005&&y<=FB.goalHeight-r+.000001?'goal':'out';
    }
    const far=this._crossing(previous.z,current.z,FB.halfLength+r);
    const right=this._crossing(previous.x,current.x,FB.halfWidth+r);
    const left=this._crossing(-previous.x,-current.x,FB.halfWidth+r);
    const outside=Math.min(far,right,left);
    if(outside<first){first=outside;kind='out';}
    if(kind)this._motion={kind,eventCount:events?events.length:Infinity};
  }

  _touch(event) {
    const id=event.footId??'player',time=Number.isFinite(event.time)?event.time:this.time;
    const p=event.position,last=this._contacts.get(id);
    // The physics solver already reports contact edges. This small spatial guard
    // merges numerical recontacts of one stroke, without swallowing quick
    // opposite-foot touches or imposing a one-second delay on juggling.
    if(last&&time>=last.time&&time-last.time<=.10&&p&&last.hasPosition&&
      Math.hypot(p.x-last.x,p.y-last.y,p.z-last.z)<.22)return false;
    this._contacts.set(id,{time,hasPosition:!!p,x:p?.x||0,y:p?.y||0,z:p?.z||0});
    this.lastTouchTime=this.time;this.settledAge=0;this.saveStoppedAge=0;this.savePending=false;
    this.phase='live';
    if(this.touches===0)return true;
    this.touches--;
    return false;
  }

  _resolve(outcome) {
    if(this.phase!=='ready'&&this.phase!=='live')return null;
    this.outcome=outcome;this.resultAge=0;
    if(outcome==='goal'){this.score++;this.lives=Math.min(3,this.lives+1);}
    else this.lives=Math.max(0,this.lives-1);
    this.phase=this.lives>0?'result':'gameover';
    this._motion=null;this._motionObserved=false;
    return outcome;
  }

  update(dt,{ball,previous,events=[],keeper=null}={}) {
    if(!this.active||!(dt>0)||!Number.isFinite(dt))return null;
    dt=Math.min(dt,.1);this.time+=dt;
    if(this.phase==='result'||this.phase==='gameover'){this.resultAge+=dt;return null;}
    if(!ball?.position||!ball.velocity)return null;
    const p=ball.position,v=ball.velocity,r=ball.radius??FB.ballRadius;
    if(!Number.isFinite(p.x+p.y+p.z+v.x+v.y+v.z))return this._resolve('miss');
    if(!this._motionObserved&&previous)this.observeMotion(previous,p,r,events);
    const motion=this._motion;
    const count=Math.min(events.length,motion?.eventCount??events.length);
    let extraTouch=false;
    for(let i=0;i<count;i++){
      const event=events[i];
      if(event.type==='touch')extraTouch=this._touch(event)||extraTouch;
      else if(event.type==='save')this.savePending=true;
    }
    this._motion=null;this._motionObserved=false;
    if(extraTouch)return this._resolve('touches');
    if(motion){
      if(motion.kind!=='goal'||this.phase==='live')return this._resolve(motion.kind);
    }
    // Also handle a boundary state after a pause/relocalization without assuming
    // that a ball placed behind the goal entered through the mouth.
    if(Math.abs(p.x)>FB.halfWidth+r||Math.abs(p.z)>FB.halfLength+r)return this._resolve('out');
    if(this.phase==='ready')return null;
    const speed=Math.hypot(v.x,v.y,v.z),grounded=p.y<=r+.045;
    const nearKeeper=keeper?.enabled!==false&&keeper?.position&&
      Math.hypot(p.x-keeper.position.x,p.z-keeper.position.z)<1.35&&p.y<2.2;
    // A parry is live. Only a ball that genuinely settles at the keeper for a
    // sustained interval counts as secured; a player's recovery clears this.
    this.saveStoppedAge=this.savePending&&nearKeeper&&speed<.38?this.saveStoppedAge+dt:0;
    if(this.saveStoppedAge>=.8)return this._resolve('saved');
    this.settledAge=this.touches===0&&grounded&&speed<.16?this.settledAge+dt:0;
    if(this.settledAge>=.55)return this._resolve('touches');
    // The last shot gets time to complete its flight, bounces and goal-line
    // crossing. There is no time limit before shooting or with touches left.
    if(this.touches===0&&this.time-this.lastTouchTime>14)return this._resolve('touches');
    return null;
  }
}

export { FootballChallenge };
