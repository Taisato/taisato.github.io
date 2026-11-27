import { FT } from "../../vendor/three.js";
import {SKY_OPTIONS} from '../config.js';
import {DEFAULT_SETTINGS} from '../settings.js';
import {UI,panel,label,tracked,brand,heart,touch,pitch,button,shape} from './theme.js';
import {createOpticalMaterial} from '../render/optics.js';
import {drawAbilitySwitcher,VR_PAGES} from './ability-switcher.js';
class FootballInterface {
 constructor(scene,callbacks,credits={attribution:[],thanksTitle:'',thanks:[]}){
  this.callbacks=callbacks;this.credits=credits;this.hover=null;this.visible=false;this.snapshot={mode:'freeroam',phase:'ready',score:0};this.stateKey='';
  this.page='main';this.settings=DEFAULT_SETTINGS;this.settingsKey='';
  this.abilityLevels={};this.abilityPage=0;
  this.canvas=document.createElement('canvas');this.canvas.width=960;this.canvas.height=660;this.ctx=this.canvas.getContext('2d');this.texture=new FT.CanvasTexture(this.canvas);
  this.texture.colorSpace=FT.SRGBColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=FT.LinearFilter;this.width=1.32;this.height=.9075;
  this.root=new FT.Mesh(new FT.PlaneGeometry(this.width,this.height),createOpticalMaterial(this.texture,{strength:.5}));this.root.visible=false;this.root.frustumCulled=false;this.root.renderOrder=90;scene.add(this.root);
  // Keep pointer layers in the same transparent queue as the panels. An
  // opaque marker is drawn before every transparent panel, regardless of order.
  this.reticle=new FT.Mesh(new FT.SphereGeometry(.011,16,10),new FT.MeshBasicMaterial({color:UI.ink,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));this.reticle.renderOrder=210;this.reticle.frustumCulled=false;this.reticle.visible=false;this.reticle.name='Menu pointer rim';scene.add(this.reticle);
  this.reticleCore=new FT.Mesh(new FT.SphereGeometry(.006,16,10),new FT.MeshBasicMaterial({color:UI.white,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));this.reticleCore.renderOrder=211;this.reticleCore.frustumCulled=false;this.reticleCore.visible=false;this.reticleCore.name='Menu pointer centre';this.reticle.add(this.reticleCore);
  this.buttons=[];this.localRay=new FT.Vector3();this.localDirection=new FT.Vector3();this.hitPoint=new FT.Vector3();this.inverseQ=new FT.Quaternion();this.drawMenu();
 }
 setState(snapshot={}){this.snapshot={...this.snapshot,...snapshot};const key=[this.snapshot.mode,this.snapshot.phase,this.snapshot.score].join('|');if(key===this.stateKey)return;this.stateKey=key;if(this.visible)this.drawMenu();}
 setSettings(settings={}){
  const next={turnSpeed:Number.isFinite(settings.turnSpeed)?Math.max(.25,Math.min(4,settings.turnSpeed)):this.settings.turnSpeed,
   chromatic:typeof settings.chromatic==='boolean'?settings.chromatic:this.settings.chromatic,noise:typeof settings.noise==='boolean'?settings.noise:this.settings.noise,
   shotTrace:typeof settings.shotTrace==='boolean'?settings.shotTrace:this.settings.shotTrace,
   wind:settings.wind==='normal'||settings.wind==='heavy'?settings.wind:this.settings.wind,
   stadium:SKY_OPTIONS.some(option=>option.id===settings.stadium)?settings.stadium:this.settings.stadium};
  const key=[next.turnSpeed,next.chromatic,next.noise,next.shotTrace,next.wind,next.stadium].join('|');if(key===this.settingsKey)return;this.settingsKey=key;this.settings=next;
  if(this.visible&&this.page==='settings')this.drawMenu();
 }
 setPage(page){
  const next=['settings','credits','abilities'].includes(page)?page:'main';if(next===this.page)return;this.page=next;this.hover=null;this.reticle.visible=false;this.reticleCore.visible=false;
  if(next==='abilities')this.abilityPage=0;
  if(this.visible)this.drawMenu();
 }
 setAbilityLevels(levels){this.abilityLevels=levels;if(this.visible&&this.page==='abilities')this.drawMenu();}
 drawSettings(){
  const c=this.ctx,s=this.settings;panel(c,960,660);brand(c,48,58);tracked(c,'SETTINGS',724,58,18,UI.mint,2);c.fillStyle=UI.line;c.fillRect(48,106,864,1);
  const freeroam=this.snapshot.mode==='freeroam',h=freeroam?56:62,gap=freeroam?64:76;
  const turn=128,chromatic=turn+gap,noise=chromatic+gap,trace=noise+gap,wind=trace+gap;
  label(c,'Turn speed',48,turn+h/2,28);label(c,s.turnSpeed.toFixed(2).replace(/\.?0+$/,'')+'×',702,turn+h/2,38,UI.white,'center',800);
  label(c,'Chromatic aberration',48,chromatic+h/2,28);label(c,'Noise',48,noise+h/2,28);label(c,'Wind',48,wind+h/2,28);
  label(c,'Shot Trace',48,trace+17,28);label(c,'Shows each shot’s path for 2.5 seconds.',48,trace+43,19,UI.muted);
  this.buttons=[{id:'turn-down',label:'−',x:492,y:turn,w:112,h,disabled:s.turnSpeed<=.25},
   {id:'turn-up',label:'+',x:800,y:turn,w:112,h,disabled:s.turnSpeed>=4},
   {id:'toggle-chromatic',label:s.chromatic?'On':'Off',x:720,y:chromatic,w:192,h,on:s.chromatic},
   {id:'toggle-noise',label:s.noise?'On':'Off',x:720,y:noise,w:192,h,on:s.noise},
   {id:'toggle-shot-trace',label:s.shotTrace?'On':'Off',x:720,y:trace,w:192,h,on:s.shotTrace},
   {id:'toggle-wind',label:s.wind==='heavy'?'Heavy':'Normal',x:720,y:wind,w:192,h,on:true}];
  if(freeroam){
   const y=wind+gap,stadium=SKY_OPTIONS.find(option=>option.id===s.stadium);
   label(c,'Stadium',48,y+h/2,28);label(c,stadium.name,691,y+h/2,25,UI.mint,'center',750);
   this.buttons.push({id:'stadium-prev',label:'‹',x:470,y,w:78,h},{id:'stadium-next',label:'›',x:834,y,w:78,h});
  }
  if(freeroam)this.buttons.push({id:'settings-back',label:'Back',x:48,y:520,w:276,h:66},
   {id:'credits',label:'Credits',x:342,y:520,w:276,h:66},{id:'abilities',label:'Abilities',x:636,y:520,w:276,h:66});
  else this.buttons.push({id:'settings-back',label:'Back',x:48,y:520,w:420,h:66},
   {id:'credits',label:'Credits',x:492,y:520,w:420,h:66});
  for(const b of this.buttons){c.save();if(b.disabled)c.globalAlpha=.32;button(c,b,{primary:b.on||b.id==='settings-back',hover:!b.disabled&&this.hover===b.id});c.restore();}
  label(c,'Trigger  Select',48,615,20,UI.muted);label(c,'Y  Menu',912,615,20,UI.muted,'right');this.texture.needsUpdate=true;
 }
 drawCredits(){
  const c=this.ctx,{attribution,thanksTitle,thanks}=this.credits;
  panel(c,960,660);brand(c,48,58);tracked(c,'CREDITS',724,58,18,UI.mint,2);
  c.fillStyle=UI.line;c.fillRect(48,106,864,1);
  let y=156;
  for(const line of attribution){label(c,line,48,y,28);y+=45;}
  y+=21;
  label(c,thanksTitle,48,y,27,UI.mint,'left',750);y+=60;
  for(const line of thanks){label(c,'•',48,y,24,UI.lilac);label(c,line,75,y,27);y+=46;}
  this.buttons=[{id:'credits-back',label:'Back',x:48,y:520,w:864,h:66}];
  button(c,this.buttons[0],{primary:true,hover:this.hover==='credits-back'});
  label(c,'Trigger  Select',48,615,20,UI.muted);label(c,'Y  Menu',912,615,20,UI.muted,'right');this.texture.needsUpdate=true;
 }
 drawMenu(){
  if(this.page==='settings'){this.drawSettings();return;}
  if(this.page==='credits'){this.drawCredits();return;}
  if(this.page==='abilities'){
   this.buttons=drawAbilitySwitcher(this.ctx,this.abilityPage,this.abilityLevels,this.hover);
   this.texture.needsUpdate=true;return;
  }
  const c=this.ctx,s=this.snapshot,over=s.mode==='challenge'&&s.phase==='gameover';panel(c,960,660);brand(c,48,58);tracked(c,s.mode==='challenge'?'3 TOUCH':'FREEROAM',724,58,18,UI.mint,2);c.fillStyle=UI.line;c.fillRect(48,106,864,1);
  tracked(c,over?'RUN OVER':'SLOW MOTION',48,153,21,over?UI.lilac:UI.muted,3);
  if(s.mode==='challenge'){label(c,String(s.score||0),912,149,54,UI.white,'right',800);label(c,'GOALS',822,151,18,UI.muted,'right');}
  this.buttons=[{id:over?'restart':'resume',label:over?'Again':'Resume',x:48,y:196,w:864,h:88},{id:'freeroam',label:'Freeroam',x:48,y:310,w:420,h:154},{id:'challenge',label:'3 TOUCH',x:492,y:310,w:420,h:154}];
  button(c,this.buttons[0],{primary:true,hover:this.hover===this.buttons[0].id});
  for(const b of this.buttons.slice(1)){
   const selected=s.mode===b.id;shape(c,b.x,b.y,b.w,b.h,14);c.fillStyle=this.hover===b.id?'#263653':selected?'#153630':UI.panel;c.fill();c.strokeStyle=selected?UI.mint:this.hover===b.id?'#7b90b1':UI.line;c.lineWidth=selected?2.5:1.5;c.stroke();label(c,b.label,b.x+26,b.y+43,31,selected?UI.mint:UI.white,'left',800);
   if(b.id==='freeroam')pitch(c,b.x+28,b.y+83,94,42,selected?UI.mint:UI.muted);else{for(let i=0;i<3;i++)touch(c,b.x+40+i*34,b.y+108,23);for(let i=0;i<3;i++)heart(c,b.x+195+i*34,b.y+110,20);}
   c.beginPath();c.arc(b.x+b.w-30,b.y+40,7,0,Math.PI*2);c.fillStyle=selected?UI.mint:'#37465e';c.fill();
  }
  const utility=over?[{id:'calibrate',label:'Calibrate',x:48,y:490,w:276,h:76},{id:'settings',label:'Settings',x:342,y:490,w:276,h:76},{id:'exit',label:'Exit',x:636,y:490,w:276,h:76}]:[{id:'restart',label:s.mode==='challenge'?'New run':'Reset',x:48,y:490,w:204,h:76},{id:'calibrate',label:'Calibrate',x:268,y:490,w:204,h:76},{id:'settings',label:'Settings',x:488,y:490,w:204,h:76},{id:'exit',label:'Exit',x:708,y:490,w:204,h:76}];
  this.buttons.push(...utility);for(const b of utility)button(c,b,{hover:b.id===this.hover});label(c,'Trigger  Select',48,615,20,UI.muted);label(c,'Y  Menu',912,615,20,UI.muted,'right');this.texture.needsUpdate=true;
 }
 show(show,controls){this.visible=show;this.root.visible=show;this.reticle.visible=false;this.reticleCore.visible=false;this.hover=null;if(!show){for(const hand of controls?.hands||[])if(hand.ray)hand.ray.visible=false;}if(show){controls.refreshHead();this.root.position.copy(controls.headWorld).addScaledVector(controls.forward,1.65);this.root.position.y=controls.headWorld.y-.04;this.root.rotation.set(0,Math.atan2(-controls.forward.x,-controls.forward.z),0);this.root.updateMatrixWorld(true);this.drawMenu();}}
 select(id){
  const target=this.buttons.find(button=>button.id===id);
  if(target?.disabled)return;
  if(target?.abilityId){this.callbacks['ability-level']?.(target.abilityId,target.level);return;}
  if(id==='ability-page-prev'||id==='ability-page-next'){
   this.abilityPage=Math.max(0,Math.min(VR_PAGES-1,this.abilityPage+(id==='ability-page-next'?1:-1)));
   this.drawMenu();return;
  }
  this.callbacks[id]?.();
 }
 point(controls){
  if(!this.visible)return;const page=this.page;let hover=null;this.reticle.visible=false;this.reticleCore.visible=false;this.inverseQ.copy(this.root.quaternion).invert();
  for(const hand of controls.hands){
   if(!(hand.rayTracked??hand.tracked)||controls.desktop)continue;this.localRay.copy(hand.rayPosition).sub(this.root.position).applyQuaternion(this.inverseQ);this.localDirection.copy(hand.rayDirection).applyQuaternion(this.inverseQ);if(this.localDirection.z>=-.0001)continue;
   const distance=-this.localRay.z/this.localDirection.z;if(distance<0||distance>8)continue;const x=this.localRay.x+this.localDirection.x*distance,y=this.localRay.y+this.localDirection.y*distance;if(Math.abs(x)>this.width*.5||Math.abs(y)>this.height*.5)continue;
   const cx=(x/this.width+.5)*960,cy=(.5-y/this.height)*660;this.hitPoint.copy(hand.rayDirection).multiplyScalar(distance).add(hand.rayPosition);controls.showRay(hand,this.hitPoint);
   const b=this.buttons.find(b=>!b.disabled&&cx>=b.x&&cx<=b.x+b.w&&cy>=b.y&&cy<=b.y+b.h);
   // A blank hit from the other hand must not move the marker away from the
   // highlighted button. Two button hits retain the existing hand priority.
   if(b||hover===null){this.reticle.position.copy(this.hitPoint);this.reticle.visible=true;this.reticleCore.visible=true;}
   if(b){hover=b.id;if(hand.select){this.select(b.id);if(!this.visible||this.page!==page)return;if(this.buttons.some(next=>next.id===b.id&&next.disabled))hover=null;break;}}
  }
  if(hover!==this.hover){this.hover=hover;this.drawMenu();}
 }
 dispose(){for(const mesh of[this.root,this.reticle,this.reticleCore]){mesh.geometry.dispose();mesh.material.dispose();mesh.removeFromParent();}this.texture.dispose();}
}
export { FootballInterface };
