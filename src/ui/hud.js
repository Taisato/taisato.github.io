import { FT } from '../../vendor/three.js';
import {UI,shape,label,tracked,heart,touch} from './theme.js';
import {createOpticalMaterial} from '../render/optics.js';
import {HUD_HEIGHT,normalizeHUDHeight} from '../settings.js';
const HUD_STRIP_PIXELS=132;
const DEFAULT_STRIPS_DOWN=3;
const HUD_FILL='rgba(8,13,29,.94)';
const SCORE_LEFT=338, SCORE_Y=93, WHEEL_HEIGHT=56;
const SCORE_SETTLE_SECONDS=.16;
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
const DEMO_LABEL='Ability demo';
// A score drum turns one tooth per point. Its motion starts and ends at rest
// across the entire award, including when the award turns just one tooth.
class GoalMeter {
 constructor(){this.queue=[];this.reset();}
 reset(mode=null,score=0){
  this.mode=mode;this.position=this.target=score;
  this.roll=null;this.queue.length=0;
 }
 award(snapshot){
  const {score,goalValue,mode}=snapshot;
  if(!Number.isSafeInteger(goalValue)||goalValue<1||!Number.isSafeInteger(score)||score<goalValue)return;
  if(this.mode===mode&&score===this.target)return;
  const from=score-goalValue;
  if(this.mode!==mode||this.target!==from)this.reset(mode,from);
  const roll={from,count:goalValue,duration:.52+.19*(goalValue-1),elapsed:0,ticked:0};
  this.target=score;
  if(this.roll)this.queue.push(roll);else this.roll=roll;
 }
 advance(seconds,onTick){
  const roll=this.roll;if(!roll)return;
  roll.elapsed+=Math.min(.075,Math.max(0,seconds));
  const t=Math.min(1,roll.elapsed/roll.duration);
  const travel=roll.count*t*t*(3-2*t);
  this.position=roll.from+travel;
  const landed=Math.floor(travel);
  while(roll.ticked<landed){
   roll.ticked++;
   onTick?.(roll.ticked,roll.count,roll.from+roll.ticked);
  }
  if(roll.elapsed>=roll.duration+SCORE_SETTLE_SECONDS)this.roll=this.queue.shift()??null;
 }
}

function drawScore(c,position,practice,width,height,regions){
 const old=String(Math.floor(position)).padStart(2,'0'),phase=position%1;
 const next=phase?String(Math.floor(position)+1).padStart(2,'0'):old;
 // When a new leading wheel is needed, make room progressively during the carry.
 const columns=old.length+phase*(next.length-old.length);
 const cell=Math.min(38,(practice?155:235)/columns),span=columns*cell;
 const fontSize=54*cell/38,top=SCORE_Y-WHEEL_HEIGHT/2;
 c.save();
 c.beginPath();c.rect(SCORE_LEFT,top,span,WHEEL_HEIGHT);c.clip();
 const face=c.createLinearGradient(0,top,0,top+WHEEL_HEIGHT);
 face.addColorStop(0,'#070b15');face.addColorStop(.26,'#142036');
 face.addColorStop(.54,'#19263c');face.addColorStop(.84,'#101a2c');face.addColorStop(1,'#080f1c');
 c.fillStyle=face;c.fillRect(SCORE_LEFT,top,span,WHEEL_HEIGHT);
 c.font='800 '+fontSize+'px Arial, "Liberation Sans", sans-serif';c.textAlign='center';c.textBaseline='middle';
 const digits=old.padStart(next.length,' ');
 for(let i=0;i<next.length;i++){
  const x=SCORE_LEFT+span-(next.length-i-.5)*cell;
  if(i){c.fillStyle='#29364a';c.fillRect(x-cell*.5,top+1,1,WHEEL_HEIGHT-2);}
  c.fillStyle=UI.white;
  if(digits[i]===next[i])c.fillText(digits[i],x,SCORE_Y);
  else{
   if(digits[i]!==' ')c.fillText(digits[i],x,SCORE_Y-phase*WHEEL_HEIGHT);
   c.fillText(next[i],x,SCORE_Y+(1-phase)*WHEEL_HEIGHT);
  }
 }
 // The narrow lips sit in front of the digits; both moving faces pass behind them.
 c.fillStyle='#0a101e';c.fillRect(SCORE_LEFT,top,span,2);c.fillRect(SCORE_LEFT,top+WHEEL_HEIGHT-2,span,2);
 c.fillStyle='#465369';c.fillRect(SCORE_LEFT,top+WHEEL_HEIGHT-1,span,1);
 c.restore();
 let right=SCORE_LEFT+span;
 if(practice){
  const goalsX=right+10;
  label(c,'GOALS',goalsX,94,17,UI.muted,'left',600);
  right=goalsX+c.measureText('GOALS').width;
 }
 if(regions)regions[2].set((SCORE_LEFT-2)/width,1-(top+WHEEL_HEIGHT+2)/height,(right+2)/width,1-(top-2)/height);
}

function drawHUD(c,s,width=900,height=250,textRegions=null,scorePosition=s.score||0,unlockName=''){
 if(textRegions)for(const region of textRegions)region.set(2,2,-1,-1);
 c.clearRect(0,0,width,height);if(s.mode!=='challenge'&&!s.practice)return;shape(c,6,6,888,HUD_STRIP_PIXELS,18);c.fillStyle=HUD_FILL;c.fill();c.strokeStyle=UI.line;c.lineWidth=2;c.stroke();c.fillStyle=UI.mint;c.fillRect(34,6,70,3);tracked(c,'TOUCHES',42,41,17,UI.muted,2);textRegion(c,textRegions,0,'TOUCHES',42,41,17,2,width,height);
 const maxTouches=s.maxTouches??3,maxLives=s.maxLives??3;
 const touches=Math.max(0,Math.min(maxTouches,s.touches??s.touchesLeft??3)),lives=Math.max(0,Math.min(maxLives,s.lives??3));
 drawCapacity(c,touches,maxTouches,42,false);
 c.fillStyle=UI.line;c.fillRect(296,30,1,84);
 if(s.practice){
  label(c,DEMO_LABEL,338,42,27,UI.mint,'left',750);
  textRegion(c,textRegions,1,DEMO_LABEL,338,42,27,0,width,height);
 }else{
  tracked(c,'GOALS',338,42,17,UI.muted,2);textRegion(c,textRegions,1,'GOALS',338,42,17,2,width,height);
 }
 drawScore(c,scorePosition,s.practice,width,height,textRegions);
 c.fillStyle=UI.line;c.fillRect(592,30,1,84);tracked(c,'LIVES',634,42,17,UI.muted,2);textRegion(c,textRegions,3,'LIVES',634,42,17,2,width,height);
 drawCapacity(c,lives,maxLives,634,true);
 const over=s.phase==='gameover',result=s.phase==='result',word=over?(s.practice?'NEW BALL':'RUN OVER'):result?({goal:s.goalValue>1?'GOAL +'+s.goalValue:'GOAL',out:'OUT',saved:'SAVED',touches:'NO TOUCHES',miss:'MISS',retry:'RETRY'}[s.outcome]||'NEXT'):'';
 if(unlockName){
  shape(c,172,152,556,91,14);c.fillStyle=UI.ink;c.fill();c.strokeStyle='#efc877';c.lineWidth=2;c.stroke();
  label(c,'You have unlocked',450,177,21,'#efc877','center',600);
  label(c,unlockName,450,212,34,UI.white,'center',800);
  if(textRegions)textRegions[4].set(285/width,1-235/height,615/width,1-158/height);
 }else if(word){shape(c,250,158,400,78,13);c.fillStyle=s.outcome==='goal'&&!over?UI.mint:over||s.outcome==='retry'?UI.lilac:UI.white;c.fill();label(c,word,450,197,35,UI.ink,'center',900);textRegion(c,textRegions,4,word,450,197,35,0,width,height);}
}
class FootballHUD{
 constructor(camera){
  this.canvas=document.createElement('canvas');this.canvas.width=900;this.canvas.height=250;this.context=this.canvas.getContext('2d');this.texture=new FT.CanvasTexture(this.canvas);this.texture.colorSpace=FT.SRGBColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=FT.LinearFilter;
  this.textRegions=Array.from({length:5},()=>new FT.Vector4(2,2,-1,-1));
  this.mesh=new FT.Mesh(new FT.PlaneGeometry(.9,.25),createOpticalMaterial(this.texture,{strength:.25,textRegions:this.textRegions}));this.mesh.position.set(0,0,-1.7);this.mesh.renderOrder=170;this.mesh.frustumCulled=false;this.mesh.visible=false;camera.add(this.mesh);this.camera=camera;
  this.desktopCanvas=document.querySelector('#desktop-hud');this.desktopContext=this.desktopCanvas?.getContext?.('2d');if(this.desktopCanvas){this.desktopCanvas.width=900;this.desktopCanvas.height=250;this.desktopCanvas.hidden=true;}this.key='';
  this.meter=new GoalMeter();this.unlockQueue=[];this.unlockName='';this.unlockSeconds=0;
  this.height=0;this.upperSlope=NaN;this.lowerSlope=NaN;this.fitToCamera(camera);
 }
 setHeight(value){
  const height=normalizeHUDHeight(value);if(height===this.height)return;
  this.height=height;
  this.desktopCanvas?.style.setProperty('--hud-strips-down',String(DEFAULT_STRIPS_DOWN-height));
  this.placeMesh();
 }
 placeMesh(){
  const strip=this.mesh.geometry.parameters.height*HUD_STRIP_PIXELS/this.canvas.height*this.mesh.scale.y;
  const stripsDown=DEFAULT_STRIPS_DOWN-this.height;
  const lowest=DEFAULT_STRIPS_DOWN-HUD_HEIGHT.min;
  const travel=Math.max(0,this.baseY-this.floorY);
  const reserve=Math.min(strip*.1,travel/lowest);
  this.mesh.position.y=this.baseY-Math.min(stripsDown*strip,travel-(lowest-stripsDown)*reserve);
 }
 fitToCamera(camera=this.camera){
  // Intersect the two eye frusta so the complete result banner fits in either eye.
  const views=camera?.isArrayCamera?camera.cameras:null;let upper=Infinity,lower=Infinity;
  const count=views?.length||1;
  for(let i=0;i<count;i++){
   const p=(views?.[i]||camera)?.projectionMatrix?.elements;
   if(p&&p[5]>0){
    const top=(1+p[9])/p[5],bottom=(1-p[9])/p[5];
    if(top>0&&Number.isFinite(top))upper=Math.min(upper,top);
    if(bottom>0&&Number.isFinite(bottom))lower=Math.min(lower,bottom);
   }
  }
  if(!Number.isFinite(upper))upper=1;if(!Number.isFinite(lower))lower=1;
  if(Math.abs(upper-this.upperSlope)<1e-6&&Math.abs(lower-this.lowerSlope)<1e-6)return;
  this.upperSlope=upper;this.lowerSlope=lower;
  const depth=-this.mesh.position.z,target=depth*Math.tan(39*Math.PI/180)-.053;
  const margin=Math.min(3*Math.PI/180,(Math.atan(upper)+Math.atan(lower))*.1);
  const ceiling=depth*Math.tan(Math.atan(upper)-margin),floor=-depth*Math.tan(Math.atan(lower)-margin);
  const planeHeight=this.mesh.geometry.parameters.height;
  const scale=Math.min(1,(ceiling-floor)/planeHeight);
  this.mesh.scale.setScalar(scale);
  this.baseY=Math.min(target,ceiling-planeHeight*scale*.5);
  this.floorY=floor+planeHeight*scale*.5;
  this.placeMesh();
 }
 get scoreRolling(){return this.meter.roll!==null;}
 get hasUnlockNotice(){return !!this.unlockName||this.unlockQueue.length>0;}
 queueUnlocks(abilities){for(const ability of abilities)this.unlockQueue.push(ability.name);}
 clearUnlocks(){this.unlockQueue.length=0;this.unlockName='';this.unlockSeconds=0;}
 advanceUnlock(seconds,onUnlock){
  if(this.unlockName){
   this.unlockSeconds-=Math.min(.075,Math.max(0,seconds));
   if(this.unlockSeconds>0)return;
   this.unlockName='';
  }
  if(this.unlockQueue.length){
   this.unlockName=this.unlockQueue.shift();this.unlockSeconds=2;
   onUnlock?.(this.unlockName);
  }
 }
 awardGoal(snapshot){this.meter.award(snapshot);}
 resetScore(){this.meter.reset();this.unlockName='';}
 update(snapshot,visible=true,desktop=false,viewCamera=this.camera,seconds=0,onScoreTick,onUnlock){
  if(!visible||!(snapshot?.mode==='challenge'||snapshot?.practice)){this.hide();return;}
  this.mesh.visible=!desktop;if(this.desktopCanvas&&this.desktopCanvas.hidden===desktop)this.desktopCanvas.hidden=!desktop;
  if(!desktop)this.fitToCamera(viewCamera);
  const meter=this.meter,score=snapshot.score||0;
  if(meter.mode!==snapshot.mode||meter.target!==score)meter.reset(snapshot.mode,score);
  const before=meter.position;
  meter.advance(seconds,onScoreTick);
  if(!snapshot.practice&&this.hasUnlockNotice)this.advanceUnlock(seconds,onUnlock);
  const unlockName=snapshot.practice?'':this.unlockName;
  const touches=snapshot.touches??snapshot.touchesLeft??3,maxTouches=snapshot.maxTouches??3,lives=snapshot.lives??3,maxLives=snapshot.maxLives??3;
  const key=[snapshot.mode,snapshot.practice,snapshot.phase,score,lives,maxLives,touches,maxTouches,snapshot.outcome,snapshot.goalValue,desktop,unlockName].join('|');
  if(key===this.key){
   if(before===meter.position)return;
   // A moving drum only dirties the score area. Keep the main HUD and demo
   // label cached, and avoid repainting stationary frames during the settle beat.
   const x=SCORE_LEFT-2,y=63,w=248,h=60;
   this.context.clearRect(x,y,w,h);this.context.fillStyle=HUD_FILL;this.context.fillRect(x,y,w,h);
   drawScore(this.context,meter.position,snapshot.practice,900,250,this.textRegions);
   if(this.desktopContext){this.desktopContext.clearRect(x,y,w,h);this.desktopContext.drawImage(this.canvas,x,y,w,h,x,y,w,h);}
  }else{
   this.key=key;
   drawHUD(this.context,snapshot,900,250,this.textRegions,meter.position,unlockName);
   if(this.desktopContext){this.desktopContext.clearRect(0,0,900,250);this.desktopContext.drawImage(this.canvas,0,0);}
   this.desktopCanvas?.setAttribute('aria-label',`${snapshot.practice?DEMO_LABEL+', ':''}${score} goals, ${touches} of ${maxTouches} touches, ${lives} of ${maxLives} lives${unlockName?', You have unlocked '+unlockName:''}`);
  }
  this.texture.needsUpdate=true;
 }
 hide(){
  this.mesh.visible=false;if(this.desktopCanvas&&!this.desktopCanvas.hidden)this.desktopCanvas.hidden=true;
  if(!this.key)return;
  this.key='';this.context.clearRect(0,0,this.canvas.width,this.canvas.height);this.texture.needsUpdate=true;
  this.desktopContext?.clearRect(0,0,this.canvas.width,this.canvas.height);
  this.desktopCanvas?.removeAttribute('aria-label');
 }
 dispose(){this.hide();this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}
export {FootballHUD,drawHUD};
