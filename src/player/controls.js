import { FT } from "../../vendor/three.js";
import { FB, footballClamp } from "../config.js";

class FootballControls {
  constructor(scene,rig,camera,field) {
    this.scene=scene;this.rig=rig;this.camera=camera;this.field=field;
    this.headLocal=new FT.Vector3(0,1.7,0);this.headOrientation=new FT.Quaternion();
    this.headWorld=new FT.Vector3();this.viewOrientation=new FT.Quaternion();
    this.forward=new FT.Vector3(0,0,-1);this.right=new FT.Vector3(1,0,0);
    this.velocity=new FT.Vector3();this.up=new FT.Vector3(0,1,0);
    this.temp=new FT.Vector3();this.temp2=new FT.Vector3();this.instepQ=new FT.Quaternion();this.shinQ=new FT.Quaternion();
    this.pitchAxis=new FT.Vector3(1,0,0);
    // Player feet may pass through the turf during a low swing. This limit is
    // measured at the actual shoe surface, not at its ankle or contact centre.
    this.floorPenetration=.20;
    this.footAxis=new FT.Vector3();this.contactOffset=new FT.Vector3();
    this.calibration={stage:'floor',progress:0,stable:false,reason:'Touch both controllers to the floor.',floorY:0,revision:0,awaitRelease:true};
    this.calibrationRecord=null;this.calibrationPaused=false;this._captureArmed=false;this._floorHeadHeight=0;
    this._calibrationSqueezed=[false,false];
    this._calibrationTime=0;this._calibrationCount=0;
    this._calibrationAnchor=[new FT.Vector3(),new FT.Vector3(),new FT.Vector3()];
    this._calibrationMean=[new FT.Vector3(),new FT.Vector3(),new FT.Vector3()];
    this._calibrationAnchorQ=[new FT.Quaternion(),new FT.Quaternion()];
    this._calibrationMeanQ=[new FT.Quaternion(),new FT.Quaternion()];
    this._desktopProfile=Object.freeze({length:.91,offset:Object.freeze(new FT.Vector3(0,-.91,0)),correction:Object.freeze(new FT.Quaternion())});
    this.poseValid=false;this.desktop=false;this.desktopPitch=-.78;
    this.poseInverse=new FT.Quaternion();this.poseVector=new FT.Vector3();
    this.trackingHoldSeconds=.12;
    this.keys=new Set();this.kickAge=10;
    this.edges={ball:false,menu:false,calibrate:false};this.left={x:0,y:0};this.turn=0;this.sprint=false;
    this.hands=['left','right'].map((name,index)=>{
      const visual=field.makeFoot(name);scene.add(visual.root);visual.root.visible=false;
      const collider=this.colliderFor(visual);
      const ray=new FT.Mesh(new FT.CylinderGeometry(.002,.002,1,5),new FT.MeshBasicMaterial({color:0xccf191,depthTest:false}));
      ray.renderOrder=50;ray.visible=false;scene.add(ray);
      return {name,index,visual,ray,source:null,tracked:false,ready:false,previousTracked:false,
        inputPresent:false,contactTracked:false,rayTracked:false,poseMode:'none',poseAge:Infinity,hasPose:false,hasRayGrip:false,
        lastPosePosition:new FT.Vector3(),lastPoseOrientation:new FT.Quaternion(),
        rayToGripPosition:new FT.Vector3(),rayToGripOrientation:new FT.Quaternion(),
        length:0,calibrated:false,profile:null,visualProfile:null,colliderOffset:collider.offset,neutralHeight:collider.neutralHeight||.105,instep:false,instepInput:0,instepAmount:0,grip:false,trigger:false,previousTrigger:false,
        lastA:false,lastX:false,lastMenu:false,select:false,
        localPosition:new FT.Vector3(),localOrientation:new FT.Quaternion(),
        rayLocalPosition:new FT.Vector3(),rayLocalOrientation:new FT.Quaternion(),
        rayPosition:new FT.Vector3(),rayOrientation:new FT.Quaternion(),rayDirection:new FT.Vector3(),
        worldPosition:new FT.Vector3(),worldOrientation:new FT.Quaternion(),
        frameStartControllerPosition:new FT.Vector3(),frameTargetControllerPosition:new FT.Vector3(),
        frameStartControllerOrientation:new FT.Quaternion(),frameTargetControllerOrientation:new FT.Quaternion(),
        frameStartOrientation:new FT.Quaternion(),frameTargetOrientation:new FT.Quaternion(),
        frameStartShinOrientation:new FT.Quaternion(),frameTargetShinOrientation:new FT.Quaternion(),
        frameStartDrive:new FT.Vector3(),frameTargetDrive:new FT.Vector3(),
        frameStart:new FT.Vector3(),frameTarget:new FT.Vector3(),sampleVelocity:new FT.Vector3(),
        foot:{id:name,position:new FT.Vector3(),previous:new FT.Vector3(),velocity:new FT.Vector3(),anklePosition:new FT.Vector3(),previousAnklePosition:new FT.Vector3(),ankleVelocity:new FT.Vector3(),orientation:new FT.Quaternion(),previousOrientation:new FT.Quaternion(),angularVelocity:new FT.Vector3(),contactShape:collider.shape||null,contactOffset:collider.offset,radius:collider.radius,halfLength:collider.halfLength,
          drivePosition:new FT.Vector3(),previousDrivePosition:new FT.Vector3(),driveVelocity:new FT.Vector3(),controlOrientation:new FT.Quaternion(),previousControlOrientation:new FT.Quaternion(),controlAngularVelocity:new FT.Vector3(),
          shinContactShape:visual.shinContactShape||visual.shin?.geometry?.userData?.footballShin?.contact||null,shinOrientation:new FT.Quaternion(),previousShinOrientation:new FT.Quaternion(),shinAngularVelocity:new FT.Vector3(),instep:false,instepAmount:0,enabled:false}}
    });
    this.feet=this.hands.map(hand=>hand.foot);this.angularDelta=new FT.Quaternion();
    if(this.feet.some(foot=>foot.contactShape)){const reach=1.02-Math.max(...this.hands.map(h=>h.neutralHeight));this._desktopProfile=Object.freeze({length:reach,offset:Object.freeze(new FT.Vector3(0,-reach,0)),correction:Object.freeze(new FT.Quaternion())});}
    this.abort=new AbortController();
    const listen=(type,fn)=>window.addEventListener(type,fn,{signal:this.abort.signal});
    listen('keydown',event=>{
      if(!this.desktop||event.repeat)return;
      this.keys.add(event.code);
      if(event.code==='KeyB')this.edges.ball=true;
      if(event.code==='KeyX')this.edges.calibrate=true;
      if(event.code==='Escape'||event.code==='KeyM')this.edges.menu=true;
      if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code))event.preventDefault();
    });
    listen('keyup',event=>{this.keys.delete(event.code);});
    listen('blur',()=>{this.keys.clear();this.invalidate();});
  }
  colliderFor(visual) {
    const description=visual.boot?.geometry?.userData?.footballBoot;
    if(description){const c=description.collider;return{radius:c.radius,halfLength:c.halfLength,offset:Object.freeze(new FT.Vector3(...c.offset)),shape:description.contact,neutralHeight:description.spec.neutralAnkleHeight};}
    const p=visual.boot?.geometry?.attributes?.position;
    if(!p)return{radius:.075,halfLength:.095,offset:Object.freeze(new FT.Vector3())};
    let minX=Infinity,maxX=-Infinity,minY=Infinity,minZ=Infinity,maxZ=-Infinity;
    for(let i=0;i<p.count;i++){
      minX=Math.min(minX,p.getX(i));maxX=Math.max(maxX,p.getX(i));minY=Math.min(minY,p.getY(i));minZ=Math.min(minZ,p.getZ(i));maxZ=Math.max(maxZ,p.getZ(i));
    }
    // Fit the rigid contact shape to the actual sole, width and toe/heel span once.
    // The shoe origin is at its ankle, so its contact body sits lower and forwards.
    const radius=footballClamp((maxX-minX)*.5,.04,.10);
    const halfLength=footballClamp((maxZ-minZ)*.5-radius,0,.15);
    return{radius,halfLength,offset:Object.freeze(new FT.Vector3((minX+maxX)*.5,minY+radius,(minZ+maxZ)*.5))};
  }
  setDesktop(enabled) {
    this.desktop=enabled;this.poseValid=false;this.keys.clear();this.velocity.set(0,0,0);this.invalidate();
    this.rig.position.y=-this.floorY;this.resetCalibrationWindow();
    if(enabled){this.headLocal.set(0,1.7,0);this.headOrientation.setFromAxisAngle(new FT.Vector3(1,0,0),this.desktopPitch);}
  }
  get isCalibrated(){return this.desktop||(this.calibration.stage==='ready'&&!!this.calibrationRecord);}
  get floorY(){return this.desktop?0:(this.calibration.stage==='stance'?this.calibration.floorY:(this.calibrationRecord?.floorY||0));}
  stick(x,y) {
    if(!Number.isFinite(x+y))return [0,0];
    const length=Math.hypot(x,y);if(length<=.16)return [0,0];
    const gain=(Math.min(length,1)-.16)/(.84*length);return [x*gain,y*gain];
  }
  button(gamepad,index) {const b=gamepad?.buttons?.[index];return !!(b&&(b.pressed||b.value>.55));}
  buttonValue(gamepad,index) {const b=gamepad?.buttons?.[index];return b?footballClamp(Number.isFinite(b.value)?b.value:Number(!!b.pressed),0,1):0;}
  validPose(pose) {
    const p=pose?.transform?.position,q=pose?.transform?.orientation;
    return !!(p&&q&&Number.isFinite(p.x+p.y+p.z+q.x+q.y+q.z+q.w)&&Math.hypot(q.x,q.y,q.z,q.w)>.5);
  }
  readControllerInput(hand,source) {
    const pad=source.gamepad,connected=hand.source!==source;
    if(connected){
      this.requireCalibrationRelease();hand.ready=false;hand.hasPose=false;hand.hasRayGrip=false;hand.poseAge=Infinity;
      // A newly attached controller may already be held. Start from its live
      // button state; only a subsequent press is an action edge.
      hand.previousTrigger=this.button(pad,0);
      hand.lastA=hand.name==='right'&&this.button(pad,4);
      hand.lastX=hand.name==='left'&&this.button(pad,4);
      hand.lastMenu=hand.name==='left'&&(this.button(pad,5)||this.button(pad,6));
    }
    hand.source=source;hand.inputPresent=true;
    const axes=pad?.axes||[],offset=axes.length>=4?2:0,stick=this.stick(axes[offset]||0,axes[offset+1]||0);
    if(hand.name==='left'){this.left.x=stick[0];this.left.y=stick[1];}else this.turn=stick[0];
    hand.trigger=this.button(pad,0);hand.instep=hand.trigger;hand.instepInput=this.buttonValue(pad,0);hand.grip=this.button(pad,1);
    hand.select=hand.trigger&&!hand.previousTrigger;hand.previousTrigger=hand.trigger;this.sprint=this.sprint||hand.grip;
    const a=hand.name==='right'&&this.button(pad,4),x=hand.name==='left'&&this.button(pad,4),menu=hand.name==='left'&&(this.button(pad,5)||this.button(pad,6));
    if(a&&!hand.lastA)this.edges.ball=true;if(x&&!hand.lastX)this.edges.calibrate=true;if(menu&&!hand.lastMenu)this.edges.menu=true;
    hand.lastA=a;hand.lastX=x;hand.lastMenu=menu;
  }
  sampleControllerPose(hand,frame,reference,dt) {
    const source=hand.source;let grip=null,ray=null;
    // Failure of one space must not discard a valid pose in the other space.
    if(frame&&reference&&source?.gripSpace)try{grip=frame.getPose(source.gripSpace,reference);}catch{}
    if(frame&&reference&&source?.targetRaySpace)try{ray=frame.getPose(source.targetRaySpace,reference);}catch{}
    const gripValid=this.validPose(grip),rayValid=this.validPose(ray),fullGrip=gripValid&&!grip.emulatedPosition,fullRay=rayValid&&!ray.emulatedPosition;
    if(rayValid){
      const p=ray.transform.position,q=ray.transform.orientation;
      hand.rayLocalPosition.set(p.x,p.y,p.z);hand.rayLocalOrientation.set(q.x,q.y,q.z,q.w).normalize();hand.rayTracked=true;
    }
    if(fullGrip){
      const p=grip.transform.position,q=grip.transform.orientation;
      hand.localPosition.set(p.x,p.y,p.z);hand.localOrientation.set(q.x,q.y,q.z,q.w).normalize();hand.poseMode='grip';
      if(fullRay&&!hand.hasRayGrip){
        // Grip and aim spaces differ. Cache their measured rigid transform once
        // per physical input source, never substitute the aim origin as a hand.
        this.poseInverse.copy(hand.rayLocalOrientation).invert();
        hand.rayToGripPosition.copy(hand.localPosition).sub(hand.rayLocalPosition).applyQuaternion(this.poseInverse);
        hand.rayToGripOrientation.copy(this.poseInverse).multiply(hand.localOrientation).normalize();hand.hasRayGrip=true;
      }
    }else if(fullRay&&hand.hasRayGrip){
      hand.localPosition.copy(hand.rayToGripPosition).applyQuaternion(hand.rayLocalOrientation).add(hand.rayLocalPosition);
      hand.localOrientation.copy(hand.rayLocalOrientation).multiply(hand.rayToGripOrientation).normalize();hand.poseMode='ray';
    }
    if(hand.poseMode==='grip'||hand.poseMode==='ray'){
      hand.tracked=true;hand.contactTracked=true;hand.poseAge=0;hand.hasPose=true;
      hand.lastPosePosition.copy(hand.localPosition);hand.lastPoseOrientation.copy(hand.localOrientation);
    }else{
      hand.poseAge+=Math.max(0,Math.min(dt,.05));
      if(hand.hasPose&&hand.poseAge<=this.trackingHoldSeconds){
        // A short visual hold avoids blinking during occlusion. No predicted
        // position is ever allowed to kick, push the net or finish calibration.
        hand.localPosition.copy(hand.lastPosePosition);hand.localOrientation.copy(hand.lastPoseOrientation);
        if(gripValid){const q=grip.transform.orientation;hand.localOrientation.set(q.x,q.y,q.z,q.w).normalize();}
        else if(rayValid&&hand.hasRayGrip)hand.localOrientation.copy(hand.rayLocalOrientation).multiply(hand.rayToGripOrientation).normalize();
        hand.tracked=true;hand.poseMode='hold';
      }
    }
    if(!hand.rayTracked&&fullGrip&&hand.hasRayGrip){
      this.poseInverse.copy(hand.rayToGripOrientation).invert();
      hand.rayLocalOrientation.copy(hand.localOrientation).multiply(this.poseInverse).normalize();
      this.poseVector.copy(hand.rayToGripPosition).applyQuaternion(hand.rayLocalOrientation);
      hand.rayLocalPosition.copy(hand.localPosition).sub(this.poseVector);hand.rayTracked=true;
    }
  }
  sample(frame,reference,session,dt) {
    this.left.x=0;this.left.y=0;this.turn=0;this.sprint=false;
    for(const hand of this.hands){hand.previousTracked=hand.tracked;hand.tracked=false;hand.contactTracked=false;hand.rayTracked=false;hand.inputPresent=false;hand.poseMode='none';hand.select=false;}
    if(this.desktop){this.sampleDesktop(dt);return true;}
    // WebXR gamepad state is independent of whether getPose can locate a hand
    // (or the viewer) this frame. Always read it, including release transitions.
    for(const source of session?.inputSources||[]){
      const hand=this.hands.find(h=>h.name===source.handedness);
      if(!hand||source.hand||source.targetRayMode!=='tracked-pointer'||source.gamepad?.connected===false)continue;
      this.readControllerInput(hand,source);
    }
    for(const hand of this.hands)if(!hand.inputPresent){
      if(hand.source)this.requireCalibrationRelease();
      hand.source=null;hand.hasPose=false;hand.hasRayGrip=false;hand.poseAge=Infinity;hand.ready=false;
      hand.trigger=hand.instep=hand.grip=hand.previousTrigger=hand.lastA=hand.lastX=hand.lastMenu=false;hand.instepInput=0;
    }
    let viewer=null;
    if(frame&&reference)try{viewer=frame.getViewerPose(reference);}catch{}
    this.poseValid=this.validPose(viewer);
    if(!this.poseValid){this.invalidate();this.resetCalibrationWindow();for(const hand of this.hands){hand.visual.root.visible=false;hand.ray.visible=false;}return false;}
    const hp=viewer.transform.position,hq=viewer.transform.orientation;
    this.headLocal.set(hp.x,hp.y,hp.z);this.headOrientation.set(hq.x,hq.y,hq.z,hq.w).normalize();
    for(const hand of this.hands)if(hand.inputPresent){this.sampleControllerPose(hand,frame,reference,dt);if(!hand.previousTracked)hand.ready=false;}
    for(const hand of this.hands)if(!hand.tracked){this.resetFootHistory(hand);hand.foot.enabled=false;hand.ready=false;hand.visual.root.visible=false;}
    this.updateCalibration(dt);
    return true;
  }
  beginCalibration() {
    if(this.desktop)return false;
    this.calibration.stage='floor';this.calibration.progress=0;this.calibration.stable=false;
    this.calibration.reason='Touch both controllers to the floor.';
    for(const hand of this.hands){hand.instepInput=0;hand.instepAmount=0;hand.foot.instep=false;hand.foot.instepAmount=0;}
    this.requireCalibrationRelease();this.invalidate();
    return true;
  }
  // Kept as a deliberate restart entry point, never called automatically by tracking.
  calibrateAll(){return this.beginCalibration();}
  resetCalibrationWindow() {
    this._calibrationTime=0;this._calibrationCount=0;
    if(this.calibration.stage!=='ready'){this.calibration.progress=0;this.calibration.stable=false;}
  }
  requireCalibrationRelease() {
    if(this.desktop||this.calibration.stage==='ready'&&!this.calibration.awaitRelease)return;
    this._captureArmed=false;this.calibration.awaitRelease=true;
    this._calibrationSqueezed[0]=false;this._calibrationSqueezed[1]=false;
    this.resetCalibrationWindow();
  }
  calibrationPoseReason() {
    if(!this.poseValid||!this.hands.every(hand=>hand.tracked&&hand.poseMode==='grip'))return 'Track both controllers.';
    const left=this.hands[0].localPosition,right=this.hands[1].localPosition;
    if(this.calibration.stage==='floor'){
      if(Math.abs(left.y-right.y)>.10)return 'Touch both controllers to the same floor.';
      // Manual calibration tolerates a substantial error in the platform's floor origin.
      // The second stage also requires standing up, so a normal grip cannot finish both stages.
      if(Math.max(left.y,right.y)>.85||Math.min(left.y,right.y)<-1)return 'Touch both controllers to the floor.';
      if(this.headLocal.y-Math.max(left.y,right.y)<.18)return 'Keep the headset above the controllers.';
    }else if(this.calibration.stage==='stance'){
      const floor=this.calibration.floorY;
      if(this.headLocal.y-floor<.95||this.headLocal.y<this._floorHeadHeight+.18)return 'Stand up fully.';
      for(const point of [left,right])if(point.y-floor<.42||point.y>this.headLocal.y-.08)return 'Hold your normal playing grip.';
      if(Math.abs(left.y-right.y)>.32)return 'Hold both hands in your playing position.';
    }
    return '';
  }
  updateCalibration(dt) {
    if(this.desktop)return;
    const calibration=this.calibration;
    const released=this.hands.every(hand=>hand.inputPresent&&hand.instepInput<=.15);
    if(calibration.stage==='ready'){
      // Completing the release after a valid capture is a button transition,
      // not another positional measurement. Occlusion must not trap this gate.
      if(released&&!this.calibrationPaused){this._captureArmed=true;calibration.awaitRelease=false;this._calibrationSqueezed[0]=false;this._calibrationSqueezed[1]=false;}
      calibration.reason=calibration.awaitRelease?'Release both triggers.':'';
      return;
    }
    const tracked=this.poseValid&&this.hands.every(hand=>hand.tracked&&hand.poseMode==='grip');
    // Calibration uses deliberate analog pressure, independently of a device's
    // sometimes hair-trigger `pressed` flag. No progress runs with idle hands.
    if(!tracked||this.calibrationPaused){
      this.requireCalibrationRelease();
      if(calibration.stage!=='ready')calibration.reason=!tracked?'Track both controllers.':'Release both triggers.';
      return;
    }
    if(released){this._captureArmed=true;calibration.awaitRelease=false;this._calibrationSqueezed[0]=false;this._calibrationSqueezed[1]=false;}
    if(calibration.awaitRelease){calibration.reason='Release both triggers.';this.resetCalibrationWindow();return;}
    const reason=this.calibrationPoseReason();
    for(let index=0;index<2;index++){
      const value=this.hands[index].instepInput;
      if(value>=.85)this._calibrationSqueezed[index]=true;
      else if(value<=.65)this._calibrationSqueezed[index]=false;
    }
    const squeezing=this._calibrationSqueezed.every(Boolean);
    if(reason){
      if(squeezing||this._calibrationCount)this.requireCalibrationRelease();
      calibration.reason=reason;this.resetCalibrationWindow();return;
    }
    if(!squeezing){
      // An interrupted hold cannot resume from a partially pressed trigger.
      if(this._calibrationCount&&!released)this.requireCalibrationRelease();
      calibration.reason=calibration.awaitRelease?'Release both triggers.':'Squeeze both triggers.';
      this.resetCalibrationWindow();return;
    }
    let moved=!this._calibrationCount;
    for(let index=0;index<2&&!moved;index++){
      const hand=this.hands[index];
      if(hand.localPosition.distanceToSquared(this._calibrationAnchor[index])>.025**2||hand.localOrientation.angleTo(this._calibrationAnchorQ[index])>.12)moved=true;
    }
    if(this.headLocal.distanceToSquared(this._calibrationAnchor[2])>.045**2)moved=true;
    if(moved){
      this.resetCalibrationWindow();
      for(let index=0;index<2;index++){
        this._calibrationAnchor[index].copy(this.hands[index].localPosition);this._calibrationMean[index].copy(this.hands[index].localPosition);
        this._calibrationAnchorQ[index].copy(this.hands[index].localOrientation);this._calibrationMeanQ[index].copy(this.hands[index].localOrientation);
      }
      this._calibrationAnchor[2].copy(this.headLocal);this._calibrationMean[2].copy(this.headLocal);this._calibrationCount=1;
    }else{
      this._calibrationCount++;const weight=1/this._calibrationCount;
      for(let index=0;index<2;index++){
        this._calibrationMean[index].lerp(this.hands[index].localPosition,weight);this._calibrationMeanQ[index].slerp(this.hands[index].localOrientation,weight);
      }
      this._calibrationMean[2].lerp(this.headLocal,weight);
      this._calibrationTime+=Math.max(0,Math.min(dt,.05));
    }
    calibration.progress=Math.min(1,this._calibrationTime/.30);calibration.stable=calibration.progress>=1;
    calibration.reason='Keep holding.';
    if(this._captureArmed&&calibration.stable)this.captureCalibration();
  }
  captureCalibration() {
    const calibration=this.calibration;
    if(this.desktop||this.calibrationPaused||calibration.stage==='ready')return {ok:false,stage:calibration.stage,reason:calibration.reason};
    const reason=this.calibrationPoseReason();
    if(reason||!calibration.stable||calibration.awaitRelease||!this._captureArmed||!this._calibrationSqueezed.every(Boolean)){
      calibration.reason=reason||(calibration.awaitRelease?'Release both triggers.':'Squeeze both triggers.');
      return {ok:false,stage:calibration.stage,reason:calibration.reason};
    }
    if(calibration.stage==='floor'){
      // Grip-space origins sit a little above the casing touching the real floor.
      calibration.floorY=(this._calibrationMean[0].y+this._calibrationMean[1].y)*.5-.025;
      this._floorHeadHeight=this._calibrationMean[2].y;calibration.stage='stance';
      calibration.reason='Stand up; hold your normal playing grip.';
      this.rig.position.y=-calibration.floorY;
      this.pulse('left',.3);this.pulse('right',.3);
    }else{
      this.temp.set(0,0,-1).applyQuaternion(this.headOrientation);this.temp.y=0;
      const yaw=this.temp.lengthSq()>.01?Math.atan2(-this.temp.x,-this.temp.z):0;
      const neutralFoot=new FT.Quaternion().setFromAxisAngle(this.up,yaw);
      const profiles=[];
      for(let index=0;index<2;index++){
        const length=this._calibrationMean[index].y-calibration.floorY-this.hands[index].neutralHeight;
        if(length<.20||length>1.65){calibration.reason='Hold your normal playing grip.';return {ok:false,stage:calibration.stage,reason:calibration.reason};}
        const inverse=this._calibrationMeanQ[index].clone().invert();
        const offset=new FT.Vector3(0,-length,0).applyQuaternion(inverse);
        const correction=inverse.clone().multiply(neutralFoot);
        const profile=Object.freeze({length,offset:Object.freeze(offset),correction:Object.freeze(correction)});
        profiles.push(profile);
      }
      calibration.revision++;calibration.stage='ready';calibration.progress=1;calibration.stable=true;
      this.calibrationRecord=Object.freeze({floorY:calibration.floorY,headHeight:this._calibrationMean[2].y-calibration.floorY,revision:calibration.revision,profiles:Object.freeze(profiles)});
      for(let index=0;index<2;index++){
        const hand=this.hands[index];hand.profile=profiles[index];hand.length=profiles[index].length;hand.calibrated=true;
        // Confirmation triggers are not a kick and must not retain an old toe tilt.
        hand.instepInput=0;hand.instepAmount=0;hand.foot.instep=false;hand.foot.instepAmount=0;
        hand.visual.setLength(hand.length);hand.visualProfile=hand.profile;
      }
      this.rig.position.y=-calibration.floorY;calibration.reason='Release both triggers.';
    }
    calibration.awaitRelease=true;this._captureArmed=false;this.resetCalibrationWindow();this.invalidate();
    return {ok:true,stage:calibration.stage,reason:calibration.reason};
  }
  sampleDesktop(dt) {
    this.poseValid=true;const key=k=>this.keys.has(k);
    this.left.x=(key('KeyD')?1:0)-(key('KeyA')?1:0);
    this.left.y=(key('KeyS')?1:0)-(key('KeyW')?1:0);
    this.turn=(key('ArrowRight')?1:0)-(key('ArrowLeft')?1:0);
    const length=Math.hypot(this.left.x,this.left.y);if(length>1){this.left.x/=length;this.left.y/=length;}
    this.sprint=key('ShiftLeft')||key('ShiftRight');
    this.kickAge+=dt;
    if(key('Space')&&this.kickAge>1)this.kickAge=0;
    const a=this.kickAge,phase=footballClamp(a/.18,0,1);
    for(const hand of this.hands){
      hand.tracked=true;hand.contactTracked=true;hand.rayTracked=true;hand.poseMode='desktop';hand.localOrientation.identity();hand.rayLocalOrientation.identity();
      const right=hand.name==='right',baseX=right?.16:-.16;
      const active=right&&a<.34;
      const swing=active?(a<.18?-.62+phase*1.3:.68-(a-.18)*4.25):0;
      hand.localPosition.set(baseX,1.02+(active?Math.max(0,Math.sin(phase*Math.PI))*.16:0),-.17-swing);
      hand.instep=key('KeyE');hand.instepInput=Number(hand.instep);
      hand.rayLocalPosition.copy(hand.localPosition);
    }
    this.headOrientation.setFromAxisAngle(new FT.Vector3(1,0,0),this.desktopPitch);
  }
  refreshHead() {
    this.rig.position.y=-this.floorY;
    this.rig.updateMatrixWorld(true);
    this.headWorld.copy(this.headLocal).applyMatrix4(this.rig.matrixWorld);
    this.viewOrientation.copy(this.rig.quaternion).multiply(this.headOrientation);
    this.forward.set(0,0,-1).applyQuaternion(this.viewOrientation);this.forward.y=0;
    if(this.forward.lengthSq()<.01)this.forward.set(0,0,-1).applyQuaternion(this.rig.quaternion);
    this.forward.normalize();this.right.crossVectors(this.forward,this.up).normalize();
    if(this.desktop){this.camera.position.copy(this.headLocal);this.camera.quaternion.copy(this.headOrientation);}
  }
  move(dt,blocked) {
    this.refreshHead();
    if(blocked||!this.poseValid||!this.isCalibrated||(!this.desktop&&this.calibration.awaitRelease)){this.velocity.set(0,0,0);return;}
    const yaw=-this.turn*FB.turnSpeed*dt;
    if(Math.abs(yaw)>1e-6){
      this.temp.copy(this.headWorld);this.rig.rotation.y+=yaw;this.rig.updateMatrixWorld(true);
      this.temp2.copy(this.headLocal).applyMatrix4(this.rig.matrixWorld);
      this.rig.position.x+=this.temp.x-this.temp2.x;this.rig.position.z+=this.temp.z-this.temp2.z;
      this.refreshHead();
    }
    const speed=this.sprint?FB.sprintSpeed:FB.walkSpeed;
    this.temp.copy(this.forward).multiplyScalar(-this.left.y).addScaledVector(this.right,this.left.x);
    const inputLength=this.temp.length();
    if(inputLength>1e-6){
      // Direction follows the stick immediately. Smoothing the velocity vector
      // makes a reversal brake through zero, even while the stick stays fully held.
      const targetSpeed=speed*Math.min(inputLength,1),currentSpeed=this.velocity.length();
      const nextSpeed=currentSpeed+(targetSpeed-currentSpeed)*(1-Math.exp(-24*dt));
      this.velocity.copy(this.temp).multiplyScalar(nextSpeed/inputLength);
    }else{
      this.velocity.multiplyScalar(Math.exp(-18*dt));
      if(this.velocity.lengthSq()<1e-8)this.velocity.set(0,0,0);
    }
    this.rig.position.addScaledVector(this.velocity,dt);this.rig.updateMatrixWorld(true);
    this.temp.copy(this.headLocal).applyMatrix4(this.rig.matrixWorld);
    const bx=FB.halfWidth+5,bz=FB.halfLength+5;
    this.rig.position.x+=footballClamp(this.temp.x,-bx,bx)-this.temp.x;
    this.rig.position.z+=footballClamp(this.temp.z,-bz,bz)-this.temp.z;
    this.refreshHead();
  }
  place(position,yaw=0) {
    this.temp.set(0,0,-1).applyQuaternion(this.headOrientation);
    const localYaw=Math.hypot(this.temp.x,this.temp.z)>.01?Math.atan2(-this.temp.x,-this.temp.z):0;
    this.rig.rotation.set(0,yaw-localYaw,0);this.rig.position.set(0,-this.floorY,0);this.rig.updateMatrixWorld(true);
    this.temp.copy(this.headLocal).applyMatrix4(this.rig.matrixWorld);
    this.rig.position.set(position.x-this.temp.x,-this.floorY,position.z-this.temp.z);
    this.velocity.set(0,0,0);this.invalidate();this.refreshHead();
  }
  prepareFeet(dt,blocked) {
    this.rig.updateMatrixWorld(true);
    for(const hand of this.hands){
      hand.ray.visible=false;
      // Menu aiming can remain available even when the boot has no trusted
      // position. Transform each ray from its fresh local value exactly once.
      if(hand.rayTracked&&this.poseValid){
        hand.rayPosition.copy(hand.rayLocalPosition).applyMatrix4(this.rig.matrixWorld);
        hand.rayOrientation.copy(this.rig.quaternion).multiply(hand.rayLocalOrientation);
        hand.rayDirection.set(0,0,-1).applyQuaternion(hand.rayOrientation);
      }else hand.rayTracked=false;
      if(!hand.tracked||!this.poseValid){this.resetFootHistory(hand);hand.foot.enabled=false;hand.visual.root.visible=false;hand.ready=false;continue;}
      hand.worldOrientation.copy(this.rig.quaternion).multiply(hand.localOrientation);
      hand.worldPosition.copy(hand.localPosition).applyMatrix4(this.rig.matrixWorld);
      hand.frameStartControllerPosition.copy(hand.frameTargetControllerPosition);hand.frameTargetControllerPosition.copy(hand.worldPosition);
      hand.frameStartControllerOrientation.copy(hand.frameTargetControllerOrientation);hand.frameTargetControllerOrientation.copy(hand.worldOrientation);
      const profile=this.desktop?this._desktopProfile:hand.profile;
      const calibrated=this.isCalibrated&&(this.desktop||!this.calibration.awaitRelease);
      if(!profile||!calibrated){this.resetFootHistory(hand);hand.foot.enabled=false;hand.visual.root.visible=false;hand.ready=false;continue;}
      if(hand.visualProfile!==profile){hand.visual.setLength(profile.length);hand.visualProfile=profile;}
      this.temp.copy(profile.offset).applyQuaternion(hand.worldOrientation).add(hand.worldPosition);
      // Impact energy follows the real controller-driven ankle. A clearance
      // adjustment can move the visible pose, but must not invent a foot swing.
      hand.frameStartDrive.copy(hand.frameTargetDrive);hand.frameTargetDrive.copy(this.temp);
      // In the reference's held-up-foot demonstration, full instep extends the
      // toe along the shin, a quarter turn about the ankle. Follow the analog
      // trigger directly; fixed-step pose interpolation handles the sweep.
      hand.instepAmount=footballClamp(hand.instepInput,0,1);
      this.instepQ.setFromAxisAngle(this.pitchAxis,-Math.PI*.5*hand.instepAmount);
      hand.frameStartOrientation.copy(hand.frameTargetOrientation);
      this.shinQ.copy(hand.worldOrientation).multiply(profile.correction);
      hand.frameTargetOrientation.copy(this.shinQ).multiply(this.instepQ);hand.foot.instep=hand.instep;hand.foot.instepAmount=hand.instepAmount;
      this.footAxis.set(0,0,1).applyQuaternion(hand.frameTargetOrientation);
      this.contactOffset.copy(hand.colliderOffset).applyQuaternion(hand.frameTargetOrientation);
      // Preserve the calibrated rigid controller -> ankle path through the turf.
      // Only the lower penetration limit may constrain the calibrated reach.
      const capsuleClearance=hand.foot.radius+hand.foot.halfLength*Math.abs(this.footAxis.y)-this.contactOffset.y+.005;
      const clearance=hand.foot.contactShape?(hand.visual.groundClearance?.(hand.frameTargetOrientation)||hand.neutralHeight):Math.max(.085,capsuleClearance,hand.visual.groundClearance?.(hand.frameTargetOrientation)||0);
      const minimumAnkle=clearance-this.floorPenetration-(hand.foot.contactShape ? .002 : 0);
      this.temp.y=Math.max(minimumAnkle,this.temp.y);
      // At the 20 cm limit, keep the ankle inside the same fixed reach.
      // Above that limit, this leaves controller translation and rotation untouched.
      const rise=this.temp.y-hand.worldPosition.y;
      if(Math.abs(rise)>profile.length+.0001){this.resetFootHistory(hand);hand.foot.enabled=false;hand.visual.root.visible=false;hand.ready=false;continue;}
      const dx=this.temp.x-hand.worldPosition.x,dz=this.temp.z-hand.worldPosition.z;
      const horizontalSquared=dx*dx+dz*dz,maxHorizontalSquared=Math.max(0,profile.length*profile.length-rise*rise);
      if(horizontalSquared>maxHorizontalSquared+1e-10){
        const factor=Math.sqrt(maxHorizontalSquared/horizontalSquared);
        this.temp.x=hand.worldPosition.x+dx*factor;this.temp.z=hand.worldPosition.z+dz*factor;
      }
      hand.frameStart.copy(hand.frameTarget);hand.frameTarget.copy(this.temp);
      hand.frameStartShinOrientation.copy(hand.frameTargetShinOrientation);
      hand.visual.root.position.copy(hand.frameTarget);hand.visual.root.quaternion.copy(hand.frameTargetOrientation);
      hand.visual.setInstep(hand.instep);hand.visual.root.visible=!blocked;
      hand.visual.setEndpoints?.(hand.worldPosition,hand.frameTarget,hand.frameTargetOrientation,this.shinQ);
      // The visible shin has its own ankle-rooted orientation; instep rotates
      // only the boot. Capture that exact pose before fixed-step interpolation.
      hand.frameTargetShinOrientation.copy(this.shinQ);
      if(hand.visual.shin)hand.frameTargetShinOrientation.copy(hand.visual.root.quaternion).multiply(hand.visual.shin.quaternion).normalize();
      // An intentional instep toggle or the calibrated lever's amplified ankle
      // arc is not lost tracking. Validate the source controller pose, before
      // that known lever and boot rotation, plus the independent visible shin.
      if(blocked||!hand.contactTracked||!hand.ready||dt<=0||dt>.08||hand.frameStartControllerPosition.distanceToSquared(hand.frameTargetControllerPosition)>Math.max(.4,dt*22)**2||hand.frameStartControllerOrientation.angleTo(hand.frameTargetControllerOrientation)>Math.max(.75,dt*40)||hand.frameStartShinOrientation.angleTo(hand.frameTargetShinOrientation)>Math.max(.75,dt*40)){
        this.resetFootHistory(hand);hand.ready=!blocked&&hand.contactTracked;hand.foot.enabled=false;
      }else{
        hand.sampleVelocity.subVectors(hand.frameTarget,hand.frameStart).divideScalar(dt);
        hand.foot.enabled=true;
      }
    }
  }
  resetFootHistory(hand) {
    const foot=hand.foot;
    hand.frameStart.copy(hand.frameTarget);hand.sampleVelocity.set(0,0,0);
    hand.frameStartControllerPosition.copy(hand.frameTargetControllerPosition);hand.frameStartControllerOrientation.copy(hand.frameTargetControllerOrientation);
    hand.frameStartDrive.copy(hand.frameTargetDrive);foot.drivePosition.copy(hand.frameTargetDrive);foot.previousDrivePosition.copy(foot.drivePosition);foot.driveVelocity.set(0,0,0);
    foot.controlOrientation.copy(hand.frameTargetControllerOrientation);foot.previousControlOrientation.copy(foot.controlOrientation);foot.controlAngularVelocity.set(0,0,0);
    hand.frameStartOrientation.copy(hand.frameTargetOrientation);foot.orientation.copy(hand.frameTargetOrientation);foot.previousOrientation.copy(foot.orientation);
    foot.anklePosition.copy(hand.frameTarget);foot.previousAnklePosition.copy(foot.anklePosition);foot.ankleVelocity.set(0,0,0);
    this.contactOffset.copy(hand.colliderOffset).applyQuaternion(foot.orientation);foot.position.copy(foot.anklePosition).add(this.contactOffset);foot.previous.copy(foot.position);
    foot.velocity.set(0,0,0);foot.angularVelocity.set(0,0,0);
    hand.frameStartShinOrientation.copy(hand.frameTargetShinOrientation);foot.shinOrientation.copy(hand.frameTargetShinOrientation);foot.previousShinOrientation.copy(foot.shinOrientation);foot.shinAngularVelocity.set(0,0,0);
  }
  measureAngularVelocity(previous,current,output) {
    this.angularDelta.copy(previous).invert().premultiply(current);
    if(this.angularDelta.w<0){this.angularDelta.x*=-1;this.angularDelta.y*=-1;this.angularDelta.z*=-1;this.angularDelta.w*=-1;}
    const sine=Math.hypot(this.angularDelta.x,this.angularDelta.y,this.angularDelta.z),rate=sine>1e-8?2*Math.atan2(sine,Math.max(0,this.angularDelta.w))/(sine*FB.fixedStep):0;
    output.set(this.angularDelta.x*rate,this.angularDelta.y*rate,this.angularDelta.z*rate);
  }
  physicsFeet(alpha1) {
    for(const hand of this.hands){
      hand.foot.previous.copy(hand.foot.position);hand.foot.previousOrientation.copy(hand.foot.orientation);
      hand.foot.previousShinOrientation.copy(hand.foot.shinOrientation);
      hand.foot.previousDrivePosition.copy(hand.foot.drivePosition);
      hand.foot.drivePosition.lerpVectors(hand.frameStartDrive,hand.frameTargetDrive,alpha1);
      hand.foot.driveVelocity.subVectors(hand.foot.drivePosition,hand.foot.previousDrivePosition).multiplyScalar(1/FB.fixedStep);
      hand.foot.previousControlOrientation.copy(hand.foot.controlOrientation);
      hand.foot.controlOrientation.slerpQuaternions(hand.frameStartControllerOrientation,hand.frameTargetControllerOrientation,alpha1);
      this.measureAngularVelocity(hand.foot.previousControlOrientation,hand.foot.controlOrientation,hand.foot.controlAngularVelocity);
      hand.foot.previousAnklePosition.copy(hand.foot.anklePosition);
      hand.foot.anklePosition.lerpVectors(hand.frameStart,hand.frameTarget,alpha1);
      hand.foot.ankleVelocity.subVectors(hand.foot.anklePosition,hand.foot.previousAnklePosition).multiplyScalar(1/FB.fixedStep);
      hand.foot.position.copy(hand.foot.anklePosition);
      hand.foot.orientation.slerpQuaternions(hand.frameStartOrientation,hand.frameTargetOrientation,alpha1);
      hand.foot.shinOrientation.slerpQuaternions(hand.frameStartShinOrientation,hand.frameTargetShinOrientation,alpha1);
      this.measureAngularVelocity(hand.foot.previousOrientation,hand.foot.orientation,hand.foot.angularVelocity);
      this.measureAngularVelocity(hand.foot.previousShinOrientation,hand.foot.shinOrientation,hand.foot.shinAngularVelocity);
      this.contactOffset.copy(hand.colliderOffset).applyQuaternion(hand.foot.orientation);hand.foot.position.add(this.contactOffset);
      // Keep translation and rotation separate. Clipping the centre velocity
      // first corrupts the recovered ankle motion when the shoe rotates quickly.
      // The collision solver bounds the final velocity at the contact surface.
      hand.foot.velocity.subVectors(hand.foot.position,hand.foot.previous).multiplyScalar(1/FB.fixedStep);
    }
    return this.feet;
  }
  showRay(hand,point) {
    hand.ray.visible=true;hand.ray.position.addVectors(hand.rayPosition,point).multiplyScalar(.5);
    this.temp.subVectors(point,hand.rayPosition);hand.ray.scale.y=this.temp.length();
    if(this.temp.lengthSq()>1e-8)hand.ray.quaternion.setFromUnitVectors(this.up,this.temp.normalize());
  }
  pulse(footId,strength=.25) {
    const actuator=this.hands.find(hand=>hand.name===footId)?.source?.gamepad?.hapticActuators?.[0];
    if(actuator?.pulse)try{const p=actuator.pulse(footballClamp(strength,0,1),35);p?.catch?.(()=>{});}catch{}
  }
  invalidate(){this.requireCalibrationRelease();for(const hand of this.hands){this.resetFootHistory(hand);hand.ready=false;hand.foot.enabled=false;hand.poseAge=this.trackingHoldSeconds;}this.velocity.set(0,0,0);}
  clearEdges(){this.edges.ball=false;this.edges.menu=false;this.edges.calibrate=false;}
  dispose(){this.abort.abort();for(const hand of this.hands){hand.ray.geometry.dispose();hand.ray.material.dispose();hand.ray.removeFromParent();hand.visual.root.removeFromParent();}}
}

export { FootballControls };
