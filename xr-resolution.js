// The Quest 3 and 3S share an OS recommendation of 1680 × 1760 per eye.
// Meta Browser can also use the same device token for both headsets.
const QUEST_DEFAULT = {width:1680, height:1760};
const QUEST_3 = {width:2064, height:2208};
const QUEST_3S = {width:1832, height:1920};

function positive(value) { return Number.isFinite(value) && value > 0 ? value : 0; }

function recommendedEyeSize(session, gl, binding) {
  // A quarter-size colour-only probe measures the runtime's 1× baseline.
  // It never enters the session's render state or replaces the submitted layer.
  const scale = .25;
  let width, height, layout;
  if (binding) {
    let layer;
    try {
      layer = binding.createProjectionLayer({scaleFactor:scale, colorFormat:gl.RGBA8});
      width = layer.textureWidth; height = layer.textureHeight; layout = layer.layout;
    } catch { /* The base layer can still supply an estimate. */ }
    finally { layer?.destroy?.(); }
  }
  if (!positive(width) || !positive(height)) {
    try {
      const layer = new XRWebGLLayer(session, gl, {framebufferScaleFactor:scale, antialias:false, depth:false, stencil:false});
      width = layer.framebufferWidth; height = layer.framebufferHeight;
    } catch { return null; }
  }
  if (!positive(width) || !positive(height) || layout === 'mono') return null;
  // The legacy API exposes an atlas; Quest uses two side-by-side views.
  // Projection layers can also explicitly report a vertically stacked atlas.
  const vertical = layout === 'stereo-top-bottom' || (!layout && height > width);
  return {width:width / (vertical ? scale : 2 * scale), height:height / (vertical ? 2 * scale : scale)};
}

export async function xrRenderPlan(session, gl) {
  let legacy = 0, projection = 0, binding;
  try {
    legacy = positive(globalThis.XRWebGLLayer?.getNativeFramebufferScaleFactor?.(session));
  } catch { /* Optional on some runtimes. */ }
  try {
    if (!gl.getContextAttributes()?.xrCompatible) await gl.makeXRCompatible();
    const Binding = globalThis.XRWebGLBinding;
    if (Binding && 'createProjectionLayer' in Binding.prototype) {
      binding = new Binding(session, gl);
      projection = positive(binding.nativeProjectionScaleFactor);
    }
  } catch { /* Three will perform its usual layer setup. */ }
  const nativeScale = Math.max(legacy, projection) || 1;
  const agent = globalThis.navigator?.userAgent ?? '';
  const family = /\bQuest[\s_-]*3(?:s)?\b/i.test(agent);
  const olderQuest = /\bQuest[\s_-]*(?:2|Pro)\b/i.test(agent);
  let eyeFloor = null, scale = nativeScale;
  if (family || (!olderQuest && nativeScale < 1.26)) {
    const size = recommendedEyeSize(session, gl, binding);
    const matches = size && Math.abs(size.width - QUEST_DEFAULT.width) <= 12 && Math.abs(size.height - QUEST_DEFAULT.height) <= 12;
    if (family || matches) {
      const panel = /\bQuest[\s_-]*3s\b/i.test(agent) ? QUEST_3S : QUEST_3;
      const base = size ?? QUEST_DEFAULT;
      scale = Math.max(scale, panel.width / base.width, panel.height / base.height);
      eyeFloor = {width:Math.max(panel.width, Math.round(base.width * nativeScale)),
        height:Math.max(panel.height, Math.round(base.height * nativeScale))};
    }
  }
  return {scale, eyeFloor};
}
