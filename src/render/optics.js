import { FT } from '../../vendor/three.js';

// One scene render and one three-sample optical pass, including in stereo.
// The renderer retains ownership of XR cameras, their viewports and the XR target.
const OPTICS = Object.freeze({
  fadeSeconds: .60,
  playSplitPixels: .60,
  menuSplitPixels: 3.50,
  playGrain: .48 / 255,
  menuGrain: .85 / 255,
  playVignette: .025,
  menuVignette: .095,
  uiSplitPixels: .48
});

const OPTICS_VERTEX = `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const OPTICS_FRAGMENT = `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform float uDepthEnabled;
uniform vec2 uResolution;
uniform vec4 uViewport;
uniform vec2 uCentre;
uniform float uSplit;
uniform float uGrain;
uniform float uVignette;
uniform float uNoiseFrame;

float sensorGrain(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))) - .5;
}
void main() {
  vec2 localUV = (gl_FragCoord.xy - uViewport.xy) / uViewport.zw;
  vec2 ray = (localUV - uCentre) * 2.0;
  float radius = length(ray);
  float edge = smoothstep(.38, 1.28, radius);
  // Leave the aiming/ball zone and the top score strip crisp in each eye.
  float hudZone = smoothstep(.80, .91, localUV.y);
  float clarity = 1.0 - .94 * hudZone;
  vec2 direction = ray / max(radius, .00001);
  vec2 shift = direction * uSplit * edge * edge * clarity;
  vec2 low = uViewport.xy + vec2(.5);
  vec2 high = uViewport.xy + uViewport.zw - vec2(.5);
  // Every tap stays in its own eye, even at an asymmetric atlas seam.
  vec2 uv = clamp(gl_FragCoord.xy, low, high) / uResolution;
  vec2 redUV = clamp(gl_FragCoord.xy + shift, low, high) / uResolution;
  vec2 blueUV = clamp(gl_FragCoord.xy - shift, low, high) / uResolution;
  vec4 centre = texture2D(tScene, uv);
  // Projection layers that consume depth receive the original scene depth.
  // This optional fourth tap is disabled on ordinary colour-only XR layers.
  if(uDepthEnabled > .5) gl_FragDepth = texture2D(tDepth, uv).r;
  else gl_FragDepth = 1.0;
  vec3 colour = vec3(texture2D(tScene, redUV).r, centre.g, texture2D(tScene, blueUV).b);
  float luminance = dot(colour, vec3(.2126, .7152, .0722));
  // Restrained sensor response: cooler shadows, neutral highlights, no bloom.
  colour = mix(vec3(luminance), colour, .97);
  float shadow = 1.0 - smoothstep(.06, .42, luminance);
  colour *= mix(vec3(1.0), vec3(.985, 1.004, 1.025), shadow);
  colour *= 1.0 - uVignette * edge * edge * (1.0 - .65 * hudZone);
  gl_FragColor = vec4(max(colour, vec3(0.0)), centre.a);
  #include <colorspace_fragment>
  // Sub-code-value texture after output conversion; no flicker or scan bands.
  float grain = sensorGrain(floor(gl_FragCoord.xy - uViewport.xy) + vec2(uNoiseFrame * 13.0, uNoiseFrame * 7.0));
  float grainMask = smoothstep(.006, .08, dot(gl_FragColor.rgb, vec3(.2126, .7152, .0722)));
  gl_FragColor.rgb = clamp(gl_FragColor.rgb + grain * uGrain * grainMask, 0.0, 1.0);
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

// A normal Three material: existing colour management, alpha and UI ordering stay
// intact. CanvasTexture updates remain driven by UI state, never by this effect.
function createOpticalMaterial(texture, {strength = .5} = {}) {
  const width = Math.max(1, texture.image?.width || 1);
  const height = Math.max(1, texture.image?.height || 1);
  const material = new FT.MeshBasicMaterial({map:texture, transparent:true, depthTest:false, depthWrite:false});
  const texel = {value:new FT.Vector2(1 / width, 1 / height)};
  const amount = {value:OPTICS.uiSplitPixels * Math.max(0, Math.min(1, strength))};
  material.name = 'Optical interface';
  material.userData.footballOpticsUI = true;
  material.onBeforeCompile = shader => {
    shader.uniforms.uOpticalTexel = texel;
    shader.uniforms.uOpticalStrength = amount;
    shader.fragmentShader = 'uniform vec2 uOpticalTexel;\nuniform float uOpticalStrength;\n' +
      shader.fragmentShader.replace('#include <map_fragment>', UI_MAP_FRAGMENT);
  };
  material.customProgramCacheKey = () => 'football-optical-interface-v32';
  return material;
}

class FootballOptics {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.menuAmount = 0;
    this.time = 0;
    this.disposed = false;
    this.target = null;
    this.targetSize = new FT.Vector2();
    this.uniforms = {
      tScene:{value:null}, tDepth:{value:null}, uDepthEnabled:{value:0}, uResolution:{value:new FT.Vector2(1, 1)},
      uViewport:{value:new FT.Vector4(0, 0, 1, 1)}, uCentre:{value:new FT.Vector2(.5, .5)},
      uSplit:{value:OPTICS.playSplitPixels},
      uGrain:{value:OPTICS.playGrain}, uVignette:{value:OPTICS.playVignette}, uNoiseFrame:{value:0}
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
    const step = elapsed / OPTICS.fadeSeconds;
    this.menuAmount += Math.max(-step, Math.min(step, goal - this.menuAmount));
    const t = this.menuAmount * this.menuAmount * (3 - 2 * this.menuAmount);
    this.time = (this.time + elapsed) % 4096;
    this.uniforms.uSplit.value = OPTICS.playSplitPixels + (OPTICS.menuSplitPixels - OPTICS.playSplitPixels) * t;
    this.uniforms.uGrain.value = OPTICS.playGrain + (OPTICS.menuGrain - OPTICS.playGrain) * t;
    this.uniforms.uVignette.value = OPTICS.playVignette + (OPTICS.menuVignette - OPTICS.playVignette) * t;
    this.uniforms.uNoiseFrame.value = Math.floor(this.time * 12);
  }

  _eye(camera) {
    const viewport = camera.viewport;
    if(viewport) this.uniforms.uViewport.value.copy(viewport);
    else this.uniforms.uViewport.value.set(0, 0, this.target.width, this.target.height);
    const p = camera.projectionMatrix.elements;
    // The optical axis is not necessarily the centre of an XR eye's viewport.
    this.uniforms.uCentre.value.set(.5 - .5 * p[8], .5 - .5 * p[9]);
    // The same material is drawn twice. Explicitly upload changed per-eye data.
    this.material.uniformsNeedUpdate = true;
  }

  _size(destination) {
    if(destination) this.targetSize.set(destination.width, destination.height);
    else this.renderer.getDrawingBufferSize(this.targetSize);
    const w = Math.max(1, Math.floor(this.targetSize.x));
    const h = Math.max(1, Math.floor(this.targetSize.y));
    const needDepth = !!(destination?.isXRRenderTarget && destination.resolveDepthBuffer);
    if(!this.target) {
      const extensions = this.renderer.extensions;
      const halfFloat = !!(extensions?.has?.('EXT_color_buffer_float') || extensions?.has?.('EXT_color_buffer_half_float'));
      // Keep one atlas only. Very large XR buffers avoid another multisample
      // allocation; ordinary sizes retain 2x MSAA for the pitch markings.
      const samples = w * h <= 7000000 ? Math.min(2, this.renderer.capabilities?.maxSamples || 0) : 0;
      this.target = new FT.WebGLRenderTarget(w, h, {
        type:halfFloat ? FT.HalfFloatType : FT.UnsignedByteType,
        colorSpace:FT.LinearSRGBColorSpace,
        minFilter:FT.LinearFilter, magFilter:FT.LinearFilter,
        depthBuffer:true, stencilBuffer:false, samples,
        depthTexture:needDepth ? new FT.DepthTexture(w, h) : null,
        generateMipmaps:false, resolveDepthBuffer:needDepth, resolveStencilBuffer:false,
        storeMultisampledDepthBuffer:needDepth, storeMultisampledStencilBuffer:false
      });
      this.target.texture.name = 'Football optical scene';
      this.uniforms.tScene.value = this.target.texture;
    } else if(this.target.width !== w || this.target.height !== h) {
      const samples = w * h <= 7000000 ? Math.min(2, this.renderer.capabilities?.maxSamples || 0) : 0;
      this.target.samples = samples;
      this.target.setSize(w, h);
    }
    if(needDepth !== !!this.target.depthTexture) {
      this.target.dispose();
      this.target.depthTexture?.dispose();
      this.target.depthTexture = needDepth ? new FT.DepthTexture(w, h) : null;
      this.target.resolveDepthBuffer = needDepth;
      this.target.storeMultisampledDepthBuffer = needDepth;
    }
    this.uniforms.tDepth.value = this.target.depthTexture || this.target.texture;
    this.uniforms.uDepthEnabled.value = needDepth ? 1 : 0;
    this.uniforms.uResolution.value.set(w, h);
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
      this._size(destination);
      // XR remains enabled throughout: Three uses the identical eye cameras and
      // viewports in both passes. No reprojection, pose copying or GL access.
      renderer.setRenderTarget(this.target);
      renderer.autoClear = true;
      renderer.render(scene, camera);
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

export {FootballOptics, createOpticalMaterial, OPTICS, OPTICS_VERTEX, OPTICS_FRAGMENT, UI_MAP_FRAGMENT};
