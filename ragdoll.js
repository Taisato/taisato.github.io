import { FT } from "../../vendor/three.js";
import { FB, footballClamp } from "../config.js";

const PARTICLES = {
  pelvis: [10, .177], chest: [13, .181], neck: [5, .085], head: [4.5, .140],
  shoulderL: [3, .085], shoulderR: [3, .085], hipL: [3.5, .111], hipR: [3.5, .111],
  elbowL: [2, .064], elbowR: [2, .064], wristL: [1.3, .048], wristR: [1.3, .048],
  handL: [1.4, .099], handR: [1.4, .099], kneeL: [3.4, .103], kneeR: [3.4, .103],
  ankleL: [2.1, .080], ankleR: [2.1, .080], toeL: [1.1, .049], toeR: [1.1, .049]
};
const NAMES = Object.keys(PARTICLES);
// The two interior points keep the torso rigid in depth without adding visible joints.
const SIM_NAMES = [...NAMES, 'back', 'sternum'];
const TORSO = ['pelvis', 'chest', 'neck', 'shoulderL', 'shoulderR', 'hipL', 'hipR', 'back', 'sternum'];
const SIDES = ['L', 'R'];
const UP = new FT.Vector3(0, 1, 0);
const V = () => new FT.Vector3();
const PALM_SUPPORT = .054;
const limit = (t, lo = 0, hi = 1) => footballClamp(t, lo, hi);
const ease = t => limit(t) ** 2 * (3 - 2 * limit(t));
const pose = (names = NAMES) => Object.fromEntries(names.map(name => [name, V()]));
const copyPose = (out, source) => {
  for (const name of NAMES) out[name].copy(source[name]);
};
const BRACE_FACE_DOWN = {
  hip: [0, .278, -.040], pitch: 1.33, roll: -.16,
  wrists: [[.34, .114, .47], [-.31, .113, .42]], ankles: [[.22, .084, -.64], [-.17, .089, -.62]],
  plantHands: true, kneeTuck: -.06, toeTilt: -.18
};
const BRACE_FACE_UP = {
  hip: [0, .286, .005], pitch: -.99, roll: -.22,
  wrists: [[.33, .114, -.41], [-.31, .118, -.44]], ankles: [[.23, .084, .41], [-.20, .083, .35]],
  plantHands: true, kneeTuck: .25, toeTilt: 0
};
const HALF_KNEEL = {
  hip: [-.025, .372, -.041], pitch: 1.02, roll: -.13,
  wrists: [[.29, .119, .43], [-.29, .117, .34]], ankles: [[.23, .083, .251], [-.21, .120, -.405]],
  plantHands: true, kneeTuck: -.56, toeTilt: -.43
};
const RISE = {
  hip: [.069, .696, .052], pitch: .36, roll: .105,
  wrists: [[.25, .55, .29], [-.35, .60, .16]], ankles: [[.23, .083, .251], [-.22, .085, -.065]],
  plantHands: false, kneeTuck: .14, toeTilt: 0
};

class FootballKeeperRagdoll {
  constructor(goalEnd = -1) {
    this.goalEnd = goalEnd < 0 ? -1 : 1;
    this.homeYaw = this.goalEnd < 0 ? Math.PI : 0;
    this.recoveryPosition = V();
    this.current = pose(SIM_NAMES);
    this.previous = pose();
    this.renderPose = pose();
    this.animated = pose();
    this.inherited = pose();
    this.velocity = pose(SIM_NAMES);
    this.integrationStart = pose(SIM_NAMES);
    this.recoveryStart = pose(SIM_NAMES);
    this.recoveryTargets = Array.from({length: 3}, () => pose(SIM_NAMES));
    this.torsoRest = pose(TORSO);
    this.particles = Object.fromEntries(SIM_NAMES.map(name => {
      const [mass, radius] = PARTICLES[name] || [2, 0];
      return [name, {position: this.current[name], inverseMass: 1 / mass, radius}];
    }));
    this.links = [];
    for (let i = 0; i < TORSO.length; i++) {
      for (let j = i + 1; j < TORSO.length; j++) this.addLink(TORSO[i], TORSO[j], .92);
    }
    this.headLink = this.addLink('neck', 'head', 1);
    this.limbs = {};
    this.flex = [this.range('chest', 'head', .378)];
    this.separation = [];
    for (const side of SIDES) {
      const arm = ['shoulder', 'elbow', 'wrist', 'hand'].map(joint => joint + side);
      const leg = ['hip', 'knee', 'ankle', 'toe'].map(joint => joint + side);
      this.limbs[side] = {arm: [], leg: []};
      for (let i = 1; i < arm.length; i++) {
        this.limbs[side].arm.push(this.addLink(arm[i - 1], arm[i], 1));
        this.limbs[side].leg.push(this.addLink(leg[i - 1], leg[i], 1));
      }
      this.flex.push(this.range(arm[0], arm[2], .16, .56), this.range(leg[0], leg[2], .24, .90),
        this.range(arm[1], arm[3], .24, .369), this.range(leg[1], leg[3], .405, .599));
      this.separation.push(this.range('chest', arm[3], .252), this.range('head', arm[3], .155),
        this.range('pelvis', arm[3], .190), this.range('pelvis', leg[2], .222));
    }
    for (const joint of ['elbow', 'hand', 'knee', 'ankle', 'toe']) {
      this.separation.push(this.range(joint + 'L', joint + 'R', PARTICLES[joint + 'L'][1] * 1.7));
    }
    this.delta = V();
    this.axis = V();
    this.direction = V();
    this.spin = V();
    this.center = V();
    this.sideAxis = V();
    this.upperAxis = V();
    this.forwardAxis = V();
    this.groundSide = V();
    this.groundForward = V();
    this.poseHip = V();
    this.bend = V();
    this.bendAxis = V();
    this.jointUp = V();
    this.jointSide = V();
    this.priorBend = V();
    this.headRest = V();
    this.matrix = new FT.Matrix4();
    this.startRotation = new FT.Quaternion();
    this.targetRotation = new FT.Quaternion();
    this.getUpRotation = new FT.Quaternion();
    this.transport = new FT.Quaternion();
    this.extremityRotation = new FT.Quaternion();
    this.transportAxis = V();
    this.interpolationAxis = V();
    this.bendStart = V();
    this.bendTarget = V();
    this.recoveryBends = Object.fromEntries(SIDES.flatMap(side => ['elbow', 'knee'].map(joint => [
      joint + side, {stage: -1, angle: 0, hasDirection: false, axis: V(), direction: V()}
    ])));
    this.reset();
  }

  addLink(a, b, stiffness) {
    const link = {a: this.particles[a], b: this.particles[b], stiffness, length: 0};
    this.links.push(link);
    return link;
  }

  range(a, b, minimum, maximum = Infinity) {
    return {a: this.particles[a], b: this.particles[b], minimum, maximum};
  }

  reset() {
    this.active = false;
    this.phase = 'ready';
    this.recoveryYaw = this.homeYaw;
    this.recoveryPosition.set(0, 0, 0);
    this.hasAnimated = false;
    this.readyWeight = this.previousReadyWeight = 0;
  }

  sampleAnimated(landmarks, dt) {
    if (this.hasAnimated && dt > 0) {
      for (const name of NAMES) {
        this.inherited[name].subVectors(landmarks[name], this.animated[name]).multiplyScalar(1 / dt).clampLength(0, 8);
      }
    } else {
      for (const name of NAMES) this.inherited[name].set(0, 0, 0);
    }
    copyPose(this.animated, landmarks);
    this.hasAnimated = true;
  }

  hit(landmarks, velocity, point, segment, _dt, { strength = 1 } = {}) {
    const rawSpeed = velocity.length();
    if (!Number.isFinite(rawSpeed) || rawSpeed < .001 || !Number.isFinite(strength) || strength <= 0) return false;
    if (!this.active) {
      copyPose(this.current, landmarks);
      copyPose(this.previous, landmarks);
      for (const name of NAMES) this.velocity[name].copy(this.inherited[name]).multiplyScalar(.65);
      this.initializeLinks();
    }

    const speed = Math.min(rawSpeed * strength, 13);
    this.direction.copy(velocity).multiplyScalar(1 / rawSpeed);
    this.center.lerpVectors(this.current.pelvis, this.current.chest, .58);
    // Transfer momentum to the whole body and to the point that was struck.
    // A low sweep and a high shoulder hit create different angular impulses.
    this.axis.subVectors(point, this.center).clampLength(0, .75);
    this.spin.crossVectors(this.axis, this.direction).multiplyScalar(speed * .71).clampLength(0, 4.5);
    const wholeBodySpeed = Math.min(3.25, speed * .235 + .07);
    for (const name of SIM_NAMES) {
      this.delta.subVectors(this.current[name], this.center);
      this.velocity[name].addScaledVector(this.direction, wholeBodySpeed)
        .add(this.axis.crossVectors(this.spin, this.delta)).clampLength(0, 8.6);
    }

    let aName = segment?.aName, bName = segment?.bName;
    if (!PARTICLES[aName] || !PARTICLES[bName]) {
      let nearest = Infinity;
      for (const name of NAMES) {
        const distance = this.current[name].distanceToSquared(point);
        if (distance < nearest) {nearest = distance; aName = bName = name;}
      }
    }
    const a = this.current[aName], b = this.current[bName];
    this.axis.subVectors(b, a);
    const lengthSq = this.axis.lengthSq();
    const along = lengthSq > 1e-7 ? limit(this.delta.subVectors(point, a).dot(this.axis) / lengthSq) : 0;
    const localSpeed = Math.min(4.5, speed * .51);
    this.velocity[aName].addScaledVector(this.direction, (1 - along) * localSpeed).clampLength(0, 9);
    this.velocity[bName].addScaledVector(this.direction, along * localSpeed).clampLength(0, 9);

    this.active = true;
    this.phase = 'falling';
    this.fallTime = 0;
    this.calmTime = 0;
    this.minimumFall = .70 + Math.min(.24, speed * .023);
    this.readyWeight = this.previousReadyWeight = 0;
    return true;
  }

  step(dt, readyLandmarks) {
    if (!this.active || !(dt > 0) || !Number.isFinite(dt)) return false;
    dt = Math.min(dt, .05);
    copyPose(this.previous, this.current);
    this.previousReadyWeight = this.readyWeight;
    if (this.phase === 'getup') return this.getUp(dt, readyLandmarks);
    const substeps = Math.max(1, Math.ceil(dt * 120 - 1e-7));
    for (let i = 0; i < substeps; i++) this.fall(dt / substeps);
    this.fallTime += dt;
    const coreSpeed = Math.max(this.velocity.pelvis.length(), this.velocity.chest.length());
    this.calmTime = coreSpeed < .63 ? this.calmTime + dt : 0;
    if ((this.fallTime >= this.minimumFall && this.calmTime >= .14 && this.current.pelvis.y < .70) ||
        (this.fallTime >= 1.75 && this.current.pelvis.y < .83) || this.fallTime >= 2.35) {
      this.beginGetUp();
    }
    return false;
  }

  needsReadyPose(dt) {
    return this.phase === 'getup' && this.getUpTime + Math.min(dt, .05) >
      this.braceDuration + this.kneelDuration + this.riseDuration;
  }

  bodyAxes(source) {
    this.upperAxis.subVectors(source.neck, source.pelvis).normalize();
    this.sideAxis.subVectors(source.shoulderR, source.shoulderL);
    this.sideAxis.addScaledVector(this.upperAxis, -this.sideAxis.dot(this.upperAxis)).normalize();
    this.forwardAxis.crossVectors(this.upperAxis, this.sideAxis).normalize();
  }

  initializeLinks() {
    this.bodyAxes(this.current);
    const {chest, back, sternum, pelvis, head} = this.current;
    back.copy(chest).addScaledVector(this.forwardAxis, -.112);
    sternum.copy(chest).addScaledVector(this.forwardAxis, .112);
    for (const name of ['back', 'sternum']) this.velocity[name].copy(this.velocity.chest);
    for (const link of this.links) link.length = link.a.position.distanceTo(link.b.position);
    for (const name of TORSO) {
      this.delta.subVectors(this.current[name], pelvis);
      this.torsoRest[name].set(this.delta.dot(this.sideAxis), this.delta.dot(this.upperAxis), this.delta.dot(this.forwardAxis));
    }
    this.delta.subVectors(head, pelvis);
    this.headRest.set(this.delta.dot(this.sideAxis), this.delta.dot(this.upperAxis), this.delta.dot(this.forwardAxis));
  }

  projectDistance(a, b, distance, length, stiffness = 1) {
    const correction = (distance - length) * stiffness / (distance * (a.inverseMass + b.inverseMass));
    a.position.addScaledVector(this.delta, correction * a.inverseMass);
    b.position.addScaledVector(this.delta, -correction * b.inverseMass);
  }

  projectRanges(ranges, stiffness) {
    for (const {a, b, minimum, maximum} of ranges) {
      this.delta.subVectors(b.position, a.position);
      const length = this.delta.length();
      if (length > 1e-7 && (length < minimum || length > maximum)) {
        this.projectDistance(a, b, length, limit(length, minimum, maximum), stiffness);
      }
    }
  }

  projectLinks() {
    for (const {a, b, stiffness, length} of this.links) {
      this.delta.subVectors(b.position, a.position);
      const distance = this.delta.length();
      if (distance > 1e-7) this.projectDistance(a, b, distance, length, stiffness);
    }
  }

  projectPitch(handFloor = PARTICLES.handL[1]) {
    const postX = FB.goalWidth * .5 + FB.postRadius;
    const barY = FB.goalHeight + FB.postRadius, goalZ = this.goalEnd * FB.halfLength;
    for (const name of NAMES) {
      const {position, radius} = this.particles[name];
      position.y = Math.max(name === 'handL' || name === 'handR' ? handFloor : radius, position.y);
      const dz = position.z - goalZ, combined = radius + FB.postRadius;
      if (Math.abs(dz) >= combined) continue;
      const postSide = position.x < 0 ? -1 : 1;
      this.axis.set(postSide * postX, limit(position.y, 0, barY), goalZ);
      this.projectFrame(position, combined);
      this.axis.set(limit(position.x, -postX, postX), barY, goalZ);
      this.projectFrame(position, combined);
    }
  }

  projectFrame(position, combined) {
    this.delta.subVectors(position, this.axis);
    const distance = this.delta.length();
    if (distance >= combined) return;
    if (distance > 1e-7) position.addScaledVector(this.delta, (combined - distance) / distance);
    else position.z -= this.goalEnd * combined;
  }

  fall(dt) {
    const drag = Math.exp(-1.55 * dt), friction = Math.exp(-8.2 * dt);
    for (const name of SIM_NAMES) {
      const p = this.current[name], velocity = this.velocity[name];
      this.integrationStart[name].copy(p);
      velocity.multiplyScalar(drag);
      velocity.y -= FB.gravity * dt;
      p.addScaledVector(velocity, dt);
    }
    for (let i = 0; i < 9; i++) {
      this.projectLinks();
      this.projectRanges(this.flex, .76);
      this.projectRanges(this.separation, .76);
      this.projectPitch();
    }
    for (const name of SIM_NAMES) {
      const p = this.current[name], velocity = this.velocity[name], old = this.integrationStart[name];
      const enteringY = velocity.y;
      velocity.subVectors(p, old).multiplyScalar(1 / dt).clampLength(0, 9.5);
      if (this.particles[name].radius && p.y <= this.particles[name].radius + .0015) {
        velocity.x *= friction; velocity.z *= friction;
        if (enteringY < -.75 && old.y > p.y + .004) {
          const slide = 1 / (1 - enteringY * .24);
          velocity.x *= slide; velocity.z *= slide;
          velocity.y = Math.max(velocity.y, -.10 * enteringY);
        } else velocity.y = Math.max(0, velocity.y);
      }
    }
  }

  beginGetUp() {
    this.bodyAxes(this.current);
    const upperY = this.upperAxis.y, faceUp = this.forwardAxis.y > .37 && upperY < .63;
    // Facing along the fall lets the keeper load a planted hand and knee
    // during the rise. The tracking controller turns him toward play afterward.
    this.groundForward.copy(this.upperAxis);
    this.groundForward.y = 0;
    if (faceUp) this.groundForward.negate();
    if (Math.abs(this.forwardAxis.y) < .43) {
      this.delta.copy(this.forwardAxis).setY(0).normalize();
      if (this.groundForward.dot(this.delta) < 0) this.groundForward.negate();
      this.groundForward.lerp(this.delta, .55);
    }
    if (this.groundForward.lengthSq() < .002) this.groundForward.set(0, 0, -this.goalEnd);
    this.groundForward.normalize();
    this.groundSide.crossVectors(this.groundForward, UP).normalize();
    this.recoveryYaw = Math.atan2(-this.groundForward.x, -this.groundForward.z);
    this.groundPoint(this.recoveryPosition, this.current.pelvis, 0, -this.current.pelvis.y, .12);
    const postX = FB.goalWidth * .5 + FB.postRadius;
    const nearPost = Math.hypot(Math.abs(this.recoveryPosition.x) - postX, this.recoveryPosition.z - this.goalEnd * FB.halfLength);
    if (nearPost < .43) this.recoveryPosition.z = this.goalEnd * (FB.halfLength - .44);

    const rightKnee = this.current.kneeR, leftKnee = this.current.kneeL;
    this.leadSide = rightKnee.y - leftKnee.y > .02 ? 1 : -1;
    if (Math.abs(rightKnee.y - leftKnee.y) < .03) {
      this.leadSide = this.delta.subVectors(this.current.ankleR, this.current.ankleL).dot(this.groundForward) > 0 ? 1 : -1;
    }
    for (const name of SIM_NAMES) this.recoveryStart[name].copy(this.current[name]);
    this.makeRecoveryTarget(this.recoveryTargets[0], faceUp ? BRACE_FACE_UP : BRACE_FACE_DOWN);
    this.makeRecoveryTarget(this.recoveryTargets[1], HALF_KNEEL);
    this.makeRecoveryTarget(this.recoveryTargets[2], RISE);
    this.braceDuration = faceUp ? .48 : .39;
    this.kneelDuration = faceUp ? .52 : .44;
    this.riseDuration = .47;
    this.settleDuration = .39;
    this.getUpTime = 0;
    for (const state of Object.values(this.recoveryBends)) {
      state.stage = -1;
      state.hasDirection = false;
    }
    this.phase = 'getup';
  }

  groundPoint(out, origin, x, y, z) {
    return out.copy(origin).addScaledVector(this.groundSide, x).addScaledVector(UP, y).addScaledVector(this.groundForward, z);
  }

  torsoPoint(out, rest) {
    return out.copy(this.poseHip).addScaledVector(this.sideAxis, rest.x)
      .addScaledVector(this.upperAxis, rest.y).addScaledVector(this.forwardAxis, rest.z);
  }

  placeTorso(out) {
    for (const name of TORSO) this.torsoPoint(out[name], this.torsoRest[name]);
  }

  rotationFromPose(source, rotation) {
    this.bodyAxes(source);
    this.matrix.makeBasis(this.sideAxis, this.upperAxis, this.delta.copy(this.forwardAxis).negate());
    return rotation.setFromRotationMatrix(this.matrix);
  }

  makeRecoveryTarget(out, stage) {
    const sign = this.leadSide, pitch = stage.pitch, roll = stage.roll * sign;
    const [x, y, z] = stage.hip;
    this.groundPoint(this.poseHip, this.recoveryPosition, x * sign, y, z);
    this.upperAxis.copy(UP).multiplyScalar(Math.cos(pitch) * Math.cos(roll))
      .addScaledVector(this.groundForward, Math.sin(pitch)).addScaledVector(this.groundSide, Math.sin(roll) * Math.cos(pitch));
    this.sideAxis.copy(this.groundSide).addScaledVector(this.upperAxis, -this.groundSide.dot(this.upperAxis)).normalize();
    this.forwardAxis.crossVectors(this.upperAxis, this.sideAxis).normalize();
    this.placeTorso(out);
    this.torsoPoint(out.head, this.headRest);

    for (const side of SIDES) {
      const lateral = side === 'R' ? 1 : -1;
      const order = lateral === sign ? 0 : 1;
      const {arm, leg} = this.limbs[side];
      const wrist = out['wrist' + side], elbow = out['elbow' + side], hand = out['hand' + side];
      const ankle = out['ankle' + side], knee = out['knee' + side], toe = out['toe' + side];
      this.groundPoint(wrist, this.recoveryPosition, stage.wrists[order][0] * sign, stage.wrists[order][1], stage.wrists[order][2]);
      this.groundPoint(ankle, this.recoveryPosition, stage.ankles[order][0] * sign, stage.ankles[order][1], stage.ankles[order][2]);
      this.bend.copy(this.groundSide).multiplyScalar(lateral * .72).addScaledVector(UP, -.34).addScaledVector(this.groundForward, -.48);
      this.solveLimb(out['shoulder' + side], elbow, wrist, arm, this.bend, PARTICLES.elbowL[1]);
      if (stage.plantHands) this.bend.copy(this.groundForward).multiplyScalar(.76).addScaledVector(UP, -.58);
      else this.bend.subVectors(wrist, elbow);
      this.placeExtremity(hand, wrist, arm[2].length, stage.plantHands ? PALM_SUPPORT : PARTICLES.handL[1]);
      this.bend.copy(this.groundForward).addScaledVector(UP, order ? stage.kneeTuck : .13)
        .addScaledVector(this.groundSide, lateral * .11);
      this.solveLimb(out['hip' + side], knee, ankle, leg, this.bend, PARTICLES.kneeL[1]);
      this.bend.copy(this.groundForward).addScaledVector(UP, -.20 + (order ? stage.toeTilt : 0))
        .addScaledVector(this.groundSide, lateral * .08);
      this.placeExtremity(toe, ankle, leg[2].length, .049);
    }
  }

  solveLimb(root, joint, end, lengths, bend, jointFloor, state, dt) {
    const upper = lengths[0].length, lower = lengths[1].length;
    this.axis.subVectors(end, root);
    const raw = this.axis.length();
    if (raw < 1e-7) this.axis.set(0, -1, 0);
    else this.axis.multiplyScalar(1 / raw);
    const distance = limit(raw, Math.abs(upper - lower) + .012, upper + lower - .004);
    end.copy(root).addScaledVector(this.axis, distance);
    const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
    const offset = Math.sqrt(Math.max(0, upper * upper - along * along));
    this.bendAxis.copy(bend).addScaledVector(this.axis, -bend.dot(this.axis));
    if (this.bendAxis.lengthSq() < 1e-6) {
      this.bendAxis.copy(this.groundSide).addScaledVector(this.axis, -this.groundSide.dot(this.axis));
    }
    this.bendAxis.normalize();
    joint.copy(root).addScaledVector(this.axis, along);
    if (state?.hasDirection) {
      this.transport.setFromUnitVectors(state.axis, this.axis);
      this.priorBend.copy(state.direction).applyQuaternion(this.transport);
    }
    this.jointUp.copy(UP).addScaledVector(this.axis, -this.axis.y);
    const verticalRange = this.jointUp.length() * offset;
    const height = verticalRange > 1e-7 ? (jointFloor - joint.y) / verticalRange : -1;
    if (height > -1) {
      // Keep the knee/elbow in the allowed arc of its IK circle. Lifting it
      // independently would shorten the visible upper bone during the roll.
      this.jointUp.normalize();
      this.jointSide.crossVectors(this.axis, this.jointUp);
      const allowed = Math.acos(Math.min(1, height));
      let turn = limit(Math.atan2(this.bendAxis.dot(this.jointSide), this.bendAxis.dot(this.jointUp)), -allowed, allowed);
      if (state?.hasDirection) {
        const previous = limit(Math.atan2(this.priorBend.dot(this.jointSide), this.priorBend.dot(this.jointUp)), -allowed, allowed);
        turn = limit(turn, previous - 21 * dt, previous + 21 * dt);
      }
      this.bendAxis.copy(this.jointUp).multiplyScalar(Math.cos(turn)).addScaledVector(this.jointSide, Math.sin(turn));
    } else if (state?.hasDirection) {
      const turn = Math.atan2(this.delta.crossVectors(this.priorBend, this.bendAxis).dot(this.axis), this.priorBend.dot(this.bendAxis));
      this.bendAxis.copy(this.priorBend).applyAxisAngle(this.axis, limit(turn, -21 * dt, 21 * dt));
    }
    if (state) {
      state.hasDirection = true;
      state.axis.copy(this.axis);
      state.direction.copy(this.bendAxis);
    }
    joint.addScaledVector(this.bendAxis, offset);
  }

  placeExtremity(point, base, length, floor) {
    this.bend.normalize();
    const minimumY = limit((floor - base.y) / length, -1, 1);
    if (this.bend.y < minimumY) {
      this.bend.setY(0);
      if (this.bend.lengthSq() < 1e-6) this.bend.copy(this.groundForward);
      this.bend.normalize().multiplyScalar(Math.sqrt(1 - minimumY * minimumY)).setY(minimumY);
    }
    point.copy(base).addScaledVector(this.bend, length);
  }

  transportBend(out, source, root, joint, end) {
    this.transportAxis.subVectors(source[end], source[root]).normalize();
    out.subVectors(source[joint], source[root]);
    out.addScaledVector(this.transportAxis, -out.dot(this.transportAxis));
    if (out.lengthSq() < 1e-7) {
      out.copy(this.groundForward).addScaledVector(this.transportAxis, -this.groundForward.dot(this.transportAxis));
      if (out.lengthSq() < 1e-7) out.copy(this.groundSide);
    }
    this.transport.setFromUnitVectors(this.transportAxis, this.interpolationAxis);
    return out.normalize().applyQuaternion(this.transport);
  }

  interpolateBend(start, target, root, joint, end, stage, t) {
    this.interpolationAxis.subVectors(this.current[end], this.current[root]).normalize();
    this.transportBend(this.bendStart, start, root, joint, end);
    this.transportBend(this.bendTarget, target, root, joint, end);
    const sine = this.delta.crossVectors(this.bendStart, this.bendTarget).dot(this.interpolationAxis);
    let angle = Math.atan2(sine, this.bendStart.dot(this.bendTarget));
    const state = this.recoveryBends[joint];
    if (state.stage === stage) angle += Math.round((state.angle - angle) / (2 * Math.PI)) * 2 * Math.PI;
    this.bend.copy(this.bendStart).applyAxisAngle(this.interpolationAxis, angle * t);
    state.stage = stage;
    state.angle = angle;
    return state;
  }

  interpolateExtremity(start, target, base, end, t) {
    this.bendStart.subVectors(start[end], start[base]).normalize();
    this.bendTarget.subVectors(target[end], target[base]).normalize();
    this.transport.setFromUnitVectors(this.bendStart, this.bendTarget);
    this.extremityRotation.identity().slerp(this.transport, t);
    this.bend.copy(this.bendStart).applyQuaternion(this.extremityRotation);
  }

  getUp(dt, readyLandmarks) {
    this.getUpTime += dt;
    const braceEnd = this.braceDuration;
    const kneelEnd = braceEnd + this.kneelDuration;
    const riseEnd = kneelEnd + this.riseDuration;
    const readyEnd = riseEnd + this.settleDuration;
    let stage = 0, start = this.recoveryStart, target = this.recoveryTargets[0], fraction = this.getUpTime / braceEnd;
    if (this.getUpTime > riseEnd) {
      if (!readyLandmarks) {
        this.getUpTime = riseEnd;
        return false;
      }
      start = this.recoveryTargets[2]; target = readyLandmarks;
      stage = 3;
      fraction = (this.getUpTime - riseEnd) / this.settleDuration;
      this.readyWeight = ease(fraction);
    } else if (this.getUpTime > kneelEnd) {
      start = this.recoveryTargets[1]; target = this.recoveryTargets[2];
      stage = 2;
      fraction = (this.getUpTime - kneelEnd) / this.riseDuration;
    } else if (this.getUpTime > braceEnd) {
      start = this.recoveryTargets[0]; target = this.recoveryTargets[1];
      stage = 1;
      fraction = (this.getUpTime - braceEnd) / this.kneelDuration;
    }
    if (this.getUpTime >= readyEnd) {
      copyPose(this.current, readyLandmarks);
      this.active = false;
      this.phase = 'ready';
      this.hasAnimated = false;
      return true;
    }

    const t = ease(fraction);
    const airHandFloor = PARTICLES.handL[1], handTravel = airHandFloor - PALM_SUPPORT;
    const handFloor = stage === 0 ? airHandFloor - handTravel * t : stage === 1 ? PALM_SUPPORT :
      stage === 2 ? PALM_SUPPORT + handTravel * t : airHandFloor;
    for (const name of SIM_NAMES) {
      this.integrationStart[name].copy(this.current[name]);
      if (target[name]) this.current[name].lerpVectors(start[name], target[name], t);
    }
    this.rotationFromPose(start, this.startRotation);
    this.rotationFromPose(target, this.targetRotation);
    this.getUpRotation.copy(this.startRotation).slerp(this.targetRotation, t);
    this.sideAxis.set(1, 0, 0).applyQuaternion(this.getUpRotation);
    this.upperAxis.set(0, 1, 0).applyQuaternion(this.getUpRotation);
    this.forwardAxis.set(0, 0, -1).applyQuaternion(this.getUpRotation);
    this.poseHip.copy(this.current.pelvis);
    this.placeTorso(this.current);

    const {head, neck} = this.current;
    this.bendStart.subVectors(start.head, start.neck).normalize().applyQuaternion(this.transport.copy(this.startRotation).invert());
    this.bendTarget.subVectors(target.head, target.neck).normalize().applyQuaternion(this.transport.copy(this.targetRotation).invert());
    this.transport.setFromUnitVectors(this.bendStart, this.bendTarget);
    this.extremityRotation.identity().slerp(this.transport, t);
    this.bend.copy(this.bendStart).applyQuaternion(this.extremityRotation).applyQuaternion(this.getUpRotation);
    head.copy(neck).addScaledVector(this.bend, this.headLink.length);
    let lift = Math.max(0, PARTICLES.head[1] - head.y);
    for (const name of TORSO) lift = Math.max(lift, this.particles[name].radius - this.current[name].y);
    if (lift > 0) {
      for (const name of TORSO) this.current[name].y += lift;
      head.y += lift;
    }

    const arc = 4 * t * (1 - t);
    for (const side of SIDES) {
      const {arm, leg} = this.limbs[side], p = this.current;
      const shoulder = 'shoulder' + side, elbow = 'elbow' + side, wrist = 'wrist' + side, hand = 'hand' + side;
      const hip = 'hip' + side, knee = 'knee' + side, ankle = 'ankle' + side, toe = 'toe' + side;
      const ankleTravel = start[ankle].distanceTo(target[ankle]);
      const wristTravel = start[wrist].distanceTo(target[wrist]);
      if (ankleTravel > .045) {p[ankle].y += Math.min(.097, .16 * ankleTravel) * arc;}
      if (wristTravel > .16) {
        p[wrist].y += Math.min(.047, .075 * wristTravel) * arc;
        p[wrist].addScaledVector(this.groundSide, (side === 'R' ? 1 : -1) * Math.min(.125, .24 * wristTravel) * arc);
      }
      const armBend = this.interpolateBend(start, target, shoulder, elbow, wrist, stage, t);
      this.solveLimb(p[shoulder], p[elbow], p[wrist], arm, this.bend, PARTICLES.elbowL[1], armBend, dt);
      this.interpolateExtremity(start, target, wrist, hand, t);
      this.placeExtremity(p[hand], p[wrist], arm[2].length, handFloor);
      const legBend = this.interpolateBend(start, target, hip, knee, ankle, stage, t);
      this.solveLimb(p[hip], p[knee], p[ankle], leg, this.bend, PARTICLES.kneeL[1], legBend, dt);
      this.interpolateExtremity(start, target, ankle, toe, t);
      this.placeExtremity(p[toe], p[ankle], leg[2].length, .049);
    }
    this.projectPitch(handFloor);
    for (const name of SIM_NAMES) {
      this.velocity[name].subVectors(this.current[name], this.integrationStart[name]).multiplyScalar(1 / dt).clampLength(0, 6);
    }
    return false;
  }

  sample(alpha) {
    const t = limit(alpha);
    for (const name of NAMES) this.renderPose[name].lerpVectors(this.previous[name], this.current[name], t);
    this.renderPose.readyWeight = this.previousReadyWeight + (this.readyWeight - this.previousReadyWeight) * t;
    return this.renderPose;
  }
}

export { FootballKeeperRagdoll };
