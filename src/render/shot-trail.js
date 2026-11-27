import { FT } from '../../vendor/three.js';
import { FB } from '../config.js';
import { UI } from '../ui/theme.js';

const POINTS = 192;
const MIN_DISTANCE_SQ = .10 ** 2;
const FADE_SECONDS = .65;
const WIDTH = .013;
const TRIANGLE_HEIGHT = Math.sqrt(3) / 2;
const INDICES_PER_SEGMENT = 18;
const PREDICTION_INTERVAL = 1 / 15;

class FootballShotTrail {
  constructor(scene) {
    this.points = new Float32Array(POINTS * 3);
    this.geometry = new FT.BufferGeometry();
    // A tiny triangular tube stays readable for both XR eyes at long range.
    this.attribute = new FT.BufferAttribute(new Float32Array(POINTS * 9), 3).setUsage(35048);
    this.geometry.setAttribute('position', this.attribute);
    const indices = new Uint16Array((POINTS - 1) * INDICES_PER_SEGMENT);
    let next = 0;
    for (let i = 0; i < POINTS - 1; i++) {
      for (let side = 0; side < 3; side++) {
        const a = 3 * i + side, b = 3 * i + (side + 1) % 3;
        indices[next++] = a; indices[next++] = b; indices[next++] = a + 3;
        indices[next++] = b; indices[next++] = b + 3; indices[next++] = a + 3;
      }
    }
    this.geometry.setIndex(new FT.BufferAttribute(indices, 1));
    this.material = new FT.MeshBasicMaterial({color: UI.mint, transparent: true, opacity: 0, depthWrite: false, toneMapped: false});
    this.line = new FT.Mesh(this.geometry, this.material);
    this.line.name = 'Player shot path';
    this.line.frustumCulled = false;
    this.markGeometry = new FT.SphereGeometry(1, 12, 8);
    this.impact = new FT.Mesh(this.markGeometry, new FT.MeshBasicMaterial({color:UI.mint, transparent:true, opacity:.90, depthWrite:false, toneMapped:false}));
    this.impact.name = 'Shot trace first impact';
    this.impact.scale.setScalar(.073);
    this.landing = new FT.Mesh(this.markGeometry, new FT.MeshBasicMaterial({color:UI.lilac, transparent:true, opacity:.81, depthWrite:false, toneMapped:false}));
    this.landing.name = 'Predicted ball landing';
    this.landing.scale.set(.125,.009,.125);
    this.landingPoint = new FT.Vector3();
    scene.add(this.line,this.impact,this.landing);
    this.setPlayerAbilities(null);
    this.clear();
  }

  setPlayerAbilities(effects) {
    this.markersEnabled = effects?.shotTraceMarkers > 0;
    this.predictionEnabled = effects?.shotTracePrediction > 0;
    if (this.replaying && !this.markersEnabled) this.clear();
    if (!this.markersEnabled) this.impact.visible = false;
    if (!this.predictionEnabled) this.landing.visible = false;
  }

  start(position, seconds) {
    this.clear();
    if (!(seconds > 0) || !Number.isFinite(seconds) || !position || !Number.isFinite(position.x + position.y + position.z)) return;
    this.remaining = seconds;
    this.interval = Math.max(1, Math.ceil(seconds / FB.fixedStep / (POINTS - 2)));
    this.samples = 1;
    this.setPoint(0, position);
    this.material.opacity = .78;
  }

  setPoint(index, position) {
    this.points[index * 3] = position.x;
    this.points[index * 3 + 1] = position.y;
    this.points[index * 3 + 2] = position.z;
  }

  setRing(index, x, y, z, dx, dy, dz) {
    const horizontal = Math.hypot(dx, dz), length = Math.hypot(dx, dy, dz);
    const ux = horizontal > 1e-6 ? -dz / horizontal : 1;
    const uz = horizontal > 1e-6 ? dx / horizontal : 0;
    const vx = dy * uz / length, vy = (dz * ux - dx * uz) / length, vz = -dy * ux / length;
    const base = index * 3;
    this.attribute.setXYZ(base, x + WIDTH * ux, y, z + WIDTH * uz);
    this.attribute.setXYZ(base + 1, x + WIDTH * (-.5 * ux + TRIANGLE_HEIGHT * vx), y + WIDTH * TRIANGLE_HEIGHT * vy, z + WIDTH * (-.5 * uz + TRIANGLE_HEIGHT * vz));
    this.attribute.setXYZ(base + 2, x + WIDTH * (-.5 * ux - TRIANGLE_HEIGHT * vx), y - WIDTH * TRIANGLE_HEIGHT * vy, z + WIDTH * (-.5 * uz - TRIANGLE_HEIGHT * vz));
  }

  record(position) {
    if (this.replaying || this.remaining <= 0 || !Number.isFinite(position.x + position.y + position.z)) return;
    const last = (this.samples - 1) * 3;
    const dx = position.x - this.points[last], dy = position.y - this.points[last + 1], dz = position.z - this.points[last + 2];
    this.steps++;
    if (dx * dx + dy * dy + dz * dz < MIN_DISTANCE_SQ) return;
    // Use the newest sample as the visible tip between committed points.
    if (this.samples === 1) this.setRing(0, this.points[0], this.points[1], this.points[2], dx, dy, dz);
    this.setPoint(this.samples, position);
    this.setRing(this.samples, position.x, position.y, position.z, dx, dy, dz);
    this.attribute.needsUpdate = true;
    this.geometry.setDrawRange(0, this.samples * INDICES_PER_SEGMENT);
    this.line.visible = true;
    if (this.steps >= this.interval && this.samples < POINTS - 1) {
      this.samples++;
      this.steps = 0;
    }
  }

  update(seconds) {
    if (this.replaying || this.remaining <= 0 || !(seconds > 0) || !Number.isFinite(seconds)) return;
    this.remaining = Math.max(0, this.remaining - seconds);
    if (this.remaining <= 0) this.line.visible = this.impact.visible = false;
    const fade = Math.min(1, this.remaining / FADE_SECONDS);
    this.material.opacity = .78 * fade;
    this.impact.material.opacity = .90 * fade;
  }

  mark(event) {
    if (!this.markersEnabled || !this.samples || this.marked || this.replaying ||
        (event.type !== 'bounce' && event.type !== 'save')) return;
    const position = event.position;
    if (!position || !Number.isFinite(position.x + position.y + position.z)) return;
    this.marked = true;
    this.impact.position.copy(position);
    this.impact.material.color.set(event.type === 'bounce' ? UI.mint : UI.white);
    this.impact.visible = this.remaining > 0;
  }

  replay() {
    this.replaying = this.markersEnabled && (this.geometry.drawRange.count > 0 || this.marked);
    if (!this.replaying) {this.clear();return false;}
    this.line.visible = this.geometry.drawRange.count > 0;
    this.impact.visible = this.marked;
    this.landing.visible = false;
    this.material.opacity = .46;
    this.impact.material.opacity = .64;
    return true;
  }

  updateLanding(physics, seconds, live = true) {
    const ball = physics.ball;
    if (!live || !this.predictionEnabled || this.replaying || ball.position.y <= ball.radius + .05) {
      this.landing.visible = false;
      this.predictionTimer = 0;
      return;
    }
    if (!(seconds > 0) || !Number.isFinite(seconds)) return;
    this.predictionTimer -= seconds;
    if (this.predictionTimer > 0) return;
    this.predictionTimer = PREDICTION_INTERVAL;
    this.landing.visible = physics.predictLanding(this.landingPoint);
    if (this.landing.visible) this.landing.position.set(this.landingPoint.x,.016,this.landingPoint.z);
  }

  clear() {
    this.remaining = 0;
    this.samples = 0;
    this.steps = 0;
    this.marked = this.replaying = false;
    this.predictionTimer = 0;
    this.impact.material.opacity = .90;
    this.geometry.setDrawRange(0, 0);
    this.line.visible = this.impact.visible = this.landing.visible = false;
  }

  dispose() {
    this.line.removeFromParent();
    this.impact.removeFromParent();
    this.landing.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.markGeometry.dispose();
    this.impact.material.dispose();
    this.landing.material.dispose();
  }
}

export { FootballShotTrail };
