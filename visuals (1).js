import { FT } from "../../vendor/three.js";
import { FootballBoots } from "./boots.js";

/* Short floating shins observed in the reference clip. The visible length is
   independent of the calibrated controller-to-ankle reach. Units are metres. */
class FootballPlayerVisuals {
  static shinHeight=.355;
  static _shinContactDescription=null;
  static describeShin(){
    if(!this._shinContactDescription){const geometry=this.prototype.makeShinGeometry();geometry.dispose();}
    return this._shinContactDescription;
  }
  constructor(owner){
    this.owner=owner;this.feet=[];
    this.canvas=this.makeAtlas();this.map=new FT.CanvasTexture(this.canvas);
    this.map.colorSpace=FT.SRGBColorSpace;this.map.anisotropy=4;
    const roughnessMap=new FT.CanvasTexture(this.makeAtlas(true));roughnessMap.anisotropy=2;
    owner.textures.add(this.map);owner.textures.add(roughnessMap);
    this.material=owner.material(new FT.MeshStandardMaterial({map:this.map,roughnessMap,color:0xffffff,roughness:1,metalness:0}));
    this.shinGeometry=owner.geometry(this.makeShinGeometry());
  }
  makeAtlas(rough=false,canvas=document.createElement('canvas')){
    const mint='#16dfb0';
    canvas.width=canvas.height=512;const c=canvas.getContext('2d');
    const cell=(i,fn)=>{c.save();c.translate(i%2*256,Math.floor(i/2)*256);c.beginPath();c.rect(0,0,256,256);c.clip();fn();c.restore();};
    let seed=8731;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const grain=(colour,count=11000,alpha=.07)=>{
      c.fillStyle=colour;c.fillRect(0,0,256,256);
      for(let j=0;j<count;j++){c.fillStyle=random()>.5?`rgba(255,255,255,${alpha})`:`rgba(0,0,0,${alpha})`;c.fillRect(random()*256,random()*256,.6+random()*.6,.6+random()*.6);}
    };
    cell(0,()=>{
      if(rough){c.fillStyle='#ededed';c.fillRect(0,0,256,256);return;}
      grain('#151d1c',12000,.045);
      // Three thin, pale cuff bands wrap all the way around the cut-off sock.
      for(const y of [7,20,33]){c.fillStyle='#dceacb';c.fillRect(0,y,256,7);c.fillStyle='rgba(22,223,176,.18)';c.fillRect(0,y+5,256,2);}
      c.strokeStyle='rgba(255,255,255,.045)';c.lineWidth=.65;
      for(let x=0;x<256;x+=5){c.beginPath();c.moveTo(x,0);c.lineTo(x,256);c.stroke();}

    });
    cell(1,()=>{
      if(rough){c.fillStyle='#c5c5c5';c.fillRect(0,0,256,256);return;}
      grain('#111b18',13000,.045);
      c.fillStyle=mint;c.fillRect(0,0,256,61);
      // Flowing quarters leave a slender, uninterrupted leather vamp. Keep
      // the side panels clean so the atlas cannot turn detail into false logos.
      for(const side of [0,1]){
        c.save();if(side){c.translate(256,0);c.scale(-1,1);}
        c.beginPath();c.moveTo(0,42);c.lineTo(86,42);
        c.bezierCurveTo(72,74,46,112,32,166);c.bezierCurveTo(24,196,16,225,6,245);
        c.lineTo(0,249);c.closePath();c.fill();
        c.beginPath();c.moveTo(76,53);c.bezierCurveTo(57,91,37,139,25,184);
        c.strokeStyle='rgba(5,64,47,.24)';c.lineWidth=1.4;c.stroke();c.restore();
      }
      const leather=c.createLinearGradient(91,0,165,0);leather.addColorStop(0,'rgba(38,58,50,0)');leather.addColorStop(.5,'rgba(57,78,65,.13)');leather.addColorStop(1,'rgba(38,58,50,0)');
      c.fillStyle=leather;c.fillRect(89,64,78,188);
      c.fillStyle='rgba(178,213,191,.04)';
      for(let y=87;y<247;y+=5)for(let x=42;x<216;x+=5){c.beginPath();c.ellipse(x+(y%10?2.5:0),y,.65,.4,0,0,Math.PI*2);c.fill();}
    });
    cell(2,()=>{if(rough){c.fillStyle='#d6d6d6';c.fillRect(0,0,256,256);}else{grain('#070d0c',14000,.065);c.fillStyle='#000000';c.fillRect(0,240,16,16);}});
    cell(3,()=>{c.fillStyle=rough?'#bababa':mint;c.fillRect(0,0,256,256);});
    return canvas;
  }
  makeShinGeometry(){
    const positions=[],normals=[],uvs=[],indices=[],sides=40;
    // Fit the ankle into the enlarged collar, blending back to the original
    // short shin by 10 cm. Calibration never stretches this visible geometry.
    const s=FootballBoots.authorScale;
    const rows=[[.012,.030*s,.0375*s,.012*s],[.05,.031*s,.0375*s,.009*s],[.10,.036,.041,.003],[.15,.043,.045,.003],[.21,.050,.051,.005],[.27,.056,.057,.006],[.315,.057,.059,.005],[.343,.056,.058,.004],[.355,.054,.057,.004]];
    for(let j=0;j<rows.length;j++)for(let i=0;i<=sides;i++){
      const a=(i/sides-.5)*Math.PI*2,row=rows[j],before=rows[Math.max(0,j-1)],after=rows[Math.min(rows.length-1,j+1)],sx=Math.sin(a),cz=Math.cos(a);
      const dx=sx*(after[1]-before[1]),dy=after[0]-before[0],dz=(after[3]-before[3])-cz*(after[2]-before[2]);
      const ax=cz*row[1],az=sx*row[2],nx=dy*az,ny=dz*ax-dx*az,nz=-dy*ax,n=Math.hypot(nx,ny,nz)||1;
      positions.push(sx*row[1],row[0],row[3]-cz*row[2]);normals.push(nx/n,ny/n,nz/n);
      uvs.push((.016+i/sides*.968)/2,1-(.016+(1-row[0]/FootballPlayerVisuals.shinHeight)*.968)/2);
    }
    for(let j=0;j<rows.length-1;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+1,c=a+sides+1,d=c+1;indices.push(a,c,b,b,c,d);}
    // Opaque black top: the reference has a deliberate flat cap, no flesh or thigh.
    const top=rows[rows.length-1],centre=positions.length/3;
    positions.push(0,top[0],top[3]);normals.push(0,1,0);uvs.push(.01,.01);
    for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2;positions.push(Math.sin(a)*top[1],top[0],top[3]-Math.cos(a)*top[2]);normals.push(0,1,0);uvs.push(.01,.01);if(i>0)indices.push(centre,centre+i+1,centre+i);}
    const geometry=new FT.BufferGeometry();geometry.setAttribute('position',new FT.BufferAttribute(new Float32Array(positions),3));geometry.setAttribute('normal',new FT.BufferAttribute(new Float32Array(normals),3));geometry.setAttribute('uv',new FT.BufferAttribute(new Float32Array(uvs),2));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
    // The reference permits contact with the visible shin/cuff. Reuse a convex
    // envelope of this exact mesh, in ankle-origin coordinates, for both legs.
    // It follows the shin's own orientation, independently of boot instep tilt.
    if(!FootballPlayerVisuals._shinContactDescription){
      const b=geometry.boundingBox,data=geometry.attributes.position.array;
      const bounds=Object.freeze({min:Object.freeze(b.min.toArray()),max:Object.freeze(b.max.toArray()),length:b.max.z-b.min.z,width:b.max.x-b.min.x,height:b.max.y-b.min.y});
      let sweepRadius=0;for(let i=0;i<data.length;i+=3)sweepRadius=Math.max(sweepRadius,Math.hypot(data[i],data[i+1],data[i+2]));
      FootballPlayerVisuals._shinContactDescription=Object.freeze({contact:FootballBoots.makeContact(data,bounds,true),bounds,sweepRadius});
    }
    geometry.userData.footballShin=FootballPlayerVisuals._shinContactDescription;return geometry;
  }
  makeFoot(hand){
    const root=new FT.Group();root.name=hand+' calibrated foot';
    const boot=new FT.Mesh(this.owner.geometry(FootballBoots.create(hand)),this.material),shin=new FT.Mesh(this.shinGeometry,this.material);
    boot.name=hand+' boot';shin.name=hand+' short shin';boot.frustumCulled=false;shin.frustumCulled=false;root.add(boot,shin);
    const inverse=new FT.Quaternion(),alignment=new FT.Quaternion(),direction=new FT.Vector3(),referenceUp=new FT.Vector3(),up=new FT.Vector3(0,1,0);
    const foot={root,boot,shin,legMesh:shin,shinContactShape:shin.geometry.userData.footballShin.contact,length:.91,visibleHeight:FootballPlayerVisuals.shinHeight,
      setLength:length=>{foot.length=Math.max(.2,length);},
      setInstep:on=>{boot.userData.instep=!!on;},
      groundClearance:orientation=>FootballBoots.groundClearance(orientation,hand),
      setEndpoints:(controllerWorld,footWorld,footOrientation,shinReferenceOrientation=footOrientation)=>{
        root.position.copy(footWorld);root.quaternion.copy(footOrientation);
        inverse.copy(footOrientation).invert();direction.copy(controllerWorld).sub(footWorld);
        if(direction.lengthSq()>1e-10){
          referenceUp.copy(up).applyQuaternion(shinReferenceOrientation);
          alignment.setFromUnitVectors(referenceUp,direction.normalize());
          shin.quaternion.copy(inverse).multiply(alignment).multiply(shinReferenceOrientation);
        }
        root.updateMatrixWorld(true);
      }
    };this.feet.push(foot);return foot;
  }
  dispose(){for(const foot of this.feet)foot.root.removeFromParent();this.feet.length=0;}
}

export { FootballPlayerVisuals };
