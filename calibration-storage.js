import { FT } from "../../vendor/three.js";

const STORAGE_KEY = 'first-touch.calibration.v1';

function calibrationProfile(length, offset, correction) {
  return Object.freeze({length, offset:Object.freeze(offset), correction:Object.freeze(correction)});
}

function readCalibration() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || 'null');
    // The capture accepts grip heights from -1 to .85 m and subtracts .025 m for the casing.
    const epsilon = 1e-6;
    if (!saved || !Number.isFinite(saved.floorY) || saved.floorY < -1.025 - epsilon || saved.floorY > .825 + epsilon ||
        !Number.isFinite(saved.headHeight) || saved.headHeight < .95 - epsilon ||
        !Array.isArray(saved.profiles) || saved.profiles.length !== 2) return null;
    const components = (a, n) => Array.isArray(a) && a.length === n && a.every(Number.isFinite);
    const profiles = [];
    for (const p of saved.profiles) {
      if (!p || !Number.isFinite(p.length) || p.length < .20 || p.length > 1.65 ||
          !components(p.offset, 3) || !components(p.correction, 4)) return null;
      const offset = new FT.Vector3(...p.offset), correction = new FT.Quaternion(...p.correction);
      if (Math.abs(offset.length() - p.length) > .0001 || Math.abs(correction.lengthSq() - 1) > .0001) return null;
      profiles.push(calibrationProfile(p.length, offset, correction));
    }
    return {floorY:saved.floorY, headHeight:saved.headHeight, profiles};
  } catch { return null; }
}

function saveCalibration({floorY, headHeight, profiles}) {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return false;
    const saved = profiles.map(p => ({length:p.length, offset:p.offset.toArray(), correction:p.correction.toArray()}));
    storage.setItem(STORAGE_KEY, JSON.stringify({floorY, headHeight, profiles:saved}));
    return true;
  } catch { return false; }
}

export { calibrationProfile, readCalibration, saveCalibration };
