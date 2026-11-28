import { FT } from '../../vendor/three.js';
import { footballClamp } from '../config.js';
import {UI,panel,label,tracked,shape} from './theme.js';
import {createOpticalMaterial} from '../render/optics.js';

function drawPlayer(c, floor) {
  const handX = floor ? 116 : 77, handY = floor ? 283 : 287;
  const ballRadius = 17, gap = 6;
  c.save();
  c.translate(450, floor ? 213 : 181);
  const scale = floor ? .55 : .45;
  c.scale(scale, scale);
  c.save();
  // Leave the panel's own gradient visible between each hand and its controller.
  c.beginPath(); c.rect(-185, -4, 370, 472);
  for (const x of [-handX, handX]) {
    c.moveTo(x + ballRadius + gap, handY);
    c.arc(x, handY, ballRadius + gap, 0, Math.PI * 2);
  }
  c.clip('evenodd');
  if (floor) {
    c.strokeStyle=UI.line; c.lineWidth=3; c.lineCap='round';
    c.beginPath(); c.moveTo(-167,301); c.lineTo(167,301); c.stroke();
  }
  c.fillStyle=UI.white;
  c.beginPath(); c.arc(0,43,43,0,Math.PI*2); c.fill();
  // Head, shoulders, and arm width follow the same silhouette in both poses.
  c.beginPath(); c.moveTo(-33,96); c.lineTo(33,96);
  c.bezierCurveTo(67,96,94,123,94,157);
  if (floor) {
    c.lineTo(132,273); c.bezierCurveTo(138,295,105,305,99,283); c.lineTo(60,164);
  } else {
    c.lineTo(94,281); c.bezierCurveTo(94,304,60,304,60,281); c.lineTo(60,163);
  }
  c.bezierCurveTo(60,157,52,157,52,163);
  if (floor) {
    // Bend the knees outwards, leaving the arms free to reach the floor.
    c.lineTo(52,195); c.lineTo(74,216); c.quadraticCurveTo(88,229,80,247);
    c.lineTo(59,288); c.bezierCurveTo(46,313,8,296,20,271); c.lineTo(37,238);
    c.lineTo(8,218); c.quadraticCurveTo(0,212,-8,218); c.lineTo(-37,238);
    c.lineTo(-20,271); c.bezierCurveTo(-8,296,-46,313,-59,288); c.lineTo(-80,247);
    c.quadraticCurveTo(-88,229,-74,216); c.lineTo(-52,195);
  } else {
    c.lineTo(52,436); c.bezierCurveTo(52,467,5,467,5,436);
    c.lineTo(5,272); c.bezierCurveTo(5,265,-5,265,-5,272);
    c.lineTo(-5,436); c.bezierCurveTo(-5,467,-52,467,-52,436);
  }
  c.lineTo(-52,163); c.bezierCurveTo(-52,157,-60,157,-60,163);
  if (floor) {
    c.lineTo(-99,283); c.bezierCurveTo(-105,305,-138,295,-132,273); c.lineTo(-94,157);
  } else {
    c.lineTo(-60,281); c.bezierCurveTo(-60,304,-94,304,-94,281); c.lineTo(-94,157);
  }
  c.bezierCurveTo(-94,123,-67,96,-33,96); c.closePath(); c.fill();
  c.restore();
  c.fillStyle=UI.mint;
  for (const x of [-handX,handX]) { c.beginPath(); c.arc(x,handY,ballRadius,0,Math.PI*2); c.fill(); }
  c.restore();
}

class FootballCalibrationPanel {
 constructor(camera){
  this.canvas=document.createElement('canvas');this.canvas.width=900;this.canvas.height=560;this.context=this.canvas.getContext('2d');this.texture=new FT.CanvasTexture(this.canvas);this.texture.colorSpace=FT.SRGBColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=FT.LinearFilter;
  this.mesh=new FT.Mesh(new FT.PlaneGeometry(1.12,.697),createOpticalMaterial(this.texture,{strength:.5}));this.mesh.position.set(0,.06,-1.55);this.mesh.renderOrder=180;this.mesh.frustumCulled=false;this.mesh.visible=false;camera.add(this.mesh);this.key='';
 }
 update(controls,active){
  const cal=controls.calibration,waiting=!!cal?.awaitRelease;this.mesh.visible=!!(active&&!controls.desktop&&(!controls.isCalibrated||waiting));if(!this.mesh.visible)return;
  const stage=cal?.stage||'floor',ready=stage==='ready',progress=Math.round(footballClamp(cal?.progress||0,0,1)*40)/40,reason=cal?.reason||'';const key=[stage,progress,reason,waiting].join('|');if(key===this.key)return;this.key=key;
  const c=this.context;panel(c,900,560);tracked(c,'CALIBRATE',44,47,18,UI.muted,3);label(c,ready?'READY':stage==='floor'?'FLOOR':'PLAYING POSITION',44,106,40,UI.white,'left',800);
  label(c,ready?'Release both triggers.':stage==='floor'?'Controllers to the floor.':'Stand up. Hold your normal playing grip.',44,157,25,UI.muted,'left',500);
  if(ready){
   c.save();c.translate(450,278);c.lineCap='round';c.lineJoin='round';c.strokeStyle=UI.mint;
   c.lineWidth=10;c.beginPath();c.arc(0,0,74,0,Math.PI*2);c.stroke();
   c.lineWidth=12;c.beginPath();c.moveTo(-38,0);c.lineTo(-9,29);c.lineTo(43,-32);c.stroke();c.restore();
  }else drawPlayer(c,stage==='floor');
  const prompt=ready?'':waiting?'Release both triggers':progress>0?'Hold steady':'Squeeze both triggers';label(c,prompt,450,426,28,UI.mint,'center',700);
  shape(c,54,464,792,10,4);c.fillStyle=UI.raised;c.fill();if(progress>0){shape(c,54,464,792*progress,10,Math.min(4,792*progress*.5));c.fillStyle=UI.mint;c.fill();}
  const standard=['Touch both controllers to the floor.','Release both triggers.','Squeeze both triggers.','Keep holding.','Hold your normal playing grip.','Stand up; hold your normal playing grip.'];let detail=ready||standard.includes(reason)?'':reason;
  const concise={'Track both controllers.':'Track both controllers','Touch both controllers to the same floor.':'Same floor level','Keep the headset above the controllers.':'Headset above controllers','Stand up fully.':'Stand up fully','Hold your normal playing grip.':'Hold your playing grip','Hold both hands in your playing position.':'Hold both hands in position'};detail=concise[detail]||detail;
  label(c,detail,450,518,21,UI.muted,'center',500);this.texture.needsUpdate=true;
 }
 hide(){this.mesh.visible=false;}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}
export { FootballCalibrationPanel };
