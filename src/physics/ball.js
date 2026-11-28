import { FT } from "../../vendor/three.js";
import { FB } from "../config.js";
import { FootballShotSurface, outsidePenaltyArea } from './shot-surface.js';

const SHOT_FOLLOW_THROUGH_SECONDS = .22;
const MAX_CURL_PACE_BONUS = .08;
const MAX_HIGH_SHOT_PACE_BONUS = .12;
const MAX_RUNUP_PACE_BONUS = .10;

function shotStrengthScale(strength, speed, impulse, drive, approach) {
  if(strength<=1||speed<=0||approach<=0)return 1;
  const active=Math.min(speed,impulse*Math.max(0,Math.min(1,drive/approach)));
  return 1+(strength-1)*active/speed;
}

/* Football rigid sphere simulation; metres, seconds, kilograms.
   The moving boot and visible shin supply contact velocity, lift and spin. Low-speed
   contacts settle; firm strikes use the same material in every instep pose. */
class FootballPhysics {
  constructor(config = {}) {
    this.config = Object.assign({
      radius: FB.ballRadius, mass: FB.ballMass, gravity: FB.gravity,
      maxSpeed: 38, maxSpin: 190, maxFootSurfaceSpeed: 44, maxInstepAngularSpeed: 8, restitution: .57, rollingResistance: .38,
      slowRollingResistance: .08,
      controlRollingResistance: .18,
      puntRollingResistance: .6,
      dribbleRollingResistance: .28,
      groundFriction: .53, footRadius: .075, footHalfLength: .095,
      footRestitution: .6, footFriction: .4, contactSkin: .002,
      footSoftImpactSpeed: .25, footFirmImpactSpeed: 4.5,
      footPowerCompressionSpeed: 24, footReceiveRestitution: .45,
      footControlRestitutionScale: .06, footControlFrictionScale: .10,
      footStrikeBlendStart: 4.4, footStrikeBlendEnd: 6.4,
      footLiftRestoration: .35,
      instepLaunchStartSpeed: 4.4, instepLaunchFullSpeed: 6,
      instepLaunchAngle: Math.PI/15,
      airSpinDecay: .13, magnus: .0032, sideCurveMultiplier: 1.12, maxCurveAcceleration: 7.5
    }, config);
    const V = FT.Vector3;
    this.ball = {
      position: new V(0, this.config.radius, 0), velocity: new V(), spin: new V(),
      orientation: new FT.Quaternion(), radius: this.config.radius,
      mass: this.config.mass, curveMultiplier: 1, curvePace: 1, shotSurface: new FootballShotSurface()
    };
    this.events = [];
    this.time = 0;
    this.footStates = new Map();
    this.footData = [];
    this.frames = [];
    const x = FB.goalWidth * .5 + FB.postRadius;
    const y = FB.goalHeight + FB.postRadius;
    for (const sign of [-1, 1]) {
      const z = sign * FB.halfLength;
      this.frames.push(
        {a: new V(-x, 0, z), b: new V(-x, y, z)},
        {a: new V(x, 0, z), b: new V(x, y, z)},
        {a: new V(-x, y, z), b: new V(x, y, z)}
      );
    }
    this._previous = new V(); this._axis = new V(); this._normal = new V();
    this._point = new V(); this._segment = new V(); this._relative = new V();
    this._tangent = new V(); this._impulse = new V(); this._cross = new V();
    this._surface = new V(); this._footCenter = new V(); this._a = new V(); this._b = new V();
    this._ankleCenter = new V(); this._shoePoint = new V(); this._shoeNormal = new V();
    this._spinAxis = new V(); this._rotation = new FT.Quaternion();
    this._footLocal = new V(); this._footLocalNormal = new V(); this._contactArm = new V();
    this._frameEventTime = -10;
    this._shotSpeedLimit = 0;
    this._launchedFoot = null;
    this._followThroughUntil = 0;
    this._launchDirection = new V();
    this._regularRunBall = {velocity:new V(), spin:new V(), radius:this.ball.radius};
    this._regularRunSurface = new V(); this._regularRunMotion = new V();
    this.setPlayerAbilities(null);
    this.resetShotHistory();
  }

  setPlayerAbilities(effects) {
    const multiplier = value => Number.isFinite(value) && value >= 1 ? value : 1;
    const bonus = value => Number.isFinite(value) && value > 0 ? value : 0;
    this.shotStrength = multiplier(effects?.shotStrength);
    this.airShotStrength = multiplier(effects?.airShotStrength);
    this.openingStrikePace = bonus(effects?.openingStrikePace);
    this.outsideShotPace = bonus(effects?.outsideShotPace);
    this.volleyBounceGrace = bonus(effects?.volleyBounceGrace);
    this.volleyDriven = effects?.volleyDriven > 0;
    this.ball.curveMultiplier = multiplier(effects?.curve);
    this.ball.shotSurface.configure(effects);
    if (this.shotStrength === 1 && this.airShotStrength === 1 && !this.openingStrikePace && !this.outsideShotPace) {
      this._shotSpeedLimit = 0; this._launchedFoot = null;
    }
  }

  resetShotHistory() {
    this._curlBoot = null;
    this.ball.curvePace = 1;
    this.ball.fromPlayerShot = false;
    this._openingStrike = true;
    this.ball.offWoodwork = false;
    this._sawFlight = false;
    this._lastBounceTime = -Infinity;
  }

  redirectPlayerShot(surface) {
    this._curlBoot = null;
    this.ball.curvePace = 1;
    this.ball.shotSurface.redirect();
    // Contact sounds are debounced. Even a quiet graze can send the ball in.
    this.ball.offWoodwork = surface === 'frame' && this.ball.position.z < 0;
  }

  reset(position, velocity) {
    const b = this.ball;
    b.position.copy(position);
    b.position.y = Math.max(b.radius, b.position.y);
    velocity ? b.velocity.copy(velocity) : b.velocity.set(0, 0, 0);
    b.spin.set(0, 0, 0); b.orientation.identity();
    b.shotSurface.reset();
    this.resetShotHistory();
    this._sawFlight = b.position.y > b.radius + .032;
    this.events.length = 0;
    this.footStates.clear();
    this._frameEventTime = -10;
    this._shotSpeedLimit = 0;
    this._launchedFoot = null;
  }

  clearContacts() {
    if (this._curlBoot) this._curlBoot.contact = false;
    this.footStates.clear(); this._launchedFoot = null;
  }

  prepareFeet(feet, dt) {
    if (this.time >= this._followThroughUntil) this._launchedFoot = null;
    let count = 0;
    for (const state of this.footStates.values()) state.present = false;
    for (let i = 0; i < feet.length; i++) {
      const foot = feet[i];
      if (foot.enabled === false || !foot.position || !foot.previous) continue;
      const distance = foot.position.distanceTo(foot.previous);
      // A lost tracking pose or placement must never become a huge kick.
      if (!Number.isFinite(distance) || distance > Math.max(.7, dt * 25)) continue;
      let f = this.footData[count];
      if (!f) {
        f = {axis:new FT.Vector3(),velocity:new FT.Vector3(),ankleVelocity:new FT.Vector3(),angularVelocity:new FT.Vector3(),bootDriveAngularVelocity:new FT.Vector3(),shinDriveAngularVelocity:new FT.Vector3(),orientation:new FT.Quaternion(),previousOrientation:new FT.Quaternion(),targetOrientation:new FT.Quaternion(),inverse:new FT.Quaternion(),previousAnkle:new FT.Vector3(),targetAnkle:new FT.Vector3(),shinOrientation:new FT.Quaternion(),previousShinOrientation:new FT.Quaternion(),targetShinOrientation:new FT.Quaternion(),shinInverse:new FT.Quaternion(),shinAngularVelocity:new FT.Vector3(),contactPart:'boot',foot:null};
        this.footData[count] = f;
      }
      f.foot = foot; f.id = foot.id == null ? i : foot.id;
      if(foot.orientation)f.targetOrientation.copy(foot.orientation).normalize();else f.targetOrientation.identity();
      f.previousOrientation.copy(foot.previousOrientation||f.targetOrientation).normalize();
      f.orientation.copy(f.targetOrientation);f.inverse.copy(f.orientation).invert();
      f.axis.set(0,0,1).applyQuaternion(f.orientation).normalize();
      f.previousAnkle.copy(foot.previous);f.targetAnkle.copy(foot.position);
      if(foot.contactShape&&foot.contactOffset){
        f.previousAnkle.sub(this._axis.copy(foot.contactOffset).applyQuaternion(f.previousOrientation));
        f.targetAnkle.sub(this._axis.copy(foot.contactOffset).applyQuaternion(f.targetOrientation));
      }
      f.angularVelocity.copy(foot.angularVelocity||this._axis.set(0,0,0));if(!Number.isFinite(f.angularVelocity.lengthSq()))f.angularVelocity.set(0,0,0);
      f.targetShinOrientation.copy(foot.shinOrientation||f.targetOrientation).normalize();
      f.previousShinOrientation.copy(foot.previousShinOrientation||f.targetShinOrientation).normalize();
      f.shinOrientation.copy(f.targetShinOrientation);f.shinInverse.copy(f.shinOrientation).invert();
      f.shinAngularVelocity.copy(foot.shinAngularVelocity||this._axis.set(0,0,0));
      if(!Number.isFinite(f.shinAngularVelocity.lengthSq()))f.shinAngularVelocity.set(0,0,0);
      f.bootDriveAngularVelocity.copy(f.angularVelocity);f.shinDriveAngularVelocity.copy(f.shinAngularVelocity);
      const controllerAngular=foot.controlAngularVelocity||foot.shinAngularVelocity;
      if(controllerAngular&&Number.isFinite(controllerAngular.lengthSq())){
        // Instep remains visually immediate. Its pose change is an ankle
        // adjustment, not an unbounded powered kick from the trigger button.
        f.bootDriveAngularVelocity.sub(controllerAngular).clampLength(0,this.config.maxInstepAngularSpeed).add(controllerAngular);
        f.shinDriveAngularVelocity.copy(controllerAngular);
      }
      f.contactPart='boot';
      if (foot.velocity) f.velocity.copy(foot.velocity);
      else f.velocity.subVectors(foot.position, foot.previous).multiplyScalar(1 / dt);
      if (!Number.isFinite(f.velocity.lengthSq())) f.velocity.set(0, 0, 0);
      f.useAnkleVelocity=!!(foot.driveVelocity||foot.ankleVelocity||(foot.contactShape&&foot.contactOffset&&foot.previousOrientation));
      // Real controller/locomotion motion drives the impact; the visual floor
      // limit must not add energy when changing instep raises the displayed shoe.
      f.ankleVelocity.copy(foot.driveVelocity||foot.ankleVelocity||f.velocity);
      if(!Number.isFinite(f.ankleVelocity.lengthSq()))f.ankleVelocity.set(0,0,0);
      if(foot.driveVelocity&&foot.ankleVelocity&&Number.isFinite(foot.ankleVelocity.y)){
        const driveY=f.ankleVelocity.y,actualY=foot.ankleVelocity.y;
        // At the turf penetration limit, raw controller motion can continue
        // while the collision ankle is pinned. Block only that unavailable
        // vertical drive; a clearance/instep pose adjustment must not supply
        // power either. Unconstrained motion keeps its exact existing value.
        if(Math.abs(driveY-actualY)>1e-7)
          f.ankleVelocity.y=driveY>0?Math.min(driveY,Math.max(0,actualY)):
            Math.max(driveY,Math.min(0,actualY));
      }
      if(f.useAnkleVelocity&&!foot.driveVelocity&&!foot.ankleVelocity){
        // foot.velocity remains the supplied contact-centre average. Remove only
        // its rotating-offset chord; the contact lever below is then ankle-based.
        this._axis.subVectors(f.targetAnkle,f.previousAnkle).sub(foot.position).add(foot.previous);
        f.ankleVelocity.addScaledVector(this._axis,1/dt);
      }
      f.radius = Math.max(.04, Math.min(.11, foot.radius || this.config.footRadius));
      f.halfLength = foot.halfLength == null ? this.config.footHalfLength : Math.max(0, Math.min(.15, foot.halfLength));
      // Angular sweeps count too: a toe can cross the ball while the ankle barely moves.
      const bounds=foot.contactShape?.bounds;
      const sweepRadius=bounds?Math.hypot(Math.max(Math.abs(bounds.min[0]),Math.abs(bounds.max[0])),Math.max(Math.abs(bounds.min[1]),Math.abs(bounds.max[1])),Math.max(Math.abs(bounds.min[2]),Math.abs(bounds.max[2]))):f.halfLength+f.radius;
      const shinBounds=foot.shinContactShape?.bounds;
      const shinRadius=shinBounds?Math.hypot(Math.max(Math.abs(shinBounds.min[0]),Math.abs(shinBounds.max[0])),Math.max(Math.abs(shinBounds.min[1]),Math.abs(shinBounds.max[1])),Math.max(Math.abs(shinBounds.min[2]),Math.abs(shinBounds.max[2]))):0;
      f.distance=f.previousAnkle.distanceTo(f.targetAnkle)+Math.max(f.previousOrientation.angleTo(f.targetOrientation)*sweepRadius,f.previousShinOrientation.angleTo(f.targetShinOrientation)*shinRadius);
      // Include the whole swept boot and shin, at any intermediate rotation.
      const bounded=(!foot.contactShape||bounds)&&(!foot.shinContactShape||shinBounds);
      f.contactReach=bounded?Math.max(sweepRadius,shinRadius)+f.distance+this.ball.radius+this.config.contactSkin:Infinity;
      let state = this.footStates.get(f.id);
      if (!state) {
        state = {contact: false, seen: false, present: true, strikeUntil: 0, releaseUntil: 0,
          strikeSpeed:0,strikeNormalY:0,strikeSurfaceY:0,correctDirection:false,releaseDirection:new FT.Vector3()};
        this.footStates.set(f.id, state);
      }
      state.seen = false; state.present = true; f.state = state;
      if (state === this._launchedFoot && f.ankleVelocity.dot(this._launchDirection) < -1) {
        this._launchedFoot = null;
        state.strikeUntil = state.releaseUntil = 0;
      }
      count++;
    }
    for (const state of this.footStates.values()) if (!state.present) {
      state.contact = false; state.strikeUntil = state.releaseUntil = 0;
    }
    return count;
  }

  step(dt, feet = [], goalkeeper = null, nets = null, observeMotion = null) {
    this.events.length = 0;
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    dt = Math.min(dt, .05);
    this.time += dt;
    const b = this.ball, cfg = this.config;
    if (!Number.isFinite(b.position.lengthSq() + b.velocity.lengthSq() + b.spin.lengthSq())) {
      this.reset(new FT.Vector3(0, b.radius, 0)); return;
    }
    b.velocity.clampLength(0, (this._shotSpeedLimit || cfg.maxSpeed) * b.curvePace);
    const footCount = this.prepareFeet(feet, dt);
    if (nets) nets.beginStep(dt, this, this.footData, footCount);
    let travel = b.velocity.length() * dt;
    for (let i = 0; i < footCount; i++) travel = Math.max(travel, this.footData[i].distance);
    if (goalkeeper && goalkeeper.isNear(b, travel)) travel = Math.max(travel, goalkeeper.maxTravel || 0);
    const steps = Math.max(1, Math.min(24, Math.ceil(travel / .042)));
    const h = dt / steps;
    for (let step = 0; step < steps; step++) {
      const alpha = (step + 1) / steps;
      this._previous.copy(b.position);
      this.integrate(h);
      for (let i = 0; i < footCount; i++) this.collideFoot(this.footData[i], alpha, h);
      for (let i = 0; i < this.frames.length; i++) this.collideFrame(this.frames[i]);
      if (goalkeeper) goalkeeper.collide(this, alpha, h);
      if (nets) nets.substep(this, alpha, h);
      this.collideGround(h);
      // Rules observe the resolved path, including crossings within a fixed
      // step. The optional observer never changes the contact simulation.
      if(observeMotion)observeMotion(this._previous,b.position,b.radius,this.events,b.offWoodwork);
      b.velocity.clampLength(0, (this._shotSpeedLimit || cfg.maxSpeed) * b.curvePace);
      if(this._shotSpeedLimit && b.velocity.lengthSq() <= (cfg.maxSpeed * b.curvePace) ** 2) this._shotSpeedLimit = 0;
      b.spin.clampLength(0, cfg.maxSpin * b.curvePace);
      const spinSpeed = b.spin.length();
      if (spinSpeed > .001) {
        this._spinAxis.copy(b.spin).multiplyScalar(1 / spinSpeed);
        this._rotation.setFromAxisAngle(this._spinAxis, spinSpeed * h);
        b.orientation.premultiply(this._rotation).normalize();
      }
    }
    if (nets) nets.endStep();
    for (let i = 0; i < footCount; i++) {
      const f = this.footData[i];
      if (!f.state.seen && (f.state.contact || f.state===this._launchedFoot || f.state.strikeUntil>this.time)) {
        f.orientation.copy(f.targetOrientation);f.inverse.copy(f.orientation).invert();f.axis.set(0,0,1).applyQuaternion(f.orientation);
        f.shinOrientation.copy(f.targetShinOrientation);f.shinInverse.copy(f.shinOrientation).invert();
        this._footCenter.copy(f.foot.position);
        this._ankleCenter.copy(f.targetAnkle);
        let separated;
        if(f.foot.contactShape)separated=this.contactDistance(f,b.radius+.025)>b.radius+.025;
        else{
          this._a.copy(this._footCenter).addScaledVector(f.axis, -f.halfLength);
          this._b.copy(this._footCenter).addScaledVector(f.axis, f.halfLength);
          this.closestPoint(b.position, this._a, this._b, this._point);
          separated=b.position.distanceToSquared(this._point)>(b.radius+f.radius+.025)**2;
        }
        if(separated){
          f.state.contact=false;
          if(f.state===this._launchedFoot&&f.ankleVelocity.lengthSq()<.25**2&&f.bootDriveAngularVelocity.lengthSq()<1){
            this._launchedFoot=null;
            f.state.strikeUntil=f.state.releaseUntil=0;
          }
          if(f.state.strikeUntil>this.time&&f.foot.contactShape&&
            this.contactDistance(f,b.radius+.08)>b.radius+.08)f.state.strikeUntil=f.state.releaseUntil=0;
        }
      }
    }
    if (this._curlBoot && !this._curlBoot.contact) {
      // Wait for the boot to leave: it must produce the original launch angle,
      // sidespin and follow-through before we shorten the shot's travel time.
      const bend = this.smoothContactBlend((Math.abs(b.spin.y) - 4) / 17);
      // A strike aimed high gets there sooner along the same arc. Estimate
      // its height from the released ball, after lift and contact have settled.
      const rise = Math.max(0, b.velocity.y);
      const apex = b.position.y + rise * rise / (2 * Math.max(.001, this.config.gravity));
      const height = this.smoothContactBlend((apex - .9) / 1.2);
      const drive = this.smoothContactBlend((Math.hypot(b.velocity.x, b.velocity.z) - 3) / 4);
      b.curvePace = (1 + MAX_CURL_PACE_BONUS * bend) * (1 + MAX_HIGH_SHOT_PACE_BONUS * height * drive);
      b.velocity.multiplyScalar(b.curvePace);
      b.spin.multiplyScalar(b.curvePace);
      this._curlBoot = null;
    }
  }

  integrate(dt) {
    const b = this.ball, speed = b.velocity.length();
    // Replaying a path k times faster scales velocity and spin by k, and
    // acceleration by k². Use the original path speed for the drag coefficient.
    const pace = b.curvePace, accelerationScale = pace * pace;
    // Smooth drag crisis approximation; the aerodynamic coefficient is bounded.
    const drag = .0108 + .0075 / (1 + Math.exp((speed / pace - 16) * .45));
    this._cross.crossVectors(b.spin, b.velocity).multiplyScalar(this.config.magnus);
    // A little more yaw-spin bend without increasing topspin/backspin lift.
    const cfg = this.config;
    const sideCurve=cfg.magnus*(cfg.sideCurveMultiplier-1)*b.spin.y;
    this._cross.x+=sideCurve*b.velocity.z;
    this._cross.z-=sideCurve*b.velocity.x;
    const curve = b.curveMultiplier + (b.shotSurface.curveOnGrass && b.position.y <= b.radius + .00015 ? .40 : 0);
    const curveMagnitude = curve > 1 ? this._cross.length() : 0;
    const maxCurve = cfg.maxCurveAcceleration * accelerationScale;
    this._cross.clampLength(0, maxCurve);
    if (curveMagnitude > 0) {
      // Boost the existing yaw-spin component after the base cap so even high-spin
      // strikes gain bend without changing the lift generated by topspin/backspin.
      const limited = Math.min(1, maxCurve / curveMagnitude);
      const boost = cfg.magnus * cfg.sideCurveMultiplier * b.spin.y * (curve - 1) * limited;
      this._cross.x += boost * b.velocity.z;
      this._cross.z -= boost * b.velocity.x;
    }
    b.velocity.addScaledVector(this._cross, dt);
    b.velocity.multiplyScalar(1 / (1 + drag * speed * dt));
    b.velocity.y -= this.config.gravity * accelerationScale * dt;
    b.position.addScaledVector(b.velocity, dt);
    b.spin.multiplyScalar(Math.exp(-this.config.airSpinDecay * dt * pace));
  }

  copyFlight(source) {
    const b = this.ball;
    b.position.copy(source.position);
    b.velocity.copy(source.velocity);
    b.spin.copy(source.spin);
    b.curveMultiplier = source.curveMultiplier ?? 1;
    b.curvePace = source.curvePace ?? 1;
    b.fromPlayerShot = source.fromPlayerShot === true;
    b.shotSurface.copy(source.shotSurface);
  }

  closestPoint(point, a, c, target) {
    this._segment.subVectors(c, a);
    const length = this._segment.lengthSq();
    const along = length > 1e-12 ? Math.max(0, Math.min(1,
      this._relative.subVectors(point, a).dot(this._segment) / length)) : 0;
    target.copy(a).addScaledVector(this._segment, along);
    return target;
  }

  shoeDistance(f,maxDistance){
    const foot=f.foot;
    this._footLocal.copy(this.ball.position).sub(this._footCenter).applyQuaternion(f.inverse).add(foot.contactOffset);
    const distance=foot.contactShape.query(this._footLocal,this._point,this._footLocalNormal,maxDistance);
    if(Number.isFinite(distance)){
      this._point.sub(foot.contactOffset).applyQuaternion(f.orientation).add(this._footCenter);
      this._normal.copy(this._footLocalNormal).applyQuaternion(f.orientation).normalize();
      if(!Number.isFinite(this._normal.lengthSq())||this._normal.lengthSq()<.5)this._normal.set(0,1,0);
    }
    return distance;
  }

  shinDistance(f,maxDistance){
    this._footLocal.copy(this.ball.position).sub(this._ankleCenter).applyQuaternion(f.shinInverse);
    const distance=f.foot.shinContactShape.query(this._footLocal,this._point,this._footLocalNormal,maxDistance);
    if(Number.isFinite(distance)){
      this._point.applyQuaternion(f.shinOrientation).add(this._ankleCenter);
      this._normal.copy(this._footLocalNormal).applyQuaternion(f.shinOrientation).normalize();
    }
    return distance;
  }

  contactDistance(f,maxDistance){
    const shoe=this.shoeDistance(f,maxDistance);f.contactPart='boot';
    if(!f.foot.shinContactShape)return shoe;
    this._shoePoint.copy(this._point);this._shoeNormal.copy(this._normal);
    const shin=this.shinDistance(f,maxDistance);
    // These are two visible surfaces of one foot, with one contact/release state.
    // The shin must catch an ankle-height sweep before the ball reaches the laces.
    if(shin<shoe){f.contactPart='shin';return shin;}
    this._point.copy(this._shoePoint);this._normal.copy(this._shoeNormal);return shoe;
  }

  footSurfaceVelocity(f,point,target,subtractRun=null){
    target.copy(f.useAnkleVelocity?f.ankleVelocity:f.velocity);
    if(subtractRun)target.sub(subtractRun);
    if(f.contactPart==='shin'){
      this._contactArm.subVectors(point,this._ankleCenter);
      this._cross.crossVectors(f.shinDriveAngularVelocity,this._contactArm);
      return target.add(this._cross).clampLength(0,this.config.maxFootSurfaceSpeed);
    }
    if(f.foot.contactShape){
      this._contactArm.subVectors(point,this._footCenter);
      if(f.useAnkleVelocity)this._contactArm.add(this._axis.copy(f.foot.contactOffset).applyQuaternion(f.orientation));
      this._cross.crossVectors(f.bootDriveAngularVelocity,this._contactArm);target.add(this._cross);
    }
    // Limit only the assembled velocity at the contact point. Clipping the
    // rotating boot-centre chord first corrupts the recovered ankle motion.
    return target.clampLength(0,this.config.maxFootSurfaceSpeed);
  }

  contactFirmness(speed){
    const cfg=this.config;
    const speedBlend=Math.max(0,Math.min(1,(speed-cfg.footSoftImpactSpeed)/(cfg.footFirmImpactSpeed-cfg.footSoftImpactSpeed)));
    const nudgeBlend=Math.max(0,Math.min(1,(speed-.25)/1.15));
    const controlBlend=Math.max(0,Math.min(1,(speed-.40)/.50));
    const nudge=nudgeBlend*nudgeBlend*(3-2*nudgeBlend),firmness=speedBlend*speedBlend*(3-2*speedBlend);
    return nudge+(firmness-nudge)*controlBlend*controlBlend*(3-2*controlBlend);
  }

  contactCompliance(speed, minimum, strikeSpeed=speed) {
    // Keep tiny touches unchanged, absorb the excess bounce of a moving
    // receiving foot, then restore the established deliberate-strike response.
    // This changes a contact impulse only; a separated ball remains entirely free.
    const control=Math.max(0,Math.min(1,speed-1));
    const strike=Math.max(0,Math.min(1,(strikeSpeed-this.config.footStrikeBlendStart)/
      (this.config.footStrikeBlendEnd-this.config.footStrikeBlendStart)));
    return 1-(1-minimum)*control*control*(3-2*control)*(1-strike*strike*(3-2*strike));
  }

  smoothContactBlend(value) {
    const t=Math.max(0,Math.min(1,value));
    return t*t*(3-2*t);
  }

  controlledPunt(f,surface=this._surface,motion=f.foot.locomotionVelocity,clearance=this.ball.position.y-this.ball.radius) {
    if(!motion||!Number.isFinite(motion.x+motion.y+motion.z))return 0;
    const bodyDrive=this._normal.dot(motion);
    if(bodyDrive<=.1)return 0;
    // The collider keeps its true world-space surface velocity. Separate the
    // controller's effort only when choosing impact compliance: walking into a
    // short touch must not unlock the material response of a deliberate strike.
    const localSpeed=Math.hypot(surface.x-motion.x,surface.y-motion.y,surface.z-motion.z);
    const deliberate=this.smoothContactBlend((localSpeed-this.config.footStrikeBlendStart)/
      (this.config.footStrikeBlendEnd-this.config.footStrikeBlendStart));
    const moving=this.smoothContactBlend((bodyDrive-.1)/.9);
    // Fade through the low toe/shin follow-through, so its second contact does
    // not suddenly regain firm-shot response. Rising lifts remain unrestricted.
    const low=1-this.smoothContactBlend((clearance-.03)/.42);
    const rising=this.smoothContactBlend((surface.y-.15)/.50);
    return low*moving*(1-deliberate)*(1-rising);
  }

  liftRestoration() {
    // A rising boot under the ball, or a genuinely airborne descending ball,
    // needs some rebound for keep-ups. Sample before penetration correction:
    // a rolling side contact must not manufacture its own airborne condition.
    if(this._normal.y<=.35)return 0;
    const b=this.ball,below=this.smoothContactBlend((this._normal.y-.35)/.5);
    const rising=this.smoothContactBlend((this._surface.y-.15)/1.1);
    const descending=this.smoothContactBlend((b.position.y-b.radius-.03)/.10)*
      this.smoothContactBlend((-b.velocity.y-.35)/1.65);
    return this.config.footLiftRestoration*below*(1-(1-rising)*(1-descending));
  }

  liftInstepLaunch(instep,grounded,approach,surfaceSpeed,b=this.ball,surface=this._surface) {
    const cfg=this.config,n=this._normal;
    const active=Math.max(0,surface.dot(n));
    const effort=this.smoothContactBlend((surfaceSpeed-cfg.instepLaunchStartSpeed)/
      (cfg.instepLaunchFullSpeed-cfg.instepLaunchStartSpeed));
    const drive=this.smoothContactBlend((active-.5)/1.5)*
      this.smoothContactBlend((Math.min(1,active/Math.max(approach,.0001))-.35)/.4);
    const shallow=this.smoothContactBlend((n.y+.10)/.10)*
      (1-this.smoothContactBlend((n.y-.20)/.35));
    const angle=cfg.instepLaunchAngle*instep*grounded*effort*drive*shallow;
    if(angle<=0)return;
    const speed=b.velocity.length(),planar=Math.hypot(b.velocity.x,b.velocity.z);
    const vertical=speed*Math.sin(angle);
    if(planar<1e-6||b.velocity.y>=vertical)return;
    // Full instep can present a vertical striking face. On a fresh active
    // ground strike, redirect a small part of the existing launch speed into
    // loft. Total translational energy and contact-generated spin are retained;
    // natural higher launches, passive arrivals and detached flight are untouched.
    const scale=Math.sqrt(Math.max(0,speed*speed-vertical*vertical))/planar;
    b.velocity.x*=scale;b.velocity.z*=scale;b.velocity.y=vertical;
  }

  moderateShotLift(foot, clearance, openingScale = 1) {
    const velocity = this.ball.velocity;
    const naturalLift = 3.25;
    // Driven shots keep their horizontal pace and spin. Allow a little more
    // height for a genuinely rising boot or when striking an airborne ball.
    if (velocity.y <= naturalLift || Math.hypot(velocity.x, velocity.z) * openingScale < this.config.footStrikeBlendStart) return false;
    const swing = foot.ankleVelocity;
    const upward = swing.y / Math.max(1, Math.hypot(swing.x, swing.z));
    const chip = this.smoothContactBlend((upward - .22) / .56);
    const volley = this.smoothContactBlend((clearance - .045) / .30);
    const knee = naturalLift + .75 * chip + 1.25 * volley;
    const excess = velocity.y - knee;
    if (excess <= 0) return false;
    const range = 2.45 + 2.9 * chip + 2.2 * volley;
    const reduced = excess * range / (range + excess);
    velocity.y = knee + reduced;
    return excess - reduced > .15;
  }

  releaseFootStrike(f, penetration) {
    const state=f.state,b=this.ball,cfg=this.config;
    state.correctDirection=false;
    if (state === this._launchedFoot) {
      const outgoing = b.velocity.dot(this._launchDirection);
      const drive = this._surface.dot(this._launchDirection);
      if (outgoing > Math.max(1.8, b.velocity.length() * .45) && drive >= -1) {
        // The same boot can sweep through again after a boosted or moderated
        // launch. Let the ball fly without a second impulse or positional shove.
        state.contact = true;
        return true;
      }
      this._launchedFoot = null;
    }
    if(state.strikeUntil<=this.time)return false;
    const direction=state.releaseDirection,outgoing=b.velocity.dot(direction);
    const drive=this._surface.dot(direction),alignment=this._normal.dot(direction);
    if(outgoing<6||drive< -1){state.strikeUntil=state.releaseUntil=0;return false;}
    // A stroke that accelerates after contact can scoop a released ball before
    // either reaches the ceiling. Preserve the established direction only for
    // this fast, upward-turning continuation of an initially level strike.
    const surfaceSpeedSq=this._surface.lengthSq();
    state.correctDirection=alignment>.35&&drive>Math.max(16,state.strikeSpeed*.65)&&
      surfaceSpeedSq>400&&(surfaceSpeedSq>state.strikeSpeed*state.strikeSpeed*1.3225||
        this._surface.y-state.strikeSurfaceY>Math.max(8,state.strikeSpeed*.25))&&
      this._normal.y>state.strikeNormalY+.08&&
      state.strikeSurfaceY<=Math.max(1.5,state.strikeSpeed*.15);
    if(state.releaseUntil<=this.time||outgoing<cfg.maxSpeed*.5)return false;
    if(drive<cfg.maxSpeed*.5||alignment<.35)return false;
    // The tracked shoe can outrun a ball at its speed ceiling. Its continuing
    // sweep belongs to the strike already resolved, not another powered kick.
    // Separate along that launch direction so the rotating boot cannot scoop
    // the ball upward through either impulses or position corrections.
    state.contact=true;
    if(penetration>0)b.position.addScaledVector(direction,(penetration+.0001)/alignment);
    return true;
  }

  footImpact(b,surface,approach,surfaceSpeed,controlPunt,liftRestore,instep,grounded,dt){
    const cfg=this.config;
    let impulse=0;
    // Use the complete physical surface velocity, including the player's
    // motion once. A fast grazing swing must keep its tangential grip and curve
    // even when only a small part of that speed points into the ball.
    if (approach > 0) {
      // Contact velocity already includes running once. High-energy impacts
      // compress the boot/ball instead of reaching a low artificial speed cap.
      const activeSpeed=Math.max(0,surface.dot(this._normal)),share=Math.min(1,activeSpeed/approach);
      const compression=Math.max(0,Math.min(1,(activeSpeed-cfg.footFirmImpactSpeed)/(cfg.footPowerCompressionSpeed-cfg.footFirmImpactSpeed)));
      const receiveBlend=Math.max(0,Math.min(1,(approach-.40)/(cfg.footFirmImpactSpeed-.40)));
      const firmness=this.contactFirmness(approach);
      const activeFull=this.contactCompliance(surfaceSpeed,cfg.footControlRestitutionScale);
      const activeCompliance=activeFull+(this.contactCompliance(surfaceSpeed,
        cfg.footControlRestitutionScale,0)-activeFull)*controlPunt;
      const active=(activeCompliance+(1-activeCompliance)*liftRestore)*cfg.footRestitution*Math.min(firmness,this.contactFirmness(activeSpeed))*(1-compression*compression*(3-2*compression));
      // Incoming ball energy cannot unlock active shot power. A passive boot
      // absorbs more of a hard rebound while tiny receiving touches stay soft.
      const incomingSpeed=Math.max(0,approach-activeSpeed);
      const receivingCompliance=this.contactCompliance(incomingSpeed,cfg.footControlRestitutionScale,Math.max(surfaceSpeed,incomingSpeed));
      const receiving=(receivingCompliance+(1-receivingCompliance)*liftRestore)*(cfg.footRestitution+(cfg.footReceiveRestitution-cfg.footRestitution)*receiveBlend*receiveBlend*(3-2*receiveBlend))*firmness;
      const restitution=share>=1?active:receiving+(active-receiving)*share;
      impulse = (1 + restitution) * approach;
      b.velocity.addScaledVector(this._normal, impulse);
    }
    // Gravity supplies a normal load while a ball is supported on a sole/toe.
    // This permits physical balancing and rolling without snapping to the boot.
    const support=Math.max(0,this._normal.y)*cfg.gravity*dt;
    // Allow tangential slip on controlled touches so a reversing boot does not
    // transfer as much rolling spin into an accidental hop.
    // Scale the single friction impulse; its linear and angular effects remain
    // coupled in surfaceFriction. Ground friction and free rolling are unchanged.
    if(impulse>0||support>0){
      const frictionFull=this.contactCompliance(surfaceSpeed,cfg.footControlFrictionScale);
      const friction=frictionFull+(this.contactCompliance(surfaceSpeed,
        cfg.footControlFrictionScale,0)-frictionFull)*controlPunt;
      this.surfaceFriction(this._normal,surface,Math.max(impulse,support)*cfg.footFriction*friction,b);
    }
    if(approach>.045&&impulse>0&&instep>0&&grounded>0)
      this.liftInstepLaunch(instep,grounded,approach,surfaceSpeed,b,surface);
    return impulse;
  }

  collideFoot(f, alpha, dt) {
    const b = this.ball, foot = f.foot, state = f.state, cfg = this.config;
    if(b.position.distanceToSquared(f.targetAnkle)>f.contactReach*f.contactReach)return;
    const instep=Number.isFinite(foot.instepAmount)?Math.max(0,Math.min(1,foot.instepAmount)):Number(!!foot.instep);
    f.orientation.slerpQuaternions(f.previousOrientation,f.targetOrientation,alpha);
    f.inverse.copy(f.orientation).invert();f.axis.set(0,0,1).applyQuaternion(f.orientation);
    f.shinOrientation.slerpQuaternions(f.previousShinOrientation,f.targetShinOrientation,alpha);
    f.shinInverse.copy(f.shinOrientation).invert();
    this._ankleCenter.lerpVectors(f.previousAnkle,f.targetAnkle,alpha);
    if(foot.contactShape&&foot.contactOffset){
      this._footCenter.copy(this._ankleCenter);
      this._footCenter.add(this._axis.copy(foot.contactOffset).applyQuaternion(f.orientation));
    }else this._footCenter.lerpVectors(foot.previous,foot.position,alpha);
    let distance,radius;
    if(foot.contactShape){
      radius=b.radius+cfg.contactSkin;distance=this.contactDistance(f,radius);
      if(!Number.isFinite(distance)||distance>radius)return;
    }else{
      this._a.copy(this._footCenter).addScaledVector(f.axis, -f.halfLength);
      this._b.copy(this._footCenter).addScaledVector(f.axis, f.halfLength);
      this.closestPoint(b.position,this._a,this._b,this._point);
      this._normal.subVectors(b.position,this._point);radius=b.radius+f.radius+cfg.contactSkin;
      const distSq=this._normal.lengthSq();if(distSq>radius*radius)return;distance=Math.sqrt(distSq);
      if(distance>1e-6)this._normal.multiplyScalar(1/distance);
      else{this._normal.copy(f.velocity);this._normal.y=Math.max(0,this._normal.y);if(this._normal.lengthSq()<.0001)this._normal.set(0,0,-1);this._normal.normalize();}
    }
    state.seen = true;
    this.footSurfaceVelocity(f,this._point,this._surface);
    if(this.releaseFootStrike(f,radius-distance))return;
    this._relative.subVectors(b.velocity, this._surface);
    const approach = -this._relative.dot(this._normal);
    const penetration = radius - distance;
    const liftRestore=this.liftRestoration();
    const clearance = b.position.y - b.radius;
    const grounded=1-this.smoothContactBlend((clearance-.004)/.03);
    const airborne = b.position.y > b.radius + .05;
    const controlPunt=this.controlledPunt(f);
    const newTouch=!state.contact&&(approach>.045||(penetration>.008&&f.velocity.lengthSq()>.003));
    let event;
    if (newTouch) {
      this._launchedFoot = null;
      this.redirectPlayerShot('foot');
      event = {
        type: 'touch', footId: f.id, time: this.time, speed: Math.max(0, approach),
        instep: instep>.5, instepAmount: instep, surface: f.contactPart, position: b.position.clone(), airborne
      };
      state.contact = true;
      this.events.push(event);
    }
    // The two-millimetre skin bridges numerical gaps, not a hidden oversized foot.
    // A resting boot may support or trap a ball without repeated bounce impulses.
    if (penetration > 0) {
      if(state.correctDirection)b.position.addScaledVector(state.releaseDirection,
        (penetration+.0001)/this._normal.dot(state.releaseDirection));
      else b.position.addScaledVector(this._normal, penetration + .0001);
    }
    const surfaceSpeed=this._surface.length();
    const strikeInstep=newTouch&&f.contactPart==='boot'?instep:0;
    const runBonus=foot.runBonusVelocity;
    const compareRun=newTouch&&f.contactPart==='boot'&&runBonus?.lengthSq()>1e-10&&foot.locomotionVelocity;
    if(compareRun){
      this._regularRunBall.velocity.copy(b.velocity);this._regularRunBall.spin.copy(b.spin);
    }
    const impulse=this.footImpact(b,this._surface,approach,surfaceSpeed,controlPunt,liftRestore,strikeInstep,grounded,dt);
    if(state.correctDirection&&impulse>0){
      const speed=b.velocity.length();b.velocity.copy(state.releaseDirection).multiplyScalar(speed);
    }
    // Remember a firm stroke's launch, but leave ordinary steady contacts unchanged.
    // An accelerating follow-through can outrun the ceiling after its first
    // impact; it must not gain a new upward direction at that later overlap.
    const drive=this._surface.dot(this._normal);
    const continuing=state.strikeUntil>this.time;
    if (newTouch && !continuing && f.contactPart === 'boot' && impulse > 0 && drive > 2.2 && drive > approach * .65) {
      const movement = foot.locomotionVelocity;
      const localDrive = drive - (movement ? Math.max(0, this._normal.dot(movement)) : 0);
      const launchSpeed = b.velocity.length();
      if (localDrive > 2.2 && launchSpeed >= cfg.footStrikeBlendStart) {
        event.shot = true;
        this._curlBoot = state;
        event.openingStrike = this._openingStrike;
        this._openingStrike = false;
        const volley = airborne || this.time - this._lastBounceTime <= this.volleyBounceGrace + 1e-9;
        const strength = this.shotStrength + (volley ? this.airShotStrength - 1 : 0);
        const openingScale = 1 + (event.openingStrike ? this.openingStrikePace : 0);
        const paceScale = openingScale + (outsidePenaltyArea(event.position) ? this.outsideShotPace : 0);
        const downward = this._surface.y - (movement?.y ?? 0) < -.65;
        if(strength>1)b.velocity.multiplyScalar(shotStrengthScale(strength,launchSpeed,impulse,drive,approach));
        let limitedRun=false;
        if(compareRun){
          // Compare the same contact with just the perk's extra travel removed.
          // The normal run-up, controller swing, incoming ball and other perks all count.
          const regular=this._regularRunBall;
          const surface=this.footSurfaceVelocity(f,this._point,this._regularRunSurface,runBonus);
          const run=this._regularRunMotion.subVectors(movement,runBonus);
          const drive=surface.dot(this._normal),approach=drive-regular.velocity.dot(this._normal);
          const punt=this.controlledPunt(f,surface,run,clearance);
          const impulse=this.footImpact(regular,surface,approach,surface.length(),punt,liftRestore,strikeInstep,grounded,dt);
          const usualScale=shotStrengthScale(strength,regular.velocity.length(),impulse,drive,approach);
          const ceiling=Math.hypot(regular.velocity.x,regular.velocity.z)*usualScale*(1+MAX_RUNUP_PACE_BONUS);
          const pace=Math.hypot(b.velocity.x,b.velocity.z);
          if(pace>ceiling){
            b.velocity.x*=ceiling/pace;b.velocity.z*=ceiling/pace;limitedRun=true;
          }
        }
        if (volley && downward && this.volleyDriven) b.velocity.y = Math.min(b.velocity.y, .42);
        const reducedLift = this.moderateShotLift(f, clearance, openingScale);
        b.velocity.x *= paceScale;
        b.velocity.z *= paceScale;
        const speedAllowance = strength * paceScale;
        if (speedAllowance > 1 && b.velocity.lengthSq() > cfg.maxSpeed ** 2) this._shotSpeedLimit = cfg.maxSpeed * speedAllowance;
        if (speedAllowance > 1 || reducedLift || limitedRun) {
          this._launchedFoot = state;
          this._followThroughUntil = this.time + SHOT_FOLLOW_THROUGH_SECONDS;
          this._launchDirection.copy(b.velocity).normalize();
        }
        b.shotSurface.launch(b, downward);
      }
    }
    const speedSq=b.velocity.lengthSq();
    // A follow-through, a bounce or a save can slow the same shot into the
    // dribbling range. Only a distinct player touch starts a new roll.
    if (event && !continuing) b.fromPlayerShot = event.shot === true;
    if (event && !event.shot) event.control = speedSq <= 3.2 ** 2 || drive <= 2.2 || controlPunt > .60;
    if(!continuing&&f.contactPart==='boot'&&approach>cfg.footFirmImpactSpeed&&
      drive>cfg.footStrikeBlendEnd&&drive>surfaceSpeed*.5&&drive/approach>.65&&
      speedSq>cfg.footStrikeBlendEnd**2&&controlPunt<.1){
      state.releaseDirection.copy(b.velocity).normalize();state.strikeUntil=this.time+.09;
      state.strikeSpeed=surfaceSpeed;state.strikeNormalY=this._normal.y;state.strikeSurfaceY=this._surface.y;
    }
    if(state.strikeUntil>this.time&&impulse>0&&drive>cfg.maxSpeed*.8&&
      this._normal.dot(state.releaseDirection)>.35&&
      (speedSq>=cfg.maxSpeed*cfg.maxSpeed||surfaceSpeed>=cfg.maxSpeed)&&controlPunt<.1){
      if(continuing)b.velocity.copy(state.releaseDirection).multiplyScalar(Math.sqrt(speedSq));
      state.releaseUntil=state.strikeUntil;
    }
  }

  surfaceFriction(normal, surfaceVelocity, limit, b=this.ball) {
    const r = b.radius;
    this._cross.copy(normal).multiplyScalar(-r);
    this._tangent.crossVectors(b.spin, this._cross).add(b.velocity).sub(surfaceVelocity);
    this._tangent.addScaledVector(normal, -this._tangent.dot(normal));
    // Solid-sphere translational plus rotational effective inverse mass = 3.5/m.
    this._impulse.copy(this._tangent).multiplyScalar(-1 / 3.5);
    this._impulse.clampLength(0, limit);
    b.velocity.add(this._impulse);
    this._tangent.crossVectors(this._cross, this._impulse).multiplyScalar(2.5 / (r * r));
    b.spin.add(this._tangent);
  }

  collideGround(dt, trackImpact = true) {
    const b = this.ball, r = b.radius;
    if (b.position.y > r + .00015) {
      const clearance = b.position.y - r;
      if (trackImpact && clearance > .032) this._sawFlight = true;
      b.shotSurface.observeAir(clearance);
      return;
    }
    b.position.y = r;
    const pace = b.curvePace;
    const incoming = Math.max(0, -b.velocity.y);
    if (trackImpact && this._sawFlight) {
      this._sawFlight = false;
      if (incoming > .105 * pace) this.events.push({type: 'bounce', time: this.time, speed: incoming, position: b.position.clone()});
      if (incoming > .65 * pace) this._lastBounceTime = this.time;
    }
    b.shotSurface.land();
    let normalImpulse = this.config.gravity * pace * pace * dt;
    if (b.velocity.y < 0) {
      if (incoming > .65 * pace) {
        b.velocity.y = incoming * this.config.restitution;
        normalImpulse += incoming * (1 + this.config.restitution);
      } else {
        normalImpulse += incoming; b.velocity.y = 0;
      }
    }
    this._normal.set(0, 1, 0); this._surface.set(0, 0, 0);
    this.surfaceFriction(this._normal, this._surface, this.config.groundFriction * normalImpulse);
    if (b.velocity.y > .15 * pace) return;
    const planarSpeed = Math.hypot(b.velocity.x, b.velocity.z) / pace;
    if (planarSpeed > 0) {
      // The final slow roll sheds slightly more energy. Smooth entry/exit keep
      // tiny nudges and the fast part of a pass free of a braking threshold.
      const rise=Math.max(0,Math.min(1,(planarSpeed-.30)/.70));
      const fall=Math.max(0,Math.min(1,(6-planarSpeed)/2));
      const slowBand=rise*rise*(3-2*rise)*fall*fall*(3-2*fall);
      // Short controlled taps settle sooner, with no threshold at either end.
      // The same loss acts on translation and rolling spin. A wider smooth
      // band also settles ordinary punts without changing feather touches,
      // airborne flight or the fast part of a driven ground shot.
      const controlBand=this.smoothContactBlend((planarSpeed-.10)/.40)*
        this.smoothContactBlend((3-planarSpeed)/1.5);
      const puntBand=this.smoothContactBlend((planarSpeed-1.5)/1.5)*
        (1-this.smoothContactBlend((planarSpeed-6)/3));
      // A tap can shed speed as its first skid turns into a roll. Ease into
      // the extra drag just below walking pace, then fade out above a sprint.
      const dribbleBand=b.fromPlayerShot?0:this.smoothContactBlend((planarSpeed-2.25)/1.5)*
        this.smoothContactBlend((8-planarSpeed)/(8-FB.sprintSpeed));
      const resistance=this.config.rollingResistance+this.config.slowRollingResistance*slowBand+
        this.config.controlRollingResistance*controlBand+this.config.puntRollingResistance*puntBand+
        this.config.dribbleRollingResistance*dribbleBand;
      const factor = Math.max(0, 1 - resistance * b.shotSurface.rollingFactor(planarSpeed) * (dt * pace) / planarSpeed);
      b.velocity.x *= factor; b.velocity.z *= factor;
      // Rolling resistance removes both translational and rolling energy.
      b.spin.x *= factor; b.spin.z *= factor;
    }
    b.spin.y *= Math.exp(-b.shotSurface.yawSpinDecay() * dt * pace);
    if (Math.hypot(b.velocity.x, b.velocity.z) < .025 * pace && Math.hypot(b.spin.x, b.spin.z) < .3 * pace) {
      b.velocity.x = 0; b.velocity.z = 0; b.spin.x = 0; b.spin.z = 0;
    }
  }

  collideFrame(frame) {
    const b = this.ball;
    const total=b.radius+FB.postRadius;
    if(b.position.z<Math.min(frame.a.z,frame.b.z)-total||b.position.z>Math.max(frame.a.z,frame.b.z)+total)return;
    this.closestPoint(b.position, frame.a, frame.b, this._point);
    this._normal.subVectors(b.position, this._point);
    const sq = this._normal.lengthSq();
    if (sq >= total * total) return;
    const distance = Math.sqrt(sq);
    if (distance > 1e-7) this._normal.multiplyScalar(1 / distance);
    else this._normal.copy(b.velocity).negate().normalize();
    const speed = -b.velocity.dot(this._normal);
    b.position.addScaledVector(this._normal, total - distance + .0001);
    if (speed > 0) {
      this.redirectPlayerShot('frame');
      b.velocity.addScaledVector(this._normal, speed * 1.72);
      this._surface.set(0, 0, 0);
      this.surfaceFriction(this._normal, this._surface, speed * .16);
      if (this.time - this._frameEventTime > .06 && speed > .15) {
        this.events.push({type: 'frame', time: this.time, speed, position: b.position.clone()});
        this._frameEventTime = this.time;
      }
    }
  }

}

export { FootballPhysics };
