import { FT } from "../../vendor/three.js";
import { footballClamp } from "../config.js";
import { FootballBoots } from "../player/boots.js";
import { FootballKeeperMeshes } from "./meshes.js";

/* One smooth goalkeeper: pre-baked geometry, fixed-length limbs and shared visual/contact poses. */
class FootballGoalkeeperVisual {
  static boneNames=['pelvis','torso','head','upperArmL','forearmL','handL','upperArmR','forearmR','handR','thighL','shinL','footL','thighR','shinR','footR','elbowL','elbowR','kneeL','kneeR'];
  static rests=[[0,.95,0],[0,.94,0],[0,1.506,0],[-.207,1.435,0],[-.207,1.154,0],[-.207,.895,0],[.207,1.435,0],[.207,1.154,0],[.207,.895,0],[-.095,.95,0],[-.095,.52,0],[-.095,.08,0],[.095,.95,0],[.095,.52,0],[.095,.08,0],[-.207,1.154,0],[.207,1.154,0],[-.095,.52,0],[.095,.52,0]];
  constructor(owner){
    this.owner=owner;this.scale=1.04;this.root=new FT.Group();this.group=this.root;this.root.name='Goalkeeper';owner.root.add(this.root);this.root.scale.setScalar(this.scale);
    this.up=new FT.Vector3(0,1,0);this.down=new FT.Vector3(0,-1,0);this.forward=new FT.Vector3(0,0,-1);this.xAxis=new FT.Vector3(1,0,0);this.zAxis=new FT.Vector3(0,0,1);
    this.v=new FT.Vector3();this.v2=new FT.Vector3();this.v3=new FT.Vector3();this.v4=new FT.Vector3();this.q=new FT.Quaternion();this.q2=new FT.Quaternion();this.bodyQ=new FT.Quaternion();this.yawQ=new FT.Quaternion();this.inverseYaw=new FT.Quaternion();this.hip=new FT.Vector3();this.target=new FT.Vector3();this.leadTarget=new FT.Vector3();this.handCentreLocal=new FT.Vector3(0,-.094,-.009);this.handDirection=new FT.Vector3();this.handPalm=new FT.Vector3();this.handRestPalm=new FT.Vector3();this.handSide=new FT.Vector3();this.handBasis=new FT.Matrix4();
    this.bones=FootballGoalkeeperVisual.boneNames.map((name,i)=>{const b=new FT.Bone();b.name=name;b.position.set(...FootballGoalkeeperVisual.rests[i]);this.root.add(b);return b;});this.bone={};for(let i=0;i<this.bones.length;i++)this.bone[FootballGoalkeeperVisual.boneNames[i]]=this.bones[i];
    const atlas=this.makeAtlas(),map=new FT.CanvasTexture(atlas);map.colorSpace=FT.SRGBColorSpace;map.anisotropy=4;owner.textures.add(map);this.bodyCanvas=atlas;
    this.material=owner.material(new FT.MeshStandardMaterial({map,color:0xffffff,roughness:.93,metalness:0}));
    this.body=new FT.SkinnedMesh(owner.geometry(FootballKeeperMeshes.create('body')),this.material);this.body.name='Smooth black keeper kit';this.body.frustumCulled=false;this.root.add(this.body);
    this.skeleton=new FT.Skeleton(this.bones);this.root.updateMatrixWorld(true);this.body.bind(this.skeleton);
    const bootMap=new FT.CanvasTexture(this.makeBootAtlas());bootMap.colorSpace=FT.SRGBColorSpace;bootMap.anisotropy=4;owner.textures.add(bootMap);this.bootCanvas=bootMap.image;
    this.bootMaterial=owner.material(new FT.MeshStandardMaterial({map:bootMap,color:0xffffff,roughness:.70,metalness:0}));this.hands=[];this.boots=[];
    for(let i=0;i<2;i++){
      const side=i?'R':'L',hand=i?'right':'left',glove=new FT.Mesh(owner.geometry(FootballKeeperMeshes.create(i?'gloveR':'gloveL')),this.material);glove.name=hand+' padded goalkeeper glove';glove.frustumCulled=false;this.root.add(glove);this.hands.push(glove);
      const boot=new FT.Mesh(owner.geometry(this.makeKeeperBoot(hand)),this.bootMaterial);boot.name=hand+' 285 mm black goalkeeper boot';boot.frustumCulled=false;boot.scale.setScalar(1/(FootballBoots.authorScale*this.scale));this.root.add(boot);this.boots.push(boot);
    }
    this.landmarks={};for(const name of ['pelvis','chest','head','handL','handR','wristL','wristR','elbowL','elbowR','shoulderL','shoulderR','hipL','hipR','kneeL','kneeR','ankleL','ankleR','toeL','toeR'])this.landmarks[name]=new FT.Vector3();
    const capsule=(a,b,radius,kind)=>({a:this.landmarks[a],b:this.landmarks[b],radius,kind});
    this.capsules=[capsule('handL','handL',.103,'glove'),capsule('handR','handR',.103,'glove'),capsule('pelvis','chest',.173,'body'),capsule('head','head',.098,'body')];
    for(const s of ['L','R'])this.capsules.push(capsule('shoulder'+s,'elbow'+s,.064,'body'),capsule('elbow'+s,'wrist'+s,.053,'body'),capsule('hip'+s,'knee'+s,.077,'leg'),capsule('knee'+s,'ankle'+s,.055,'leg'),capsule('ankle'+s,'toe'+s,.043,'leg'));
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d'),gradient=c.createRadialGradient(32,32,1,32,32,31);gradient.addColorStop(0,'rgba(0,0,0,.50)');gradient.addColorStop(.5,'rgba(0,0,0,.22)');gradient.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gradient;c.fillRect(0,0,64,64);const shadowMap=new FT.CanvasTexture(canvas);owner.textures.add(shadowMap);this.shadowMaterial=owner.material(new FT.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,side:2,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));this.shadow=new FT.Mesh(owner.geometry(new FT.PlaneGeometry(1,1)),this.shadowMaterial);this.shadow.name='Goalkeeper contact shadow';this.shadow.rotation.x=-Math.PI/2;this.shadow.frustumCulled=false;owner.root.add(this.shadow);
    this._state={position:new FT.Vector3(0,0,-51.9),yaw:Math.PI,phase:'ready',phaseProgress:0,side:1,targetHeight:1,time:0,lateralSpeed:0};this.updatePose(this._state);
  }
  smooth(a,b,x){const t=footballClamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
  mix(a,b,t){return a+(b-a)*t;}
  makeAtlas(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const c=canvas.getContext('2d');
    const colours=['#171b20','#171b20','#181d22','#13171b','#151a1e','#161d22','#baa08c','#101417','#baa08c','#d0d6c9','#3b362d','#252d31','#d0d6c9','#dde1d5','#20282c','#baa08c'];
    let seed=6513;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let k=0;k<16;k++){const x=(k%4)*256,y=Math.floor(k/4)*256;c.save();c.translate(x,y);c.scale(2,2);c.fillStyle=colours[k];c.fillRect(0,0,128,128);
      if(k!==6&&k!==15){for(let j=0;j<1400;j++){c.fillStyle=random()>.5?'rgba(255,255,255,.025)':'rgba(0,0,0,.025)';c.fillRect(random()*128,random()*128,.6,.6);}}
      if([0,1,2,3,4].includes(k)){c.strokeStyle='rgba(125,145,151,.028)';c.lineWidth=.35;for(let xx=5;xx<125;xx+=5){c.beginPath();c.moveTo(xx,0);c.lineTo(xx,128);c.stroke();}c.fillStyle='rgba(0,0,0,.12)';c.fillRect(0,118,128,3);}
      if(k===9){
        // A single continuous backhand panel replaces a triangle-coloured edge.
        c.fillStyle='#293238';c.beginPath();c.moveTo(47,24);c.lineTo(82,24);c.quadraticCurveTo(91,24,92,34);c.lineTo(93,54);c.quadraticCurveTo(93,64,84,68);c.quadraticCurveTo(63,76,43,68);c.quadraticCurveTo(35,64,35,55);c.lineTo(36,35);c.quadraticCurveTo(37,24,47,24);c.closePath();c.fill();
        c.strokeStyle='rgba(104,120,122,.28)';c.lineWidth=.7;c.beginPath();c.moveTo(43,38);c.quadraticCurveTo(64,41,85,38);c.moveTo(42,54);c.quadraticCurveTo(64,59,86,54);c.stroke();
      }
      if(k===12||k===13){c.strokeStyle='rgba(51,67,69,.13)';c.lineWidth=.65;for(let yy=13;yy<120;yy+=22){c.beginPath();c.moveTo(5,yy);c.quadraticCurveTo(64,yy+8,123,yy);c.stroke();}}
      c.restore();}
    return canvas;
  }
  makeKeeperBoot(hand){
    const geometry=FootballBoots.create(hand),uv=geometry.attributes.uv;let cuff=false;
    // The first contiguous accent island is the two outer cuff rings. Keep
    // the collar black while the later lace / stud islands remain slate.
    for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i),accent=u>.5&&v<.5;if(accent){cuff=true;uv.setXY(i,u-.5,v+.5);}else if(cuff)break;}return geometry;
  }
  makeBootAtlas(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');
    for(let k=0;k<4;k++){c.save();c.translate(k%2*256,Math.floor(k/2)*256);c.fillStyle=['#181d20','#20272b','#0c1012','#7c888c'][k];c.fillRect(0,0,256,256);
      if(k===1){const g=c.createLinearGradient(0,0,256,0);g.addColorStop(0,'rgba(0,0,0,.25)');g.addColorStop(.45,'rgba(110,128,135,.15)');g.addColorStop(.6,'rgba(110,128,135,.08)');g.addColorStop(1,'rgba(0,0,0,.25)');c.fillStyle=g;c.fillRect(0,0,256,256);c.strokeStyle='rgba(130,149,156,.20)';c.lineWidth=1.1;for(const sign of [-1,1]){c.beginPath();c.moveTo(128+sign*60,24);c.bezierCurveTo(128+sign*36,70,128+sign*72,155,128+sign*91,231);c.stroke();}c.fillStyle='rgba(190,205,211,.06)';for(let y=76;y<250;y+=7)for(let x=20;x<240;x+=7)c.fillRect(x+(y%14?3:0),y,1,1);}
      c.restore();}return canvas;
  }
  rotate(q,x=0,y=0,z=0){q.setFromAxisAngle(this.up,y);if(x)q.multiply(this.q2.setFromAxisAngle(this.xAxis,x));if(z)q.multiply(this.q2.setFromAxisAngle(this.zAxis,z));return q;}
  solveJoint(root,end,l1,l2,bend,out){
    this.v.subVectors(end,root);let distance=this.v.length();if(distance<.00001)this.v.set(0,-1,0);else this.v.multiplyScalar(1/distance);
    distance=footballClamp(distance,.001,l1+l2-.00002);end.copy(root).addScaledVector(this.v,distance);
    const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
    this.v2.copy(bend).addScaledVector(this.v,-bend.dot(this.v));if(this.v2.lengthSq()<.00001)this.v2.set(0,0,-1);this.v2.normalize();return out.copy(root).addScaledVector(this.v,along).addScaledVector(this.v2,height);
  }
  aimBone(name,from,to){const b=this.bone[name];b.position.copy(from);this.v.subVectors(to,from).normalize();b.quaternion.setFromUnitVectors(this.down,this.v);return b;}
  readyHandQuaternion(wrist,elbow,side,armQuaternion,blend,out){
    // The lowered hands continue the forearms, keeping the wrists neutral.
    // Open palms face into play and slightly toward one another.
    this.handDirection.subVectors(wrist,elbow).normalize();
    this.handPalm.set(-side*.45,0,-1);
    this.handPalm.addScaledVector(this.handDirection,-this.handPalm.dot(this.handDirection));
    if(blend>=.999999)return out.copy(armQuaternion);
    // Blend palm directions in the forearm frame. Keeping them in the same
    // hemisphere prevents a shortest-path quaternion flip on high reaches.
    this.handRestPalm.set(0,0,-1).applyQuaternion(armQuaternion);
    const alignment=this.handPalm.dot(this.handRestPalm);if(alignment<.5)this.handPalm.addScaledVector(this.handRestPalm,.5-alignment);
    this.handPalm.normalize().lerp(this.handRestPalm,blend).normalize();
    this.handSide.crossVectors(this.handDirection,this.handPalm).normalize();
    // A small relaxed wrist angle lets the softly curled fingertips hang down.
    const tilt=.1396263402*(1-blend),cos=Math.cos(tilt),sin=Math.sin(tilt);
    this.v.copy(this.handDirection);this.handDirection.multiplyScalar(cos).addScaledVector(this.handPalm,-sin);
    this.handPalm.multiplyScalar(cos).addScaledVector(this.v,sin);
    this.v.copy(this.handDirection).negate();this.v2.copy(this.handPalm).negate();
    this.handBasis.makeBasis(this.handSide,this.v,this.v2);return out.setFromRotationMatrix(this.handBasis);
  }
  updatePose(state){
    const t=footballClamp(state.phaseProgress||0,0,1),phase=state.phase||'ready',yaw=state.yaw??Math.PI,time=state.time||0,side=state.side>=0?1:-1,dir=side*(Math.cos(yaw)>=0?1:-1),speed=footballClamp(Math.abs(state.lateralSpeed||0)/3,0,1);
    this.root.position.copy(state.position);this.yawQ.setFromAxisAngle(this.up,yaw);this.root.quaternion.copy(this.yawQ);this.inverseYaw.copy(this.yawQ).invert();
    const height=footballClamp((state.targetHeight||1)/this.scale,.13,2.65),rollTarget=this.mix(1.47,.55,this.smooth(.25,2.65,height));
    let roll=0,hipY=.884+Math.sin(time*2.3)*.004,reach=0,settle=0,recover=0,push=0;
    if(phase==='push'){push=this.smooth(0,1,t);hipY-=.124*push;roll=.12*push;}
    else if(phase==='dive'){
      reach=this.smooth(0,.45,t);push=1-reach;settle=this.smooth(.70,1,t);roll=this.mix(.12,rollTarget,reach);roll=this.mix(roll,1.48,settle);
      const flightHip=footballClamp(height-.94*Math.cos(rollTarget)+.06,.30,1.78);hipY=this.mix(.760,flightHip,reach);hipY=this.mix(hipY,.238,settle);
    }else if(phase==='land'){reach=1;settle=1;roll=1.48;hipY=.238-.018*Math.sin(Math.PI*t);}
    else if(phase==='recover'){
      reach=1;settle=1;recover=this.smooth(0,1,t);roll=1.48*(1-this.smooth(0,.65,t));hipY=this.mix(.238,.50,this.smooth(0,.50,t));hipY=this.mix(hipY,.884,this.smooth(.45,1,t));
    }
    const activeDive=reach*(1-recover),lie=settle*(1-recover),gait=(phase==='ready'?speed:phase==='push'?footballClamp(Math.abs(state.takeoffSpeed||0)/3,0,1)*(1-push):0),stride=state.position.x*8,sway=Math.sin(stride)*.012*gait;
    this.hip.set(sway,hipY,0);this.rotate(this.bodyQ,-.09*(1-activeDive),0,-dir*roll);
    this.bone.pelvis.position.copy(this.hip);this.bone.pelvis.quaternion.copy(this.bodyQ);
    this.bone.torso.position.set(0,-.01,0).applyQuaternion(this.bodyQ).add(this.hip);this.bone.torso.quaternion.copy(this.bodyQ);
    this.bone.head.position.set(0,.556,0).applyQuaternion(this.bodyQ).add(this.hip);this.bone.head.quaternion.copy(this.bodyQ).multiply(this.q.setFromAxisAngle(this.xAxis,.045));
    for(let i=0;i<2;i++){
      const s=i?'R':'L',sg=i?1:-1,hand=i?'right':'left',hip=this.bone['thigh'+s].position,ankle=this.bone['foot'+s].position,knee=this.bone['shin'+s].position;
      hip.set(sg*.095,0,0).applyQuaternion(this.bodyQ).add(this.hip);
      ankle.set(sg*.231-Math.cos(stride+i*Math.PI)*.055*gait,.080+Math.max(0,Math.sin(stride+i*Math.PI))*.045*gait,-.018+Math.sin(stride+i*Math.PI)*.03*gait);
      if(activeDive>0){
        this.v3.set(sg*.15,-.76+(sg===dir?.18:0),sg===dir?-.06:.13).applyQuaternion(this.bodyQ).add(this.hip);this.v3.y+=.18*reach;
        // Side landing: one leg folded slightly above the supporting calf.
        this.v4.set(-dir*(sg===dir?.40:.70),sg===dir?.34:.11,sg===dir?-.15:.12);this.v3.lerp(this.v4,settle);ankle.lerp(this.v3,activeDive);
      }
      if(phase==='recover'){
        const kneel=this.smooth(0,.42,t)*(1-this.smooth(.55,1,t));this.v3.set(sg*.18,.080,sg===dir?-.27:.27);ankle.lerp(this.v3,kneel);ankle.lerp(this.v4.set(sg*.231,.080,-.018),this.smooth(.52,1,t));
      }
      this.v3.set(0,.04,-1).applyQuaternion(this.bodyQ);this.solveJoint(hip,ankle,.43,.44,this.v3,knee);
      this.aimBone('thigh'+s,hip,knee);this.aimBone('shin'+s,knee,ankle);
      const footQ=this.bone['foot'+s].quaternion;this.rotate(footQ,-.04,sg*.08,0);if(activeDive>0)footQ.slerp(this.q.copy(this.bodyQ).multiply(this.q2.setFromAxisAngle(this.xAxis,sg===dir?-.27:.24)),activeDive);
      const clearance=FootballBoots.groundClearance(footQ,hand)/(FootballBoots.authorScale*this.scale);ankle.y=Math.max(ankle.y,clearance);
      // Clamp after sole support correction; this keeps the ankle continuous
      // with the shin rather than floating a separately rendered boot.
      this.solveJoint(hip,ankle,.43,.44,this.v3,knee);this.aimBone('thigh'+s,hip,knee);this.aimBone('shin'+s,knee,ankle);
      this.bone['knee'+s].position.copy(knee);this.bone['knee'+s].quaternion.copy(this.bone['thigh'+s].quaternion).slerp(this.bone['shin'+s].quaternion,.5);
      this.boots[i].position.copy(ankle);this.boots[i].quaternion.copy(footQ);
      const shoulder=this.bone['upperArm'+s].position,wrist=this.bone['hand'+s].position,elbow=this.bone['forearm'+s].position;
      shoulder.set(sg*.207,.485,0).applyQuaternion(this.bodyQ).add(this.hip);
      wrist.set(sg*(.32-.035*push),hipY+.13-.025*push,-.34+.035*push);
      if(activeDive>0){
        // Work from the frozen predicted ball point, but solve a fixed-length
        // arm: unreachable shots remain genuinely unreachable.
        if(state.reachTarget)this.leadTarget.copy(state.reachTarget).sub(state.position).applyQuaternion(this.inverseYaw).multiplyScalar(1/this.scale);
        else this.leadTarget.set(dir*.98,height,-.32);
        this.leadTarget.x-=dir*(sg===dir?.015:.065);this.leadTarget.y-=sg===dir?0:.095;this.leadTarget.z+=sg===dir?0:.045;
        this.v3.subVectors(this.leadTarget,shoulder).normalize();this.leadTarget.addScaledVector(this.v3,-.096);
        this.v4.set(dir*.93,.16+(sg===dir?0:.09),-.22+(sg===dir?0:.08));this.leadTarget.lerp(this.v4,settle);wrist.lerp(this.leadTarget,activeDive);
      }
      if(phase==='recover'){
        const support=this.smooth(.08,.30,t)*(1-this.smooth(.48,.84,t));this.v4.set(dir*(sg===dir?.30:.12),sg===dir?.11:.45,sg===dir?-.10:-.30);wrist.lerp(this.v4,support);
      }
      this.v3.set(sg*.40,-.60,-.40).lerp(this.v4.set(sg*.22,-.55,1),activeDive);this.solveJoint(shoulder,wrist,.281,.259,this.v3,elbow);this.aimBone('upperArm'+s,shoulder,elbow);this.aimBone('forearm'+s,elbow,wrist);
      this.readyHandQuaternion(wrist,elbow,sg,this.bone['forearm'+s].quaternion,activeDive,this.bone['hand'+s].quaternion);this.bone['elbow'+s].position.copy(elbow);this.bone['elbow'+s].quaternion.copy(this.bone['upperArm'+s].quaternion).slerp(this.bone['forearm'+s].quaternion,.5);
      this.hands[i].position.copy(wrist);this.hands[i].quaternion.copy(this.bone['hand'+s].quaternion);
    }
    // Collision landmarks and actual skin share the very same authored pose.
    this.root.updateMatrixWorld(true);this.skeleton.update();this.updateLandmarks();
    // Conservative support only during dives / recovery, based on the real
    // anatomical contacts. No hand, head or calf is allowed through the pitch.
    let lift=0;for(const c of this.capsules)lift=Math.max(lift,c.radius-Math.min(c.a.y,c.b.y));
    if(lift>.0001){this.root.position.y+=lift+.001;this.root.updateMatrixWorld(true);this.skeleton.update();this.updateLandmarks();}
    this.shadow.position.set(state.position.x,.017,state.position.z);this.shadow.scale.set(1.05+activeDive*1.9,.72+activeDive*.18,1);this.shadowMaterial.opacity=1-footballClamp((hipY-.85)*.35,0,.45);
  }
  updateLandmarks(){
    const lm=this.landmarks,b=this.bone,to=(name,p)=>lm[name].copy(p).applyMatrix4(this.root.matrixWorld);
    to('pelvis',b.pelvis.position);to('chest',this.v.set(0,.34,0).applyQuaternion(b.torso.quaternion).add(b.torso.position));to('head',this.v.set(0,.18,0).applyQuaternion(b.head.quaternion).add(b.head.position));
    for(let i=0;i<2;i++){const s=i?'R':'L';to('hand'+s,this.v.copy(this.handCentreLocal).applyQuaternion(b['hand'+s].quaternion).add(b['hand'+s].position));to('wrist'+s,b['hand'+s].position);to('elbow'+s,b['forearm'+s].position);to('shoulder'+s,b['upperArm'+s].position);to('hip'+s,b['thigh'+s].position);to('knee'+s,b['shin'+s].position);to('ankle'+s,b['foot'+s].position);to('toe'+s,this.v.set(0,-.035,-.178).applyQuaternion(b['foot'+s].quaternion).add(b['foot'+s].position));}
  }
  dispose(){this.skeleton.dispose();this.root.removeFromParent();this.shadow.removeFromParent();}
}

export { FootballGoalkeeperVisual };
