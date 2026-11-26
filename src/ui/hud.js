import { FT } from '../../vendor/three.js';
import {UI,shape,label,tracked,heart,touch} from './theme.js';
import {createOpticalMaterial} from '../render/optics.js';
function drawHUD(c,s,width=900,height=250){
 c.clearRect(0,0,width,height);if(s.mode!=='challenge')return;shape(c,6,6,888,132,18);c.fillStyle='rgba(8,13,29,.94)';c.fill();c.strokeStyle=UI.line;c.lineWidth=2;c.stroke();c.fillStyle=UI.mint;c.fillRect(34,6,70,3);tracked(c,'TOUCHES',42,41,17,UI.muted,2);
 const touches=Math.max(0,Math.min(3,s.touches??s.touchesLeft??3)),lives=Math.max(0,Math.min(3,s.lives??3));for(let i=0;i<3;i++)touch(c,64+i*46,91,30,i<touches);
 c.fillStyle=UI.line;c.fillRect(296,30,1,84);tracked(c,'GOALS',338,42,17,UI.muted,2);label(c,String(s.score||0),338,94,54,UI.white,'left',800);c.fillStyle=UI.line;c.fillRect(592,30,1,84);tracked(c,'LIVES',634,42,17,UI.muted,2);for(let i=0;i<3;i++)heart(c,656+i*44,95,27,i<lives);
 const over=s.phase==='gameover',result=s.phase==='result',word=over?'RUN OVER':result?({goal:'GOAL',out:'OUT',saved:'SAVED',touches:'NO TOUCHES',miss:'MISS'}[s.outcome]||'NEXT'):'';
 if(word){shape(c,250,158,400,78,13);c.fillStyle=s.outcome==='goal'&&!over?UI.mint:over?UI.lilac:UI.white;c.fill();label(c,word,450,197,35,UI.ink,'center',900);}
}
class FootballHUD{
 constructor(camera){
  this.canvas=document.createElement('canvas');this.canvas.width=900;this.canvas.height=250;this.context=this.canvas.getContext('2d');this.texture=new FT.CanvasTexture(this.canvas);this.texture.colorSpace=FT.SRGBColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=FT.LinearFilter;
  this.mesh=new FT.Mesh(new FT.PlaneGeometry(.9,.25),createOpticalMaterial(this.texture,{strength:.25}));this.mesh.position.set(0,0,-1.7);this.mesh.renderOrder=170;this.mesh.frustumCulled=false;this.mesh.visible=false;camera.add(this.mesh);this.camera=camera;this.upperSlope=0;this.fitToCamera(camera);
  this.desktopCanvas=document.querySelector('#desktop-hud');this.desktopContext=this.desktopCanvas?.getContext?.('2d');if(this.desktopCanvas){this.desktopCanvas.width=900;this.desktopCanvas.height=250;this.desktopCanvas.hidden=true;}this.key='';
 }
 fitToCamera(camera=this.camera){
  // Use both eye projections: asymmetric headset frusta can crop a fixed high HUD.
  const views=camera?.isArrayCamera?camera.cameras:null;let upper=Infinity;
  const count=views?.length||1;
  for(let i=0;i<count;i++){
   const p=(views?.[i]||camera)?.projectionMatrix?.elements;
   if(p&&p[5]>0){const slope=(1+p[9])/p[5];if(slope>0&&Number.isFinite(slope))upper=Math.min(upper,slope);}
  }
  if(!Number.isFinite(upper))upper=1;if(Math.abs(upper-this.upperSlope)<1e-6)return;this.upperSlope=upper;
  // The main strip is centred 53 mm above the canvas centre; leave 3 degrees
  // above the entire plane, including transparent pixels and the result badge.
  const depth=1.7,target=depth*Math.tan(39*Math.PI/180)-.053;
  const ceiling=depth*Math.tan(Math.atan(upper)-3*Math.PI/180)-.125;
  this.mesh.position.y=Math.min(target,ceiling);
 }
 update(snapshot={},visible=true,desktop=false,viewCamera=this.camera){
  const show=!!visible&&snapshot.mode==='challenge';this.mesh.visible=show&&!desktop;if(this.desktopCanvas)this.desktopCanvas.hidden=!(show&&desktop);if(!show)return;
  if(!desktop)this.fitToCamera(viewCamera);
  const key=[snapshot.mode,snapshot.phase,snapshot.score,snapshot.lives,snapshot.touches??snapshot.touchesLeft,snapshot.outcome,desktop].join('|');if(key===this.key)return;this.key=key;drawHUD(this.context,snapshot);this.texture.needsUpdate=true;
  if(this.desktopContext){this.desktopContext.clearRect(0,0,900,250);this.desktopContext.drawImage(this.canvas,0,0);}if(this.desktopCanvas)this.desktopCanvas.setAttribute?.('aria-label',(snapshot.score||0)+' goals, '+(snapshot.touches??snapshot.touchesLeft??3)+' touches, '+(snapshot.lives??3)+' lives');
 }
 hide(){this.mesh.visible=false;if(this.desktopCanvas)this.desktopCanvas.hidden=true;}
 dispose(){this.hide();this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}
export {FootballHUD,drawHUD};
