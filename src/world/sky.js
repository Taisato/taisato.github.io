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
  float edge = clamp(fwidth(radius) * .75, .006, .19);
  return (1.0 - smoothstep(width, width + edge, abs(radius - center))) * min(1.0, .025 / edge);
}

void main() {
  vec3 ray = normalize(vWorldDirection - cameraPosition);
  float altitude = max(0.0, ray.y);
  float horizon = exp(-altitude * 5.5);
  vec3 color = mix(uZenith, uHorizon, horizon);

  vec2 celestial = vec2(atan(ray.x, -ray.z) / 6.283185 + .5, asin(clamp(ray.y, -1.0, 1.0)) / 3.141593 + .5);
  float specks = stars(celestial, vec2(660.0, 294.0), .916);
  float beacons = stars(celestial + vec2(.034, .012), vec2(290.0, 135.0), .96);
  float darkness = smoothstep(0.015, .31, altitude) * .72 + .24;
  color += (vec3(.45,.60,.84) * specks * .085 + vec3(.74,.82,.98) * beacons * .24) * darkness;

  if (dot(ray, uPlanet) > .98) {
    vec2 local = vec2(dot(ray, uRight), dot(ray, uUp)) / uRadius;
    float radius = length(local);
    float toDisk = abs(radius - 1.0);
    float aa = clamp(fwidth(radius) * .68, .002, .32);
    float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, radius);
    vec3 normal = vec3(local, sqrt(max(0.0, 1.0 - radius * radius)));
    float sunlight = dot(normal, uSunlight);
    float limb = (1.0 - smoothstep(.006, .006 + aa * 1.4, toDisk)) * min(1.0, .07 / aa);
    float rimBrightness = max(0.0, dot(vec3(normalize(local + .00001), .10), uSunlight));
    float ring = 0.0;
    bool orbit = uKind < .5;
    if (orbit) {
      vec2 tilted = vec2(.954 * local.x - .30 * local.y, .30 * local.x + .954 * local.y);
      float ellipse = length(vec2(tilted.x, tilted.y / .38));
      float dust = smoothstep(1.31, 1.43, ellipse) * (1.0 - smoothstep(1.73, 1.88, ellipse));
      ring = .048 * dust + .17 * ringLine(ellipse, 1.46, .009) + .10 * ringLine(ellipse, 1.70, .013);
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
      color += uAccent * exp(-toDisk * 15.0) * (.021 + .13 * edgeLight);
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

// The planets keep fixed bearings across runs. All sit away from the goal axis.
function skyDirection(bearing, elevation) {
  const yaw = bearing * Math.PI / 180, pitch = elevation * Math.PI / 180;
  return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
}

const SKY_STAGES = {
  black: {
    lighting:{sky:'#f3f6e8', ground:'#2d421d', key:'#f4f6ff', fill:'#fff9df', pitch:'#ffffff', runoff:'#000000'}
  },
  'quiet-orbit': {
    zenith:'#03060b', horizon:'#0a131e', shadow:'#080d16', light:'#537b96', accent:'#7aa5c1',
    planet:skyDirection(-62,25), radius:.014, sunlight:[-.82,.44,.27], kind:0, stars:3.6,
    lighting:{sky:'#d2e9fa', ground:'#223944', key:'#edf5ff', fill:'#e5edf9', pitch:'#e5f1ff', runoff:'#567dc0'}
  },
  'solar-edge': {
    zenith:'#080605', horizon:'#1c130e', shadow:'#110b08', light:'#966447', accent:'#c89066',
    planet:skyDirection(108,19), radius:.0125, sunlight:[-.52,.86,.18], kind:1, stars:8.2,
    lighting:{sky:'#f9e6d2', ground:'#463020', key:'#fff1de', fill:'#fff2db', pitch:'#fff3e4', runoff:'#a87246'}
  },
  'violet-hour': {
    zenith:'#06050c', horizon:'#151021', shadow:'#0c0a15', light:'#7a6b9b', accent:'#a698c6',
    planet:skyDirection(40,56), radius:.016, sunlight:[-.88,.34,-.33], kind:2, stars:14.1,
    lighting:{sky:'#e9defa', ground:'#3b2c50', key:'#f3eaff', fill:'#f3ecfc', pitch:'#f4eaff', runoff:'#8768b3'}
  }
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
  get lighting() {return SKY_STAGES[SKY_OPTIONS[this.currentIndex].id].lighting;}
  get horizonLight() {return this.uniforms.uHorizon.value;}

  set(index) {
    if (this.currentIndex === index) return;
    const stage = SKY_STAGES[SKY_OPTIONS[index].id], u = this.uniforms;
    this.currentIndex = index;
    this.mesh.visible = Boolean(stage.planet);
    u.uHorizon.value.set(stage.horizon??0x000000);
    if (!this.mesh.visible) return;
    u.uZenith.value.set(stage.zenith);
    u.uPlanetShadow.value.set(stage.shadow); u.uPlanetLight.value.set(stage.light); u.uAccent.value.set(stage.accent);
    const planet = u.uPlanet.value.set(...stage.planet).normalize();
    const right = u.uRight.value.set(-planet.z,0,planet.x).normalize();
    u.uUp.value.crossVectors(right,planet).normalize();
    u.uSunlight.value.set(...stage.sunlight).normalize();
    u.uRadius.value = stage.radius; u.uKind.value = stage.kind; u.uStarSeed.value = stage.stars;
  }

  dispose() {
    this.mesh.removeFromParent(); this.geometry.dispose(); this.material.dispose();
  }
}

export { FootballSky };
