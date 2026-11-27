import { FT } from '../../vendor/three.js';
import {UI,shape,label,tracked,heart,touch} from './theme.js';
import {createOpticalMaterial} from '../render/optics.js';
function textRegion(c,regions,index,value,x,y,size,spacing,width,height){
 if(!regions)return;
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 const parts=spacing?value:[value];
 for(const part of parts){
  const m=c.measureText(part),offset=c.textAlign==='center'?m.width*.5:c.textAlign==='right'?m.width:0;
  left=Math.min(left,x-(Number.isFinite(m.actualBoundingBoxLeft)?m.actualBoundingBoxLeft:offset));
  right=Math.max(right,x+(Number.isFinite(m.actualBoundingBoxRight)?m.actualBoundingBoxRight:m.width-offset));
  top=Math.min(top,y-(Number.isFinite(m.actualBoundingBoxAscent)?m.actualBoundingBoxAscent:size*.65));
  bottom=Math.max(bottom,y+(Number.isFinite(m.actualBoundingBoxDescent)?m.actualBoundingBoxDescent:size*.65));
  x+=m.width+spacing;
 }
 // Two canvas pixels include bilinear filtering and the complete .35 px fringe.
 regions[index].set((left-2)/width,1-(bottom+2)/height,(right+2)/width,1-(top-2)/height);
}
function drawCapacity(c,count,capacity,x,isLife){
 if(capacity>5){label(c,`${count} / ${capacity}`,x,91,38,isLife?UI.lilac:UI.mint,'left',800);return;}
 const icon=isLife?heart:touch;
 for(let i=0;i<capacity;i++)icon(c,x+22+i*(isLife?44:46),isLife?95:91,isLife?27:30,i<count);
}
function drawHUD(c,s,width=900,height=250,textRegions=null){
 if(textRegions)for(const region of textRegions)region.set(2,2,-1,-1);
 c.clearRect(0,0,width,height);if(s.mode!=='challenge'&&!s.practice)return;shape(c,6,6,888,132,18);c.fillStyle='rgba(8,13,29,.94)';c.fill();c.strokeStyle=UI.line;c.lineWidth=2;c.stroke();c.fillStyle=UI.mint;c.fillRect(34,6,70,3);tracked(c,'TOUCHES',42,41,17,UI.muted,2);textRegion(c,textRegions,0,'TOUCHES',42,41,17,2,width,height);
 const maxTouches=s.maxTouches??3,maxLives=s.maxLives??3;
 const touches=Math.max(0,Math.min(maxTouches,s.touches??s.touchesLeft??3)),lives=Math.max(0,Math.min(maxLives,s.lives??3));
 drawCapacity(c,touches,maxTouches,42,false);
 c.fillStyle=UI.line;c.fillRect(296,30,1,84);tracked(c,'GOALS',338,42,17,UI.muted,2);textRegion(c,textRegions,1,'GOALS',338,42,17,2,width,height);label(c,String(s.score||0),338,94,54,UI.white,'left',800);textRegion(c,textRegions,2,String(s.score||0),338,94,54,0,width,height);c.fillStyle=UI.line;c.fillRect(592,30,1,84);tracked(c,'LIVES',634,42,17,UI.muted,2);textRegion(c,textRegions,3,'LIVES',634,42,17,2,width,height);
 drawCapacity(c,lives,maxLives,634,true);
 const over=s.phase==='gameover',result=s.phase==='result',word=over?(s.practice?'NEW BALL':'RUN OVER'):result?({goal:s.goalValue>1?'GOAL +'+s.goalValue:'GOAL',out:'OUT',saved:'SAVED',touches:'NO TOUCHES',miss:'MISS',retry:'RETRY'}[s.outcome]||'NEXT'):'';
 if(word){shape(c,250,158,400,78,13);c.fillStyle=s.outcome==='goal'&&!over?UI.mint:over||s.outcome==='retry'?UI.lilac:UI.white;c.fill();label(c,word,450,197,35,UI.ink,'center',900);textRegion(c,textRegions,4,word,450,197,35,0,width,height);}
}
class FootballHUD{
 constructor(camera){
  this.canvas=document.createElement('canvas');this.canvas.width=900;this.canvas.height=250;this.context=this.canvas.getContext('2d');this.texture=new FT.CanvasTexture(this.canvas);this.texture.colorSpace=FT.SRGBColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=FT.LinearFilter;
  this.textRegions=Array.from({length:5},()=>new FT.Vector4(2,2,-1,-1));
  this.mesh=new FT.Mesh(new FT.PlaneGeometry(.9,.25),createOpticalMaterial(this.texture,{strength:.25,textRegions:this.textRegions}));this.mesh.position.set(0,0,-1.7);this.mesh.renderOrder=170;this.mesh.frustumCulled=false;this.mesh.visible=false;camera.add(this.mesh);this.camera=camera;this.upperSlope=0;this.fitToCamera(camera);
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
  // Keep the frustum fit, with one further visible-strip drop from V35.
  // Two 132-pixel strips total .264 m at this unchanged canvas scale.
  const depth=1.7,target=depth*Math.tan(39*Math.PI/180)-.053;
  const ceiling=depth*Math.tan(Math.atan(upper)-3*Math.PI/180)-.125;
  this.mesh.position.y=Math.min(target,ceiling)-.264;
 }
 update(snapshot={},visible=true,desktop=false,viewCamera=this.camera){
  const show=!!visible&&(snapshot.mode==='challenge'||snapshot.practice);this.mesh.visible=show&&!desktop;if(this.desktopCanvas)this.desktopCanvas.hidden=!(show&&desktop);if(!show)return;
  if(!desktop)this.fitToCamera(viewCamera);
  const touches=snapshot.touches??snapshot.touchesLeft??3,maxTouches=snapshot.maxTouches??3,lives=snapshot.lives??3,maxLives=snapshot.maxLives??3;
  const key=[snapshot.mode,snapshot.phase,snapshot.score,lives,maxLives,touches,maxTouches,snapshot.outcome,snapshot.goalValue,desktop].join('|');if(key===this.key)return;this.key=key;drawHUD(this.context,snapshot,900,250,this.textRegions);this.texture.needsUpdate=true;
  if(this.desktopContext){this.desktopContext.clearRect(0,0,900,250);this.desktopContext.drawImage(this.canvas,0,0);}if(this.desktopCanvas)this.desktopCanvas.setAttribute?.('aria-label',`${snapshot.score||0} goals, ${touches} of ${maxTouches} touches, ${lives} of ${maxLives} lives`);
 }
 hide(){this.mesh.visible=false;if(this.desktopCanvas)this.desktopCanvas.hidden=true;}
 dispose(){this.hide();this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}
export {FootballHUD,drawHUD};
