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
uniform vec2 uRingAxis;
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

vec3 surfaceAlbedo(vec3 normal) {
  if (uKind < 2.5) {
    float bands = .95 + .05 * sin((normal.y - normal.x * .22) * 16.0);
    return uPlanetLight * bands;
  }
  if (uKind < 3.5) {
    // Broad shelves and a polar cap keep the ocean legible on a tiny disc.
    float coast = normal.y + .34 * sin(3.7 * normal.x - 1.8 * normal.z)
                + .15 * cos(5.7 * normal.z + 1.9 * normal.y)
                + .08 * sin(6.8 * normal.x - 3.6 * normal.y);
    vec3 ocean = uPlanetLight * (.68 + .11 * normal.z);
    vec3 land = mix(uPlanetLight,uAccent,.25);
    vec3 surface = mix(ocean, land, smoothstep(.01,.12,coast));
    return mix(surface, uAccent, .55 * smoothstep(.75,.93,normal.y + .18 * normal.x));
  }
  if (uKind < 4.5) {
    float basin = smoothstep(.88,.98,dot(normal,vec3(-.40,.12,.909)));
    float plain = smoothstep(.90,.99,dot(normal,vec3(.42,-.43,.80)));
    return uPlanetLight * (1.0 - .27 * basin - .19 * plain);
  }
  if (uKind < 5.5) {
    float ridge = abs(normal.y + .47 * normal.x + .16 * sin(3.0 * normal.z));
    return mix(uPlanetLight, uAccent, .33 * smoothstep(.33,.64,ridge));
  }
  float latitude = normal.y - .21 * normal.x + .07 * sin(3.3 * normal.x + normal.z);
  float belt = smoothstep(-.55,.68,cos(latitude * 11.0 + .38 * sin(latitude * 7.0)));
  return mix(uPlanetLight * .78,mix(uPlanetLight,uAccent,.18),belt);
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
      vec2 tilted = vec2(uRingAxis.x * local.x - uRingAxis.y * local.y,
                         uRingAxis.y * local.x + uRingAxis.x * local.y);
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
      float diffuse = uKind > 2.5 ? .73 + .27 * max(0.0,sunlight) : 1.0;
      vec3 surface = mix(uPlanetShadow, surfaceAlbedo(normal) * diffuse, phase);
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
  },
  jade: {
    zenith:'#050b08', horizon:'#0c2017', shadow:'#081611', light:'#568c78', accent:'#a0c5ad',
    planet:skyDirection(73,22), radius:.0154, sunlight:[.64,.49,.59], kind:3, stars:21.7,
    lighting:{sky:'#d8efe0', ground:'#284235', key:'#ebf9ed', fill:'#e0efe8', pitch:'#e5f8eb', runoff:'#5c967b'}
  },
  crimson: {
    zenith:'#0c0506', horizon:'#241012', shadow:'#190b0c', light:'#a95952', accent:'#d39b80',
    planet:skyDirection(-116,16), radius:.0137, sunlight:[-.77,-.26,.58], kind:4, stars:28.4,
    lighting:{sky:'#f4dcd7', ground:'#4a2b2e', key:'#ffede4', fill:'#f6e1df', pitch:'#fbece7', runoff:'#ad5962'}
  },
  turquoise: {
    zenith:'#040b0d', horizon:'#0b2023', shadow:'#0a171a', light:'#679eaa', accent:'#b8ded9',
    planet:skyDirection(-36,39), radius:.0129, sunlight:[.77,.44,-.18], kind:5, stars:32.2,
    lighting:{sky:'#cfedf0', ground:'#244447', key:'#e5f8f7', fill:'#dff1f4', pitch:'#e3f6f7', runoff:'#4c97a2'}
  },
  gold: {
    zenith:'#0c0a04', horizon:'#211d0c', shadow:'#171306', light:'#a89259', accent:'#cebd87',
    planet:skyDirection(137,29), radius:.0132, sunlight:[.76,.53,.38], kind:0, ringTilt:-36, stars:39.6,
    lighting:{sky:'#f2eccb', ground:'#444023', key:'#fff6df', fill:'#f7f2dc', pitch:'#fcf5df', runoff:'#a79a4c'}
  },
  indigo: {
    zenith:'#060713', horizon:'#141a32', shadow:'#0a1022', light:'#7684b8', accent:'#a2b1e0',
    planet:skyDirection(-87,48), radius:.0156, sunlight:[.36,-.91,-.30], kind:2, stars:44.3,
    lighting:{sky:'#dce2f8', ground:'#2a314e', key:'#e9edff', fill:'#e3e9fb', pitch:'#e8edff', runoff:'#6577b8'}
  },
  rose: {
    zenith:'#0e070b', horizon:'#241221', shadow:'#1a1018', light:'#b47f94', accent:'#d6aab6',
    planet:skyDirection(55,33), radius:.0148, sunlight:[-.68,.19,.72], kind:6, stars:48.9,
    lighting:{sky:'#f3dfe9', ground:'#493043', key:'#ffedf2', fill:'#f6e5f0', pitch:'#faeaf3', runoff:'#ae7195'}
  },
  lime: {
    zenith:'#080b04', horizon:'#1a210c', shadow:'#141907', light:'#8c9859', accent:'#bcc48a',
    planet:skyDirection(-139,35), radius:.0134, sunlight:[.51,.71,-.39], kind:4, stars:54.5,
    lighting:{sky:'#e4efd0', ground:'#394529', key:'#f4f9e4', fill:'#edf3de', pitch:'#eff6df', runoff:'#8b9b52'}
  }
};

class FootballSky {
  constructor(scene) {
    const color = () => ({value:new FT.Color()}), vector = () => ({value:new FT.Vector3()});
    this.uniforms = {
      uZenith:color(), uHorizon:color(), uPlanetShadow:color(), uPlanetLight:color(), uAccent:color(),
      uPlanet:vector(), uRight:vector(), uUp:vector(), uSunlight:vector(), uRingAxis:{value:new FT.Vector2()},
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
    const tilt = (stage.ringTilt ?? 17.46) * Math.PI / 180;
    u.uRingAxis.value.set(Math.cos(tilt),Math.sin(tilt));
    u.uRadius.value = stage.radius; u.uKind.value = stage.kind; u.uStarSeed.value = stage.stars;
  }

  dispose() {
    this.mesh.removeFromParent(); this.geometry.dispose(); this.material.dispose();
  }
}

export { FootballSky };
