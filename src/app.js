import { FT } from "../vendor/three.js";
import { FB, footballClamp } from "./config.js";
import { FootballField } from "./world/field.js";
import { FootballPhysics } from "./physics/ball.js";
import { FootballGoalNets } from "./physics/nets.js";
import { FootballGoalNetVisual } from "./render/net.js";
import { FootballOptics } from "./render/optics.js";
import { FootballGoalkeeper } from "./keeper/keeper.js";
import { FootballControls } from "./player/controls.js";
import { FootballInterface } from "./ui/menu.js";
import { FootballCalibrationPanel } from "./ui/calibration.js";
import { FootballHUD } from "./ui/hud.js";
import { FootballChallenge } from "./game/challenge.js";
import { FootballAudio } from "./audio.js";

class FootballApp {
  constructor() {
    this.scene=new FT.Scene();this.camera=new FT.PerspectiveCamera(90,1,.035,230);this.rig=new FT.Group();
    this.rig.add(this.camera);this.scene.add(this.rig);
    this.renderer=new FT.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=FT.SRGBColorSpace;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.4));
    this.renderer.xr.enabled=true;this.renderer.xr.setReferenceSpaceType('local-floor');
    if(this.renderer.xr.setFramebufferScaleFactor)this.renderer.xr.setFramebufferScaleFactor(.9);
    if(this.renderer.xr.setFoveation)this.renderer.xr.setFoveation(0);
    this.renderer.domElement.id='pitch-view';document.body.prepend(this.renderer.domElement);
    this.field=new FootballField(this.scene);this.physics=new FootballPhysics();
    this.nets=new FootballGoalNets();this.netVisual=new FootballGoalNetVisual(this.field,this.nets);
    this.goalkeeper=new FootballGoalkeeper(this.field,-1);
    this.controls=new FootballControls(this.scene,this.rig,this.camera,this.field);
    this.mode='freeroam';this.challenge=new FootballChallenge();this.pendingChance=null;
    this.freeSnapshot={mode:'freeroam',phase:'ready',score:0,lives:3,touches:3,round:0,outcome:null};
    this.modeInput={ball:this.physics.ball,previous:null,events:this.physics.events,keeper:this.goalkeeper};
    this.observeChallengeMotion=(previous,current,radius,events)=>this.challenge.observeMotion(previous,current,radius,events);
    this.audio=new FootballAudio();this.interface=new FootballInterface(this.scene,{
      resume:()=>this.setMenu(false),calibrate:()=>this.beginCalibration(),exit:()=>this.exit(),
      freeroam:()=>this.selectMode('freeroam'),challenge:()=>this.selectMode('challenge'),restart:()=>this.restart()
    });
    this.calibrationPanel=new FootballCalibrationPanel(this.camera);
    this.hud=new FootballHUD(this.camera);
    this.optics=new FootballOptics(this.renderer,this.scene,this.camera);
    this.opticsState={menu:false,active:false};
    this.active=false;this.menu=false;this.pending=false;this.pendingInitialPlacement=false;
    this.session=null;this.reference=null;this.paused=false;this.contextLost=false;this.disposed=false;
    this.lastTime=0;this.accumulator=0;this.calibrationRevision=0;this.calibrationCompletePending=false;
    this.calibrationFromGameover=false;
    this.pendingStartWhistle=false;
    this.abort=new AbortController();this.spawnPoint=new FT.Vector3();this.origin=new FT.Vector3();
    this.ballBefore=new FT.Vector3();this.ballDraw=new FT.Vector3();this.orientationBefore=new FT.Quaternion();
    this.renderBall={position:this.ballDraw,orientation:new FT.Quaternion(),radius:FB.ballRadius};
    this.ui={launcher:document.querySelector('#launcher'),status:document.querySelector('#status'),enter:document.querySelector('#enter-vr'),
      desktop:document.querySelector('#desktop'),resume:document.querySelector('#resume'),exit:document.querySelector('#exit'),
      hint:document.querySelector('#desktop-hint'),restart:document.querySelector('#restart'),
      modes:document.querySelector('#mode-select'),freeroam:document.querySelector('#mode-freeroam'),challenge:document.querySelector('#mode-challenge'),
      pauseLabel:document.querySelector('#pause-label'),pauseScore:document.querySelector('#pause-score')};
    const on=(el,event,fn)=>el?.addEventListener(event,fn,{signal:this.abort.signal});
    on(this.ui.enter,'click',()=>this.enterVR());on(this.ui.desktop,'click',()=>this.enterDesktop());
    on(this.ui.resume,'click',()=>this.setMenu(false));on(this.ui.exit,'click',()=>this.exit());
    on(this.ui.restart,'click',()=>this.restart());
    on(this.ui.freeroam,'click',()=>this.selectMode('freeroam'));on(this.ui.challenge,'click',()=>this.selectMode('challenge'));
    on(window,'resize',()=>this.resize());
    on(window,'pagehide',event=>{if(!event.persisted)this.dispose();});
    on(document,'visibilitychange',()=>{
      if(!this.session){this.paused=document.hidden;this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts();this.accumulator=0;this.lastTime=0;this.audio.pause(this.paused||this.menu||!this.active);}
    });
    on(this.renderer.domElement,'webglcontextlost',event=>{
      event.preventDefault();this.contextLost=true;this.controls.invalidate();this.audio.pause(true);
      this.ui.status.textContent='Graphics interrupted. Reload.';this.ui.launcher.hidden=false;
    });
    on(this.renderer.domElement,'webglcontextrestored',()=>{
      this.contextLost=false;this.lastTime=0;this.accumulator=0;this.physics.clearContacts();this.nets.clearContacts();
      this.ui.status.textContent='';this.ui.launcher.hidden=this.active&&(!this.menu||!this.controls.desktop);
      this.audio.pause(this.paused||this.menu||!this.active);
    });
    on(this.renderer.domElement,'click',()=>{
      if(this.active&&this.controls.desktop&&!this.menu){
        if(document.pointerLockElement!==this.renderer.domElement)this.renderer.domElement.requestPointerLock?.();
        else if(this.controls.kickAge>.7)this.controls.kickAge=0;
      }
    });
    on(window,'mousemove',event=>{
      if(this.controls.desktop&&this.active&&!this.menu&&document.pointerLockElement===this.renderer.domElement){
        const yaw=-(event.movementX||0)*.0023;
        this.controls.refreshHead();this.controls.temp.copy(this.controls.headWorld);
        this.rig.rotation.y+=yaw;this.rig.updateMatrixWorld(true);
        this.controls.temp2.copy(this.controls.headLocal).applyMatrix4(this.rig.matrixWorld);
        this.rig.position.x+=this.controls.temp.x-this.controls.temp2.x;this.rig.position.z+=this.controls.temp.z-this.controls.temp2.z;
        this.controls.desktopPitch=footballClamp(this.controls.desktopPitch-(event.movementY||0)*.0023,-1.25,.7);
      }
    });
    on(document,'pointerlockchange',()=>{if(this.controls.desktop&&this.active&&!document.pointerLockElement)this.controls.keys.clear();});
    this.controls.setDesktop(true);this.controls.place(new FT.Vector3(0,0,4),0);
    this.physics.reset(new FT.Vector3(0,FB.ballRadius,2.7));this.field.updateBall(this.physics.ball);this.syncBallHistory();
    this.resize();this.syncPage();this.detectVR();this.renderer.setAnimationLoop(this.frame);
  }
  resize(){const w=window.innerWidth||1280,h=window.innerHeight||720;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  get snapshot(){return this.mode==='challenge'?this.challenge.snapshot:this.freeSnapshot;}
  syncPage() {
    const over=this.mode==='challenge'&&this.challenge.phase==='gameover';
    this.ui.resume.hidden=!this.active||over;this.ui.exit.hidden=!this.active;
    this.ui.enter.hidden=this.active;this.ui.desktop.hidden=this.active;
    this.ui.restart.hidden=!this.active||this.mode!=='challenge';
    this.ui.restart.textContent=over?'Again':'Restart';
    this.ui.pauseLabel.textContent=over?'RUN OVER':'PAUSED';
    this.ui.pauseScore.textContent=this.mode==='challenge'?String(this.snapshot.score)+' GOALS':'';
    this.ui.launcher.dataset.active=String(this.active);this.ui.launcher.dataset.mode=this.mode;
    this.ui.launcher.dataset.input=this.active&&this.controls.desktop?'desktop':'vr';
    this.ui.launcher.dataset.phase=this.snapshot.phase;
    this.ui.freeroam.setAttribute('aria-pressed',String(this.mode==='freeroam'));
    this.ui.challenge.setAttribute('aria-pressed',String(this.mode==='challenge'));
    this.interface.setState(this.snapshot);
  }
  selectMode(mode) {
    if(mode!=='freeroam'&&mode!=='challenge'||this.pending)return;
    if(mode===this.mode){this.syncPage();return;}
    this.mode=mode;
    if(this.active)this.start();else this.syncPage();
  }
  restart() {
    if(!this.active||this.pending)return;
    this.start();
  }
  async detectVR() {
    if(!window.isSecureContext||!navigator.xr){this.ui.enter.disabled=true;this.ui.status.textContent=window.isSecureContext?'VR unavailable.':'VR requires HTTPS.';return;}
    this.ui.enter.disabled=true;
    try{const supported=await navigator.xr.isSessionSupported('immersive-vr');
      if(this.disposed)return;this.ui.enter.disabled=!supported;this.ui.status.textContent=supported?'':'VR unavailable.';
    }catch{this.ui.status.textContent='VR unavailable.';}
  }
  async enterVR() {
    if(this.pending||this.session||!navigator.xr)return;this.pending=true;this.ui.enter.disabled=true;this.ui.desktop.disabled=true;this.ui.status.textContent='Starting VR…';
    try{
      const sessionRequest=navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor']});
      // Both requests occur inside the entry gesture, before either is awaited.
      this.audio.start();
      const session=await sessionRequest;
      if(this.disposed){await session.end();return;}
      this.session=session;session.addEventListener('end',this.onSessionEnd);session.addEventListener('visibilitychange',this.onXRVisibility);
      await this.renderer.xr.setSession(session);
      this.reference=this.renderer.xr.getReferenceSpace();this.reference?.addEventListener('reset',this.onReferenceReset);
      this.controls.setDesktop(false);this.active=true;this.paused=false;this.lastTime=0;
      this.start();this.onXRVisibility();this.ui.status.textContent='';
    }catch(error){
      console.warn('VR session could not start',error);
      if(this.session)try{await this.session.end();}catch{this.onSessionEnd();}
      this.ui.status.textContent='Could not start VR.';
    }finally{this.pending=false;this.ui.enter.disabled=false;this.ui.desktop.disabled=false;}
  }
  enterDesktop(){if(this.session||this.pending)return;this.audio.start();this.controls.setDesktop(true);this.active=true;this.paused=false;this.lastTime=0;this.start();}
  onXRVisibility=()=>{
    this.paused=this.session?.visibilityState!=='visible';this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts();
    this.accumulator=0;this.lastTime=0;this.audio.pause(this.paused||this.menu);
  };
  onReferenceReset=()=>{this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts();this.accumulator=0;this.lastTime=0;};
  onSessionEnd=()=>{
    this.reference?.removeEventListener('reset',this.onReferenceReset);
    this.session?.removeEventListener('end',this.onSessionEnd);this.session?.removeEventListener('visibilitychange',this.onXRVisibility);
    this.session=null;this.reference=null;this.active=false;this.menu=false;this.paused=false;this.pendingInitialPlacement=false;this.pendingStartWhistle=false;
    this.calibrationFromGameover=false;
    this.pendingChance=null;this.challenge.stop();this.hud.hide();
    this.interface.show(false,this.controls);this.calibrationPanel.hide();this.controls.setDesktop(true);this.controls.invalidate();
    this.physics.clearContacts();this.nets.clearContacts();this.accumulator=0;this.audio.pause(true);
    this.ui.launcher.hidden=false;this.ui.hint.hidden=true;this.ui.status.textContent='';this.syncPage();this.resize();this.lastTime=0;
  };
  exit(){
    this.pendingStartWhistle=false;
    if(this.session){this.session.end().catch(()=>{this.ui.status.textContent='Use the headset menu to leave VR.';});return;}
    document.exitPointerLock?.();this.active=false;this.menu=false;this.pendingInitialPlacement=false;
    this.calibrationFromGameover=false;
    this.pendingChance=null;this.challenge.stop();this.hud.hide();
    this.controls.keys.clear();this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts();this.accumulator=0;
    this.interface.show(false,this.controls);this.calibrationPanel.hide();
    this.ui.launcher.hidden=false;this.ui.hint.hidden=true;this.audio.pause(true);this.syncPage();
  }
  start() {
    // The first tracked pose and calibration must be available before centering a VR player.
    this.pendingInitialPlacement=!this.controls.desktop;this.calibrationCompletePending=false;
    this.calibrationFromGameover=false;
    this.pendingStartWhistle=true;
    this.pendingChance=this.mode==='challenge'?this.challenge.start():null;
    if(this.mode==='freeroam')this.challenge.stop();
    this.goalkeeper.setDifficulty(this.mode==='challenge'?0:null);
    this.goalkeeper.reset();
    this.nets.reset();
    if(this.controls.desktop){
      if(this.pendingChance)this.placeChance(this.pendingChance);
      else{this.controls.place(this.origin,0);this.spawnBall();}
    }
    this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts();this.accumulator=0;this.lastTime=0;
    this.syncBallHistory();this.field.updateBall(this.physics.ball);this.setMenu(false);this.audio.pause(false);
  }
  syncBallHistory(){this.ballBefore.copy(this.physics.ball.position);this.orientationBefore.copy(this.physics.ball.orientation);}
  placeChance(chance) {
    if(!chance)return;
    this.spawnPoint.set(chance.player.x,0,chance.player.z);this.controls.place(this.spawnPoint,chance.yaw);
    this.spawnPoint.set(chance.ball.x,chance.ball.y,chance.ball.z);
    this.audio.resetBall();this.physics.reset(this.spawnPoint);
    this.goalkeeper.setDifficulty(chance.difficulty);this.goalkeeper.reset();this.nets.reset();
    this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts(true);
    this.pendingChance=null;this.accumulator=0;this.syncBallHistory();this.field.updateBall(this.physics.ball);
    this.netVisual.render(1);
    this.syncPage();
  }
  spawnBall() {
    this.audio.resetBall();
    this.controls.refreshHead();this.spawnPoint.copy(this.controls.headWorld).addScaledVector(this.controls.forward,.72);
    this.spawnPoint.x=footballClamp(this.spawnPoint.x,-FB.halfWidth+.5,FB.halfWidth-.5);
    this.spawnPoint.z=footballClamp(this.spawnPoint.z,-FB.halfLength+.7,FB.halfLength-.7);this.spawnPoint.y=FB.ballRadius+.025;
    this.physics.reset(this.spawnPoint);this.goalkeeper.clearContacts();this.nets.clearContacts(true);this.controls.invalidate();this.syncBallHistory();
  }
  setMenu(show) {
    if(!show&&this.mode==='challenge'&&this.challenge.phase==='gameover'&&!this.calibrationFromGameover)show=true;
    this.menu=show;this.controls.keys.clear();this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts();this.accumulator=0;
    this.interface.show(show&&!this.controls.desktop,this.controls);
    this.ui.launcher.hidden=!(show&&this.controls.desktop);this.ui.hint.hidden=!(this.active&&this.controls.desktop&&!show);
    if(show)document.exitPointerLock?.();this.audio.pause(show||this.paused);this.syncPage();
  }
  beginCalibration() {
    if(this.controls.desktop)return;
    this.calibrationFromGameover=this.mode==='challenge'&&this.challenge.phase==='gameover';
    this.setMenu(false);this.controls.beginCalibration();this.calibrationCompletePending=true;
    this.physics.clearContacts();this.nets.clearContacts();this.accumulator=0;this.controls.invalidate();
  }
  handleEvent(event) {
    const speed=Number.isFinite(event.speed)?Math.max(0,event.speed):null;
    const position=event.position||this.physics.ball.position;
    if(event.type==='touch'){
      this.audio.kick(speed??this.physics.ball.velocity.length(),position);this.controls.pulse(event.footId,.18+Math.min(.5,(event.speed||0)/24));
    }else if(event.type==='frame')this.audio.frame(speed??2,position);
    else if(event.type==='save')this.audio.save(speed??4,position,event.surface);
    else if(event.type==='net'){
      this.audio.net(speed??1,position,event.footId);
      if(event.footId)this.controls.pulse(event.footId,Math.min(.25,.07+(event.speed||0)*.018));
    }
  }
  frame=(milliseconds,frame)=>{
    if(this.disposed)return;
    if(this.contextLost){this.audio.update(this.physics.ball,this.controls,false,0);return;}
    const now=milliseconds*.001,rawDt=this.lastTime?now-this.lastTime:0;this.lastTime=now;
    const dt=footballClamp(rawDt,0,.05);
    let audioActive=false;
    if(rawDt>.1){this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts();this.accumulator=0;}
    if(this.active&&!this.paused){
      this.controls.calibrationPaused=this.menu;
      const tracked=this.controls.sample(frame,this.reference,this.session,dt),cal=this.controls.calibration;
      if(!this.controls.desktop&&cal.revision!==this.calibrationRevision&&this.controls.isCalibrated){
        this.calibrationRevision=cal.revision;this.calibrationCompletePending=true;
        this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts();this.accumulator=0;
      }
      const ready=this.controls.isCalibrated&&(this.controls.desktop||!cal.awaitRelease);
      if(tracked&&ready&&!this.menu){
        const needsBall=this.pendingInitialPlacement||this.calibrationCompletePending;
        if(this.pendingInitialPlacement){
          if(this.mode==='challenge')this.placeChance(this.pendingChance);
          else this.controls.place(this.origin,0);
          this.pendingInitialPlacement=false;
        }
        if(this.calibrationCompletePending){
          this.calibrationCompletePending=false;this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts();this.accumulator=0;
          this.controls.pulse('left',.35);this.controls.pulse('right',.35);
          if(this.calibrationFromGameover){this.calibrationFromGameover=false;this.setMenu(true);}
        }
        if(needsBall&&this.mode==='freeroam')this.spawnBall();
      }
      if(this.controls.edges.menu)this.setMenu(!this.menu);
      if(this.controls.edges.calibrate)this.beginCalibration();
      if(this.controls.edges.ball&&this.controls.isCalibrated&&(this.controls.desktop||!this.controls.calibration.awaitRelease)){
        if(this.mode==='challenge'&&this.challenge.phase==='gameover')this.restart();
        else if(this.mode==='freeroam'&&!this.menu)this.spawnBall();
      }
      this.controls.clearEdges();
      const calibrating=!this.controls.isCalibrated||(!this.controls.desktop&&!!this.controls.calibration.awaitRelease);
      const blocked=this.menu||!tracked||calibrating||this.pendingInitialPlacement;
      audioActive=!blocked;
      const roundResult=this.mode==='challenge'&&(this.challenge.phase==='result'||this.challenge.phase==='gameover');
      this.controls.move(dt,blocked||roundResult);this.controls.prepareFeet(dt,blocked);
      if(this.menu)this.interface.point(this.controls);
      if(!blocked){
        const oldAccumulator=this.accumulator;this.accumulator+=dt;
        const count=Math.min(8,Math.floor((this.accumulator+1e-9)/FB.fixedStep));
        for(let step=0;step<count;step++){
          this.syncBallHistory();
          const sampleAlpha=dt>0?footballClamp(((step+1)*FB.fixedStep-oldAccumulator)/dt,0,1):1;
          this.goalkeeper.update(FB.fixedStep,this.physics.ball);
          this.physics.step(FB.fixedStep,this.controls.physicsFeet(sampleAlpha),this.goalkeeper,this.nets,
            this.mode==='challenge'&&!roundResult?this.observeChallengeMotion:null);
          for(const event of this.physics.events)this.handleEvent(event);
          if(this.mode==='challenge'){
            this.modeInput.previous=this.ballBefore;
            const result=this.challenge.update(FB.fixedStep,this.modeInput);
            if(result){this.interface.setState(this.snapshot);this.syncPage();}
            if(this.challenge.phase==='gameover'){this.setMenu(true);break;}
          }
          this.accumulator-=FB.fixedStep;
        }
        if(count===8)this.accumulator=Math.min(this.accumulator,FB.fixedStep);
      }else this.accumulator=0;
      // Rendering interpolates the fixed-step ball without changing its physical position.
      const alpha=footballClamp(this.accumulator/FB.fixedStep,0,1);
      if(blocked){this.ballDraw.copy(this.physics.ball.position);this.renderBall.orientation.copy(this.physics.ball.orientation);}
      else{
        this.ballDraw.lerpVectors(this.ballBefore,this.physics.ball.position,alpha);
        this.renderBall.orientation.slerpQuaternions(this.orientationBefore,this.physics.ball.orientation,alpha);
      }
      // Height, rotation and the contact shadow all use the same rendered pose.
      this.field.updateBall(this.renderBall);
      this.goalkeeper.render(blocked?1:alpha);
      this.netVisual.render(blocked?1:alpha);
      this.calibrationPanel.update(this.controls,!this.menu);
      if(this.mode==='challenge'&&this.challenge.phase==='result'&&this.challenge.resultAge>=1.6&&!blocked){
        this.placeChance(this.challenge.next());
      }
      this.hud.update(this.snapshot,!blocked&&!this.menu,this.controls.desktop,
        this.renderer.xr.isPresenting?this.renderer.xr.getCamera():this.camera);
    }else{
      for(const hand of this.controls.hands){hand.visual.root.visible=false;hand.ray.visible=false;}
      this.calibrationPanel.hide();
      this.hud.hide();
    }
    this.audio.update(this.physics.ball,this.controls,audioActive,dt);
    if(audioActive&&this.pendingStartWhistle&&this.audio.whistle())this.pendingStartWhistle=false;
    this.opticsState.menu=this.menu;this.opticsState.active=this.active;
    this.optics.update(dt,this.opticsState);this.optics.render();
  };
  dispose(){
    if(this.disposed)return;this.disposed=true;this.pendingStartWhistle=false;this.renderer.setAnimationLoop(null);
    this.abort.abort();if(this.session)this.session.end().catch(()=>{});
    this.controls.dispose();this.interface.dispose();this.calibrationPanel.dispose();this.hud.dispose();this.audio.dispose();this.goalkeeper.dispose();this.netVisual.dispose();this.nets.dispose();this.field.dispose();this.optics.dispose();this.renderer.dispose();
  }
}

export { FootballApp };
