import { SKY_OPTIONS } from './config.js';

const SETTINGS_KEY='first-touch.settings.v1';
const DEFAULT_SETTINGS=Object.freeze({turnSpeed:1,vrResolution:1,chromatic:true,noise:true,shotTrace:false,wind:'normal',stadium:SKY_OPTIONS[0].id});
const TURN_SPEED=Object.freeze({min:.25,max:4,step:.25});
const VR_RESOLUTION_OPTIONS=Object.freeze([
 {scale:1,label:'100% (Native)'},{scale:.85,label:'85%'},{scale:.7,label:'70%'},{scale:.5,label:'50%'}
].map(Object.freeze));

function normalizeSettings(value){
 const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const speed=typeof source.turnSpeed==='number'&&Number.isFinite(source.turnSpeed)?source.turnSpeed:DEFAULT_SETTINGS.turnSpeed;
 return {
  turnSpeed:Math.max(TURN_SPEED.min,Math.min(TURN_SPEED.max,Math.round(speed/TURN_SPEED.step)*TURN_SPEED.step)),
  vrResolution:VR_RESOLUTION_OPTIONS.some(option=>option.scale===source.vrResolution)?source.vrResolution:DEFAULT_SETTINGS.vrResolution,
  chromatic:typeof source.chromatic==='boolean'?source.chromatic:DEFAULT_SETTINGS.chromatic,
  noise:typeof source.noise==='boolean'?source.noise:DEFAULT_SETTINGS.noise,
  shotTrace:typeof source.shotTrace==='boolean'?source.shotTrace:DEFAULT_SETTINGS.shotTrace,
  wind:source.wind==='heavy'?'heavy':DEFAULT_SETTINGS.wind,
  stadium:SKY_OPTIONS.some(sky=>sky.id===source.stadium)?source.stadium:DEFAULT_SETTINGS.stadium
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
export {DEFAULT_SETTINGS,TURN_SPEED,VR_RESOLUTION_OPTIONS,SETTINGS_KEY,normalizeSettings,readSettings,saveSettings};
