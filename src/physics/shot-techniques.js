import { FB } from '../config.js';
import { outsidePenaltyArea } from './shot-surface.js';

// Only distinct player contacts advance setups. The collision solver reports
// deflections and turf bounces separately so they cannot use up a player touch.
class ShotTechniques {
  configure(effects) {
    this.effects = effects;
    this.switchEnabled = !!(effects?.switchPace || effects?.switchCurve || effects?.switchFree);
    this.boxEnabled = !!(effects?.boxRefund || effects?.boxPace || effects?.boxGoal);
    this.reboundEnabled = !!(effects?.reboundPace || effects?.reboundWindow || effects?.reboundHeal);
    this.farEnabled = !!(effects?.farCurve || effects?.farPace || effects?.farGoal);
    this.halfEnabled = !!(effects?.halfVolleyStrength || effects?.halfVolleyWindow || effects?.halfVolleyFree);
    this.active = this.switchEnabled || this.boxEnabled || this.reboundEnabled || this.farEnabled || this.halfEnabled;
    if (!this.switchEnabled) this.setupFoot = null;
    if (!this.boxEnabled) this.outsideControl = this.enteredBox = this.boxShotPending = false;
    if (!this.reboundEnabled) this.reboundAt = -Infinity;
    if (!this.halfEnabled) this.bounceAt = -Infinity;
  }

  reset() {
    this.setupFoot = null;
    this.controlAt = this.bounceAt = this.reboundAt = -Infinity;
    this.outsideControl = this.enteredBox = this.boxShotPending = false;
    this.hadPlayerTouch = false;
  }

  redirect(surface) {
    this.setupFoot = null;
    this.bounceAt = -Infinity;
    this.outsideControl = false;
    if (surface === 'net') this.reboundAt = -Infinity;
  }

  recordRebound(time, live) {
    this.reboundAt = this.reboundEnabled && this.hadPlayerTouch && live ? time : -Infinity;
  }

  recordControl(event) {
    const controlled = event.control && event.surface === 'boot';
    this.setupFoot = this.switchEnabled && controlled ? event.footId : null;
    this.controlAt = event.time;
    this.bounceAt = -Infinity;
    this.hadPlayerTouch = true;
    if (!this.boxEnabled || this.enteredBox) return;
    if (!controlled) {
      this.outsideControl = false;
      return;
    }
    if (outsidePenaltyArea(event.position)) {
      this.outsideControl = true;
    } else if (this.outsideControl && event.position.z >= -FB.halfLength) {
      event.boxEntry = this.enteredBox = this.boxShotPending = true;
    }
  }

  recordStrike(event, velocity) {
    const { time, position, footId } = event, effects = this.effects;
    if (this.switchEnabled && this.setupFoot != null && this.setupFoot !== footId &&
        time - this.controlAt <= 2 + 1e-9) event.switchShot = true;
    if (this.boxShotPending && !outsidePenaltyArea(position) && position.z >= -FB.halfLength) event.boxShot = true;
    if (this.reboundEnabled && time - this.reboundAt <= 2 + (effects.reboundWindow || 0) + 1e-9) event.reboundShot = true;
    if (this.halfEnabled && time - this.bounceAt <= .30 + (effects.halfVolleyWindow || 0) + 1e-9) event.halfVolley = true;
    if (this.farEnabled) {
      event.farSide = 0;
      if (Math.abs(position.x) >= 4 && velocity.z < 0 && position.z > -FB.halfLength) {
        const projectedX = position.x + velocity.x * ((-FB.halfLength - position.z) / velocity.z);
        if (position.x * projectedX < 0) event.farSide = -Math.sign(position.x);
      }
    }
    this.setupFoot = null;
    this.outsideControl = this.boxShotPending = false;
    this.bounceAt = this.reboundAt = -Infinity;
    this.hadPlayerTouch = true;
  }

  paceBonus(event) {
    const e = this.effects;
    return (event.switchShot ? e.switchPace || 0 : 0) + (event.boxShot ? e.boxPace || 0 : 0) +
      (event.reboundShot ? e.reboundPace || 0 : 0) + (event.farSide ? e.farPace || 0 : 0);
  }
}

export { ShotTechniques };
