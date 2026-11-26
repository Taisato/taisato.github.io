import { FT } from "../../vendor/three.js";
import { footballClamp } from "../config.js";

class FootballCalibrationPanel {
  constructor(camera) {
    this.canvas=document.createElement('canvas');this.canvas.width=900;this.canvas.height=490;
    this.context=this.canvas.getContext('2d');this.texture=new FT.CanvasTexture(this.canvas);
    this.texture.colorSpace=FT.SRGBColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=FT.LinearFilter;
    this.mesh=new FT.Mesh(new FT.PlaneGeometry(1.12,.61),new FT.MeshBasicMaterial({map:this.texture,transparent:true,depthTest:false,depthWrite:false}));
    this.mesh.position.set(0,.08,-1.55);this.mesh.renderOrder=180;this.mesh.visible=false;camera.add(this.mesh);
    this.key='';
  }
  update(controls,active) {
    const cal=controls.calibration;
    const waiting=!!cal?.awaitRelease;
    this.mesh.visible=!!(active&&!controls.desktop&&(!controls.isCalibrated||waiting));
    if(!this.mesh.visible)return;
    const stage=cal?.stage||'floor',ready=stage==='ready';
    const progress=Math.round(footballClamp(cal?.progress||0,0,1)*40)/40;
    const reason=cal?.reason||'';
    const key=[stage,progress,reason,waiting].join('|');if(key===this.key)return;this.key=key;
    const c=this.context;c.clearRect(0,0,900,490);
    c.beginPath();c.roundRect(0,0,900,490,18);c.fillStyle='rgba(17,29,25,.96)';c.fill();
    c.strokeStyle='#64806b';c.lineWidth=2;c.stroke();
    c.fillStyle='#d7eca7';c.textAlign='left';c.textBaseline='alphabetic';c.font='700 38px sans-serif';
    c.fillText(ready?'CALIBRATED':stage==='floor'?'01 / FLOOR':'02 / PLAYING POSITION',42,63);
    c.font='28px sans-serif';c.fillStyle='#e8eee2';
    if(ready)c.fillText('Release both triggers to play.',42,118);
    else if(stage==='floor')c.fillText('Touch both controllers to the floor.',42,118);
    else{
      c.fillText('Stand up. Hold your hands',42,112);
      c.fillText('in your normal playing position.',42,151);
    }
    // The two poses are explained visually so the in-headset flow stays short.
    c.save();c.translate(450,stage==='stance'?251:228);
    c.lineCap='round';c.lineJoin='round';c.strokeStyle='#9ab6a0';c.lineWidth=8;
    if(stage==='floor'){
      c.beginPath();c.moveTo(-150,76);c.lineTo(150,76);c.stroke();
      for(const x of [-66,66]){
        c.save();c.translate(x,22);c.rotate(x<0?-.22:.22);
        c.fillStyle='#cedbc8';c.beginPath();c.roundRect(-14,-40,28,76,9);c.fill();
        c.strokeStyle='#d6eba5';c.lineWidth=6;c.beginPath();c.arc(0,-36,24,0,Math.PI*2);c.stroke();c.restore();
      }
      c.strokeStyle='#d6eba5';c.lineWidth=4;
      for(const x of [-66,66]){c.beginPath();c.moveTo(x,-82);c.lineTo(x,-58);c.moveTo(x-8,-66);c.lineTo(x,-58);c.lineTo(x+8,-66);c.stroke();}
    }else if(!ready){
      c.beginPath();c.arc(0,-62,22,0,Math.PI*2);c.stroke();
      c.beginPath();c.moveTo(0,-33);c.lineTo(0,38);c.moveTo(-40,-13);c.lineTo(40,-13);
      c.moveTo(-40,-13);c.lineTo(-53,28);c.lineTo(-79,12);c.moveTo(40,-13);c.lineTo(53,28);c.lineTo(79,12);
      c.moveTo(0,38);c.lineTo(-26,90);c.moveTo(0,38);c.lineTo(26,90);c.stroke();
      c.fillStyle='#d6eba5';for(const x of [-82,82]){c.beginPath();c.roundRect(x-8,-6,16,30,5);c.fill();}
    }else{
      c.strokeStyle='#d6eba5';c.lineWidth=12;c.beginPath();c.moveTo(-51,1);c.lineTo(-14,39);c.lineTo(59,-44);c.stroke();
    }
    c.restore();
    c.textAlign='center';c.font='600 28px sans-serif';c.fillStyle='#e7eddf';
    c.fillText(ready?'':waiting?'Release both triggers':progress>0?'Keep holding':'Squeeze both triggers',450,380);
    c.fillStyle='#33493b';c.beginPath();c.roundRect(60,402,780,12,6);c.fill();
    if(progress>0){c.fillStyle='#d7eca7';c.beginPath();c.roundRect(60,402,780*progress,12,6);c.fill();}
    const detail=(ready||['Touch both controllers to the floor.','Release both triggers.','Squeeze both triggers.','Keep holding.'].includes(reason))?'':reason;
    c.fillStyle='#b2c4ac';c.font='23px sans-serif';c.fillText(detail,450,454,790);
    this.texture.needsUpdate=true;
  }
  hide(){this.mesh.visible=false;}
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}

export { FootballCalibrationPanel };
