import { FT } from "../../vendor/three.js";

class FootballInterface {
  constructor(scene,callbacks) {
    this.callbacks=callbacks;this.hover=null;this.visible=false;
    this.canvas=document.createElement('canvas');this.canvas.width=768;this.canvas.height=384;
    this.ctx=this.canvas.getContext('2d');this.texture=new FT.CanvasTexture(this.canvas);
    this.texture.colorSpace=FT.SRGBColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=FT.LinearFilter;
    this.root=new FT.Mesh(new FT.PlaneGeometry(1.2,.6),new FT.MeshBasicMaterial({map:this.texture,transparent:true,depthTest:false,depthWrite:false}));
    this.root.visible=false;this.root.frustumCulled=false;this.root.renderOrder=90;scene.add(this.root);
    this.reticle=new FT.Mesh(new FT.SphereGeometry(.008,10,6),new FT.MeshBasicMaterial({color:0xd7f99a,depthTest:false}));
    this.reticle.renderOrder=100;this.reticle.visible=false;scene.add(this.reticle);
    this.buttons=[
      {id:'resume',label:'Resume',x:40,y:104,w:688,h:80},
      {id:'calibrate',label:'Calibrate feet',x:40,y:202,w:334,h:64},
      {id:'exit',label:'Exit VR',x:394,y:202,w:334,h:64}
    ];
    this.localRay=new FT.Vector3();this.localDirection=new FT.Vector3();this.hitPoint=new FT.Vector3();this.inverseQ=new FT.Quaternion();
    this.drawMenu();
  }
  round(ctx,x,y,w,h,r=12){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  drawMenu() {
    const c=this.ctx;c.clearRect(0,0,768,384);this.round(c,0,0,768,384,20);c.fillStyle='#14211f';c.fill();
    c.fillStyle='#d9eeaa';c.font='700 38px sans-serif';c.textAlign='left';c.textBaseline='alphabetic';c.fillText('FIRST TOUCH',40,64);
    for(const b of this.buttons){
      const primary=b.id==='resume',hover=b.id===this.hover;
      this.round(c,b.x,b.y,b.w,b.h,8);c.fillStyle=primary?(hover?'#e6f7c3':'#d8eeaa'):(hover?'#3a5044':'#253830');c.fill();
      c.fillStyle=primary?'#13211b':'#edf2e8';c.font=(primary?'600 34px':'500 27px')+' sans-serif';
      c.textAlign='center';c.textBaseline='middle';c.fillText(b.label,b.x+b.w/2,b.y+b.h/2);
    }
    c.textAlign='left';c.textBaseline='alphabetic';c.fillStyle='#aab9ae';c.font='22px sans-serif';
    c.fillText('L Move  /  R Turn  /  Grip Sprint',40,318);
    c.fillText('Trigger Instep  /  B Ball  /  Y Menu',40,352);
    this.texture.needsUpdate=true;
  }
  show(show,controls) {
    this.visible=show;this.root.visible=show;this.reticle.visible=false;this.hover=null;
    if(show){
      controls.refreshHead();this.root.position.copy(controls.headWorld).addScaledVector(controls.forward,1.65);
      this.root.position.y=controls.headWorld.y-.06;
      this.root.rotation.set(0,Math.atan2(-controls.forward.x,-controls.forward.z),0);
      this.root.updateMatrixWorld(true);this.drawMenu();
    }
  }
  select(id){this.callbacks[id]?.();}
  point(controls) {
    if(!this.visible)return;
    let hover=null;this.reticle.visible=false;this.inverseQ.copy(this.root.quaternion).invert();
    for(const hand of controls.hands){
      if(!(hand.rayTracked??hand.tracked)||controls.desktop)continue;
      this.localRay.copy(hand.rayPosition).sub(this.root.position).applyQuaternion(this.inverseQ);
      this.localDirection.copy(hand.rayDirection).applyQuaternion(this.inverseQ);
      if(this.localDirection.z>=-.0001)continue;
      const distance=-this.localRay.z/this.localDirection.z;
      if(distance<0||distance>8)continue;
      const x=this.localRay.x+this.localDirection.x*distance,y=this.localRay.y+this.localDirection.y*distance;
      if(Math.abs(x)>.6||Math.abs(y)>.3)continue;
      const cx=(x/.6+1)*384,cy=(1-y/.3)*192;
      this.hitPoint.copy(hand.rayDirection).multiplyScalar(distance).add(hand.rayPosition);
      this.reticle.position.copy(this.hitPoint);this.reticle.visible=true;controls.showRay(hand,this.hitPoint);
      const button=this.buttons.find(b=>cx>=b.x&&cx<=b.x+b.w&&cy>=b.y&&cy<=b.y+b.h);
      if(button){hover=button.id;if(hand.select){this.select(button.id);break;}}
    }
    if(hover!==this.hover){this.hover=hover;this.drawMenu();}
  }
  dispose(){for(const mesh of [this.root,this.reticle]){mesh.geometry.dispose();mesh.material.dispose();mesh.removeFromParent();}this.texture.dispose();}
}

export { FootballInterface };
