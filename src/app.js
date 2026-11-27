import { FT } from "../vendor/three.js";
import { FB, footballClamp, SKY_OPTIONS, THREE_TOUCH_SKIES } from "./config.js";
import { FootballField } from "./world/field.js";
import { FootballSky } from "./world/sky.js";
import { FootballPhysics } from "./physics/ball.js";
import { FootballGoalNets } from "./physics/nets.js";
import { FootballGoalNetVisual } from "./render/net.js";
import { FootballOptics, setOpticalEffects, OPTICS } from "./render/optics.js";
import { FootballMotionSources } from "./render/motion.js";
import { FootballShotTrail } from "./render/shot-trail.js";
import { nativeXRScale } from "./render/xr-resolution.js";
import { FootballGoalkeeper } from "./keeper/keeper.js";
import { FootballControls } from "./player/controls.js";
import { FootballInterface } from "./ui/menu.js";
import { FootballCalibrationPanel } from "./ui/calibration.js";
import { FootballHUD } from "./ui/hud.js";
import { FootballRewardPicker } from "./ui/rewards.js";
import { FootballChallenge } from "./game/challenge.js";
import { normalizeAbilityLevels } from "./game/abilities.js";
import { FootballAbilitySwitcher } from "./ui/ability-switcher.js";
import { FootballAudio } from "./audio.js";
import { TURN_SPEED, VR_RESOLUTION_OPTIONS, normalizeSettings, readSettings, saveSettings } from "./settings.js";

const PRACTICE_STORAGE = 'first-touch.practice-abilities.v1';
function readPracticeLevels() {
  try {return normalizeAbilityLevels(JSON.parse(localStorage.getItem(PRACTICE_STORAGE)||'{}'));}
  catch {return normalizeAbilityLevels({});}
}

class FootballApp {
  constructor(menuPages) {
    this.settings=readSettings();this.menuPages=menuPages;
    this.scene=new FT.Scene();this.camera=new FT.PerspectiveCamera(90,1,.035,230);this.rig=new FT.Group();
    this.rig.add(this.camera);this.scene.add(this.rig);
    this.renderer=new FT.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=FT.SRGBColorSpace;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.4));
    this.renderer.xr.enabled=true;this.renderer.xr.setReferenceSpaceType('local-floor');
    if(this.renderer.xr.setFoveation)this.renderer.xr.setFoveation(0);
    this.renderer.domElement.id='pitch-view';document.body.prepend(this.renderer.domElement);
    this.field=new FootballField(this.scene);this.physics=new FootballPhysics();
    this.field.turfMesh.material.color.set(0xc9dacb);
    this.sky=new FootballSky(this.scene);
    this.shotTrail=new FootballShotTrail(this.scene);
    this.nets=new FootballGoalNets();this.netVisual=new FootballGoalNetVisual(this.field,this.nets);
    this.goalkeeper=new FootballGoalkeeper(this.field,-1);
    this.controls=new FootballControls(this.scene,this.rig,this.camera,this.field);
    this.mode='freeroam';this.challenge=new FootballChallenge();this.pendingChance=null;
    this.practice=new FootballChallenge({drafts:false});
    this.practiceLevels=readPracticeLevels();
    this.hasPracticeAbilities=Object.keys(this.practiceLevels).length>0;
    this.practiceSpawn=new FT.Vector3();this.practicePlayer=new FT.Vector3();this.practiceYaw=0;
    this.freeSnapshot={mode:'freeroam',phase:'ready',score:0,lives:3,touches:3,round:0,outcome:null};
    this.modeInput={ball:this.physics.ball,previous:null,events:this.physics.events,keeper:this.goalkeeper};
    this.observeChallengeMotion=(previous,current,radius,events)=>this.activeRules?.observeMotion(previous,current,radius,events);
    const creditsPage=document.querySelector('#credits-page');
    const credits={
      attribution:Array.from(creditsPage.querySelectorAll('.credits-attribution span'),line=>line.textContent),
      thanksTitle:creditsPage.querySelector('h3').textContent,
      thanks:Array.from(creditsPage.querySelectorAll('li'),line=>line.textContent)
    };
    this.audio=new FootballAudio();this.interface=new FootballInterface(this.scene,{
      resume:()=>this.setMenu(false),calibrate:()=>this.beginCalibration(),exit:()=>this.exit(),
      freeroam:()=>this.selectMode('freeroam'),challenge:()=>this.selectMode('challenge'),restart:()=>this.restart(),
      settings:()=>this.setMenuPage('settings'),'settings-back':()=>this.setMenuPage('main'),
      credits:()=>this.setMenuPage('credits'),'credits-back':()=>this.setMenuPage('settings'),
      abilities:()=>this.setMenuPage('abilities'),'abilities-back':()=>this.setMenuPage('settings'),
      'ability-level':(id,level)=>this.setPracticeLevels({...this.practiceLevels,[id]:level}),
      'abilities-clear':()=>this.setPracticeLevels({}),
      'turn-down':()=>this.changeSettings({turnSpeed:this.settings.turnSpeed-TURN_SPEED.step}),
      'turn-up':()=>this.changeSettings({turnSpeed:this.settings.turnSpeed+TURN_SPEED.step}),
      'toggle-chromatic':()=>this.changeSettings({chromatic:!this.settings.chromatic}),
      'toggle-noise':()=>this.changeSettings({noise:!this.settings.noise}),
      'toggle-shot-trace':()=>this.changeSettings({shotTrace:!this.settings.shotTrace}),
      'vr-resolution':value=>this.changeSettings({vrResolution:value}),
      'toggle-wind':()=>this.changeSettings({wind:this.settings.wind==='normal'?'heavy':'normal'}),
      'stadium-prev':()=>this.cycleStadium(-1),'stadium-next':()=>this.cycleStadium(1)
    },credits);
    this.calibrationPanel=new FootballCalibrationPanel(this.camera);
    this.hud=new FootballHUD(this.camera);
    this.rewardPicker=new FootballRewardPicker(this.scene,(id,hand)=>this.chooseReward(id,hand));
    this.optics=new FootballOptics(this.renderer,this.scene,this.camera);
    this.motion=new FootballMotionSources(this.field,this.controls,this.goalkeeper);
    this.optics.setMotionSources(this.motion.sources);this.optics.setHUD(this.hud.mesh);
    this.opticsState={menu:false,active:false};this.timeScale=1;
    this.active=false;this.menu=false;this.pending=false;this.pendingInitialPlacement=false;
    this.session=null;this.reference=null;this.paused=false;this.contextLost=false;this.disposed=false;
    this.lastTime=0;this.accumulator=0;this.calibrationRevision=0;this.calibrationCompletePending=false;
    this.calibrationFromGameover=false;
    this.rewardAwaitRelease=false;
    this.pendingStartWhistle=false;
    this.abort=new AbortController();this.spawnPoint=new FT.Vector3();this.origin=new FT.Vector3();
    this.ballBefore=new FT.Vector3();this.ballDraw=new FT.Vector3();this.orientationBefore=new FT.Quaternion();
    this.renderBall={position:this.ballDraw,orientation:new FT.Quaternion(),radius:FB.ballRadius};
    this.ui={launcher:document.querySelector('#launcher'),status:document.querySelector('#status'),enter:document.querySelector('#enter-vr'),
      desktop:document.querySelector('#desktop'),resume:document.querySelector('#resume'),exit:document.querySelector('#exit'),
      hint:document.querySelector('#desktop-hint'),restart:document.querySelector('#restart'),
      modes:document.querySelector('#mode-select'),freeroam:document.querySelector('#mode-freeroam'),challenge:document.querySelector('#mode-challenge'),
      pauseLabel:document.querySelector('#pause-label'),pauseScore:document.querySelector('#pause-score'),
      settings:menuPages.settingsButton,
      turnSpeed:document.querySelector('#turn-speed'),turnSpeedValue:document.querySelector('#turn-speed-value'),
      chromatic:document.querySelector('#toggle-chromatic'),noise:document.querySelector('#toggle-noise'),wind:document.querySelector('#toggle-wind'),
      shotTrace:document.querySelector('#toggle-shot-trace'),
      vrResolution:document.querySelector('#vr-resolution'),
      stadium:document.querySelector('#stadium'),stadiumRow:document.querySelector('#freeroam-stadium-row')};
    this.ui.stadium.append(...SKY_OPTIONS.map(sky=>new Option(sky.name,sky.id)));
    this.ui.vrResolution.append(...VR_RESOLUTION_OPTIONS.map(({scale,label})=>new Option(label,String(scale))));
    this.abilitySwitcher=new FootballAbilitySwitcher(document.querySelector('#abilities-page'),{
      change:(id,level)=>this.setPracticeLevels({...this.practiceLevels,[id]:level}),
      clear:()=>this.setPracticeLevels({})
    });
    this.abilitySwitcher.setLevels(this.practiceLevels);
    this.interface.setAbilityLevels(this.practiceLevels);
    const on=(el,event,fn)=>el?.addEventListener(event,fn,{signal:this.abort.signal});
    on(this.ui.enter,'click',()=>this.enterVR());on(this.ui.desktop,'click',()=>this.enterDesktop());
    on(this.ui.resume,'click',()=>this.setMenu(false));on(this.ui.exit,'click',()=>this.exit());
    on(this.ui.restart,'click',()=>this.restart());
    on(this.ui.freeroam,'click',()=>this.selectMode('freeroam'));on(this.ui.challenge,'click',()=>this.selectMode('challenge'));
    on(this.ui.turnSpeed,'input',()=>this.changeSettings({turnSpeed:Number(this.ui.turnSpeed.value)}));
    on(this.ui.chromatic,'click',()=>this.changeSettings({chromatic:!this.settings.chromatic}));
    on(this.ui.noise,'click',()=>this.changeSettings({noise:!this.settings.noise}));
    on(this.ui.shotTrace,'click',()=>this.changeSettings({shotTrace:!this.settings.shotTrace}));
    on(this.ui.vrResolution,'change',()=>this.changeSettings({vrResolution:Number(this.ui.vrResolution.value)}));
    on(this.ui.wind,'click',()=>this.changeSettings({wind:this.settings.wind==='normal'?'heavy':'normal'}));
    on(this.ui.stadium,'change',()=>{
      if(this.mode==='freeroam')this.changeSettings({stadium:this.ui.stadium.value});
    });
    on(window,'keydown',event=>{
      if(event.code==='Escape'&&this.menuPage!=='main'){
        this.controls.edges.menu=false;this.controls.keys.delete('Escape');
        this.setMenuPage(this.menuPages.backPage);event.preventDefault?.();
      }
    });
    on(window,'resize',()=>this.resize());
    on(window,'pagehide',event=>{if(!event.persisted)this.dispose();});
    on(document,'visibilitychange',()=>{
      if(!this.session){this.paused=document.hidden;if(this.paused)this.rewardPicker.suspend();this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts();this.motion.reset();this.accumulator=0;this.lastTime=0;this.audio.pause(this.paused||!this.active);}
    });
    on(this.renderer.domElement,'webglcontextlost',event=>{
      event.preventDefault();this.contextLost=true;this.rewardPicker.suspend();this.controls.invalidate();this.motion.reset();this.audio.pause(true);
      this.ui.status.textContent='Graphics interrupted. Reload.';this.ui.launcher.hidden=false;
    });
    on(this.renderer.domElement,'webglcontextrestored',()=>{
      this.contextLost=false;this.lastTime=0;this.accumulator=0;this.physics.clearContacts();this.nets.clearContacts();this.motion.reset();
      this.ui.status.textContent='';this.ui.launcher.hidden=this.active&&(!this.menu||!this.controls.desktop);
      this.audio.pause(this.paused||!this.active);
    });
    on(this.renderer.domElement,'click',()=>{
      if(this.active&&this.controls.desktop&&!this.menu&&!this.rewardActive){
        if(document.pointerLockElement!==this.renderer.domElement)this.renderer.domElement.requestPointerLock?.();
        else if(this.controls.kickAge>.7)this.controls.kickAge=0;
      }
    });
    on(window,'mousemove',event=>{
      if(this.controls.desktop&&this.active&&!this.menu&&!this.rewardActive&&document.pointerLockElement===this.renderer.domElement){
        const yaw=-(event.movementX||0)*.0023*this.controls.turnSpeedMultiplier;
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
    this.applySettings();this.setMenuPage(menuPages.page,false);
    this.resize();this.syncPage();this.detectVR();this.renderer.setAnimationLoop(this.frame);
  }
  resize(){const w=window.innerWidth||1280,h=window.innerHeight||720;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  get activeRules(){return this.mode==='challenge'?this.challenge:this.hasPracticeAbilities&&this.practice.active?this.practice:null;}
  get snapshot(){return this.activeRules?.snapshot??this.freeSnapshot;}
  get menuPage(){return this.menuPages.page;}
  get rewardActive(){return this.mode==='challenge'&&this.challenge.phase==='reward';}
  applySettings() {
    const settings=this.settings;
    if(this.mode==='freeroam')this.applyModeSky();
    this.controls.turnSpeedMultiplier=settings.turnSpeed;this.optics.setEffects(settings);this.audio.setWind(settings.wind);
    for(const material of [this.interface.root.material,this.calibrationPanel.mesh.material,this.hud.mesh.material,this.rewardPicker.root.material])setOpticalEffects(material,settings);
    this.interface.setSettings(settings);
    this.ui.turnSpeed.value=String(settings.turnSpeed);
    this.ui.turnSpeed.setAttribute('aria-valuetext',settings.turnSpeed+' times');
    this.ui.turnSpeedValue.value=settings.turnSpeed+'×';this.ui.turnSpeedValue.textContent=settings.turnSpeed+'×';
    if(!settings.shotTrace)this.shotTrail.clear();
    for(const [element,enabled]of [[this.ui.chromatic,settings.chromatic],[this.ui.noise,settings.noise],[this.ui.shotTrace,settings.shotTrace]]){
      element.setAttribute('aria-checked',String(enabled));element.textContent=enabled?'On':'Off';
    }
    this.ui.launcher.dataset.chromatic=String(settings.chromatic);
    const wind=settings.wind==='heavy'?'Heavy':'Normal';
    this.ui.wind.textContent=wind;this.ui.wind.dataset.wind=settings.wind;
    this.ui.wind.setAttribute('aria-label','Wind: '+wind+'. Switch to '+(settings.wind==='heavy'?'Normal':'Heavy'));
    this.ui.stadium.value=settings.stadium;
    this.ui.vrResolution.value=String(settings.vrResolution);
  }
  changeSettings(patch) {
    const next=normalizeSettings({...this.settings,...patch}),old=this.settings;
    if(next.turnSpeed===old.turnSpeed&&next.chromatic===old.chromatic&&next.noise===old.noise&&
      next.wind===old.wind&&next.stadium===old.stadium&&next.shotTrace===old.shotTrace&&next.vrResolution===old.vrResolution)return;
    this.settings=next;this.applySettings();saveSettings(next);
  }
  applyModeSky(reveal=false) {
    const completed=this.active?this.challenge.acceptedRewardCount:0;
    const skyId=this.mode==='freeroam'?this.settings.stadium:THREE_TOUCH_SKIES[completed%THREE_TOUCH_SKIES.length].id;
    const index=SKY_OPTIONS.findIndex(sky=>sky.id===skyId);
    if(this.sky.currentIndex===index)return;
    this.sky.set(index);
    this.field.setSkyLighting(this.sky.lighting,this.sky.horizonLight);
    this.netVisual.setSkyLighting(this.field.pitchLighting.flood.value);
    if(reveal)this.optics.revealSky();
  }
  cycleStadium(direction) {
    if(this.mode!=='freeroam')return;
    const current=SKY_OPTIONS.findIndex(sky=>sky.id===this.settings.stadium);
    const index=(current+direction+SKY_OPTIONS.length)%SKY_OPTIONS.length;
    this.changeSettings({stadium:SKY_OPTIONS[index].id});
  }
  setMenuPage(page,focus=true) {
    if(page==='abilities'&&this.mode!=='freeroam')return;
    if(page!=='main'&&this.pending)return;
    if(page!=='main'&&this.active&&!this.menu&&!this.contextLost)this.setMenu(true);
    this.interface.setPage(page);
    this.menuPages.setPage(page,focus);
  }
  syncPage() {
    const over=this.mode==='challenge'&&this.challenge.phase==='gameover';
    this.abilitySwitcher.setEnabled(this.mode==='freeroam');
    this.ui.stadiumRow.hidden=this.ui.stadium.disabled=this.mode!=='freeroam';
    this.ui.resume.hidden=!this.active||over;this.ui.exit.hidden=!this.active;
    this.ui.enter.hidden=this.active;this.ui.desktop.hidden=this.active;
    this.ui.restart.hidden=!this.active||this.mode!=='challenge';
    this.ui.restart.textContent=over?'Again':'Restart';
    this.ui.hint.hidden=!(this.active&&this.controls.desktop&&!this.menu&&!this.rewardActive);
    this.ui.pauseLabel.textContent=over?'RUN OVER':'SLOW MOTION';
    this.ui.pauseScore.textContent=this.mode==='challenge'?String(this.snapshot.score)+' GOALS':'';
    this.ui.launcher.dataset.active=String(this.active);this.ui.launcher.dataset.mode=this.mode;
    this.ui.launcher.dataset.input=this.active&&this.controls.desktop?'desktop':'vr';
    this.ui.launcher.dataset.phase=this.snapshot.phase;
    this.ui.freeroam.setAttribute('aria-pressed',String(this.mode==='freeroam'));
    this.ui.challenge.setAttribute('aria-pressed',String(this.mode==='challenge'));
    this.interface.setState(this.snapshot);
  }
  setPracticeLevels(levels) {
    if(this.mode!=='freeroam')return;
    const next=normalizeAbilityLevels(levels),ids=Object.keys(next);
    if(ids.length===Object.keys(this.practiceLevels).length&&ids.every(id=>next[id]===this.practiceLevels[id]))return;
    this.practiceLevels=next;this.hasPracticeAbilities=ids.length>0;
    this.abilitySwitcher.setLevels(this.practiceLevels);
    this.interface.setAbilityLevels(this.practiceLevels);
    try {localStorage.setItem(PRACTICE_STORAGE,JSON.stringify(this.practiceLevels));} catch {}
    if(this.active) {
      if(this.practice.active){
        this.practice.setPracticeBuild(this.practiceLevels);
      }else if(this.hasPracticeAbilities){
        this.practice.practiceBall(this.practiceLevels);
      }
      this.applyChallengeEffects();
    }
    this.syncPage();
  }
  selectMode(mode) {
    if(mode!=='freeroam'&&mode!=='challenge'||this.pending)return;
    if(mode===this.mode){this.syncPage();return;}
    this.mode=mode;
    if(this.active)this.start();else{this.applyModeSky();this.syncPage();}
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
    if(this.pending||this.session||!navigator.xr)return;this.pending=true;this.ui.enter.disabled=true;this.ui.desktop.disabled=true;this.ui.settings.disabled=true;this.ui.status.textContent='Starting VR…';
    try{
      const sessionRequest=navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor']});
      // Both requests occur inside the entry gesture, before either is awaited.
      this.audio.start();
      const session=await sessionRequest;
      if(this.disposed){await session.end();return;}
      this.session=session;session.addEventListener('end',this.onSessionEnd);session.addEventListener('visibilitychange',this.onXRVisibility);
      const nativeScale=await nativeXRScale(session,this.renderer.getContext());
      if(this.disposed||this.session!==session)return;
      this.renderer.xr.setFramebufferScaleFactor(nativeScale*this.settings.vrResolution);
      await this.renderer.xr.setSession(session);
      if(this.disposed||this.session!==session)return;
      this.reference=this.renderer.xr.getReferenceSpace();this.reference?.addEventListener('reset',this.onReferenceReset);
      this.controls.setDesktop(false);this.active=true;this.paused=false;this.lastTime=0;
      this.start();this.onXRVisibility();this.ui.status.textContent='';
    }catch(error){
      console.warn('VR session could not start',error);
      if(this.session)try{await this.session.end();}catch{this.onSessionEnd();}
      this.ui.status.textContent='Could not start VR.';
    }finally{this.pending=false;this.ui.enter.disabled=false;this.ui.desktop.disabled=false;this.ui.settings.disabled=false;}
  }
  enterDesktop(){if(this.session||this.pending)return;this.audio.start();this.controls.setDesktop(true);this.active=true;this.paused=false;this.lastTime=0;this.start();}
  onXRVisibility=()=>{
    this.paused=this.session?.visibilityState!=='visible';this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts();
    if(this.paused)this.rewardPicker.suspend();
    this.motion.reset();
    this.accumulator=0;this.lastTime=0;this.audio.pause(this.paused||!this.active);
  };
  onReferenceReset=()=>{this.rewardPicker.suspend();this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts();this.motion.reset();this.accumulator=0;this.lastTime=0;};
  onSessionEnd=()=>{
    this.reference?.removeEventListener('reset',this.onReferenceReset);
    this.session?.removeEventListener('end',this.onSessionEnd);this.session?.removeEventListener('visibilitychange',this.onXRVisibility);
    this.session=null;this.reference=null;this.active=false;this.menu=false;this.paused=false;this.pendingInitialPlacement=false;this.pendingStartWhistle=false;
    this.setMenuPage('main',false);
    this.calibrationFromGameover=false;
    this.pendingChance=null;this.challenge.stop();this.practice.stop();this.hud.hide();this.motion.reset();this.clearChallengePresentation();
    this.interface.show(false,this.controls);this.calibrationPanel.hide();this.controls.setDesktop(true);this.controls.invalidate();
    this.physics.clearContacts();this.nets.clearContacts();this.accumulator=0;this.audio.pause(true);
    this.ui.launcher.hidden=false;this.ui.hint.hidden=true;this.ui.status.textContent='';this.syncPage();this.resize();this.lastTime=0;
  };
  exit(){
    this.pendingStartWhistle=false;
    if(this.session){this.session.end().catch(()=>{this.ui.status.textContent='Use the headset menu to leave VR.';});return;}
    document.exitPointerLock?.();this.active=false;this.menu=false;this.pendingInitialPlacement=false;
    this.setMenuPage('main',false);
    this.calibrationFromGameover=false;
    this.pendingChance=null;this.challenge.stop();this.practice.stop();this.hud.hide();this.motion.reset();this.clearChallengePresentation();
    this.controls.keys.clear();this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts();this.accumulator=0;
    this.interface.show(false,this.controls);this.calibrationPanel.hide();
    this.ui.launcher.hidden=false;this.ui.hint.hidden=true;this.audio.pause(true);this.syncPage();
  }
  start() {
    this.motion.reset();this.clearChallengePresentation();
    this.practice.stop();
    // The first tracked pose and calibration must be available before centering a VR player.
    this.pendingInitialPlacement=!this.controls.desktop;this.calibrationCompletePending=false;
    this.calibrationFromGameover=false;
    this.pendingStartWhistle=true;
    this.pendingChance=this.mode==='challenge'?this.challenge.start():null;
    if(this.mode==='freeroam')this.challenge.stop();
    this.applyModeSky();this.optics.revealSky(false);
    this.applyChallengeEffects();
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
  clearChallengePresentation() {
    this.rewardPicker.hide();this.shotTrail.clear();this.rewardAwaitRelease=false;
  }
  applyChallengeEffects() {
    const effects=this.activeRules?.effects;
    this.physics.setPlayerAbilities(effects);
    this.goalkeeper.setPlayerAbilities(effects);
    this.controls.speedMultiplier=this.activeRules?.movementSpeedMultiplier??1;
  }
  openReward() {
    const choices=this.challenge.beginReward();
    if(!choices)return;
    if(this.controls.desktop)document.exitPointerLock?.();
    this.controls.keys.clear();this.controls.invalidate();this.controls.prepareFeet(0,true);
    this.goalkeeper.clearContacts();this.motion.reset();
    this.rewardPicker.show(choices,this.challenge.rewardPool,this.controls,this.challenge.score);
    this.syncPage();
  }
  chooseReward(id,hand) {
    if(!this.rewardActive||!this.challenge.chooseReward(id))return;
    if(hand)this.controls.pulse(hand,.2);
    this.rewardAwaitRelease=!this.controls.desktop&&this.controls.hands.some(input=>input.trigger);
    this.rewardPicker.hide();this.controls.keys.clear();
    if(this.controls.desktop)this.controls.kickAge=10;
    this.applyModeSky(true);
    this.applyChallengeEffects();
    this.advanceChance();
  }
  advanceChance() {
    this.placeChance(this.challenge.next());
  }
  placeChance(chance) {
    if(!chance)return;
    this.motion.reset();
    this.shotTrail.clear();
    this.spawnPoint.set(chance.player.x,0,chance.player.z);this.controls.place(this.spawnPoint,chance.yaw);
    this.spawnPoint.set(chance.ball.x,chance.ball.y,chance.ball.z);
    this.audio.resetBall();this.physics.reset(this.spawnPoint);
    this.goalkeeper.setDifficulty(chance.difficulty);this.goalkeeper.reset();
    // Automatic chances advance after this frame's feet were prepared. Move
    // the scene-root leg meshes now, then seed zero-motion contact histories
    // before the new rig position can be rendered or used by the next step.
    this.controls.prepareFeet(0,this.rewardAwaitRelease);
    this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts(true);
    this.pendingChance=null;this.accumulator=0;this.syncBallHistory();this.field.updateBall(this.physics.ball);
    this.netVisual.render(1);
    this.syncPage();
  }
  spawnBall() {
    this.motion.reset();
    this.audio.resetBall();
    this.shotTrail.clear();
    const retry=this.hasPracticeAbilities&&this.practice.active&&this.practice.outcome==='retry';
    if(retry){
      this.controls.place(this.practicePlayer,this.practiceYaw);
      this.spawnPoint.copy(this.practiceSpawn);
    }else{
      this.controls.refreshHead();
      this.practicePlayer.copy(this.controls.headWorld);this.practicePlayer.y=0;
      this.practiceYaw=Math.atan2(-this.controls.forward.x,-this.controls.forward.z);
      this.spawnPoint.copy(this.controls.headWorld).addScaledVector(this.controls.forward,.72);
      this.spawnPoint.x=footballClamp(this.spawnPoint.x,-FB.halfWidth+.5,FB.halfWidth-.5);
      this.spawnPoint.z=footballClamp(this.spawnPoint.z,-FB.halfLength+.7,FB.halfLength-.7);
      this.spawnPoint.y=FB.ballRadius+.025;this.practiceSpawn.copy(this.spawnPoint);
    }
    if(this.hasPracticeAbilities||this.practice.active){
      this.practice.practiceBall(this.practiceLevels);this.applyChallengeEffects();
    }
    this.goalkeeper.resetAbilityChance();
    this.physics.reset(this.spawnPoint);this.goalkeeper.clearContacts();this.nets.clearContacts(true);this.controls.invalidate();this.syncBallHistory();
  }
  setMenu(show) {
    if(!show&&this.mode==='challenge'&&this.challenge.phase==='gameover'&&!this.calibrationFromGameover)show=true;
    this.menu=show;this.controls.keys.clear();this.controls.invalidate();this.motion.reset();
    if(show)this.rewardPicker.suspend();
    this.setMenuPage('main',false);
    this.interface.show(show&&!this.controls.desktop,this.controls);
    this.ui.launcher.hidden=!(show&&this.controls.desktop);
    if(show)document.exitPointerLock?.();this.audio.pause(this.paused||!this.active||this.contextLost);this.syncPage();
  }
  beginCalibration() {
    if(this.controls.desktop)return;
    this.rewardPicker.suspend();
    this.calibrationFromGameover=this.mode==='challenge'&&this.challenge.phase==='gameover';
    this.setMenu(false);this.controls.beginCalibration();this.calibrationCompletePending=true;
    this.physics.clearContacts();this.nets.clearContacts();this.accumulator=0;this.controls.invalidate();
  }
  handleEvent(event) {
    const speed=Number.isFinite(event.speed)?Math.max(0,event.speed):null;
    const position=event.position||this.physics.ball.position;
    if(event.type==='touch'){
      this.audio.kick(speed??this.physics.ball.velocity.length(),position);this.controls.pulse(event.footId,.18+Math.min(.5,(event.speed||0)/24));
      if(this.settings.shotTrace&&event.shot&&
        (this.mode==='freeroam'||this.challenge.phase==='ready'||this.challenge.phase==='live')){
        this.shotTrail.start(position);
      }
    }else if(event.type==='frame')this.audio.frame(speed??2,position);
    else if(event.type==='save')this.audio.save(speed??4,position,event.surface);
    else if(event.type==='keeper-contact'){
      if(event.footId){
        this.audio.keeperKick(speed??4,position);
        this.controls.pulse(event.footId,Math.min(.65,.16+(speed??0)*.035));
      }else this.audio.save(speed??4,position,event.surface);
    }else if(event.type==='net'){
      this.audio.net(speed??1,position,event.footId);
      if(event.footId)this.controls.pulse(event.footId,Math.min(.25,.07+(event.speed||0)*.018));
    }
  }
  advanceTime(dt) {
    // The visual transition owns the clock, even with chromatic effects off.
    // Integrate its smoothstep exactly so changing refresh rate does not change
    // the amount of simulated time during opening, closing or a quick reversal.
    const before=this.optics.menuAmount;
    this.opticsState.menu=this.menu||this.rewardActive;this.opticsState.active=this.active;
    this.optics.update(dt,this.opticsState);
    const after=this.optics.menuAmount,blend=after*after*(3-2*after),change=after-before;
    this.timeScale=1-.75*blend;this.audio.setTimeScale(this.timeScale);
    if(Math.abs(change)<1e-12)return dt*this.timeScale;
    const rampTime=Math.min(dt,Math.abs(change)*OPTICS.fadeSeconds);
    const integral=after*after*after*(1-after*.5)-before*before*before*(1-before*.5);
    return Math.max(0,dt-.75*(rampTime*integral/change+(dt-rampTime)*blend));
  }
  simulationFeet(alpha,rate) {
    const feet=this.controls.physicsFeet(alpha);
    if(rate!==1)for(const foot of feet){
      // Real tracked hands keep their real speed as the world eases back in.
      // Fewer simulation steps must not turn one controller swing into a 4x hit.
      foot.velocity.multiplyScalar(rate);foot.driveVelocity.multiplyScalar(rate);
      foot.ankleVelocity.multiplyScalar(rate);foot.locomotionVelocity.multiplyScalar(rate);
      foot.angularVelocity.multiplyScalar(rate);foot.shinAngularVelocity.multiplyScalar(rate);
      foot.controlAngularVelocity.multiplyScalar(rate);
    }
    return feet;
  }
  frame=(milliseconds,frame)=>{
    if(this.disposed)return;
    if(this.contextLost){this.audio.update(this.physics.ball,this.controls,false,0);return;}
    const now=milliseconds*.001,rawDt=this.lastTime?now-this.lastTime:0;this.lastTime=now;
    const dt=footballClamp(rawDt,0,.05);
    let audioActive=false,timeUpdated=false;
    if(rawDt>.1){this.rewardPicker.suspend();this.controls.invalidate();this.physics.clearContacts();this.nets.clearContacts();this.motion.reset();this.accumulator=0;}
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
      // Menu rays follow fresh real-time poses. A selection may resume, restart,
      // exit or recalibrate; resolve it before deciding what can simulate.
      const pointedMenu=this.menu;
      if(pointedMenu){this.controls.refreshHead();this.controls.prepareFeet(dt,true);this.interface.point(this.controls);}
      const simulationDt=this.advanceTime(dt);timeUpdated=true;
      const calibrating=!this.controls.isCalibrated||(!this.controls.desktop&&!!this.controls.calibration.awaitRelease);
      const worldBlocked=!this.active||this.paused||!tracked||calibrating||this.pendingInitialPlacement;
      if(this.rewardAwaitRelease&&tracked&&!this.controls.hands.some(input=>input.trigger))this.rewardAwaitRelease=false;
      const blocked=worldBlocked||this.menu||pointedMenu||this.rewardActive||this.rewardAwaitRelease||this.optics.skyReveal>.16;
      audioActive=!worldBlocked;
      if(this.audio.paused===audioActive)this.audio.pause(!audioActive);
      const roundResult=this.mode==='challenge'&&(this.challenge.phase==='result'||this.challenge.phase==='gameover');
      const rules=this.activeRules;
      this.controls.speedMultiplier=rules?.movementSpeedMultiplier??1;
      this.controls.move(dt,blocked||roundResult);if(!pointedMenu)this.controls.prepareFeet(dt,blocked);
      this.goalkeeper.preparePlayerContact(this.controls.headWorld,dt,blocked||roundResult||rawDt>.1);
      if(!worldBlocked){
        const oldAccumulator=this.accumulator;this.accumulator+=simulationDt;
        const count=Math.min(8,Math.floor((this.accumulator+1e-9)/FB.fixedStep));
        const inputRate=dt>0?simulationDt/dt:1;
        for(let step=0;step<count;step++){
          this.syncBallHistory();
          const sampleAlpha=simulationDt>0?footballClamp(((step+1)*FB.fixedStep-oldAccumulator)/simulationDt,0,1):1;
          this.goalkeeper.update(FB.fixedStep,this.physics.ball);
          const feet=this.simulationFeet(sampleAlpha,inputRate);
          if(!blocked&&!roundResult){
            const impact=this.goalkeeper.collidePlayer(feet,sampleAlpha,inputRate);
            if(impact)this.handleEvent(impact);
          }
          this.physics.step(FB.fixedStep,feet,this.goalkeeper,this.nets,
            rules&&!roundResult&&!this.rewardActive?this.observeChallengeMotion:null);
          for(const event of this.physics.events)this.handleEvent(event);
          this.shotTrail.record(this.physics.ball.position);
          if(rules){
            this.modeInput.previous=this.ballBefore;
            const result=rules.update(FB.fixedStep,this.modeInput);
            if(result){this.interface.setState(this.snapshot);this.syncPage();}
            if(this.mode==='challenge'&&rules.phase==='gameover'&&!this.menu){this.setMenu(true);this.accumulator-=FB.fixedStep;break;}
          }
          this.accumulator-=FB.fixedStep;
        }
        if(count===8)this.accumulator=Math.min(this.accumulator,FB.fixedStep);
      }else this.accumulator=0;
      // Rendering interpolates the fixed-step ball without changing its physical position.
      const alpha=footballClamp(this.accumulator/FB.fixedStep,0,1);
      if(worldBlocked){this.ballDraw.copy(this.physics.ball.position);this.renderBall.orientation.copy(this.physics.ball.orientation);}
      else{
        this.ballDraw.lerpVectors(this.ballBefore,this.physics.ball.position,alpha);
        this.renderBall.orientation.slerpQuaternions(this.orientationBefore,this.physics.ball.orientation,alpha);
      }
      // Height, rotation and the contact shadow all use the same rendered pose.
      this.field.updateBall(this.renderBall);
      this.goalkeeper.render(worldBlocked?1:alpha);
      this.netVisual.render(worldBlocked?1:alpha);
      this.calibrationPanel.update(this.controls,this.active&&!this.menu);
      const rewardInteractive=!worldBlocked&&!this.menu&&!pointedMenu;
      if(this.mode==='challenge'&&this.challenge.phase==='result'&&rewardInteractive){
        if(this.challenge.rewardDue){
          if(this.challenge.resultAge>=.85)this.openReward();
        }else if(this.challenge.resultAge>=1.6){
          // Only starting a new run repairs net damage.
          this.advanceChance();
        }
      }
      if(this.rewardActive)this.rewardPicker.update(dt,this.controls,rewardInteractive);
      this.hud.update(this.snapshot,!worldBlocked&&!this.menu&&!this.rewardActive,this.controls.desktop,
        this.renderer.xr.isPresenting?this.renderer.xr.getCamera():this.camera);
    }else{
      for(const hand of this.controls.hands){hand.visual.root.visible=false;hand.ray.visible=false;}
      this.calibrationPanel.hide();
      this.hud.hide();this.rewardPicker.suspend();
    }
    if(!timeUpdated)this.advanceTime(dt);
    if(this.audio.paused===audioActive)this.audio.pause(!audioActive);
    this.audio.update(this.physics.ball,this.controls,audioActive,dt);
    this.shotTrail.update(audioActive?dt*this.timeScale:0);
    if(audioActive&&this.pendingStartWhistle&&this.audio.whistle())this.pendingStartWhistle=false;
    this.motion.update(dt,this.physics.ball,this.active&&audioActive&&!this.menu&&!this.rewardActive&&!this.paused);
    this.optics.setHUD(this.rewardPicker.root.visible?this.rewardPicker.root:this.hud.mesh);
    this.optics.render();
  };
  dispose(){
    if(this.disposed)return;this.disposed=true;this.pendingStartWhistle=false;this.renderer.setAnimationLoop(null);
    this.abort.abort();if(this.session)this.session.end().catch(()=>{});
    this.abilitySwitcher.dispose();this.rewardPicker.dispose();this.shotTrail.dispose();
    this.sky.dispose();
    this.controls.dispose();this.interface.dispose();this.calibrationPanel.dispose();this.hud.dispose();this.audio.dispose();this.goalkeeper.dispose();this.netVisual.dispose();this.nets.dispose();this.field.dispose();this.optics.dispose();this.renderer.dispose();
  }
}

export { FootballApp };
