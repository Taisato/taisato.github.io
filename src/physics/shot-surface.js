import { FB } from '../config.js';

const FIRM_GROUND_SPEED = 5.5;
const LOW_SHOT_CLEARANCE = .22;

function outsidePenaltyArea(position) {
  return Boolean(position && Number.isFinite(position.x) && Number.isFinite(position.z) &&
    (position.z > -FB.halfLength + FB.penaltyDepth || Math.abs(position.x) > FB.goalWidth * .5 + FB.penaltyDepth));
}

class FootballShotSurface {
  constructor() {
    this.configure(null);
    this.reset();
  }

  configure(effects) {
    const grassRank = effects?.grassCutter;
    this.grassFactor = grassRank >= 2 ? .45 : grassRank >= 1 ? .6 : 1;
    this.grassAirLanding = effects?.grassAirLanding > 0;
    this.lowCurveBounce = effects?.lowCurveBounce > 0;
    this.reset();
  }

  reset() {
    this.cutGrass = false;
    this.grassFromAir = false;
    this.grassOnNextLanding = false;
    this.lowCurveShot = false;
    this.curveOnGrass = false;
  }

  copy(source) {
    this.grassFactor = source?.grassFactor ?? 1;
    this.cutGrass = source?.cutGrass ?? false;
    this.grassFromAir = source?.grassFromAir ?? false;
    this.grassOnNextLanding = source?.grassOnNextLanding ?? false;
    this.lowCurveShot = source?.lowCurveShot ?? false;
    this.curveOnGrass = source?.curveOnGrass ?? false;
  }

  launch(ball, downward) {
    const clearance = ball.position.y - ball.radius;
    const firm = Math.hypot(ball.velocity.x, ball.velocity.z) >= FIRM_GROUND_SPEED;
    this.cutGrass = this.grassFactor < 1 && firm && clearance <= .045;
    this.grassOnNextLanding = this.grassFactor < 1 && this.grassAirLanding && firm && downward &&
      clearance > .045 && clearance <= .54 && ball.velocity.y < .9;
    this.lowCurveShot = this.lowCurveBounce && firm && clearance <= .20 &&
      ball.velocity.y <= 2.25 && Math.abs(ball.spin.y) >= 4;
  }

  redirect() {
    this.reset();
  }

  observeAir(clearance) {
    // Use the resolved flight height. A driven shot may point into the turf at
    // contact, while a chip from the same spot will rise past this clearance.
    if (this.cutGrass && !this.grassFromAir && clearance > LOW_SHOT_CLEARANCE) this.cutGrass = false;
    if (this.lowCurveShot && clearance > .34) {
      this.lowCurveShot = false;
      this.curveOnGrass = false;
    }
  }

  land() {
    if (this.grassOnNextLanding) {
      this.cutGrass = true;
      this.grassFromAir = true;
      this.grassOnNextLanding = false;
    }
    if (this.lowCurveShot) this.curveOnGrass = true;
  }

  yawSpinDecay() {
    return this.curveOnGrass ? .36 : 1.7;
  }

  rollingFactor(speed) {
    if (!this.cutGrass || speed <= 3.2) return 1;
    // Fade the benefit out as the drive settles into an ordinary slow roll.
    const t = Math.min(1, (speed - 3.2) / 3.8);
    return 1 - (1 - this.grassFactor) * t * t * (3 - 2 * t);
  }
}

export { FootballShotSurface, outsidePenaltyArea };
