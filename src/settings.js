const SETTINGS_KEY='first-touch.settings.v1';
const DEFAULT_SETTINGS=Object.freeze({turnSpeed:1,chromatic:true,noise:true});
const TURN_SPEED=Object.freeze({min:.25,max:4,step:.25});

function normalizeSettings(value){
 const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const speed=typeof source.turnSpeed==='number'&&Number.isFinite(source.turnSpeed)?source.turnSpeed:DEFAULT_SETTINGS.turnSpeed;
 return {
  turnSpeed:Math.max(TURN_SPEED.min,Math.min(TURN_SPEED.max,Math.round(speed/TURN_SPEED.step)*TURN_SPEED.step)),
  chromatic:typeof source.chromatic==='boolean'?source.chromatic:DEFAULT_SETTINGS.chromatic,
  noise:typeof source.noise==='boolean'?source.noise:DEFAULT_SETTINGS.noise
 };
}
function readSettings(storage){
 try{
  const target=storage===undefined?globalThis.localStorage:storage;
  return normalizeSettings(JSON.parse(target?.getItem(SETTINGS_KEY)||'null'));
 }catch{return normalizeSettings();}
}
function saveSettings(settings,storage){
 try{
  const target=storage===undefined?globalThis.localStorage:storage;
  if(!target?.setItem)return false;
  target.setItem(SETTINGS_KEY,JSON.stringify(normalizeSettings(settings)));return true;
 }catch{return false;}
}
export {DEFAULT_SETTINGS,TURN_SPEED,SETTINGS_KEY,normalizeSettings,readSettings,saveSettings};
