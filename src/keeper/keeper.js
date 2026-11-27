import { FT } from "../../vendor/three.js";
import { FB, footballClamp } from "../config.js";
import { FootballPhysics } from "../physics/ball.js";
import { FootballGoalkeeperVisual } from "./visuals.js";
import { FootballKeeperRagdoll } from "./ragdoll.js";
import { FootballKeeperPlayerContact } from "./player-contact.js";

const BALL_IMPACT = {strength: .40};

const FREEROAM_KEEPER = Object.freeze({
  reaction: .115, predictionInterval: .045,
  trackingSpeed: 3.9, idleSpeed: 1.65, acceleration: 13,
  diveLead: .45, diveTravel: 2.10, pushDuration: .075,
  diveDuration: .64, landDuration: .25, recoveryDuration: 1.05
});

/* One keeper, one real body. Shot prediction only chooses the animation;
   the ball is saved exclusively by contact with its moving gloves and limbs. */
class FootballGoalkeeper {
  constructor(field, goalEnd = -1) {
    const V = FT.Vector3;
    this.field = field;
    this.goalEnd = goalEnd < 0 ? -1 : 1;
    this.homeZ = this.goalEnd * (FB.halfLength - .88);
    this.homeYaw = this.goalEnd < 0 ? Math.PI : 0;
    this.enabled = true;
    this.time = 0;
    this.position = new V(0, 0, this.homeZ);
    this.velocity = new V();
    this.visual = new FootballGoalkeeperVisual(field);
    this.ragdoll = new FootballKeeperRagdoll(this.goalEnd);
    this.playerContact = new FootballKeeperPlayerContact();
    this.state = {
      position: this.position, yaw: this.homeYaw,
      phase: 'ready', phaseProgress: 0, side: 1, targetHeight: 1,
      lateralSpeed: 0, longitudinalSpeed: 0, takeoffSpeed: 0, time: 0,
      reachTarget: new V(0, 1, this.homeZ - this.goalEnd * .36)
    };
    this.previousState = this._newState();
    this.renderState = this._newState();
    this.getupState = this._newState();
    this._phaseTime = 0;
    this._predictTimer = 0;
    this._threatAge = 0;
    this._lastImpact = -10;
    this._diveStart = new V();
    this._diveEnd = new V();
    this._prediction = new FootballPhysics();
    this.threat = {valid: false, x: 0, y: 1, time: 9};
    this.maxTravel = 0;
    this.saves = 0;
    this.dives = 0;
    this.colliders = [];
    this._a = new V(); this._b = new V(); this._axis = new V();
    this._point = new V(); this._normal = new V(); this._surface = new V();
    this._velocityA = new V(); this._velocityB = new V(); this._relative = new V();
    this._impactPoint = new V(); this._impactVelocity = new V();
    this._predictPrevious = new V();
    this._fixedDt = FB.fixedStep;
    this.setDifficulty(null);
    this.reset();
  }

  setDifficulty(level = null) {
    this.difficultyLevel = level == null ? null : Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
    if (this.difficultyLevel === null) this._tuning = FREEROAM_KEEPER;
    else {
      const t = 1 - Math.exp(-this.difficultyLevel / 6.5);
      // Only decisions and visible movement improve. Collision geometry and
      // rebound response stay the same; no difficulty level can force a save.
      this._tuning = Object.freeze({
        reaction: .38 - .305 * t, predictionInterval: .09 - .055 * t,
        trackingSpeed: 2.05 + 2.5 * t, idleSpeed: 1.05 + .8 * t,
        acceleration: 7 + 9 * t, diveLead: .31 + .18 * t,
        diveTravel: 1.15 + 1.25 * t, pushDuration: .14 - .08 * t,
        diveDuration: .80 - .24 * t, landDuration: .32 - .10 * t,
        recoveryDuration: 1.35 - .53 * t
      });
    }
    return this;
  }

  get tuning() { return this._tuning; }

  _newState() {
    return {position: new FT.Vector3(), yaw: 0, phase: 'ready', phaseProgress: 0,
      side: 1, targetHeight: 1, lateralSpeed: 0, longitudinalSpeed: 0, takeoffSpeed: 0, time: 0, reachTarget: new FT.Vector3()};
  }

  _copyState(target, source) {
    target.position.copy(source.position); target.reachTarget.copy(source.reachTarget);
    target.yaw = source.yaw; target.phase = source.phase; target.phaseProgress = source.phaseProgress;
    target.side = source.side; target.targetHeight = source.targetHeight;
    target.lateralSpeed = source.lateralSpeed; target.takeoffSpeed = source.takeoffSpeed; target.time = source.time;
    target.longitudinalSpeed = source.longitudinalSpeed;
  }

  reset() {
    this.ragdoll.reset(); this._ragdollHandoff = false; this._lastRagdollImpact = -Infinity;
    this.position.set(0, 0, this.homeZ); this.velocity.set(0, 0, 0);
    this.state.phase = 'ready'; this.state.phaseProgress = 0;
    this.state.side = 1; this.state.targetHeight = 1; this.state.lateralSpeed = this.state.longitudinalSpeed = this.state.takeoffSpeed = 0;
    this.state.yaw = this.homeYaw;
    this.state.reachTarget.set(0, 1, this.homeZ - this.goalEnd * .36);
    this.time = 0; this.state.time = 0; this._phaseTime = 0;
    this.saves = 0; this.dives = 0; this.clearContacts();
    this._copyState(this.previousState, this.state);
    this._copyState(this.renderState, this.state);
    this.visual.updatePose(this.state);
    this.ragdoll.sampleAnimated(this.visual.landmarks, 0);
    this._capture(true);
    this.maxTravel = 0;
  }

  clearContacts() {
    this.playerContact.reset();
    this._lastImpact = -10;
    this._threatAge = 0; this._predictTimer = 0;
    this.threat.valid = false; this.threat.time = 9;
  }

  _capture(initial = false) {
    const capsules = this.visual.capsules;
    this.maxTravel = 0;
    for (let i = 0; i < capsules.length; i++) {
      const source = capsules[i];
      let capsule = this.colliders[i];
      if (!capsule) {
        capsule = {a: new FT.Vector3(), b: new FT.Vector3(), previousA: new FT.Vector3(),
          previousB: new FT.Vector3(), aName: source.aName, bName: source.bName, radius: source.radius, kind: source.kind};
        this.colliders[i] = capsule; initial = true;
      }
      capsule.previousA.copy(capsule.a); capsule.previousB.copy(capsule.b);
      capsule.a.copy(source.a); capsule.b.copy(source.b);
      capsule.radius = source.radius; capsule.kind = source.kind;
      if (initial) {capsule.previousA.copy(capsule.a); capsule.previousB.copy(capsule.b);}
      this.maxTravel = Math.max(this.maxTravel, capsule.a.distanceTo(capsule.previousA), capsule.b.distanceTo(capsule.previousB));
    }
  }

  _predict(ball) {
    const threat = this.threat, end = this.goalEnd;
    threat.valid = false; threat.time = 9;
    if (!ball || !Number.isFinite(ball.position.lengthSq() + ball.velocity.lengthSq() + ball.spin.lengthSq()) ||
      ball.velocity.z * end < 1.25 || ball.position.z * end < FB.halfLength - 30 ||
      ball.position.z * end > this.homeZ * end + .5) return;
    const simulator = this._prediction, predicted = simulator.ball;
    predicted.position.copy(ball.position); predicted.velocity.copy(ball.velocity); predicted.spin.copy(ball.spin);
    const plane = this.homeZ - end * .36, h = 1 / 90;
    // Reuse the released ball integrator: drag, Magnus and the actual turf
    // friction/bounce all participate. There is no invisible save target force.
    for (let step = 0; step < 198; step++) {
      this._predictPrevious.copy(predicted.position);
      simulator.integrate(h); simulator.collideGround(h);
      if (predicted.position.z * end >= plane * end) {
        const dz = predicted.position.z - this._predictPrevious.z;
        const part = dz === 0 ? 1 : footballClamp((plane - this._predictPrevious.z) / dz, 0, 1);
        threat.x = this._predictPrevious.x + (predicted.position.x - this._predictPrevious.x) * part;
        threat.y = this._predictPrevious.y + (predicted.position.y - this._predictPrevious.y) * part;
        threat.time = (step + part) * h;
        threat.valid = Math.abs(threat.x) < FB.goalWidth * .5 + .75 && threat.y < FB.goalHeight + .45;
        return;
      }
      if (predicted.velocity.z * end < .12) return;
    }
  }

  _phase(phase) {this.state.phase = phase; this.state.phaseProgress = 0; this._phaseTime = 0;}

  _beginSave() {
    const s = this.state, t = this.threat, dx = t.x - this.position.x;
    s.takeoffSpeed = s.lateralSpeed;
    s.side = dx < 0 ? -1 : 1;
    s.targetHeight = footballClamp(t.y, .16, 2.75);
    s.reachTarget.set(t.x, s.targetHeight, this.homeZ - this.goalEnd * .36);
    this._diveStart.copy(this.position);
    // The body covers part of the distance; the remaining reach is the visible
    // bent arm. Both are bounded, so hard shots into the corner can beat him.
    const lateral = footballClamp(Math.abs(dx) - .86, .32, this._tuning.diveTravel);
    this._diveEnd.copy(this.position);
    this._diveEnd.x = footballClamp(this.position.x + s.side * lateral, -3.28, 3.28);
    this._diveEnd.z -= this.goalEnd * .12;
    this.velocity.set(0, 0, 0); s.longitudinalSpeed = 0; this._phase('push'); this.dives++;
  }

  preparePlayerContact(head, dt, blocked) {
    this.playerContact.prepareBody(head, dt, blocked || !this.enabled);
  }

  collidePlayer(feet, alpha, rate) {
    return this.enabled ? this.playerContact.step(this, feet, alpha, rate) : null;
  }

  receiveImpact(velocity, point, capsule, options) {
    if (!this.enabled || this.time - this._lastRagdollImpact < .07) return false;
    if (!this.ragdoll.hit(this.visual.landmarks, velocity, point, capsule, this._fixedDt, options)) return false;
    this.visual.captureRagdollPose();
    this._ragdollHandoff = false;
    this._lastRagdollImpact = this.time;
    this.velocity.set(0, 0, 0); this.state.lateralSpeed = this.state.longitudinalSpeed = this.state.takeoffSpeed = 0;
    this._phase('ragdoll');
    this._threatAge = 0; this._predictTimer = 0;
    this.threat.valid = false; this.threat.time = 9;
    return true;
  }

  _updateRagdoll(dt) {
    const ragdoll = this.ragdoll, s = this.state;
    let readyLandmarks;
    if (ragdoll.needsReadyPose(dt)) {
      const ready = this.getupState;
      this._copyState(ready, s);
      ready.position.copy(ragdoll.recoveryPosition); ready.yaw = ragdoll.recoveryYaw;
      ready.phase = 'ready'; ready.phaseProgress = 0; ready.targetHeight = .92;
      ready.reachTarget.set(ready.position.x, ready.targetHeight, ready.position.z - this.goalEnd * .36);
      this.visual.updatePose(ready);
      this.visual.captureRagdollRecoveryPose();
      readyLandmarks = this.visual.landmarks;
    }
    if (ragdoll.step(dt, readyLandmarks)) {
      this._copyState(s, this.getupState);
      this._ragdollHandoff = true;
      this.ragdoll.sampleAnimated(readyLandmarks, 0);
    } else {
      const pose = ragdoll.sample(1);
      this.position.set(pose.pelvis.x, 0, pose.pelvis.z);
      s.phase = ragdoll.phase === 'getup' ? 'getup' : 'ragdoll';
      this.visual.updateRagdollPose(pose);
    }
    this._capture();
  }

  update(dt, ball) {
    if (!this.enabled || !(dt > 0) || !Number.isFinite(dt)) return;
    dt = Math.min(dt, .05); this._fixedDt = dt;
    const tuning = this._tuning;
    this._copyState(this.previousState, this.state);
    this.time += dt; this.state.time = this.time;
    this._ragdollHandoff = false;
    if (this.ragdoll.active) {this._updateRagdoll(dt); return;}
    this._predictTimer -= dt;
    if (this._predictTimer <= 0) {this._predict(ball); this._predictTimer = tuning.predictionInterval;}
    else this.threat.time = Math.max(0, this.threat.time - dt);
    this._threatAge = this.threat.valid ? this._threatAge + dt : 0;
    const s = this.state;
    if (s.phase === 'ready') {
      const yawDelta = Math.atan2(Math.sin(this.homeYaw - s.yaw), Math.cos(this.homeYaw - s.yaw));
      s.yaw += Math.abs(yawDelta) < .001 ? yawDelta : yawDelta * (1 - Math.exp(-7 * dt));
      const incoming = this.threat.valid && this._threatAge >= tuning.reaction;
      const target = incoming ? this.threat.x : (ball ? ball.position.x * .13 : 0);
      const targetX = footballClamp(target, -2.68, 2.68);
      const delta = targetX - this.position.x;
      const maximum = incoming ? tuning.trackingSpeed : tuning.idleSpeed;
      const desired = Math.sign(delta) * Math.min(maximum, Math.sqrt(Math.abs(delta) * 17));
      this.velocity.x += footballClamp(desired - this.velocity.x, -tuning.acceleration * dt, tuning.acceleration * dt);
      this.position.x += this.velocity.x * dt;
      const depth = this.homeZ - this.position.z;
      const depthSpeed = Math.sign(depth) * Math.min(1.85, Math.sqrt(Math.abs(depth) * 11));
      this.velocity.z += footballClamp(depthSpeed - this.velocity.z, -6.5 * dt, 6.5 * dt);
      const depthStep = this.velocity.z * dt;
      if (Math.abs(depthStep) < Math.abs(depth)) this.position.z += depthStep;
      else {this.position.z = this.homeZ; this.velocity.z = 0;}
      this.position.y = 0;
      s.lateralSpeed = this.velocity.x;
      s.longitudinalSpeed = this.velocity.z;
      s.targetHeight += ((incoming ? footballClamp(this.threat.y, .18, 2.55) : .92) - s.targetHeight) * Math.min(1, dt * 10);
      s.reachTarget.set(this.position.x, s.targetHeight, this.homeZ - this.goalEnd * .36);
      // Set first, then push off. A central ball is blocked by the ready body;
      // lateral and low balls prompt the actual sideways save animation.
      const dx = this.threat.x - this.position.x;
      if (incoming && Math.abs(yawDelta) < .34 && this.threat.time < tuning.diveLead && this.threat.time > .055 &&
          (Math.abs(dx) > .48 || this.threat.y < .55 || this.threat.y > 1.82)) this._beginSave();
    } else {
      this._phaseTime += dt;
      if (s.phase === 'push') {
        s.phaseProgress = footballClamp(this._phaseTime / tuning.pushDuration, 0, 1);
        s.lateralSpeed = 0;
        if (this._phaseTime >= tuning.pushDuration) this._phase('dive');
      } else if (s.phase === 'dive') {
        const p = footballClamp(this._phaseTime / tuning.diveDuration, 0, 1);
        s.phaseProgress = p;
        // A fast takeoff followed by drag at landing; no snapping to the ball.
        const travel = 1 - Math.pow(1 - p, 2.5);
        const previousX = this.position.x;
        this.position.lerpVectors(this._diveStart, this._diveEnd, travel);
        s.lateralSpeed = (this.position.x - previousX) / dt;
        if (this._phaseTime >= tuning.diveDuration) {this.position.copy(this._diveEnd); this._phase('land');}
      } else if (s.phase === 'land') {
        s.phaseProgress = footballClamp(this._phaseTime / tuning.landDuration, 0, 1); s.lateralSpeed = 0;
        if (this._phaseTime >= tuning.landDuration) this._phase('recover');
      } else if (s.phase === 'recover') {
        s.phaseProgress = footballClamp(this._phaseTime / tuning.recoveryDuration, 0, 1); s.lateralSpeed = 0;
        if (this._phaseTime >= tuning.recoveryDuration) {this._phase('ready'); this._threatAge = 0;}
      }
    }
    this.visual.updatePose(s);
    this.ragdoll.sampleAnimated(this.visual.landmarks, dt);
    this._capture();
  }

  render(alpha) {
    if (!this.enabled) return;
    const s = this.renderState, a = this.previousState, b = this.state;
    alpha = footballClamp(alpha, 0, 1);
    if (this.ragdoll.active || this._ragdollHandoff) {
      this.visual.updateRagdollPose(this.ragdoll.sample(alpha));
      return;
    }
    this._copyState(s, b);
    s.position.lerpVectors(a.position, b.position, alpha);
    s.yaw = a.yaw + (b.yaw - a.yaw) * alpha;
    s.time = a.time + (b.time - a.time) * alpha;
    s.lateralSpeed = a.lateralSpeed + (b.lateralSpeed - a.lateralSpeed) * alpha;
    s.longitudinalSpeed = a.longitudinalSpeed + (b.longitudinalSpeed - a.longitudinalSpeed) * alpha;
    s.targetHeight = a.targetHeight + (b.targetHeight - a.targetHeight) * alpha;
    s.reachTarget.lerpVectors(a.reachTarget, b.reachTarget, alpha);
    if (a.phase === b.phase) s.phaseProgress = a.phaseProgress + (b.phaseProgress - a.phaseProgress) * alpha;
    this.visual.updatePose(s);
  }

  isNear(ball, padding = 0) {
    return this.enabled && Math.abs(ball.position.z - this.position.z) <= 2.4 + padding &&
      Math.abs(ball.position.x - this.position.x) <= 3.4 + padding && ball.position.y <= 3.7 + padding;
  }

  collide(physics, alpha, h) {
    const ball = physics.ball;
    if (!this.isNear(ball)) return;
    const dt = this._fixedDt;
    for (let i = 0; i < this.colliders.length; i++) {
      const capsule = this.colliders[i];
      this._a.lerpVectors(capsule.previousA, capsule.a, alpha);
      this._b.lerpVectors(capsule.previousB, capsule.b, alpha);
      this._axis.subVectors(this._b, this._a);
      const lengthSq = this._axis.lengthSq();
      const along = lengthSq > 1e-12 ? footballClamp(this._relative.subVectors(ball.position, this._a).dot(this._axis) / lengthSq, 0, 1) : 0;
      this._point.copy(this._a).addScaledVector(this._axis, along);
      this._normal.subVectors(ball.position, this._point);
      const sum = ball.radius + capsule.radius, distanceSq = this._normal.lengthSq();
      if (distanceSq >= sum * sum) continue;
      const distance = Math.sqrt(distanceSq);
      this._velocityA.subVectors(capsule.a, capsule.previousA).multiplyScalar(1 / dt);
      this._velocityB.subVectors(capsule.b, capsule.previousB).multiplyScalar(1 / dt);
      this._surface.lerpVectors(this._velocityA, this._velocityB, along).clampLength(0, 12);
      if (distance > 1e-7) this._normal.multiplyScalar(1 / distance);
      else {
        this._normal.copy(this._surface).sub(ball.velocity);
        if (this._normal.lengthSq() > 1e-9) this._normal.normalize(); else this._normal.set(0, 0, -this.goalEnd);
      }
      ball.position.addScaledVector(this._normal, sum - distance + .00015);
      const incoming = -this._relative.copy(ball.velocity).sub(this._surface).dot(this._normal);
      if (incoming <= 0) continue;
      const centerHit = capsule.aName === 'pelvis' || capsule.aName === 'head';
      if ((this.ragdoll.active && incoming > 5.5) || (!this.ragdoll.active && centerHit && incoming > 24)) {
        this._impactPoint.copy(this._point).addScaledVector(this._normal, capsule.radius);
        this._impactVelocity.copy(this._normal).multiplyScalar(-Math.min(incoming, 18));
        this.receiveImpact(this._impactVelocity, this._impactPoint, capsule, BALL_IMPACT);
      }
      const restitution = capsule.kind === 'glove' ? .23 : capsule.kind === 'leg' ? .40 : .32;
      ball.velocity.addScaledVector(this._normal, incoming * (1 + restitution));
      physics.surfaceFriction(this._normal, this._surface, incoming * .28);
      if (incoming > .4 && physics.time - this._lastImpact > .09) {
        physics.events.push({type: 'save', time: physics.time, speed: incoming, position: ball.position.clone(), surface: capsule.kind});
        this._lastImpact = physics.time; this.saves++;
      }
    }
  }

  dispose() {
    if (this.visual.dispose) this.visual.dispose();
    else if (this.visual.group) this.visual.group.removeFromParent();
    this.colliders.length = 0;
  }
}

export { FootballGoalkeeper };
