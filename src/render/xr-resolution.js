// Both WebXR layer APIs report native size as a multiplier of the
// session's recommended framebuffer dimensions, including lens distortion.
export async function nativeXRScale(session, gl) {
  try {
    const scale = globalThis.XRWebGLLayer?.getNativeFramebufferScaleFactor?.(session);
    if (Number.isFinite(scale) && scale > 0) return scale;
  } catch {
    // Some runtimes only expose a usable scale through the Layers API.
  }
  const Binding = globalThis.XRWebGLBinding;
  if (Binding && 'createProjectionLayer' in Binding.prototype) {
    try {
      if (!gl.getContextAttributes()?.xrCompatible) await gl.makeXRCompatible();
      const scale = new Binding(session, gl).nativeProjectionScaleFactor;
      if (Number.isFinite(scale) && scale > 0) return scale;
    } catch {
      // Leave layer creation and its usual compatibility handling to the renderer.
    }
  }
  return 1;
}
