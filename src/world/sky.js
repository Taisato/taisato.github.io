import { FT } from '../../vendor/three.js';
import { SKY_OPTIONS } from '../config.js';

const SKY_VERTEX = `
varying vec3 vWorldDirection;
void main() {
  vWorldDirection = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAGMENT = `
varying vec3 vWorldDirection;
uniform vec3 uZenith, uHorizon, uPlanetShadow, uPlanetLight, uAccent;
uniform vec3 uPlanet, uRight, uUp, uSunlight;
uniform float uRadius, uKind, uStarSeed;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float stars(vec2 sky, vec2 density, float threshold) {
  vec2 coord = sky * density;
  vec2 cell = floor(coord);
  cell.x = mod(cell.x, density.x);
  float value = hash(cell + uStarSeed);
  vec2 center = vec2(hash(cell + 13.4), hash(cell - 5.3)) * .52 + .24;
  vec2 delta = fract(coord) - center;
  float distance = length(delta);
  float antialias = max(.015, min(.075, fwidth(distance) * .8));
  float point = 1.0 - smoothstep(.025, .025 + antialias, distance);
  return step(threshold, value) * pow(value, 12.0) * point;
}

float ringLine(float radius, float center, float width) {
  float edge = min(.026, fwidth(radius) * 1.35);
  return 1.0 - smoothstep(width, width + edge, abs(radius - center));
}

void main() {
  vec3 ray = normalize(vWorldDirection - cameraPosition);
  float altitude = max(0.0, ray.y);
  float horizon = exp(-altitude * 5.5);
  vec3 color = mix(uZenith, uHorizon, horizon);
  color += uAccent * .015 * exp(-36.0 * abs(ray.y - .009));

  vec2 celestial = vec2(atan(ray.x, -ray.z) / 6.283185 + .5, asin(clamp(ray.y, -1.0, 1.0)) / 3.141593 + .5);
  float specks = stars(celestial, vec2(660.0, 294.0), .916);
  float beacons = stars(celestial + vec2(.034, .012), vec2(290.0, 135.0), .96);
  float darkness = smoothstep(0.015, .31, altitude) * .72 + .24;
  color += (vec3(.45,.60,.84) * specks * .23 + vec3(.74,.82,.98) * beacons * .54) * darkness;

  if (dot(ray, uPlanet) > .87) {
    vec2 local = vec2(dot(ray, uRight), dot(ray, uUp)) / uRadius;
    float radius = length(local);
    float toDisk = abs(radius - 1.0);
    float aa = clamp(fwidth(radius), .002, .033);
    float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, radius);
    vec3 normal = vec3(local, sqrt(max(0.0, 1.0 - radius * radius)));
    float sunlight = dot(normal, uSunlight);
    float limb = (1.0 - smoothstep(.006, .006 + aa * 1.4, toDisk));
    float rimBrightness = max(0.0, dot(vec3(normalize(local + .00001), .10), uSunlight));
    float ring = 0.0;
    bool orbit = uKind < .5;
    if (orbit) {
      vec2 tilted = vec2(.954 * local.x - .30 * local.y, .30 * local.x + .954 * local.y);
      float ellipse = length(vec2(tilted.x, tilted.y / .38));
      float dust = smoothstep(1.31, 1.43, ellipse) * (1.0 - smoothstep(1.73, 1.88, ellipse));
      ring = .085 * dust + .22 * ringLine(ellipse, 1.46, .009) + .14 * ringLine(ellipse, 1.70, .013);
      if (tilted.y > 0.0) color = mix(color, uAccent, ring);
      else ring *= 1.14;
      float latitude = normal.y + normal.x * .20;
      float band = .65 * sin(latitude * 21.0 + sin(latitude * 8.0) * 1.2) + .35 * sin(latitude * 54.0 + normal.x);
      vec3 surface = mix(uPlanetShadow, uPlanetLight * (.90 + .10 * band), smoothstep(-.06, .86, sunlight));
      color += uAccent * exp(-toDisk * 20.0) * .027 * rimBrightness;
      color = mix(color, surface, disc);
      color += uAccent * limb * (.06 + .49 * rimBrightness);
      if (tilted.y <= 0.0) color = mix(color, uAccent, ring);
    } else if (uKind < 1.5) {
      float edgeLight = smoothstep(-.98, .72, dot(normalize(local + .00001), vec2(-.52,.86)));
      color += uAccent * exp(-toDisk * 19.0) * (.028 + .16 * edgeLight);
      color = mix(color, uPlanetShadow + uPlanetLight * .012 * normal.z, disc);
      color += uAccent * limb * (.15 + .86 * edgeLight);
    } else {
      float phase = smoothstep(-.055, .62, sunlight);
      float bands = .95 + .05 * sin((normal.y - normal.x * .22) * 16.0);
      vec3 surface = mix(uPlanetShadow, uPlanetLight * bands, phase);
      color += uAccent * exp(-toDisk * 20.0) * .04 * rimBrightness;
      color = mix(color, surface, disc);
      color += uAccent * limb * (.055 + .56 * rimBrightness);
    }
  }

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

const SKY_STAGES = {
  'quiet-orbit': {zenith:'#060c1c', horizon:'#132a41', shadow:'#0a1324', light:'#699eb4', accent:'#9de3fa',
    planet:[.275,.235,-.93], radius:.111, sunlight:[-.82,.44,.27], stars:3.6},
  'solar-edge': {zenith:'#110b1c', horizon:'#34202d', shadow:'#100b1b', light:'#e78852', accent:'#ffd098',
    planet:[-.145,.218,-.96], radius:.126, sunlight:[-.52,.86,.18], stars:8.2},
  'violet-hour': {zenith:'#0c0a24', horizon:'#262044', shadow:'#130e2a', light:'#b7a2eb', accent:'#cdbcff',
    planet:[.34,.290,-.90], radius:.139, sunlight:[-.88,.34,-.33], stars:14.1}
};

class FootballSky {
  constructor(scene) {
    const color = () => ({value:new FT.Color()}), vector = () => ({value:new FT.Vector3()});
    this.uniforms = {
      uZenith:color(), uHorizon:color(), uPlanetShadow:color(), uPlanetLight:color(), uAccent:color(),
      uPlanet:vector(), uRight:vector(), uUp:vector(), uSunlight:vector(),
      uRadius:{value:.1}, uKind:{value:0}, uStarSeed:{value:0}
    };
    // The camera can travel 70 m across the original run-off area. The dome
    // stays entirely inside the 230 m far plane at both ends of the pitch.
    this.geometry = new FT.SphereGeometry(150, 40, 20);
    this.material = new FT.ShaderMaterial({uniforms:this.uniforms, vertexShader:SKY_VERTEX,
      fragmentShader:SKY_FRAGMENT, side:1, depthWrite:false, toneMapped:false});
    this.mesh = new FT.Mesh(this.geometry,this.material);
    this.mesh.name = 'Football sky'; this.mesh.renderOrder = -20; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.currentIndex = -1;
    this.set(0);
  }

  get name() {return SKY_OPTIONS[this.currentIndex].name;}
  get accent() {return SKY_STAGES[SKY_OPTIONS[this.currentIndex].id].accent;}

  set(index) {
    if (this.currentIndex === index) return;
    const stage = SKY_STAGES[SKY_OPTIONS[index].id], u = this.uniforms;
    u.uZenith.value.set(stage.zenith); u.uHorizon.value.set(stage.horizon);
    u.uPlanetShadow.value.set(stage.shadow); u.uPlanetLight.value.set(stage.light); u.uAccent.value.set(stage.accent);
    const planet = u.uPlanet.value.set(...stage.planet).normalize();
    const right = u.uRight.value.set(-planet.z,0,planet.x).normalize();
    u.uUp.value.crossVectors(right,planet).normalize();
    u.uSunlight.value.set(...stage.sunlight).normalize();
    u.uRadius.value = stage.radius; u.uKind.value = index; u.uStarSeed.value = stage.stars;
    this.currentIndex = index;
  }

  advance() {this.set((this.currentIndex + 1) % SKY_OPTIONS.length);}

  dispose() {
    this.mesh.removeFromParent(); this.geometry.dispose(); this.material.dispose();
  }
}

export { FootballSky };
