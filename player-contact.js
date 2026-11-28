import { FT } from '../../vendor/three.js';
import { FB, footballClamp } from '../config.js';

const V = FT.Vector3;
const BOOT_SPEED = 2.55;
const BODY_SPEED = 3.25;

// Closest points on finite axes, including degenerate axes such as the head.
function closestAxes(a, b, c, d, first, second, axes) {
  const [u, v, offset] = axes;
  u.subVectors(b, a); v.subVectors(d, c); offset.subVectors(a, c);
  const uu = u.lengthSq(), vv = v.lengthSq(), uv = u.dot(v);
  const uOffset = u.dot(offset), vOffset = v.dot(offset);
  let s = 0, t = 0;
  if (uu > 1e-10) {
    const denominator = uu * vv - uv * uv;
    if (denominator > 1e-10) s = footballClamp((uv * vOffset - vv * uOffset) / denominator, 0, 1);
    else if (vv <= 1e-10) s = footballClamp(-uOffset / uu, 0, 1);
  }
  if (vv > 1e-10) {
    t = footballClamp((uv * s + vOffset) / vv, 0, 1);
    if (uu > 1e-10 && (t === 0 || t === 1)) s = footballClamp((uv * t - uOffset) / uu, 0, 1);
  }
  first.copy(a).addScaledVector(u, s);
  second.copy(c).addScaledVector(v, t);
  return t;
}

class FootballKeeperPlayerContact {
  constructor() {
    this.body = {from: new V(), to: new V(), previous: new V(), position: new V(), velocity: new V(), valid: false, primed: false};
    this.bodyContact = {hit: false};
    this.bootContacts = [{hit: false}, {hit: false}];
    this.sourceA = new V(); this.sourceB = new V();
    this.keeperA = new V(); this.keeperB = new V();
    this.sourcePoint = new V(); this.keeperPoint = new V();
    this.normal = new V(); this.arm = new V(); this.axis = new V();
    this.axes = [new V(), new V(), new V()];
    this.ankle = new V(); this.center = new V(); this.orientation = new FT.Quaternion();
    this.drive = new V(); this.angular = new V(); this.surface = new V(); this.swing = new V();
    this.keeperVelocity = new V(); this.keeperVelocityB = new V();
    this.best = {score: 0, speed: 0, point: new V(), velocity: new V(), capsule: null, footId: null};
  }

  reset() {
    this.body.valid = this.body.primed = false;
    this.bodyContact.hit = false;
    for (const contact of this.bootContacts) contact.hit = false;
  }

  prepareBody(head, dt, blocked) {
    const body = this.body;
    if (blocked || dt <= 0 || !Number.isFinite(head.lengthSq())) {this.reset(); return;}
    body.from.copy(body.to); body.to.copy(head);
    body.valid = body.primed && body.from.distanceToSquared(body.to) < Math.max(.39, 15 * dt) ** 2;
    body.primed = true;
    if (!body.valid) body.previous.copy(body.to);
  }

  step(keeper, feet, alpha, rate) {
    const best = this.best, body = this.body;
    best.score = 0;
    for (let i = 0; i < this.bootContacts.length; i++) {
      const foot = feet[i], contact = this.bootContacts[i];
      if (foot?.enabled && this.near(keeper, foot.position, foot.previous)) this.sweep(keeper, contact, foot);
      else contact.hit = false;
    }
    if (body.valid) {
      body.position.lerpVectors(body.from, body.to, alpha);
      body.velocity.subVectors(body.position, body.previous).multiplyScalar(rate / FB.fixedStep);
      body.velocity.y = 0;
      if (this.near(keeper, body.position, body.previous)) this.sweep(keeper, this.bodyContact);
      else this.bodyContact.hit = false;
      body.previous.copy(body.position);
    } else this.bodyContact.hit = false;
    if (!best.score || !keeper.receiveImpact(best.velocity, best.point, best.capsule)) return null;
    return {type: 'keeper-contact', time: keeper.time, position: best.point.clone(), speed: best.speed,
      surface: best.capsule.kind, footId: best.footId};
  }

  near(keeper, current, previous) {
    return Math.min(current.distanceToSquared(keeper.position), previous.distanceToSquared(keeper.position)) < 3.15 ** 2;
  }

  sweep(keeper, contact, foot = null) {
    const body = this.body;
    const from = foot ? foot.previousAnklePosition : body.previous;
    const to = foot ? foot.anklePosition : body.position;
    const radius = foot ? foot.radius : .235;
    let travel = from.distanceTo(to) + keeper.maxTravel;
    if (foot) {
      travel += foot.previousOrientation.angleTo(foot.orientation) * (foot.halfLength + foot.contactOffset.length());
      this.drive.copy(foot.driveVelocity);
      // Keep clearance corrections and trigger-only ankle rotation from creating a strike.
      const ankleY = foot.ankleVelocity.y;
      this.drive.y = this.drive.y > 0 ? Math.min(this.drive.y, Math.max(0, ankleY)) : Math.max(this.drive.y, Math.min(0, ankleY));
      this.angular.copy(foot.angularVelocity).sub(foot.controlAngularVelocity).clampLength(0, 8).add(foot.controlAngularVelocity);
    } else this.drive.copy(body.velocity);
    if (!Number.isFinite(travel + this.drive.lengthSq()) || travel > 1.55) {contact.hit = false; return;}

    const steps = Math.max(1, Math.min(12, Math.ceil(travel / .045)));
    const threshold = foot ? BOOT_SPEED : BODY_SPEED;
    let touching = false, hit = false;
    for (let i = 1; i <= steps; i++) {
      const alpha = i / steps;
      this.center.lerpVectors(from, to, alpha);
      if (foot) {
        this.ankle.copy(this.center);
        this.orientation.slerpQuaternions(foot.previousOrientation, foot.orientation, alpha);
        this.center.add(this.axis.copy(foot.contactOffset).applyQuaternion(this.orientation));
        this.axis.set(0, 0, foot.halfLength).applyQuaternion(this.orientation);
        this.sourceA.copy(this.center).sub(this.axis); this.sourceB.copy(this.center).add(this.axis);
      } else {
        const top = footballClamp(this.center.y - .19, .68, 1.81);
        this.sourceA.set(this.center.x, Math.max(.37, top - .64), this.center.z);
        this.sourceB.set(this.center.x, top, this.center.z);
      }
      for (const capsule of keeper.colliders) {
        this.keeperA.lerpVectors(capsule.previousA, capsule.a, alpha);
        this.keeperB.lerpVectors(capsule.previousB, capsule.b, alpha);
        const along = closestAxes(this.sourceA, this.sourceB, this.keeperA, this.keeperB,
          this.sourcePoint, this.keeperPoint, this.axes);
        this.normal.subVectors(this.keeperPoint, this.sourcePoint);
        const distanceSq = this.normal.lengthSq(), reach = radius + capsule.radius;
        if (distanceSq > (reach + .025) ** 2) continue;
        touching = true;
        if (contact.hit || distanceSq > reach * reach) continue;
        if (distanceSq > 1e-10) this.normal.multiplyScalar(1 / Math.sqrt(distanceSq));
        else this.normal.copy(this.drive).normalize();
        this.surface.copy(this.drive);
        if (foot) {
          this.arm.copy(this.sourcePoint).addScaledVector(this.normal, radius).sub(this.ankle);
          this.swing.crossVectors(this.angular, this.arm);
          this.surface.add(this.swing);
          if (this.swing.copy(this.surface).sub(foot.locomotionVelocity).dot(this.normal) < 2.1) continue;
        }
        // Only a moving player can cause an impact, even when the keeper dives into them.
        if (this.surface.dot(this.normal) < threshold * .81) continue;
        this.keeperVelocity.subVectors(capsule.a, capsule.previousA);
        this.keeperVelocityB.subVectors(capsule.b, capsule.previousB);
        this.keeperVelocity.lerp(this.keeperVelocityB, along).multiplyScalar(1 / keeper._fixedDt).clampLength(0, 9);
        const speed = this.surface.dot(this.normal) - this.keeperVelocity.dot(this.normal);
        if (speed < threshold) continue;
        hit = true;
        const score = (foot ? 1.1 : 1) * speed;
        if (score <= this.best.score) continue;
        this.best.score = score; this.best.speed = speed; this.best.capsule = capsule;
        this.best.footId = foot?.id ?? null;
        this.best.point.copy(this.keeperPoint).addScaledVector(this.normal, -capsule.radius);
        this.surface.normalize();
        this.best.velocity.copy(this.normal).multiplyScalar(.67).addScaledVector(this.surface, .33)
          .normalize().multiplyScalar(Math.min(speed, foot ? 18 : 6.1));
      }
      if (hit) break;
    }
    contact.hit = touching && (contact.hit || hit);
  }
}

export { FootballKeeperPlayerContact };
