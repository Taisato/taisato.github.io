import { FT } from '../../vendor/three.js';

// One scene render and one optical pass, including in stereo.
// The scene can render below native resolution. The final pass always draws to
// the XR compositor's own eye rectangles using the same poses and projections.
const OPTICS = Object.freeze({
  fadeSeconds: .60,
  skyRevealSeconds: .36,
  playSplitPixels: 1.7,
  menuSplitPixels: 4.1,
  motionSplitPixels: 8.0,
  playGrain: 8 / 255,
  menuGrain: 12 / 255,
  playVignette: .025,
  menuVignette: .095,
  uiSplitPixels: 1.4,
  maxMotionSources: 8
});

const OPTICS_VERTEX = `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const OPTICS_FRAGMENT = `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform float uCopyDepth;
uniform vec2 uResolution;
uniform vec4 uViewport;
uniform vec4 uSceneViewport;
uniform vec2 uCentre;
uniform vec4 uProjection;
uniform vec2 uDepthProjection;
uniform vec4 uWorldHeight;
uniform vec4 uHUDRect;
uniform float uHUDVisible;
uniform float uPixelScale;
uniform int uMotionCount;
uniform vec4 uMotionBounds[8];
uniform vec4 uMotionSphere[8];
uniform vec2 uMotionShift[8];
uniform float uSplit;
uniform float uGrain;
uniform float uVignette;
uniform float uNoiseFrame;
uniform float uSkyCover;

float sensorGrain(vec2 p) {
  // Integer avalanche avoids the diagonal pattern of the old linear hash when
  // the stronger noise becomes visible in near-black regions.
  uint value = uint(p.x) * 1664525u + uint(p.y) * 1013904223u + 374761393u;
  value = (value ^ (value >> 16u)) * 2246822519u;
  value = (value ^ (value >> 13u)) * 3266489917u;
  value = value ^ (value >> 16u);
  return float(value & 16777215u) / 16777216.0 - .5;
}
float viewDepth(float depth) {
  return uDepthProjection.y / (2.0 * depth - 1.0 + uDepthProjection.x);
}
float belongsToSphere(vec2 eyeUV, float depth, vec4 sphere) {
  float distance = viewDepth(depth);
  vec2 ray = (eyeUV * 2.0 - 1.0 + uProjection.zw) / uProjection.xy;
  vec3 position = vec3(ray * distance, -distance);
  float worldHeight = dot(uWorldHeight, vec4(position, 1.0));
  // Turf is at 0 m and paint at .009 m. They cannot inherit motion from a
  // boot's bounding sphere when that boot is allowed to pass below the pitch.
  if(worldHeight >= -.008 && worldHeight <= .018) return 0.0;
  // A tight world-space gate rejects unrelated foreground and background even
  // when they share the source's projected bounding ellipse.
  float padding = max(.003, sphere.w * .025);
  return 1.0 - smoothstep(sphere.w, sphere.w + padding, length(position - sphere.xyz));
}
void main() {
  vec2 localUV = (gl_FragCoord.xy - uViewport.xy) / uViewport.zw;
  vec2 ray = (localUV - uCentre) * 2.0;
  float radius = length(ray);
  float edge = smoothstep(.08, 1.28, radius);
  vec2 hudPadding = vec2(2.0 * uPixelScale) / uViewport.zw;
  vec2 hudIn = smoothstep(uHUDRect.xy - hudPadding, uHUDRect.xy, localUV);
  vec2 hudOut = 1.0 - smoothstep(uHUDRect.zw, uHUDRect.zw + hudPadding, localUV);
  float hudZone = hudIn.x * hudIn.y * hudOut.x * hudOut.y * uHUDVisible;
  float clarity = 1.0 - .94 * hudZone;
  vec2 direction = ray / max(radius, .00001);
  // V32 squared its edge mask, reducing 0.6 px to 0.014 px at UV(.8,.5).
  // A visible floor now extends across the view, with only a tiny axis fade.
  vec2 shift = direction * uSplit * uPixelScale * (.22 + .78 * edge) * smoothstep(0.0, .035, radius);
  vec2 sourceScale = uSceneViewport.zw / uViewport.zw;
  vec2 sourcePixel = uSceneViewport.xy + (gl_FragCoord.xy - uViewport.xy) * sourceScale;
  vec2 low = uSceneViewport.xy + vec2(.5);
  vec2 high = uSceneViewport.xy + uSceneViewport.zw - vec2(.5);
  vec2 uv = clamp(sourcePixel, low, high) / uResolution;
  float sceneDepth = texture2D(tDepth, uv).r;
  float pixelDepth = viewDepth(sceneDepth);
  vec2 pixelRay = (localUV * 2.0 - 1.0 + uProjection.zw) / uProjection.xy;
  float pixelHeight = dot(uWorldHeight, vec4(pixelRay * pixelDepth, -pixelDepth, 1.0));
  vec2 motion = vec2(0.0);
  float motionWeight = 0.0;
  for(int i = 0; i < 8; i++) {
    if(i >= uMotionCount) break;
    if(pixelHeight >= -.008 && pixelHeight <= .018) break;
    vec4 bound = uMotionBounds[i];
    vec2 offset = (localUV - bound.xy) / bound.zw;
    float ellipse = dot(offset, offset);
    if(ellipse >= 1.0) continue;
    vec4 sphere = uMotionSphere[i];
    // Silhouette expansion is allowed onto the background, never across a
    // closer occluder merely because a shifted tap can see past its edge.
    if(pixelDepth < -sphere.z - sphere.w - max(.004, sphere.w * .03)) continue;
    vec2 displacement = uMotionShift[i];
    float belongs = belongsToSphere(localUV, sceneDepth, sphere);
    // Shifted depth taps extend the coloured silhouette itself, while a source
    // hidden behind foreground depth still cannot tint that foreground.
    vec2 redPixel = clamp(sourcePixel + displacement * sourceScale, low, high);
    vec2 bluePixel = clamp(sourcePixel - displacement * sourceScale, low, high);
    float redDepth = texture2D(tDepth, redPixel / uResolution).r;
    float blueDepth = texture2D(tDepth, bluePixel / uResolution).r;
    belongs = max(belongs, belongsToSphere((redPixel - uSceneViewport.xy) / uSceneViewport.zw, redDepth, sphere));
    belongs = max(belongs, belongsToSphere((bluePixel - uSceneViewport.xy) / uSceneViewport.zw, blueDepth, sphere));
    float weight = belongs * (1.0 - smoothstep(.82, 1.0, ellipse));
    if(weight > motionWeight) { motion = displacement * weight; motionWeight = weight; }
  }
  // Motion has no central dead zone: a hard shot through the aiming axis still
  // separates. Paused sources and camera rotation alone do not generate it.
  // Opposing motion must not cancel the stationary lens separation. Preserve
  // the combined direction, but give it the sum of both magnitudes.
  float separation = length(shift) + length(motion);
  vec2 combined = shift + motion;
  if(length(combined) < .00001) combined = length(motion) > 0.0 ? motion : shift;
  shift = combined / max(length(combined), .00001) * separation * clarity;
  // Every tap stays in its own eye, even at an asymmetric atlas seam.
  vec2 redUV = clamp(sourcePixel + shift * sourceScale, low, high) / uResolution;
  vec2 blueUV = clamp(sourcePixel - shift * sourceScale, low, high) / uResolution;
  vec4 centre = texture2D(tScene, uv);
  // Projection layers that consume depth receive the unshifted scene depth.
  if(uCopyDepth > .5) gl_FragDepth = sceneDepth;
  else gl_FragDepth = 1.0;
  vec3 colour = vec3(texture2D(tScene, redUV).r, centre.g, texture2D(tScene, blueUV).b);
  float luminance = dot(colour, vec3(.2126, .7152, .0722));
  // Restrained sensor response: cooler shadows, neutral highlights, no bloom.
  colour = mix(vec3(luminance), colour, .97);
  float shadow = 1.0 - smoothstep(.06, .42, luminance);
  colour *= mix(vec3(1.0), vec3(.985, 1.004, 1.025), shadow);
  colour *= 1.0 - uVignette * edge * edge * (1.0 - .65 * hudZone);
  colour = mix(colour, vec3(.003, .005, .012), uSkyCover);
  gl_FragColor = vec4(max(colour, vec3(0.0)), centre.a);
  #include <colorspace_fragment>
  // Monochrome sensor texture is deliberately strongest in dark areas. Unlike
  // V32, near-black pixels retain grain instead of multiplying it away.
  vec2 grainPixel = (gl_FragCoord.xy - uViewport.xy) / max(1.0, uPixelScale);
  vec2 seed = vec2(uNoiseFrame * 13.0, uNoiseFrame * 7.0);
  float grain = mix(sensorGrain(floor(grainPixel) + seed), sensorGrain(floor(grainPixel / 2.3) + seed), .25);
  float outputLight = dot(gl_FragColor.rgb, vec3(.2126, .7152, .0722));
  float darkGrain = 1.0 - smoothstep(.06, .46, outputLight);
  float grainAmount = uGrain * mix(.35, 1.0, darkGrain) * (1.0 - .70 * hudZone);
  gl_FragColor.rgb = clamp(gl_FragColor.rgb + grain * grainAmount * (1.0 - .7 * uSkyCover), 0.0, 1.0);
}`;

const UI_MAP_FRAGMENT = `
#ifdef USE_MAP
  vec2 opticalRay = vMapUv - .5;
  float opticalEdge = smoothstep(.08, .58, length(opticalRay));
  vec2 opticalShift = normalize(opticalRay + vec2(.00001)) * uOpticalTexel * uOpticalStrength * opticalEdge;
  vec4 opticalCentre = texture2D(map, vMapUv);
  vec4 opticalRed = texture2D(map, clamp(vMapUv + opticalShift, uOpticalTexel * .5, vec2(1.0) - uOpticalTexel * .5));
  vec4 opticalBlue = texture2D(map, clamp(vMapUv - opticalShift, uOpticalTexel * .5, vec2(1.0) - uOpticalTexel * .5));
  diffuseColor *= vec4(opticalRed.r, opticalCentre.g, opticalBlue.b, opticalCentre.a);
#endif
`;

// Only the HUD opts into these measured text bounds. Padding includes the old
// fringe outside each glyph, while icons, panel edges and other UI stay intact.
const UI_TEXT_MAP_FRAGMENT = UI_MAP_FRAGMENT.replace(
  '  vec4 opticalCentre =',
  `  float opticalText = 0.0;
  for(int i = 0; i < 5; i++) {
    vec2 insideLow = step(uOpticalTextRegions[i].xy, vMapUv);
    vec2 insideHigh = step(vMapUv, uOpticalTextRegions[i].zw);
    opticalText = max(opticalText, insideLow.x * insideLow.y * insideHigh.x * insideHigh.y);
  }
  opticalShift *= 1.0 - .25 * opticalText;
  vec4 opticalCentre =`
);

// A normal Three material: existing colour management, alpha and UI ordering stay
// intact. CanvasTexture updates remain driven by UI state, never by this effect.
const opticalMaterials = new WeakMap();
function createOpticalMaterial(texture, {strength = .5, textRegions = null} = {}) {
  const width = Math.max(1, texture.image?.width || 1);
  const height = Math.max(1, texture.image?.height || 1);
  const material = new FT.MeshBasicMaterial({map:texture, transparent:true, depthTest:false, depthWrite:false});
  const texel = {value:new FT.Vector2(1 / width, 1 / height)};
  const amount = {value:OPTICS.uiSplitPixels * Math.max(0, Math.min(1, strength))};
  opticalMaterials.set(material, {amount, strength:amount.value});
  material.name = 'Optical interface';
  material.userData.footballOpticsUI = true;
  material.onBeforeCompile = shader => {
    shader.uniforms.uOpticalTexel = texel;
    shader.uniforms.uOpticalStrength = amount;
    if(textRegions) shader.uniforms.uOpticalTextRegions = {value:textRegions};
    shader.fragmentShader = 'uniform vec2 uOpticalTexel;\nuniform float uOpticalStrength;\n' +
      (textRegions ? 'uniform vec4 uOpticalTextRegions[5];\n' : '') +
      shader.fragmentShader.replace('#include <map_fragment>', textRegions ? UI_TEXT_MAP_FRAGMENT : UI_MAP_FRAGMENT);
  };
  material.customProgramCacheKey = textRegions ? () => 'football-optical-interface-text-v35' : () => 'football-optical-interface-v33';
  return material;
}

function setOpticalEffects(material, {chromatic} = {}) {
  const optical = opticalMaterials.get(material);
  if(optical && typeof chromatic === 'boolean')
    optical.amount.value = chromatic ? optical.strength : 0;
  return material;
}

class FootballOptics {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.menuAmount = 0;
    this.skyReveal = 0;
    this.time = 0;
    this.disposed = false;
    this.target = null;
    this.targetSize = new FT.Vector2();
    this.vrResolution = 1;
    this.sceneViewports = new WeakMap();
    this.outputViewports = [];
    this.eyeSize = new FT.Vector2();
    this.rightEyeSize = new FT.Vector2();
    this.motionSources = [];
    this.motionEnabled = true;
    this.chromaticEnabled = true;
    this.noiseEnabled = true;
    this.hud = null;
    this._viewPosition = new FT.Vector3();
    this._corner = new FT.Vector3();
    this.uniforms = {
      tScene:{value:null}, tDepth:{value:null}, uCopyDepth:{value:0}, uResolution:{value:new FT.Vector2(1, 1)},
      uViewport:{value:new FT.Vector4(0, 0, 1, 1)}, uSceneViewport:{value:new FT.Vector4(0, 0, 1, 1)},
      uCentre:{value:new FT.Vector2(.5, .5)},
      uProjection:{value:new FT.Vector4(1, 1, 0, 0)}, uDepthProjection:{value:new FT.Vector2(-1, -.07)},
      uWorldHeight:{value:new FT.Vector4(0, 1, 0, 0)},
      uHUDRect:{value:new FT.Vector4(0, 0, 0, 0)}, uHUDVisible:{value:0}, uPixelScale:{value:1},
      uMotionCount:{value:0},
      uMotionBounds:{value:Array.from({length:OPTICS.maxMotionSources}, () => new FT.Vector4())},
      uMotionSphere:{value:Array.from({length:OPTICS.maxMotionSources}, () => new FT.Vector4())},
      uMotionShift:{value:Array.from({length:OPTICS.maxMotionSources}, () => new FT.Vector2())},
      uSplit:{value:OPTICS.playSplitPixels},
      uGrain:{value:OPTICS.playGrain}, uVignette:{value:OPTICS.playVignette}, uNoiseFrame:{value:0}, uSkyCover:{value:0}
    };
    this.material = new FT.ShaderMaterial({
      name:'Football optical response', uniforms:this.uniforms,
      vertexShader:OPTICS_VERTEX, fragmentShader:OPTICS_FRAGMENT,
      depthTest:true, depthWrite:true, depthFunc:FT.AlwaysDepth, toneMapped:false
    });
    this.geometry = new FT.BufferGeometry();
    this.geometry.setAttribute('position', new FT.BufferAttribute(new Float32Array([-1,-1,0, 3,-1,0, -1,3,0]), 3));
    this.quad = new FT.Mesh(this.geometry, this.material);
    this.quad.name = 'Stereo optical composite';
    this.quad.frustumCulled = false;
    this.quad.onBeforeRender = (_renderer, _scene, eye) => this._eye(eye);
    this.outputScene = new FT.Scene();
    this.outputScene.add(this.quad);
    // The native unit harness has no render targets. Production Three has these.
    this.enabled = !!(renderer.setRenderTarget && renderer.getRenderTarget && renderer.getDrawingBufferSize);
  }

  update(dt, {menu = false, active = true} = {}) {
    if(this.disposed) return;
    const elapsed = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
    const goal = menu || !active ? 1 : 0;
    this.motionEnabled = active && !menu;
    const step = elapsed / OPTICS.fadeSeconds;
    this.menuAmount += Math.max(-step, Math.min(step, goal - this.menuAmount));
    const t = this.menuAmount * this.menuAmount * (3 - 2 * this.menuAmount);
    this.time = (this.time + elapsed) % 4096;
    this.skyReveal = Math.max(0, this.skyReveal - elapsed);
    const reveal = this.skyReveal / OPTICS.skyRevealSeconds;
    this.uniforms.uSkyCover.value = .82 * reveal * reveal * (3 - 2 * reveal);
    this._effects(t);
    this.uniforms.uVignette.value = OPTICS.playVignette + (OPTICS.menuVignette - OPTICS.playVignette) * t;
    this.uniforms.uNoiseFrame.value = Math.floor(this.time * 24);
  }

  setEffects({chromatic, noise, vrResolution} = {}) {
    if(Number.isFinite(vrResolution) && vrResolution > 0 && vrResolution <= 1) this.vrResolution = vrResolution;
    if(typeof chromatic === 'boolean') this.chromaticEnabled = chromatic;
    if(typeof noise === 'boolean') this.noiseEnabled = noise;
    this._effects(this.menuAmount * this.menuAmount * (3 - 2 * this.menuAmount));
    if(!this.chromaticEnabled) this.uniforms.uMotionCount.value = 0;
    return this;
  }

  _effects(t) {
    this.uniforms.uSplit.value = this.chromaticEnabled ? OPTICS.playSplitPixels + (OPTICS.menuSplitPixels - OPTICS.playSplitPixels) * t : 0;
    this.uniforms.uGrain.value = this.noiseEnabled ? OPTICS.playGrain + (OPTICS.menuGrain - OPTICS.playGrain) * t : 0;
  }

  revealSky(show = true) {
    this.skyReveal = show ? OPTICS.skyRevealSeconds : 0;
    this.uniforms.uSkyCover.value = show ? .82 : 0;
  }

  setMotionSources(sources) { this.motionSources = sources || []; }
  setHUD(mesh) { this.hud = mesh || null; }

  _hud(camera) {
    const u = this.uniforms, mesh = this.hud;
    u.uHUDVisible.value = mesh?.visible ? 1 : 0;
    if(!u.uHUDVisible.value) return;
    let left = Infinity, bottom = Infinity, right = -Infinity, top = -Infinity;
    const {width=.9,height=.25} = mesh.geometry.parameters || {};
    // Use the current UI plane so the reward text stays readable in slow motion.
    for(let i = 0; i < 4; i++) {
      this._corner.set((i & 1 ? .5 : -.5) * width, (i & 2 ? .5 : -.5) * height, 0)
        .applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      if(this._corner.z>=-camera.near){u.uHUDVisible.value=0;return;}
      this._corner.applyMatrix4(camera.projectionMatrix);
      const x = this._corner.x * .5 + .5, y = this._corner.y * .5 + .5;
      left = Math.min(left, x); right = Math.max(right, x);
      bottom = Math.min(bottom, y); top = Math.max(top, y);
    }
    if(!Number.isFinite(left + bottom + right + top)) { u.uHUDVisible.value = 0; return; }
    u.uHUDRect.value.set(left, bottom, right, top);
  }

  _motions(camera) {
    const u = this.uniforms, viewport = u.uViewport.value, p = camera.projectionMatrix.elements;
    const m = camera.matrixWorldInverse.elements, pixelScale = u.uPixelScale.value;
    let count = 0;
    if(this.motionEnabled && this.chromaticEnabled) for(let i = 0; i < this.motionSources.length && count < OPTICS.maxMotionSources; i++) {
      const source = this.motionSources[i], position = source?.position, velocity = source?.velocity;
      const radius = source?.radius;
      if(!source?.enabled || !position || !velocity || !(radius > 0) ||
        !Number.isFinite(position.x + position.y + position.z + velocity.x + velocity.y + velocity.z + radius)) continue;
      const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
      if(speed <= .65) continue;
      this._viewPosition.copy(position).applyMatrix4(camera.matrixWorldInverse);
      const x = this._viewPosition.x, y = this._viewPosition.y, z = this._viewPosition.z, depth = -z;
      if(depth <= Math.max(.001, camera.near || .001)) continue;
      const cx = .5 + .5 * (p[0] * x / depth - p[8]);
      const cy = .5 + .5 * (p[5] * y / depth - p[9]);
      const denominator = Math.max(.02, depth - radius);
      const rx = .5 * Math.abs(p[0]) * radius * (1 + Math.abs(x) / depth) / denominator;
      const ry = .5 * Math.abs(p[5]) * radius * (1 + Math.abs(y) / depth) / denominator;
      const vx = m[0] * velocity.x + m[4] * velocity.y + m[8] * velocity.z;
      const vy = m[1] * velocity.x + m[5] * velocity.y + m[9] * velocity.z;
      const vz = m[2] * velocity.x + m[6] * velocity.y + m[10] * velocity.z;
      let dx = .5 * viewport.z * p[0] * (vx * depth + x * vz) / (depth * depth);
      let dy = .5 * viewport.w * p[5] * (vy * depth + y * vz) / (depth * depth);
      let length = Math.hypot(dx, dy);
      // A fast axial approach can have zero centre displacement but still
      // rapidly expand/contract; retain its chromatic response consistently.
      const axial = Math.hypot(vx, vy) < speed * .05 && Math.hypot(cx - (.5 - .5 * p[8]), cy - (.5 - .5 * p[9])) < .04;
      if(length < .001 || axial) { dx = .92387953; dy = .38268343; length = 1; }
      const t = Math.max(0, Math.min(1, (speed - .65) / (13 - .65)));
      const response = t * t * (3 - 2 * t);
      const projectedRadius = Math.max(.5, Math.min(rx * viewport.z, ry * viewport.w));
      const amount = Math.min(OPTICS.motionSplitPixels * pixelScale * response, projectedRadius * .65);
      dx = dx / length * amount; dy = dy / length * amount;
      const padX = (Math.abs(dx) + 2 * pixelScale) / viewport.z;
      const padY = (Math.abs(dy) + 2 * pixelScale) / viewport.w;
      if(cx + rx + padX < 0 || cx - rx - padX > 1 || cy + ry + padY < 0 || cy - ry - padY > 1) continue;
      u.uMotionBounds.value[count].set(cx, cy, rx + padX, ry + padY);
      u.uMotionSphere.value[count].set(x, y, z, radius);
      u.uMotionShift.value[count].set(dx, dy);
      count++;
    }
    u.uMotionCount.value = count;
  }

  _eye(camera) {
    const viewport = camera.viewport;
    if(viewport) this.uniforms.uViewport.value.copy(viewport);
    else this.uniforms.uViewport.value.set(0, 0, this.target.width, this.target.height);
    this.uniforms.uSceneViewport.value.copy((this.eyeSize.x && this.sceneViewports.get(camera)) || this.uniforms.uViewport.value);
    const p = camera.projectionMatrix.elements;
    // The optical axis is not necessarily the centre of an XR eye's viewport.
    this.uniforms.uCentre.value.set(.5 - .5 * p[8], .5 - .5 * p[9]);
    this.uniforms.uProjection.value.set(p[0], p[5], p[8], p[9]);
    this.uniforms.uDepthProjection.value.set(p[10], p[14]);
    const world = camera.matrixWorld.elements;
    this.uniforms.uWorldHeight.value.set(world[1], world[5], world[9], world[13]);
    this.uniforms.uPixelScale.value = Math.max(.7, Math.min(2.5, Math.min(this.uniforms.uViewport.value.z, this.uniforms.uViewport.value.w) / 1000));
    this._hud(camera);
    this._motions(camera);
    // The same material is drawn twice. Explicitly upload changed per-eye data.
    this.material.uniformsNeedUpdate = true;
  }

  _size(destination, scale = 1) {
    if(destination) this.targetSize.set(destination.width, destination.height);
    else this.renderer.getDrawingBufferSize(this.targetSize);
    const w = Math.max(1, Math.round(this.targetSize.x * scale));
    const h = Math.max(1, Math.round(this.targetSize.y * scale));
    const copyDepth = !!(destination?.isXRRenderTarget && destination.resolveDepthBuffer);
    // Base MSAA on the output, so lowering scene quality never increases samples.
    const samples = this.targetSize.x * this.targetSize.y <= 7000000 ? Math.min(2, this.renderer.capabilities?.maxSamples || 0) : 0;
    if(!this.target) {
      const extensions = this.renderer.extensions;
      const halfFloat = !!(extensions?.has?.('EXT_color_buffer_float') || extensions?.has?.('EXT_color_buffer_half_float'));
      // Keep one atlas only. Very large XR buffers avoid another multisample
      // allocation; ordinary sizes retain 2x MSAA for the pitch markings.
      this.target = new FT.WebGLRenderTarget(w, h, {
        type:halfFloat ? FT.HalfFloatType : FT.UnsignedByteType,
        colorSpace:FT.LinearSRGBColorSpace,
        minFilter:FT.LinearFilter, magFilter:FT.LinearFilter,
        depthBuffer:true, stencilBuffer:false, samples,
        depthTexture:new FT.DepthTexture(w, h),
        generateMipmaps:false, resolveDepthBuffer:true, resolveStencilBuffer:false,
        storeMultisampledDepthBuffer:true, storeMultisampledStencilBuffer:false
      });
      this.target.texture.name = 'Football optical scene';
      this.uniforms.tScene.value = this.target.texture;
    } else if(this.target.width !== w || this.target.height !== h) {
      this.target.samples = samples;
      this.target.setSize(w, h);
    } else if(this.target.samples !== samples) {
      this.target.dispose();
      this.target.samples = samples;
    }
    this.uniforms.tDepth.value = this.target.depthTexture;
    this.uniforms.uCopyDepth.value = copyDepth ? 1 : 0;
    this.uniforms.uResolution.value.set(w, h);
  }

  _renderScene(scene, camera, eyes) {
    this.eyeSize.set(0, 0);
    this.rightEyeSize.set(0, 0);
    if(!eyes?.length) { this.renderer.render(scene, camera); return; }
    const sx = this.target.width / this.targetSize.x, sy = this.target.height / this.targetSize.y;
    this.outputViewports.length = 0;
    try {
      for(let i = 0; i < eyes.length; i++) {
        const eye = eyes[i];
        const full = eye.viewport;
        let sub = this.sceneViewports.get(eye);
        if(!sub) { sub = new FT.Vector4(); this.sceneViewports.set(eye, sub); }
        // Round the edges, so adjacent eyes still share an exact boundary.
        const x = Math.round(full.x * sx), y = Math.round(full.y * sy);
        sub.set(x, y, Math.max(1, Math.round((full.x + full.z) * sx) - x),
          Math.max(1, Math.round((full.y + full.w) * sy) - y));
        this.outputViewports.push(full);
        eye.viewport = sub;
        if(i === 0) this.eyeSize.set(sub.z, sub.w);
        if(i === 1) this.rightEyeSize.set(sub.z, sub.w);
      }
      this.renderer.render(scene, camera);
    } finally {
      for(let i = 0; i < this.outputViewports.length; i++) eyes[i].viewport = this.outputViewports[i];
    }
  }

  render(scene = this.scene, camera = this.camera) {
    if(this.disposed) return;
    const renderer = this.renderer;
    if(!this.enabled) { renderer.render(scene, camera); return; }
    const destination = renderer.getRenderTarget();
    const face = renderer.getActiveCubeFace?.() || 0;
    const level = renderer.getActiveMipmapLevel?.() || 0;
    const autoClear = renderer.autoClear;
    try {
      const eyes = destination?.isXRRenderTarget ?
        (renderer.xr.isPresenting ? renderer.xr.getCamera() : camera).cameras : null;
      this._size(destination, eyes?.length ? this.vrResolution : 1);
      renderer.setRenderTarget(this.target);
      renderer.autoClear = true;
      this._renderScene(scene, camera, eyes);
      renderer.setRenderTarget(destination, face, level);
      renderer.render(this.outputScene, camera);
    } finally {
      renderer.autoClear = autoClear;
      // Restore the destination-defined viewport/scissor. The game does not
      // override active rectangles after binding a target. Global rectangles,
      // XR flags, and camera matrices are untouched, including on draw failure.
      renderer.setRenderTarget(destination, face, level);
    }
  }

  dispose() {
    if(this.disposed) return;
    this.disposed = true;
    this.target?.dispose();
    this.target?.depthTexture?.dispose();
    this.target = null;
    this.geometry.dispose();
    this.material.dispose();
    this.quad.removeFromParent();
  }
}

export {FootballOptics, createOpticalMaterial, setOpticalEffects, OPTICS, OPTICS_VERTEX, OPTICS_FRAGMENT, UI_MAP_FRAGMENT};
