import { FT } from "../../vendor/three.js";

/* Anatomical unbranded boots. The original last is authored in metres, then
   enlarged once for the reference game's boot-to-ball proportions. Side views
   support an approximately 1.5-ball-diameter shoe; perspective prevents an exact
   recovered size. The striking body shares these outer dimensions, with broad
   contact flanks and tapered ends rather than colliding against lace details. */
class FootballBoots {
  static authorScale=1.18;
  static spec=Object.freeze({length:.285*this.authorScale,width:.102*this.authorScale,height:.111*this.authorScale,
    toeZ:-.224*this.authorScale,heelZ:.061*this.authorScale,
    soleBottomY:-.066*this.authorScale,studBottomY:-.079*this.authorScale,collarTopY:.032*this.authorScale,
    soleThickness:.005*this.authorScale,forefootStudLength:.011*this.authorScale,heelStudLength:.013*this.authorScale,
    neutralAnkleHeight:.079*this.authorScale+.002});
  static _cache={};
  static _up=new FT.Vector3();
  static _inverse=new FT.Quaternion();
  static source(hand='right'){
    hand=hand==='left'?'left':'right';
    if(!this._cache[hand])this._cache[hand]=this.build(hand);
    return this._cache[hand];
  }
  static create(hand='right'){
    const source=this.source(hand),geometry=source.geometry.clone();
    geometry.userData.footballBoot=source.description;return geometry;
  }
  static supportVertices(hand='right'){return this.source(hand).description.support;}
  static support(direction,hand='right',target=new FT.Vector3()){
    const data=this.supportVertices(hand);let score=-Infinity;
    for(let i=0;i<data.length;i+=3){const d=data[i]*direction.x+data[i+1]*direction.y+data[i+2]*direction.z;
      if(d>score){score=d;target.set(data[i],data[i+1],data[i+2]);}}
    return target;
  }
  static groundClearance(orientation,hand='right'){
    const up=this._up.set(0,1,0).applyQuaternion(this._inverse.copy(orientation).invert()),data=this.supportVertices(hand);
    let low=Infinity;for(let i=0;i<data.length;i+=3)low=Math.min(low,data[i]*up.x+data[i+1]*up.y+data[i+2]*up.z);
    return -low+.002;
  }
  static describe(hand='right'){return this.source(hand).description;}
  static build(hand){
    const side=1,P=[],UV=[],I=[],upperOffsets=[]; // Author one last, mirror it once for the opposite foot.
    // Z, medial half-width, lateral half-width, centre offset, dorsal height,
    // contact-roof limit. The last column does not change the rendered last.
    // A narrow heel/waist opens into the metatarsal head then an asymmetrical toe.
    const last=[
      [-.224,0,0,.012,-.046,-.046],[-.218,.014,.014,.010,-.034,-.030],[-.205,.029,.031,.007,-.025,-.019],
      [-.183,.042,.044,.004,-.016,-.008],[-.151,.050,.050,.003,-.006,.010],[-.129,.051,.051,.002,.001,.025],
      [-.096,.046,.047,.001,.010,.032],[-.060,.037,.041,0,.019,.032],[-.025,.031,.036,-.001,.025,.032],
      [.005,.030,.033,-.002,.028,.032],[.031,.031,.031,-.002,.028,.032],[.048,.025,.026,-.001,.022,.028],
      [.058,.012,.013,0,.004,.014],[.061,0,0,0,-.027,-.027]
    ];
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const smooth=t=>t*t*(3-2*t);
    const sample=z=>{
      let j=0;while(j<last.length-2&&z>last[j+1][0])j++;
      const a=last[j],b=last[j+1],t=clamp((z-a[0])/(b[0]-a[0]),0,1),out=[z];
      // Monotone cubic Hermite interpolation: smooth silhouettes, no overshooting extents.
      for(let k=1;k<5;k++){
        const slope=(b[k]-a[k])/(b[0]-a[0]);
        const sec0=j?(a[k]-last[j-1][k])/(a[0]-last[j-1][0]):slope;
        const sec1=j+2<last.length?(last[j+2][k]-b[k])/(last[j+2][0]-b[0]):slope;
        const m0=sec0*slope<=0?0:2*sec0*slope/(sec0+slope),m1=sec1*slope<=0?0:2*sec1*slope/(sec1+slope),d=b[0]-a[0];
        out.push(clamp((2*t*t*t-3*t*t+1)*a[k]+(t*t*t-2*t*t+t)*d*m0+(-2*t*t*t+3*t*t)*b[k]+(t*t*t-t*t)*d*m1,Math.min(a[k],b[k]),Math.max(a[k],b[k])));
      }
      if(z<-.218){const t=clamp((z+.224)/.006,0,1),cap=Math.sqrt(t);out[1]=.014*cap;out[2]=.014*cap;out[4]=-.046+.012*cap;}
      return out;
    };
    const toeSpring=z=>.010*smooth(clamp((-z-.168)/.056,0,1));
    const soleY=z=>-.066+toeSpring(z);
    const topAt=(z,x)=>{
      const r=sample(z),centre=side*r[3],w=x>=centre?r[1]:r[2],base=soleY(z)+.005;
      const flat=.019*smooth(clamp((z+.127)/.025,0,1))*smooth(clamp((.038-z)/.024,0,1));
      const ratio=clamp((Math.abs(x-centre)-flat)/Math.max(.001,w-flat),0,1);
      return base+(r[4]-base)*Math.pow(Math.max(0,1-ratio*ratio),.58);
    };
    // The rendered leather rolls smoothly into the lacing channel. The contact
    // last stays unchanged: these shallow shaping offsets are visual only.
    const upperOffset=(z,x)=>{
      const r=sample(z),centre=side*r[3],w=x>=centre?r[1]:r[2],base=soleY(z)+.005;
      const flat=.010*smooth(clamp((z+.127)/.025,0,1))*smooth(clamp((.038-z)/.024,0,1));
      const ratio=clamp((Math.abs(x-centre)-flat)/Math.max(.001,w-flat),0,1);
      const slimming=.0035*smooth(clamp((z+.218)/.040,0,1))*smooth(clamp((-.005-z)/.090,0,1));
      const natural=base+(r[4]-slimming-base)*Math.pow(Math.max(0,1-ratio*ratio),.64);
      return Math.min(0,natural-topAt(z,x))*.5*(1-.65*smooth(clamp((z+.060)/.070,0,1)));
    };
    let shapedUpper=false;
    const stations=count=>Array.from(new Set([...Array.from({length:count+1},(_,i)=>-.224+.285*(1-Math.cos(i/count*Math.PI))*.5),...last.map(r=>r[0])].map(z=>z.toFixed(9)))).map(Number).sort((a,b)=>a-b);
    const uv=(u,v,cell)=>[(cell%2+.016+clamp(u,0,1)*.968)/2,1-(Math.floor(cell/2)+.016+(1-clamp(v,0,1))*.968)/2];
    const vertex=(x,y,z,u,v,cell)=>{P.push(x,y,z);upperOffsets.push(shapedUpper?upperOffset(z,x):0);UV.push(...uv(u,v,cell));return P.length/3-1;};
    const tri=(a,b,c)=>I.push(a,b,c);
    const quad=(a,b,c,d)=>{tri(a,b,c);tri(b,d,c);};
    // Continuous top and sides; the cuff covers a true opening in the upper.
    shapedUpper=true;
    const zs=stations(48),nz=zs.length-1,nt=24,upper=[];
    for(let j=0;j<=nz;j++){
      const z=zs[j],r=sample(z),row=[];
      for(let i=0;i<=nt;i++){
        const theta=Math.PI*i/nt,cos=Math.cos(theta),half=cos>=0?r[1]:r[2],centre=side*r[3];
        const x=centre+side*half*cos,base=soleY(z)+.005;
        const y=topAt(z,x);
        row.push(vertex(x,y,z,i/nt,j/nz,1));
      }upper.push(row);
    }
    for(let j=0;j<nz;j++)for(let i=0;i<nt;i++){
      const ids=[upper[j][i],upper[j][i+1],upper[j+1][i],upper[j+1][i+1]];
      const x=ids.reduce((a,k)=>a+P[k*3],0)/4,z=ids.reduce((a,k)=>a+P[k*3+2],0)/4;
      const opening=(x/.023)**2+((z-.012)/.035)**2<1&&i>nt*.18&&i<nt*.82;
      if(!opening)quad(ids[0],ids[1],ids[2],ids[3]);
    }
    // Thin, rounded sole follows the same last; no oversized platform.
    shapedUpper=false;
    const outline=[],soleZ=stations(40);
    for(const z of soleZ){const r=sample(z);outline.push([side*(r[3]+r[1]),z]);}
    for(let j=soleZ.length-2;j>0;j--){const z=soleZ[j],r=sample(z);outline.push([side*(r[3]-r[2]),z]);}
    const soleRings=[];
    for(const [height,inset] of [[0,0],[.001,1],[.004,1],[.005,0]]){
      const ring=[];for(let i=0;i<outline.length;i++){
        const [x,z]=outline[i],r=sample(z),cx=side*r[3];
        ring.push(vertex(cx+(x-cx)*(1-inset*.012),soleY(z)+height,z,i/outline.length,height/.005,2));
      }soleRings.push(ring);
    }
    for(let j=0;j<3;j++)for(let i=0;i<outline.length;i++){
      const n=(i+1)%outline.length;quad(soleRings[j][i],soleRings[j+1][i],soleRings[j][n],soleRings[j+1][n]);
    }
    const soleCentre=vertex(0,-.066,-.065,.5,.5,2);
    for(let i=0;i<outline.length;i++){const n=(i+1)%outline.length;tri(soleCentre,soleRings[0][i],soleRings[0][n]);}
    // Padded elliptical collar: closed rim, dark inner wall and genuinely hollow mouth.
    const cuff=[];const cn=48;
    for(let ring=0;ring<5;ring++){
      shapedUpper=ring===0;
      const row=[];for(let i=0;i<=cn;i++){
        const a=i/cn*Math.PI*2,sa=Math.sin(a),ca=Math.cos(a),inner=ring>=2;
        const rx=inner?.0235:.0305,rz=inner?.0355:.0425,z=.012+ca*rz,x=sa*rx;
        const top=.023+.009*(ca+1)*.5;
        const y=ring===0?topAt(z,x)-.002:ring===1?top:ring===2?top-.001:ring===3?top-.007:-.023;
        row.push(vertex(x,y,z,i/cn,ring/4,ring>=2?2:3));
      }cuff.push(row);
    }
    for(let j=0;j<4;j++)for(let i=0;i<cn;i++)quad(cuff[j][i],cuff[j][i+1],cuff[j+1][i],cuff[j+1][i+1]);
    // Narrow raised tongue bridges the instep and tucks beneath the laces.
    shapedUpper=true;
    const tongue=[];
    for(let j=0;j<=12;j++){
      const z=-.103+j*.113/12,w=.018+Math.sin(j/12*Math.PI)*.005,row=[];
      for(let i=0;i<=8;i++){const x=(i/8*2-1)*w;row.push(vertex(x,topAt(z,x)+.0015,z,i/8,j/12,2));}tongue.push(row);
    }
    for(let j=0;j<12;j++)for(let i=0;i<8;i++)quad(tongue[j][i],tongue[j+1][i],tongue[j][i+1],tongue[j+1][i+1]);
    const tube=(points,radius,cell,sides=8)=>{
      const rows=[],tangent=new FT.Vector3(),normal=new FT.Vector3(),binormal=new FT.Vector3(),up=new FT.Vector3(0,1,0);
      for(let j=0;j<points.length;j++){
        const p=points[j],a=points[Math.max(0,j-1)],b=points[Math.min(points.length-1,j+1)];tangent.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize();
        normal.crossVectors(tangent,up);if(normal.lengthSq()<.001)normal.set(1,0,0);normal.normalize();binormal.crossVectors(normal,tangent).normalize();
        const row=[];for(let k=0;k<=sides;k++){const a=k/sides*Math.PI*2,c=Math.cos(a)*radius,s=Math.sin(a)*radius;row.push(vertex(p[0]+normal.x*c+binormal.x*s,p[1]+normal.y*c+binormal.y*s,p[2]+normal.z*c+binormal.z*s,k/sides,j/(points.length-1),cell));}rows.push(row);
      }
      for(let j=0;j<rows.length-1;j++)for(let k=0;k<sides;k++)quad(rows[j][k],rows[j+1][k],rows[j][k+1],rows[j+1][k+1]);
    };
    // Slim crossed textile laces; the eyelets sit flush rather than floating spheres.
    for(let j=0;j<6;j++){
      const z=-.089+j*.014,w=.018-j*.0003;
      for(const direction of [-1,1]){
        const pts=[];for(let k=0;k<=4;k++){
          const t=k/4,x=direction*(-w+2*w*t),zz=z+(t-.5)*.011;
          pts.push([x,topAt(zz,x)+.0012+Math.sin(t*Math.PI)*.00025,zz]);
        }tube(pts,.0009,3,6);
      }
      for(const sign of [-1,1]){
        const x=sign*w,y=topAt(z,x)+.0008,outer=[],inner=[];
        for(let k=0;k<=8;k++){const a=k/8*Math.PI*2;outer.push(vertex(x+Math.cos(a)*.0021,y,z+Math.sin(a)*.0021,k/8,1,2));inner.push(vertex(x+Math.cos(a)*.0011,y+.0001,z+Math.sin(a)*.0011,k/8,0,2));}
        for(let k=0;k<8;k++)quad(outer[k],inner[k],outer[k+1],inner[k+1]);
      }
    }
    // 12 low firm-ground studs with rounded triangular bases; dimensions below
    // belong to the authored last and receive the same final fit as the upper.
    shapedUpper=false;
    const studs=[[-.034,-.167],[.034,-.167],[-.037,-.119],[.037,-.119],[-.032,-.067],[.032,-.067],[0,-.151],[0,-.092],[-.022,.012],[.022,.012],[-.020,.043],[.020,.043]];
    for(const [x0,z] of studs){
      const x=side*x0,heel=z>0,height=heel?.013:.011,bottom=soleY(z)-height,rows=[];
      for(const [y,radius] of [[soleY(z)+.001,.0062],[bottom,.0038]]){
        const row=[];for(let k=0;k<=10;k++){const a=k/10*Math.PI*2,round=1+.10*Math.cos(a*3);row.push(vertex(x+Math.cos(a)*radius*round,y,z+Math.sin(a)*radius*round,k/10,(y-bottom)/height,3));}rows.push(row);
      }
      for(let k=0;k<10;k++)quad(rows[0][k],rows[0][k+1],rows[1][k],rows[1][k+1]);
      const centre=vertex(x,bottom,z,.5,.5,3);for(let k=0;k<10;k++)tri(centre,rows[1][k],rows[1][k+1]);
    }
    // Capture the accepted physical last before leather shaping. Keeping this
    // compact support set separate from shading/upper details preserves shots
    // when the visual profile changes, without a duplicate mesh in the scene.
    const mirror=hand==='left'?1:-1,scale=this.authorScale,lastSupport=[],seenSupport=new Set();
    for(let i=0;i<P.length;i+=3){
      const x=clamp(P[i],-.049,.053),z=P[i+2],physical=[mirror*x*scale,P[i+1]*scale,z*scale];
      const key=physical.map(v=>v.toFixed(6)).join(',');
      if(!seenSupport.has(key)){seenSupport.add(key);lastSupport.push(...physical);}
      const r=sample(z),toeTaper=.055*smooth(clamp((-.136-z)/.055,0,1))*smooth(clamp((z+.224)/.014,0,1));
      P[i]=mirror*(r[3]+(x-r[3])*(1-toeTaper))*scale;
      P[i+1]=(P[i+1]+upperOffsets[i/3])*scale;P[i+2]=physical[2];
    }
    if(mirror<0)for(let i=0;i<I.length;i+=3){const b=I[i+1];I[i+1]=I[i+2];I[i+2]=b;}
    const geometry=new FT.BufferGeometry();geometry.setAttribute('position',new FT.BufferAttribute(new Float32Array(P),3));geometry.setAttribute('uv',new FT.BufferAttribute(new Float32Array(UV),2));geometry.setIndex(I);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    // Seam welding for normals only: UV islands and construction rings retain their UVs.
    const normals=geometry.attributes.normal,buckets=new Map();
    for(let i=0;i<P.length/3;i++){
      const key=[P[i*3].toFixed(6),P[i*3+1].toFixed(6),P[i*3+2].toFixed(6)].join(',');
      let b=buckets.get(key);if(!b){b={ids:[],x:0,y:0,z:0};buckets.set(key,b);}b.ids.push(i);b.x+=normals.getX(i);b.y+=normals.getY(i);b.z+=normals.getZ(i);
    }
    const support=[];for(const b of buckets.values()){
      const length=Math.hypot(b.x,b.y,b.z)||1;for(const i of b.ids)normals.setXYZ(i,b.x/length,b.y/length,b.z/length);
      const i=b.ids[0];support.push(P[i*3],P[i*3+1],P[i*3+2]);
    }
    const b=geometry.boundingBox,bounds=Object.freeze({min:Object.freeze([b.min.x,b.min.y,b.min.z]),max:Object.freeze([b.max.x,b.max.y,b.max.z]),length:b.max.z-b.min.z,width:b.max.x-b.min.x,height:b.max.y-b.min.y});
    const radius=(b.max.x-b.min.x)*.5,halfLength=(b.max.z-b.min.z)*.5-radius;
    const collider=Object.freeze({radius,halfLength,offset:Object.freeze([(b.max.x+b.min.x)*.5,b.min.y+radius,(b.max.z+b.min.z)*.5])});
    const supportArray=new Float32Array(support),contact=hand==='left'?this.makeStrikingBody(last,bounds,scale,new Float32Array(lastSupport)):this.mirrorContact(this.source('left').description.contact,bounds);
    const description=Object.freeze({hand,spec:this.spec,bounds,collider,contact,support:supportArray,toeLocal:Object.freeze([mirror*.012*scale,-.046*scale,-.224*scale]),heelLocal:Object.freeze([0,-.027*scale,.061*scale]),triangles:I.length/3});
    return{geometry,description};
  }
  static makeStrikingBody(last,bounds,scale,lastSupport){
    // A tapered, bevelled boot body. Its broad side faces transfer an inside-foot
    // sweep forwards instead of letting the rounded upper scoop every fast hit.
    // Preserve the narrow toe/heel and all outer dimensions; a full box would
    // fill the empty front corners and catch balls well away from the shoe.
    // Include the authored cuff rim, curved toe and studs. Visual leather is
    // sculpted within this last; the established contact normals stay fixed.
    const points=Array.from(lastSupport);
    for(const[z,medial,lateral,centre,dorsal,roof]of last){
      const top=(dorsal+(roof-dorsal)*.75)*scale;
      const bottom=(-.079+.010*Math.min(1,Math.max(0,(-z-.168)/.056)))*scale;
      const broad=Math.min(1,Math.max(0,(z+.22)/.07))*Math.min(1,Math.max(0,(.061-z)/.02));
      const lo=((centre-lateral)*(1-broad)-.049*broad)*scale;
      const hi=((centre+medial)*(1-broad)+.053*broad)*scale;
      const width=hi-lo,round=Math.min(.004,width*.48,Math.max(0,(top-bottom)*.48));
      if(width<1e-7){points.push(centre*scale,top,z*scale);continue;}
      for(const[x,y,start]of[[hi-round,top-round,0],[lo+round,top-round,90],[lo+round,bottom+round,180],[hi-round,bottom+round,270]]){
        for(let i=0;i<=2;i++){
          const a=(start+i*45)*Math.PI/180;
          points.push(x+Math.cos(a)*round,y+Math.sin(a)*round,z*scale);
        }
      }
    }
    return this.makeContact(new Float32Array(points),bounds,true);
  }
  // Cached convex distance-query surface; also used by the visible short shin.
  static makeContact(support,bounds,allVertices=false){
    const points=[],seen=new Set(),directions=[];
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)directions.push([x,y,z]);
    for(let i=0;i<320;i++){const y=1-2*(i+.5)/320,r=Math.sqrt(1-y*y),a=i*Math.PI*(3-Math.sqrt(5));directions.push([Math.cos(a)*r,y,Math.sin(a)*r]);}
    for(let i=0;i<24;i++)for(const y of [-.6,.6]){const a=i/24*Math.PI*2;directions.push([Math.cos(a),y,Math.sin(a)]);}
    const addPoint=index=>{const key=[support[index],support[index+1],support[index+2]].map(v=>v.toFixed(6)).join(',');if(!seen.has(key)){seen.add(key);points.push([support[index],support[index+1],support[index+2]]);}};
    if(allVertices){for(let i=0;i<support.length;i+=3)addPoint(i);}
    else for(const d of directions){let score=-Infinity,index=0;for(let i=0;i<support.length;i+=3){const v=support[i]*d[0]+support[i+1]*d[1]+support[i+2]*d[2];if(v>score){score=v;index=i;}}addPoint(index);}
    const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    let a=0,b=0;for(let i=0;i<points.length;i++){if(points[i][0]<points[a][0])a=i;if(points[i][0]>points[b][0])b=i;}
    const ab=sub(points[b],points[a]);let c=-1,best=-1;
    for(let i=0;i<points.length;i++){const cr=cross(ab,sub(points[i],points[a])),n=dot(cr,cr);if(n>best){best=n;c=i;}}
    const normal=cross(sub(points[b],points[a]),sub(points[c],points[a]));let d=-1;best=-1;
    for(let i=0;i<points.length;i++){const n=Math.abs(dot(normal,sub(points[i],points[a])));if(n>best){best=n;d=i;}}
    const centre=[0,0,0];for(const i of [a,b,c,d])for(let k=0;k<3;k++)centre[k]+=points[i][k]*.25;
    const face=(a,b,c)=>{
      let n=cross(sub(points[b],points[a]),sub(points[c],points[a]));
      if(dot(n,sub(centre,points[a]))>0){const t=b;b=c;c=t;n=n.map(v=>-v);}
      const len=Math.hypot(...n);if(len<1e-12)return null;n=n.map(v=>v/len);return{a,b,c,n,w:dot(n,points[a])};
    };
    let faces=[[a,b,c],[a,b,d],[a,c,d],[b,c,d]].map(f=>face(...f)).filter(Boolean);
    const initial=new Set([a,b,c,d]);
    for(let index=0;index<points.length;index++){
      if(initial.has(index))continue;const point=points[index],visible=[],edges=new Map();
      for(let i=0;i<faces.length;i++)if(dot(faces[i].n,point)-faces[i].w>1e-7)visible.push(i);
      if(!visible.length)continue;
      for(const i of visible){const f=faces[i];for(const [a,b] of [[f.a,f.b],[f.b,f.c],[f.c,f.a]]){const key=Math.min(a,b)+':'+Math.max(a,b);if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}}
      const removed=new Set(visible);faces=faces.filter((_,i)=>!removed.has(i));
      for(const edge of edges.values()){const f=face(edge[0],edge[1],index);if(f)faces.push(f);}
    }
    const data=[];
    for(const f of faces){const a=points[f.a],b=points[f.b],c=points[f.c];data.push(...a,...b,...c,...f.n,f.w,Math.min(a[0],b[0],c[0]),Math.min(a[1],b[1],c[1]),Math.min(a[2],b[2],c[2]),Math.max(a[0],b[0],c[0]),Math.max(a[1],b[1],c[1]),Math.max(a[2],b[2],c[2]));}
    const surface={triangles:new Float32Array(data),count:faces.length,bounds};
    surface.query=(point,target,normal,maxDistance=Infinity)=>FootballBoots.querySurface(surface,point,target,normal,maxDistance);
    return Object.freeze(surface);
  }
  static mirrorContact(source,bounds){
    const data=new Float32Array(source.triangles),s=source.triangles;
    for(let i=0;i<data.length;i+=19){
      data[i]=-s[i];data[i+3]=-s[i+6];data[i+4]=s[i+7];data[i+5]=s[i+8];data[i+6]=-s[i+3];data[i+7]=s[i+4];data[i+8]=s[i+5];
      data[i+9]=-s[i+9];data[i+13]=-s[i+16];data[i+16]=-s[i+13];
    }
    const surface={triangles:data,count:source.count,bounds};surface.query=(p,target,normal,maxDistance=Infinity)=>FootballBoots.querySurface(surface,p,target,normal,maxDistance);return Object.freeze(surface);
  }
  static querySurface(surface,p,target,normal,maxDistance=Infinity){
    const bounds=surface.bounds,px=p.x,py=p.y,pz=p.z;
    const dx=Math.max(bounds.min[0]-px,0,px-bounds.max[0]),dy=Math.max(bounds.min[1]-py,0,py-bounds.max[1]),dz=Math.max(bounds.min[2]-pz,0,pz-bounds.max[2]);
    if(dx*dx+dy*dy+dz*dz>maxDistance*maxDistance)return Infinity;
    const data=surface.triangles;let best=maxDistance*maxDistance,found=false,inside=true,bx=0,by=0,bz=0,nx=0,ny=1,nz=0;
    for(let i=0;i<data.length;i+=19){
      const plane=data[i+9]*px+data[i+10]*py+data[i+11]*pz-data[i+12];if(plane>1e-7)inside=false;
      const dx=Math.max(data[i+13]-px,0,px-data[i+16]),dy=Math.max(data[i+14]-py,0,py-data[i+17]),dz=Math.max(data[i+15]-pz,0,pz-data[i+18]);
      if(dx*dx+dy*dy+dz*dz>best)continue;
      const ax=data[i],ay=data[i+1],az=data[i+2],abx=data[i+3]-ax,aby=data[i+4]-ay,abz=data[i+5]-az,acx=data[i+6]-ax,acy=data[i+7]-ay,acz=data[i+8]-az;
      const apx=px-ax,apy=py-ay,apz=pz-az,d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz;
      let cx,cy,cz;
      if(d1<=0&&d2<=0){cx=ax;cy=ay;cz=az;}
      else{
        const bpx=px-data[i+3],bpy=py-data[i+4],bpz=pz-data[i+5],d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;
        if(d3>=0&&d4<=d3){cx=data[i+3];cy=data[i+4];cz=data[i+5];}
        else{
          const vc=d1*d4-d3*d2;
          if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);cx=ax+abx*v;cy=ay+aby*v;cz=az+abz*v;}
          else{
            const cpx=px-data[i+6],cpy=py-data[i+7],cpz=pz-data[i+8],d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;
            if(d6>=0&&d5<=d6){cx=data[i+6];cy=data[i+7];cz=data[i+8];}
            else{
              const vb=d5*d2-d1*d6;
              if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);cx=ax+acx*w;cy=ay+acy*w;cz=az+acz*w;}
              else{
                const va=d3*d6-d5*d4;
                if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));cx=data[i+3]+(data[i+6]-data[i+3])*w;cy=data[i+4]+(data[i+7]-data[i+4])*w;cz=data[i+5]+(data[i+8]-data[i+5])*w;}
                else{const denom=va+vb+vc;if(Math.abs(denom)<1e-20)continue;const v=vb/denom,w=vc/denom;cx=ax+abx*v+acx*w;cy=ay+aby*v+acy*w;cz=az+abz*v+acz*w;}
              }
            }
          }
        }
      }
      const ex=px-cx,ey=py-cy,ez=pz-cz,distance=ex*ex+ey*ey+ez*ez;
      if(distance<=best){best=distance;found=true;bx=cx;by=cy;bz=cz;nx=data[i+9];ny=data[i+10];nz=data[i+11];}
    }
    if(!found)return Infinity;
    target.set(bx,by,bz);const distance=Math.sqrt(best);
    if(inside||distance<1e-8)normal.set(nx,ny,nz).normalize();else normal.set((px-bx)/distance,(py-by)/distance,(pz-bz)/distance);
    return inside?-distance:distance;
  }
}

export { FootballBoots };
