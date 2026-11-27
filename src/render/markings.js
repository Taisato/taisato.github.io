import { FT } from '../../vendor/three.js';
import { FB } from '../config.js';

const PITCH_PAINT = Object.freeze({lineWidth:.115, minimumPixels:.45, centreRadius:9.15,
  penaltyDepth:FB.penaltyDepth, goalAreaDepth:FB.goalAreaDepth, penaltySpot:11, cornerRadius:1});

// The first seven metres past the lines, including the goal nets, are fully lit.
function pitchFloodlight(x, z) {
  const outside = Math.max(Math.abs(x) - FB.halfWidth, Math.abs(z) - FB.halfLength);
  return outside <= 7 ? 1 : Math.exp(-Math.pow((outside - 7) / 11, 1.55));
}

function runoffOpacity(light) {
  const t = Math.max(0, Math.min(1, (light - .025) / (.4 - .025)));
  return t * t * (3 - 2 * t);
}

// Paint is part of the opaque turf draw. Filtering the covered interval keeps
// a line present even when no raster sample lands inside its physical width.
// Only subpixel paint gets a restrained .45-pixel readability floor; nearby
// strokes retain their actual 0.115 m width and circular/square geometry.
const PITCH_PAINT_FRAGMENT = `
varying vec2 vPitchPoint;
uniform vec3 uPitchPaint;
uniform vec3 uPitchFlood;
uniform vec3 uPitchAmbient;
uniform vec3 uPitchHorizon;
uniform vec2 uPitchExtent;
uniform float uPitchGoalHalf;
const float pitchHalfWidth = .0575;
const float pitchMinimumPixels = .45;

float pitchInterval(float value, float low, float high, float footprint) {
  float width = max(footprint, .00001);
  float overlap = min(value + width * .5, high) - max(value - width * .5, low);
  return clamp(overlap / width, 0.0, 1.0);
}
float pitchBand(float distance, float footprint) {
  float halfWidth = max(pitchHalfWidth, pitchMinimumPixels * footprint * .5);
  return pitchInterval(distance, -halfWidth, halfWidth, footprint);
}
float pitchSpan(float value, float low, float high, float footprint) {
  return pitchInterval(value, low - pitchHalfWidth, high + pitchHalfWidth, footprint);
}
float pitchBelow(float value, float limit, float footprint) {
  return clamp(.5 + (limit - value) / max(footprint, .00001), 0.0, 1.0);
}
float pitchCircleFootprint(vec2 point, float radius, vec2 signs, vec2 dx, vec2 dy) {
  vec2 normal = radius > .00001 ? point / radius * signs : vec2(1.0, 0.0);
  return max(.00001, abs(dot(normal, dx)) + abs(dot(normal, dy)));
}
float pitchSpot(vec2 point, float distance, float radius, float radialFootprint, vec2 footprint, float pixelArea) {
  float edge = pitchBelow(distance, radius, radialFootprint);
  float support = pitchInterval(point.x, -radius, radius, footprint.x) * pitchInterval(point.y, -radius, radius, footprint.y);
  // Bound by area and by actual axis support: a grazing footprint must not
  // spread a small spot sideways into a halo which cannot overlap the paint.
  return min(support, min(edge, min(1.0, 3.14159265359 * radius * radius / max(pixelArea, .00000001))));
}
float pitchPaintCoverage(vec2 point) {
  // Differentiate the original coordinates, before abs/min or shape unions.
  // fwidth(abs(distance)) can cancel on a line centre and recreate the gaps.
  vec2 dx = dFdx(point), dy = dFdy(point);
  vec2 footprint = max(abs(dx) + abs(dy), vec2(.00001));
  vec2 p = abs(point), signs = sign(point);
  float halfX = uPitchExtent.x, halfZ = uPitchExtent.y;
  float coverage = 0.0;
  // The folded shapes continue across the symmetry axes. Filtering a false
  // zero-length end there would halve the paint at the centre of the pitch.
  float across = pitchBelow(p.x, halfX + pitchHalfWidth, footprint.x);
  float along = pitchBelow(p.y, halfZ + pitchHalfWidth, footprint.y);
  coverage = max(coverage, pitchBand(p.x - halfX, footprint.x) * along);
  coverage = max(coverage, pitchBand(p.y - halfZ, footprint.y) * across);
  coverage = max(coverage, pitchBand(point.y, footprint.y) * across);

  float penaltyFront = halfZ - ${PITCH_PAINT.penaltyDepth.toFixed(1)}, penaltyHalf = uPitchGoalHalf + ${PITCH_PAINT.penaltyDepth.toFixed(1)};
  float smallFront = halfZ - ${PITCH_PAINT.goalAreaDepth.toFixed(1)}, smallHalf = uPitchGoalHalf + ${PITCH_PAINT.goalAreaDepth.toFixed(1)};
  coverage = max(coverage, pitchBand(p.y - penaltyFront, footprint.y) * pitchBelow(p.x, penaltyHalf + pitchHalfWidth, footprint.x));
  coverage = max(coverage, pitchBand(p.x - penaltyHalf, footprint.x) * pitchSpan(p.y, penaltyFront, halfZ, footprint.y));
  coverage = max(coverage, pitchBand(p.y - smallFront, footprint.y) * pitchBelow(p.x, smallHalf + pitchHalfWidth, footprint.x));
  coverage = max(coverage, pitchBand(p.x - smallHalf, footprint.x) * pitchSpan(p.y, smallFront, halfZ, footprint.y));

  float pixelArea = abs(dx.x * dy.y - dx.y * dy.x);
  float centreDistance = length(p);
  float centreFootprint = pitchCircleFootprint(p, centreDistance, signs, dx, dy);
  coverage = max(coverage, pitchBand(centreDistance - 9.15, centreFootprint));
  coverage = max(coverage, pitchSpot(p, centreDistance, .12, centreFootprint, footprint, pixelArea));

  vec2 penaltyPoint = p - vec2(0.0, halfZ - 11.0);
  float penaltyDistance = length(penaltyPoint);
  float penaltyFootprint = pitchCircleFootprint(penaltyPoint, penaltyDistance, signs, dx, dy);
  float penaltyArc = pitchBand(penaltyDistance - 9.15, penaltyFootprint);
  penaltyArc *= pitchBelow(p.y, penaltyFront + pitchHalfWidth, footprint.y);
  coverage = max(coverage, penaltyArc);
  coverage = max(coverage, pitchSpot(penaltyPoint, penaltyDistance, .105, penaltyFootprint, footprint, pixelArea));

  vec2 cornerPoint = p - uPitchExtent;
  float cornerDistance = length(cornerPoint);
  float cornerFootprint = pitchCircleFootprint(cornerPoint, cornerDistance, signs, dx, dy);
  float cornerArc = pitchBand(cornerDistance - 1.0, cornerFootprint);
  cornerArc *= pitchBelow(p.x, halfX + pitchHalfWidth, footprint.x) * pitchBelow(p.y, halfZ + pitchHalfWidth, footprint.y);
  coverage = max(coverage, cornerArc);
  return coverage;
}
`;

function applyPitchPaint(material) {
  const paint={value:new FT.Color(0xeaefd7)};
  const flood={value:new FT.Color(0xffffff)};
  const ambient={value:new FT.Color(0x000000)};
  const horizon={value:new FT.Color(0x000000)};
  const extent={value:new FT.Vector2(FB.halfWidth, FB.halfLength)};
  const goalHalf={value:FB.goalWidth*.5};
  material.onBeforeCompile=shader=>{
    shader.uniforms.uPitchPaint=paint;
    shader.uniforms.uPitchFlood=flood;
    shader.uniforms.uPitchAmbient=ambient;
    shader.uniforms.uPitchHorizon=horizon;
    shader.uniforms.uPitchExtent=extent;
    shader.uniforms.uPitchGoalHalf=goalHalf;
    shader.vertexShader='varying vec2 vPitchPoint;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nvPitchPoint = position.xz;');
    shader.fragmentShader=PITCH_PAINT_FRAGMENT+shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
        float bakedLight = max(.004, vColor.r);
      #else
        float bakedLight = 1.0;
      #endif
      vec2 runoff = abs(vPitchPoint) - uPitchExtent;
      float distanceOutside = max(runoff.x, runoff.y);
      float skyLight = (1.0 - smoothstep(.04, .86, bakedLight)) * (1.0 - smoothstep(26.0, 82.0, distanceOutside));
      vec3 grass = diffuseColor.rgb / bakedLight;
      vec3 reflection = mix(grass, vec3(dot(grass, vec3(.2126, .7152, .0722))), .78);
      vec3 litGrass = diffuseColor.rgb * uPitchFlood + reflection * uPitchAmbient * skyLight;
      litGrass = mix(litGrass, uPitchHorizon, smoothstep(18.0, 62.0, distanceOutside));
      diffuseColor.rgb = mix(litGrass, uPitchPaint * uPitchFlood, pitchPaintCoverage(vPitchPoint));
    `);
  };
  material.customProgramCacheKey=()=> 'football-pitch-paint-lighting';
  material.userData.pitchPaint=PITCH_PAINT;
  material.userData.pitchLighting={flood,ambient,horizon};
  return material;
}

export {PITCH_PAINT, PITCH_PAINT_FRAGMENT, applyPitchPaint, pitchFloodlight, runoffOpacity};
