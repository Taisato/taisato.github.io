import { FT } from '../../vendor/three.js';
import { footballClamp } from '../config.js';
import {UI,panel,label,tracked,shape} from './theme.js';
class FootballCalibrationPanel {
 constructor(camera){
  this.canvas=document.createElement('canvas');this.canvas.width=900;this.canvas.height=560;this.context=this.canvas.getContext('2d');this.texture=new FT.CanvasTexture(this.canvas);this.texture.colorSpace=FT.SRGBColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=FT.LinearFilter;
  this.mesh=new FT.Mesh(new FT.PlaneGeometry(1.12,.697),new FT.MeshBasicMaterial({map:this.texture,transparent:true,depthTest:false,depthWrite:false}));this.mesh.position.set(0,.06,-1.55);this.mesh.renderOrder=180;this.mesh.frustumCulled=false;this.mesh.visible=false;camera.add(this.mesh);this.key='';
 }
 update(controls,active){
  const cal=controls.calibration,waiting=!!cal?.awaitRelease;this.mesh.visible=!!(active&&!controls.desktop&&(!controls.isCalibrated||waiting));if(!this.mesh.visible)return;
  const stage=cal?.stage||'floor',ready=stage==='ready',progress=Math.round(footballClamp(cal?.progress||0,0,1)*40)/40,reason=cal?.reason||'';const key=[stage,progress,reason,waiting].join('|');if(key===this.key)return;this.key=key;
  const c=this.context;panel(c,900,560);tracked(c,'CALIBRATE',44,47,18,UI.muted,3);tracked(c,ready?'02 / 02':stage==='floor'?'01 / 02':'02 / 02',728,47,18,UI.mint,2);label(c,ready?'READY':stage==='floor'?'FLOOR':'PLAYING POSITION',44,106,40,UI.white,'left',800);
  label(c,ready?'Release both triggers.':stage==='floor'?'Controllers to the floor.':'Stand up. Hold your normal playing grip.',44,157,25,UI.muted,'left',500);
  c.save();c.translate(450,ready?278:stage==='floor'?264:271);c.lineCap='round';c.lineJoin='round';c.strokeStyle=UI.muted;c.lineWidth=7;
  if(stage==='floor'){
   c.strokeStyle='#384c68';c.lineWidth=2;for(const y of[76,100]){c.beginPath();c.moveTo(-220,y);c.lineTo(220,y);c.stroke();}c.strokeStyle=UI.mint;c.lineWidth=3;c.beginPath();c.moveTo(-168,76);c.lineTo(168,76);c.stroke();
   for(const x of[-72,72]){c.save();c.translate(x,20);c.rotate(x<0?-.16:.16);c.fillStyle='#e7effc';c.beginPath();c.roundRect(-14,-37,28,78,9);c.fill();c.strokeStyle=UI.mint;c.lineWidth=6;c.beginPath();c.arc(0,-32,25,0,Math.PI*2);c.stroke();c.restore();c.strokeStyle=UI.mint;c.lineWidth=3;c.beginPath();c.moveTo(x,-88);c.lineTo(x,-61);c.moveTo(x-8,-69);c.lineTo(x,-61);c.lineTo(x+8,-69);c.stroke();}
  }else if(!ready){
   c.strokeStyle=UI.muted;c.lineWidth=7;c.beginPath();c.arc(0,-56,22,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(0,-28);c.lineTo(0,39);c.moveTo(-39,-10);c.lineTo(39,-10);c.moveTo(-39,-10);c.lineTo(-53,28);c.lineTo(-80,10);c.moveTo(39,-10);c.lineTo(53,28);c.lineTo(80,10);c.moveTo(0,39);c.lineTo(-26,91);c.moveTo(0,39);c.lineTo(26,91);c.stroke();
   c.fillStyle=UI.mint;for(const x of[-83,83]){c.beginPath();c.roundRect(x-8,-9,16,31,5);c.fill();}c.strokeStyle='#34485f';c.lineWidth=2;c.beginPath();c.moveTo(-126,104);c.lineTo(126,104);c.stroke();
  }else{c.strokeStyle=UI.mint;c.lineWidth=10;c.beginPath();c.arc(0,0,74,0,Math.PI*2);c.stroke();c.lineWidth=12;c.beginPath();c.moveTo(-38,0);c.lineTo(-9,29);c.lineTo(43,-32);c.stroke();}
  c.restore();
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
