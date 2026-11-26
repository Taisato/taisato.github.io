import { FT } from '../../vendor/three.js';

// Render-aligned bounds with actual world motion. Moving the camera never
// creates an object velocity, and the collector does not alter any game pose.
class FootballMotionSources {
  constructor(field, controls, keeper) {
    this.field=field;this.controls=controls;this.keeper=keeper;
    const source=name=>({name,position:new FT.Vector3(),velocity:new FT.Vector3(),radius:0,enabled:false});
    this.sources=[source('ball'),source('left boot'),source('right boot'),
      source('keeper body'),source('left glove'),source('right glove')];
    this._bootCentres=[];this._bootRadii=[];
    for(let i=0;i<2;i++){
      const hand=controls.hands[i],sphere=hand.visual.boot.geometry.boundingSphere;
      this._bootCentres.push(sphere?sphere.center.clone():hand.colliderOffset.clone());
      this._bootRadii.push(sphere?sphere.radius:hand.foot.radius+hand.foot.halfLength);
    }
    this._previous=new FT.Vector3();this._keeperIndices=[2,0,1];
    this._primed=false;this._keeperTime=-Infinity;
  }

  reset() {
    this._primed=false;this._keeperTime=-Infinity;
    for(let i=0;i<this.sources.length;i++){
      this.sources[i].enabled=false;this.sources[i].velocity.set(0,0,0);
    }
    return this.sources;
  }

  _validate(source) {
    const valid=source.radius>0&&Number.isFinite(source.radius)&&
      Number.isFinite(source.position.lengthSq()+source.velocity.lengthSq());
    source.enabled=valid;
    if(!valid)source.velocity.set(0,0,0);
  }

  update(dt, ball, enabled=true) {
    if(!enabled||!Number.isFinite(dt)||dt<=0||dt>.08)return this.reset();
    const fresh=!this._primed;
    const b=this.sources[0],mesh=this.field.ballMesh;
    // The pitch root has no transform; its ball position is already world-space.
    b.enabled=false;b.velocity.set(0,0,0);
    if(mesh&&mesh.visible!==false&&ball?.position&&ball?.velocity){
      b.position.copy(mesh.position);b.velocity.copy(ball.velocity);b.radius=ball.radius;
      this._validate(b);
    }
    for(let i=0;i<2;i++){
      const hand=this.controls.hands[i],s=this.sources[i+1];
      s.enabled=false;s.velocity.set(0,0,0);s.radius=this._bootRadii[i];
      if(!hand.visual.root.visible||!hand.foot.enabled||!hand.tracked)continue;
      s.position.copy(this._bootCentres[i]).applyQuaternion(hand.frameTargetOrientation).add(hand.frameTarget);
      this._previous.copy(this._bootCentres[i]).applyQuaternion(hand.frameStartOrientation).add(hand.frameStart);
      s.velocity.subVectors(s.position,this._previous).divideScalar(dt);
      this._validate(s);
    }
    const keeper=this.keeper,step=keeper._fixedDt;
    const keeperReset=keeper.time<this._keeperTime;
    for(let i=0;i<3;i++){
      const s=this.sources[i+3],index=this._keeperIndices[i];
      const view=keeper.visual.capsules[index],physical=keeper.colliders[index];
      s.enabled=false;s.velocity.set(0,0,0);
      if(!keeper.enabled||!keeper.visual.root.visible||!view||!physical||!(step>0)||!Number.isFinite(step))continue;
      s.position.addVectors(view.a,view.b).multiplyScalar(.5);
      s.radius=view.radius+.5*view.a.distanceTo(view.b);
      // Collider history contains the real animated limb motion, including
      // dives where keeper.velocity is zero. Rendering never overwrites it.
      if(!keeperReset){
        this._previous.subVectors(physical.a,physical.previousA);
        s.velocity.subVectors(physical.b,physical.previousB).add(this._previous).multiplyScalar(.5/step);
      }
      this._validate(s);
    }
    // Reset/respawn/relocalization primes bounds without manufacturing a sweep.
    if(fresh)for(let i=0;i<this.sources.length;i++)this.sources[i].velocity.set(0,0,0);
    this._primed=true;this._keeperTime=keeper.time;
    return this.sources;
  }
}

export {FootballMotionSources};
