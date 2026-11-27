const FLIGHT_CLEARANCE = .025;
const FIRM_GROUND_SPEED = 5.5;
const LOW_SHOT_CLEARANCE = .22;

function stackedFactor(picks, factor, minimum) {
  return Number.isFinite(picks) && picks > 0 ? Math.max(minimum, factor ** picks) : 1;
}

class FootballShotSurface {
  constructor() {
    this.configure(null);
    this.reset();
  }

  configure(effects) {
    this.bounceFactor = stackedFactor(effects?.softLanding, .8, .35);
    this.grassFactor = stackedFactor(effects?.grassCutter, .6, .20);
    this.reset();
  }

  reset() {
    this.pendingBounce = false;
    this.leftTurf = false;
    this.cutGrass = false;
  }

  copy(source) {
    this.bounceFactor = source?.bounceFactor ?? 1;
    this.grassFactor = source?.grassFactor ?? 1;
    this.pendingBounce = source?.pendingBounce ?? false;
    this.leftTurf = source?.leftTurf ?? false;
    this.cutGrass = source?.cutGrass ?? false;
  }

  touch(ball) {
    this.pendingBounce = this.bounceFactor < 1;
    this.leftTurf = this.pendingBounce && ball.position.y - ball.radius > FLIGHT_CLEARANCE;
    this.cutGrass = false;
  }

  launch(ball) {
    this.cutGrass = this.grassFactor < 1 && ball.position.y - ball.radius <= .045 &&
      Math.hypot(ball.velocity.x, ball.velocity.z) >= FIRM_GROUND_SPEED;
  }

  redirect() {
    this.cutGrass = false;
  }

  observeAir(clearance) {
    if (this.pendingBounce && clearance > FLIGHT_CLEARANCE) this.leftTurf = true;
    // Use the resolved flight height. A driven shot may point into the turf at
    // contact, while a chip from the same spot will rise past this clearance.
    if (this.cutGrass && clearance > LOW_SHOT_CLEARANCE) this.cutGrass = false;
  }

  land(ball, incoming) {
    if (!this.pendingBounce || !this.leftTurf) return;
    this.pendingBounce = this.leftTurf = false;
    if (incoming <= .65) return;
    // Remove horizontal pace and its associated rolling spin on the same bounce.
    // Vertical restitution and sidespin remain available for a follow-up.
    const factor = this.bounceFactor;
    ball.velocity.x *= factor; ball.velocity.z *= factor;
    ball.spin.x *= factor; ball.spin.z *= factor;
  }

  rollingFactor(speed) {
    if (!this.cutGrass || speed <= 3.2) return 1;
    // Fade the benefit out as the drive settles into an ordinary slow roll.
    const t = Math.min(1, (speed - 3.2) / 3.8);
    return 1 - (1 - this.grassFactor) * t * t * (3 - 2 * t);
  }
}

export { FootballShotSurface };
