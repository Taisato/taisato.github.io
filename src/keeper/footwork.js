import { FT } from "../../vendor/three.js";
import { footballClamp } from "../config.js";

const wrappedAngle = x => Math.atan2(Math.sin(x), Math.cos(x));

// Keep planted ankles in pitch coordinates. Physics and the renderer sample the
// same two poses, so a glove or boot never leads its collision capsule.
class KeeperFootwork {
  constructor(scale) {
    this.scale = scale;
    this.feet = [-1, 1].map(side => ({
      side, at:new FT.Vector3(), previous:new FT.Vector3(), home:new FT.Vector3(),
      pitch:0, previousPitch:0, yaw:0, previousYaw:0
    }));
    this.start = new FT.Vector3();
    this.land = new FT.Vector3();
    this.lastRoot = new FT.Vector3();
    this.velocity = new FT.Vector3();
  }

  homes(state) {
    const {x,z} = state.position, sn = Math.sin(state.yaw), cs = Math.cos(state.yaw);
    for (const f of this.feet) {
      const width = f.side * .231 * this.scale, stagger = (-.018 + f.side * .018) * this.scale;
      f.home.set(x + cs*width + sn*stagger, 0, z - sn*width + cs*stagger);
    }
  }

  reset(state) {
    this.homes(state);
    for (const f of this.feet) {
      f.at.copy(f.home); f.previous.copy(f.at);
      f.pitch = f.previousPitch = 0;
      f.yaw = f.previousYaw = state.yaw;
    }
    this.lastRoot.copy(state.position); this.velocity.set(0,0,0);
    this.phase = state.phase; this.swing = -1; this.lastFoot = -1;
    this.weight = this.previousWeight = 0;
    this.effort = this.previousEffort = 0;
  }

  begin(i,state,speed) {
    const f=this.feet[i];
    this.swing=i; this.lastFoot=i; this.elapsed=0;
    this.start.copy(f.at); this.land.copy(f.home);
    this.startYaw=f.yaw; this.endYaw=state.yaw;
    this.duration=footballClamp(.46/(speed+.53),.14,.31);
    this.land.addScaledVector(this.velocity,Math.min(.33/Math.max(.01,speed),1.28*this.duration));
    this.land.y=0;
    // In a sideways shuffle the trailing shoe closes the gap without
    // stepping across the supporting foot, even when the attacker cuts back.
    const support=this.feet[1-i].at,cs=Math.cos(state.yaw),sn=Math.sin(state.yaw);
    const gap=f.side*((this.land.x-support.x)*cs-(this.land.z-support.z)*sn);
    const spread=f.side*Math.max(0,.28-gap);
    this.land.x+=cs*spread;this.land.z-=sn*spread;
    const dx=this.land.x-this.start.x,dz=this.land.z-this.start.z;
    this.lift=footballClamp(.014+Math.hypot(dx,dz)*.17,.018,.107);
    this.roll=footballClamp(-(dx*Math.sin(state.yaw)+dz*Math.cos(state.yaw))/.54,-1,1);
  }

  step(state,dt) {
    if (state.phase!=='ready') {
      if(this.phase==='ready'){
        for(const f of this.feet){f.previous.copy(f.at);f.previousPitch=f.pitch;f.previousYaw=f.yaw;}
        this.previousWeight=this.weight;this.previousEffort=this.effort;
      }
      this.phase=state.phase;return;
    }
    if (this.phase!=='ready' || this.lastRoot.distanceToSquared(state.position)>1) {this.reset(state);return;}
    this.homes(state);
    const v=this.velocity.subVectors(state.position,this.lastRoot).multiplyScalar(1/dt);
    this.lastRoot.copy(state.position);
    v.y=0;
    this.previousWeight=this.weight; this.previousEffort=this.effort;
    for(const f of this.feet){f.previous.copy(f.at); f.previousPitch=f.pitch; f.previousYaw=f.yaw;}
    const speed=v.length();
    if(this.swing<0){
      const left=this.feet[0],right=this.feet[1];
      const l=Math.hypot(left.home.x-left.at.x,left.home.z-left.at.z);
      const r=Math.hypot(right.home.x-right.at.x,right.home.z-right.at.z);
      if(Math.max(l,r)>.044 || Math.abs(wrappedAngle(state.yaw-left.yaw))>.36 || Math.abs(wrappedAngle(state.yaw-right.yaw))>.36){
        const next=this.lastFoot<0 ? Number(v.x*Math.cos(state.yaw)-v.z*Math.sin(state.yaw)>0) : 1-this.lastFoot;
        // At rest, correct the foot that is still displaced after braking.
        this.begin(speed<.12&&Math.abs(l-r)>.03?Number(r>l):next,state,speed);
      }
    }
    this.effort+=(footballClamp(speed/1.65,0,1)-this.effort)*(1-Math.exp(-dt*11));
    if(this.swing<0){this.weight=0;return;}
    const f=this.feet[this.swing];
    this.elapsed+=dt;
    const p=Math.min(1,this.elapsed/this.duration),e=p*p*(3-2*p),arch=Math.sin(Math.PI*p)**2;
    f.at.lerpVectors(this.start,this.land,e);
    f.at.y=this.lift*arch;
    f.pitch=this.roll*arch*(p*.88-.48);
    f.yaw=this.startYaw+wrappedAngle(this.endYaw-this.startYaw)*e;
    this.weight=-f.side*arch;
    if(p===1){this.swing=-1;f.at.copy(this.land);f.pitch=0;this.weight=0;}
  }
}
export { KeeperFootwork };
