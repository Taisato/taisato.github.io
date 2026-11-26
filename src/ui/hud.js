import { FT } from '../../vendor/three.js';
import {UI,shape,label,tracked,heart,touch} from './theme.js';
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
  this.mesh=new FT.Mesh(new FT.PlaneGeometry(.9,.25),new FT.MeshBasicMaterial({map:this.texture,transparent:true,depthTest:false,depthWrite:false}));this.mesh.position.set(0,.60,-1.7);this.mesh.renderOrder=170;this.mesh.frustumCulled=false;this.mesh.visible=false;camera.add(this.mesh);
  this.desktopCanvas=document.querySelector('#desktop-hud');this.desktopContext=this.desktopCanvas?.getContext?.('2d');if(this.desktopCanvas){this.desktopCanvas.width=900;this.desktopCanvas.height=250;this.desktopCanvas.hidden=true;}this.key='';
 }
 update(snapshot={},visible=true,desktop=false){
  const show=!!visible&&snapshot.mode==='challenge';this.mesh.visible=show&&!desktop;if(this.desktopCanvas)this.desktopCanvas.hidden=!(show&&desktop);if(!show)return;
  const key=[snapshot.mode,snapshot.phase,snapshot.score,snapshot.lives,snapshot.touches??snapshot.touchesLeft,snapshot.outcome,desktop].join('|');if(key===this.key)return;this.key=key;drawHUD(this.context,snapshot);this.texture.needsUpdate=true;
  if(this.desktopContext){this.desktopContext.clearRect(0,0,900,250);this.desktopContext.drawImage(this.canvas,0,0);}if(this.desktopCanvas)this.desktopCanvas.setAttribute?.('aria-label',(snapshot.score||0)+' goals, '+(snapshot.touches??snapshot.touchesLeft??3)+' touches, '+(snapshot.lives??3)+' lives');
 }
 hide(){this.mesh.visible=false;if(this.desktopCanvas)this.desktopCanvas.hidden=true;}
 dispose(){this.hide();this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}
export {FootballHUD,drawHUD};
