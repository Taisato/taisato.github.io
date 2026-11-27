import { FT } from "../../vendor/three.js";
import { footballClamp } from "../config.js";

const MAX_FRAYS=128,FRAY_SEGMENTS=8,FRAY_SIDES=5;

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
    this.frayMaterial=field.material(new FT.MeshBasicMaterial({color:0xe8ece0,side:2}));
    for(const net of nets.goals)this.goals.push(this._build(net));
    this.render(1);
  }
  setSkyLighting(tint) {
    this.material.color.set(0xe8ece0).multiply(tint);
    this.frayMaterial.color.copy(this.material.color);
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
    const originalIndices=new Uint16Array(indices),index=new FT.BufferAttribute(originalIndices.slice(),1);index.setUsage(35048);
    geometry.setAttribute('uv',new FT.BufferAttribute(new Float32Array(uv),2));geometry.setIndex(index);
    geometry.setDrawRange(0,indices.length);
    geometry.userData.footballNet={cordDiameter:.004,subdivisions:2,physicalNodes:net.rest.length/3,triangles:indices.length/3};
    const mesh=new FT.Mesh(geometry,this.material);mesh.name=(net.sign<0?'Near':'Far')+' deformable goal net';mesh.frustumCulled=false;
    this.root.add(mesh);this.meshes.push(mesh);
    // Edges are keyed by the welded physical nodes, so a tear across a panel
    // seam has one rim. Its dangling ends start on existing texture knots.
    const edgeMap=new Map(),source=net.indices;
    for(let t=0;t<source.length;t+=3)for(let e=0;e<3;e++){
      const a=source[t+e],b=source[t+(e+1)%3],c=source[t+(e+2)%3],key=Math.min(a,b)*4096+Math.max(a,b);
      let edge=edgeMap.get(key);if(!edge){edge={a:Math.min(a,b),b:Math.max(a,b),sides:[]};edgeMap.set(key,edge);}
      edge.sides.push({triangle:t/3,opposite:c});
    }
    const nodeVertex=new Uint16Array(net.rest.length/3);for(let i=0;i<particles.length;i++)nodeVertex[particles[i]]=i;
    const frayPositions=new Float32Array(MAX_FRAYS*(FRAY_SEGMENTS+1)*FRAY_SIDES*3),frayIndices=[];
    for(let f=0;f<MAX_FRAYS;f++)for(let s=0;s<FRAY_SEGMENTS;s++)for(let side=0;side<FRAY_SIDES;side++){
      const a=(f*(FRAY_SEGMENTS+1)+s)*FRAY_SIDES+side,b=(f*(FRAY_SEGMENTS+1)+s)*FRAY_SIDES+(side+1)%FRAY_SIDES;
      frayIndices.push(a,a+FRAY_SIDES,b,b,a+FRAY_SIDES,b+FRAY_SIDES);
    }
    const frayAttribute=new FT.BufferAttribute(frayPositions,3);frayAttribute.setUsage(35048);
    const frayGeometry=this.field.geometry(new FT.BufferGeometry());frayGeometry.setAttribute('position',frayAttribute);frayGeometry.setIndex(frayIndices);frayGeometry.setDrawRange(0,0);
    const frayMesh=new FT.Mesh(frayGeometry,this.frayMaterial);frayMesh.name=mesh.name+' loose cord ends';frayMesh.frustumCulled=false;frayMesh.visible=false;this.root.add(frayMesh);
    return{net,mesh,positions,attribute,particles:new Uint16Array(particles),originalIndices,index,nodeVertex,edges:[...edgeMap.values()],
      damageRevision:-1,topologyUpdates:0,frayCount:0,frayMesh,frayAttribute,frayPositions,
      frayNodes:new Uint16Array(MAX_FRAYS*3),frayParameters:new Float32Array(MAX_FRAYS*7),
      frayPoints:new Float32Array((FRAY_SEGMENTS+1)*3),frayTime:-1,latestTear:-10,
      revision:-1,alpha:-1,updates:0};
  }
  _damage(data){
    const net=data.net,active=net.triangleActive,source=data.originalIndices,target=data.index.array;let count=0;
    for(let t=0;t<source.length/3;t++)if(!active||active[t]){target[count++]=source[t*3];target[count++]=source[t*3+1];target[count++]=source[t*3+2];}
    data.mesh.geometry.setDrawRange(0,count);data.index.needsUpdate=true;data.frayCount=0;data.latestTear=-10;
    if(active)for(const edge of data.edges){
      let intact=null,cut=null;for(const side of edge.sides){if(active[side.triangle])intact=side;else cut=side;}
      if(!intact||!cut)continue;
      const a=edge.a*3,b=edge.b*3,rest=net.rest;
      const mx=(rest[a]+rest[b])*.5,my=(rest[a+1]+rest[b+1])*.5,mz=(rest[a+2]+rest[b+2])*.5;
      let tear=null,distance=Infinity;for(const candidate of net.tears||[]){const p=candidate.restPosition,d=(p.x-mx)**2+(p.y-my)**2+(p.z-mz)**2;if(d<distance){distance=d;tear=candidate;}}
      const length=Math.hypot(rest[b]-rest[a],rest[b+1]-rest[a+1],rest[b+2]-rest[a+2]);
      for(let knot=0;knot<2&&data.frayCount<MAX_FRAYS;knot++){
        const f=data.frayCount++,n=f*3,j=f*7,seed=((edge.a*73856093^edge.b*19349663^knot*83492791)>>>0)/4294967296;
        data.frayNodes[n]=edge.a;data.frayNodes[n+1]=edge.b;data.frayNodes[n+2]=intact.opposite;
        // Each coarse edge contains two woven cells. Ends have unequal
        // lengths, rather than a uniform fringe or a round cut-out decal.
        data.frayParameters[j]=knot*.5;
        data.frayParameters[j+1]=Math.min(.28,length*(.32+seed*.55));
        data.frayParameters[j+2]=seed;data.frayParameters[j+3]=tear?.time??this.nets.time;
        data.frayParameters[j+4]=tear?.normal.x??0;data.frayParameters[j+5]=tear?.normal.y??0;data.frayParameters[j+6]=tear?.normal.z??net.sign;
        data.latestTear=Math.max(data.latestTear,data.frayParameters[j+3]);
      }
    }
    data.frayMesh.geometry.setDrawRange(0,data.frayCount*FRAY_SEGMENTS*FRAY_SIDES*6);data.frayMesh.visible=data.frayCount>0;
    data.damageRevision=net.damageRevision||0;data.topologyUpdates++;data.frayTime=-1;
  }
  _frays(data,time){
    const p=data.positions,nodes=data.frayNodes,parameters=data.frayParameters,out=data.frayPositions,points=data.frayPoints,map=data.nodeVertex;
    for(let f=0;f<data.frayCount;f++){
      const n=f*3,j=f*7,a=map[nodes[n]]*3,b=map[nodes[n+1]]*3,c=map[nodes[n+2]]*3,t=parameters[j],length=parameters[j+1],seed=parameters[j+2];
      let x=p[a]+(p[b]-p[a])*t,y=p[a+1]+(p[b+1]-p[a+1])*t,z=p[a+2]+(p[b+2]-p[a+2])*t;
      points[0]=x;points[1]=y;points[2]=z;
      const ex=p[b]-p[a],ey=p[b+1]-p[a+1],ez=p[b+2]-p[a+2],edgeLengthSq=ex*ex+ey*ey+ez*ez;
      // Point away from the surviving face. Never follow an orphaned particle
      // inside the hole; only the still-connected side defines the cut tangent.
      let dx=(p[a]+p[b])*.5-p[c],dy=(p[a+1]+p[b+1])*.5-p[c+1],dz=(p[a+2]+p[b+2])*.5-p[c+2];
      const along=(dx*ex+dy*ey+dz*ez)/Math.max(1e-9,edgeLengthSq);dx-=ex*along;dy-=ey*along;dz-=ez*along;
      const inv=1/Math.max(1e-9,Math.hypot(dx,dy,dz));dx*=inv;dy*=inv;dz*=inv;
      const age=Math.max(0,time-parameters[j+3]),decay=Math.exp(-age*2.8),settle=1-Math.exp(-age*5),phase=seed*Math.PI*2;
      const nx=parameters[j+4],ny=parameters[j+5],nz=parameters[j+6],swing=Math.cos(age*(10+seed*5)+phase)*decay;
      for(let k=1;k<=FRAY_SEGMENTS;k++){
        const u=(k-.5)/FRAY_SEGMENTS,forward=1-u*.77,flutter=(.6*decay+.36*swing)*Math.sin(u*Math.PI)+.12*Math.sin(u*5+phase);
        let tx=dx*forward+nx*flutter,ty=dy*forward-1.05*u*settle+ny*flutter,tz=dz*forward+nz*flutter;
        const step=length/FRAY_SEGMENTS/Math.max(1e-9,Math.hypot(tx,ty,tz));x+=tx*step;y+=ty*step;z+=tz*step;
        const q=k*3;points[q]=x;points[q+1]=Math.max(.003,y);points[q+2]=z;
      }
      for(let k=0;k<=FRAY_SEGMENTS;k++){
        const q=k*3,before=Math.max(0,k-1)*3,after=Math.min(FRAY_SEGMENTS,k+1)*3;
        let tx=points[after]-points[before],ty=points[after+1]-points[before+1],tz=points[after+2]-points[before+2],invT=1/Math.max(1e-9,Math.hypot(tx,ty,tz));tx*=invT;ty*=invT;tz*=invT;
        let ux=0,uy=tz,uz=-ty;if(Math.abs(tx)>.85){ux=-tz;uy=0;uz=tx;}
        const invU=1/Math.max(1e-9,Math.hypot(ux,uy,uz));ux*=invU;uy*=invU;uz*=invU;
        const vx=ty*uz-tz*uy,vy=tz*ux-tx*uz,vz=tx*uy-ty*ux,radius=.002*(k===FRAY_SEGMENTS?.68:1);
        for(let s=0;s<FRAY_SIDES;s++){
          const angle=s/FRAY_SIDES*Math.PI*2,co=Math.cos(angle)*radius,si=Math.sin(angle)*radius,target=((f*(FRAY_SEGMENTS+1)+k)*FRAY_SIDES+s)*3;
          out[target]=points[q]+ux*co+vx*si;out[target+1]=points[q+1]+uy*co+vy*si;out[target+2]=points[q+2]+uz*co+vz*si;
        }
      }
    }
    data.frayAttribute.needsUpdate=true;data.frayTime=time;
  }
  render(alpha=1){
    if(this.disposed)return;
    for(const data of this.goals){
      const net=data.net,t=net.sleeping?1:footballClamp(alpha,0,1),revision=net.revision||0;
      const damageChanged=data.damageRevision!==(net.damageRevision||0);if(damageChanged)this._damage(data);
      const changed=damageChanged||data.revision!==revision||(!net.sleeping&&data.alpha!==t);
      const frayTime=Math.min(this.nets.time,data.latestTear+3);
      if(!changed){if(data.frayCount&&data.frayTime!==frayTime)this._frays(data,frayTime);continue;}
      const current=net.positions,previous=net.renderPrevious||net.previous||current,p=data.positions,ids=data.particles;
      for(let i=0;i<ids.length;i++){
        const source=ids[i]*3,target=i*3;
        p[target]=previous[source]+(current[source]-previous[source])*t;
        p[target+1]=previous[source+1]+(current[source+1]-previous[source+1])*t;
        p[target+2]=previous[source+2]+(current[source+2]-previous[source+2])*t;
      }
      data.attribute.needsUpdate=true;data.revision=revision;data.alpha=t;data.updates++;
      if(data.frayCount)this._frays(data,frayTime);
    }
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.root.removeFromParent();}
}

export { FootballGoalNetVisual };
