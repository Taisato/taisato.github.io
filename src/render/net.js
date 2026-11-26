import { FT } from "../../vendor/three.js";
import { footballClamp } from "../config.js";

/* Filtered cord coverage on the actual deformed contact triangles. Panel edges
   share physical node IDs, including the back/roof/sides, and the mouth is open. */
class FootballGoalNetVisual {
  constructor(field,nets){
    this.field=field;this.nets=nets;this.root=new FT.Group();this.root.name='Deformable goal nets';
    field.root.add(this.root);this.goals=[];this.meshes=[];this.disposed=false;
    const image=new Uint8Array(128*128*4),pixel=1/128,half=.002/.13,knot=.0028/.13;
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      const u=(x+.5)/128,v=(y+.5)/128,dx=Math.min(u,1-u),dy=Math.min(v,1-v);
      const a=footballClamp((half+pixel*.5-dx)/pixel,0,1),b=footballClamp((half+pixel*.5-dy)/pixel,0,1);
      const c=footballClamp((knot+pixel*.5-Math.hypot(dx,dy))/pixel,0,1),i=(y*128+x)*4;
      // Bright RGB also in fully transparent pixels prevents dark mip fringes.
      image[i]=image[i+1]=image[i+2]=255;image[i+3]=Math.round(Math.max(a,b,c)*255);
    }
    this.texture=new FT.DataTexture(image,128,128);this.texture.colorSpace=FT.SRGBColorSpace;
    this.texture.wrapS=this.texture.wrapT=1000;this.texture.minFilter=1008;this.texture.magFilter=FT.LinearFilter;
    this.texture.generateMipmaps=true;this.texture.anisotropy=8;this.texture.needsUpdate=true;field.textures.add(this.texture);
    this.material=field.material(new FT.MeshBasicMaterial({map:this.texture,color:0xe8ece0,
      transparent:true,opacity:.9,depthWrite:false,alphaTest:0,side:2,forceSinglePass:true}));
    for(const net of nets.goals)this.goals.push(this._build(net));
    this.render(1);
  }
  _build(net){
    const particles=[],uv=[],indices=[];
    for(const panel of net.panels){
      const base=particles.length,cols=panel.columns,rows=panel.rows;
      for(let v=0;v<=rows;v++)for(let u=0;u<=cols;u++){particles.push(panel.nodes[v*(cols+1)+u]);uv.push(u*2,v*2);}
      for(let v=0;v<rows;v++)for(let u=0;u<cols;u++){
        const a=base+v*(cols+1)+u,b=a+1,c=a+cols+1,d=c+1;
        // The collider uses exactly these same a-b-c / b-d-c triangles.
        indices.push(a,b,c,b,d,c);
      }
    }
    const positions=new Float32Array(particles.length*3),attribute=new FT.BufferAttribute(positions,3);attribute.setUsage(35048);
    const geometry=this.field.geometry(new FT.BufferGeometry());geometry.setAttribute('position',attribute);
    geometry.setAttribute('uv',new FT.BufferAttribute(new Float32Array(uv),2));geometry.setIndex(indices);
    geometry.userData.footballNet={cordDiameter:.004,subdivisions:2,physicalNodes:net.rest.length/3,triangles:indices.length/3};
    const mesh=new FT.Mesh(geometry,this.material);mesh.name=(net.sign<0?'Near':'Far')+' deformable goal net';mesh.frustumCulled=false;
    this.root.add(mesh);this.meshes.push(mesh);
    return{net,mesh,positions,attribute,particles:new Uint16Array(particles),revision:-1,alpha:-1,updates:0};
  }
  render(alpha=1){
    if(this.disposed)return;
    for(const data of this.goals){
      const net=data.net,t=net.sleeping?1:footballClamp(alpha,0,1),revision=net.revision||0;
      if(data.revision===revision&&(net.sleeping||data.alpha===t))continue;
      const current=net.positions,previous=net.renderPrevious||net.previous||current,p=data.positions,ids=data.particles;
      for(let i=0;i<ids.length;i++){
        const source=ids[i]*3,target=i*3;
        p[target]=previous[source]+(current[source]-previous[source])*t;
        p[target+1]=previous[source+1]+(current[source+1]-previous[source+1])*t;
        p[target+2]=previous[source+2]+(current[source+2]-previous[source+2])*t;
      }
      data.attribute.needsUpdate=true;data.revision=revision;data.alpha=t;data.updates++;
    }
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.root.removeFromParent();}
}

export { FootballGoalNetVisual };
