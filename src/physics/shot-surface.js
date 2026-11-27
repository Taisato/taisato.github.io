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
    this.grassFactor = stackedFactor(effects?.grassCutter, .6, .20);
    this.reset();
  }

  reset() {
    this.cutGrass = false;
  }

  copy(source) {
    this.grassFactor = source?.grassFactor ?? 1;
    this.cutGrass = source?.cutGrass ?? false;
  }

  launch(ball) {
    this.cutGrass = this.grassFactor < 1 && ball.position.y - ball.radius <= .045 &&
      Math.hypot(ball.velocity.x, ball.velocity.z) >= FIRM_GROUND_SPEED;
  }

  redirect() {
    this.cutGrass = false;
  }

  observeAir(clearance) {
    // Use the resolved flight height. A driven shot may point into the turf at
    // contact, while a chip from the same spot will rise past this clearance.
    if (this.cutGrass && clearance > LOW_SHOT_CLEARANCE) this.cutGrass = false;
  }

  rollingFactor(speed) {
    if (!this.cutGrass || speed <= 3.2) return 1;
    // Fade the benefit out as the drive settles into an ordinary slow roll.
    const t = Math.min(1, (speed - 3.2) / 3.8);
    return 1 - (1 - this.grassFactor) * t * t * (3 - 2 * t);
  }
}

export { FootballShotSurface };
