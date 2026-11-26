(() => {
'use strict';
const FT = globalThis.FirstTouchThree;
const {MATCH_POSITIONS,MatchEngine} = globalThis.FirstTouchTactics;
const {MatchVisuals} = globalThis.FirstTouchVisuals;

const FB = Object.freeze({
  length:105, width:68, halfLength:52.5, halfWidth:34,
  goalWidth:7.32, goalHeight:2.44, goalDepth:2.4, postRadius:.06,
  ballRadius:.11, ballMass:.43, gravity:9.81, fixedStep:1/120,
  walkSpeed:3.2, sprintSpeed:6.6, turnSpeed:1.8
});
const footballClamp = (value,min,max)=>Math.max(min,Math.min(max,value));


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

/* Floodlit full-size training pitch, reconstructed from the supplied reference. Units: metres. */
class FootballField {
  constructor(scene) {
    this.scene = scene;
    this.root = new FT.Group();
    this.root.name = 'Football pitch';
    scene.add(this.root);
    scene.background = new FT.Color(0x020309);
    this.geometries = new Set();
    this.materials = new Set();
    this.textures = new Set();
    this.matrix = new FT.Matrix4();
    this.translation = new FT.Vector3();
    this.scale = new FT.Vector3();
    this.quaternion = new FT.Quaternion();
    this._makeLighting();
    this._makePitch();
    this._makeGoals();
    this._makeBall();
    this.player=new FootballPlayerVisuals(this);
    // The headset's actual viewport clips the scene. Do not make individual
    // field pieces or the ball disappear near a view edge.
    this.root.traverse(object=>{if(object.isMesh)object.frustumCulled=false;});
  }

  geometry(geometry) { this.geometries.add(geometry); return geometry; }
  material(material) { this.materials.add(material); return material; }
  addMesh(geometry, material, parent = this.root) {
    const mesh = new FT.Mesh(this.geometry(geometry), material);
    parent.add(mesh);
    return mesh;
  }

  _makeLighting() {
    // The reference has an almost black sky but a brightly floodlit playing surface.
    // A baked grass light field avoids ten expensive shadowed spot lights in VR.
    const sky = new FT.HemisphereLight(0xf3f6e8, 0x2d421d, 1.38);
    this.root.add(sky);
    for(const [x,z,intensity,colour] of [[-42,-28,.9,0xf4f6ff],[42,28,.65,0xfff9df]]){
      const light=new FT.DirectionalLight(colour,intensity);light.position.set(x,22,z);this.root.add(light);
    }
  }

  _grassTexture() {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
    const c=canvas.getContext('2d'),pixels=c.createImageData(1024,1024);
    let seed=43871;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<pixels.data.length;i+=4){
      const shade=(random()-.5)*24;pixels.data[i]=47+shade;pixels.data[i+1]=112+shade;pixels.data[i+2]=26+shade;pixels.data[i+3]=255;
    }
    c.putImageData(pixels,0,0);c.lineCap='round';
    // Thousands of tiny overlapping blades stay visible when looking down at the ball.
    for(let i=0;i<54000;i++){
      const x=random()*1024,y=random()*1024,a=random()*Math.PI*2,length=3+random()*10;
      const light=random()>.42; c.strokeStyle=light?'rgba(114,162,70,.28)':'rgba(18,60,8,.27)';c.lineWidth=.5+random()*.7;
      const dx=Math.cos(a)*length,dy=Math.sin(a)*length;
      c.beginPath();c.moveTo(x,y);c.lineTo(x+dx,y+dy);c.stroke();
      // Repeated edge strokes make the procedural tile seamless.
      if(x+dx<0||x+dx>1024||y+dy<0||y+dy>1024){const ox=x+dx<0?1024:x+dx>1024?-1024:0,oy=y+dy<0?1024:y+dy>1024?-1024:0;c.beginPath();c.moveTo(x+ox,y+oy);c.lineTo(x+dx+ox,y+dy+oy);c.stroke();}
    }
    const texture=new FT.CanvasTexture(canvas);texture.colorSpace=FT.SRGBColorSpace;texture.wrapS=texture.wrapT=1000;texture.anisotropy=8;this.textures.add(texture);return texture;
  }

  _makePitch() {
    const grass=this._grassTexture();this.grassTexture=grass;
    const material=this.material(new FT.MeshBasicMaterial({map:grass,color:0xffffff,vertexColors:true}));
    // Solid paint keeps distant lines from breaking into translucent dashes.
    // The renderer's multisample antialiasing resolves the actual geometry edge.
    const lineMaterial=this.material(new FT.MeshBasicMaterial({color:0xeaefd7,
      polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,side:2}));
    const positions=[],colours=[],uvs=[];
    const surface=(x,z)=>{
      const outside=Math.max(0,Math.abs(x)-FB.halfWidth,Math.abs(z)-FB.halfLength);
      const fade=outside<=7?1:Math.exp(-Math.pow((outside-7)/11,1.55));
      const stripe=(Math.floor((z+FB.halfLength)/(FB.length/12))&1)?.90:1.15;
      const cross=(Math.floor((x+FB.halfWidth)/(FB.width/8))&1)?.985:1.025;
      // Broad, subtle light pools fade smoothly into the unlit run-off area.
      const pool=1+.055*Math.cos(z*Math.PI/27)*Math.min(1,Math.abs(x)/FB.halfWidth);
      return Math.max(.004,fade*stripe*cross*pool);
    };
    const vertex=(x,z)=>{positions.push(x,0,z);uvs.push(x/2.25,z/2.25);const value=surface(x,z);colours.push(value,value,value);};
    // Grid cuts follow mowing edges exactly; there are no overlapping ground planes.
    const xs=[-160,-90,-60,-52,-46,-41,-38,-FB.halfWidth],zs=[-180,-110,-82,-70,-64,-60,-56,-FB.halfLength];
    for(let i=1;i<8;i++)xs.push(-FB.halfWidth+i*FB.width/8);xs.push(FB.halfWidth,38,41,46,52,60,90,160);
    for(let i=1;i<12;i++)zs.push(-FB.halfLength+i*FB.length/12);zs.push(FB.halfLength,56,60,64,70,82,110,180);
    // A separate cell colour preserves the reference's clearly cut mowing bands.
    for(let iz=0;iz<zs.length-1;iz++)for(let ix=0;ix<xs.length-1;ix++){
      const x1=xs[ix],x2=xs[ix+1],z1=zs[iz],z2=zs[iz+1],inside=x1>=-FB.halfWidth&&x2<=FB.halfWidth&&z1>=-FB.halfLength&&z2<=FB.halfLength;
      const shade=inside?surface((x1+x2)/2,(z1+z2)/2):null;
      for(const [x,z]of[[x1,z1],[x2,z2],[x2,z1],[x1,z1],[x1,z2],[x2,z2]]){
        if(shade===null)vertex(x,z);else{positions.push(x,0,z);uvs.push(x/2.25,z/2.25);colours.push(shade,shade,shade);}
      }
    }
    const geometry=new FT.BufferGeometry();geometry.setAttribute('position',new FT.BufferAttribute(new Float32Array(positions),3));
    geometry.setAttribute('color',new FT.BufferAttribute(new Float32Array(colours),3));geometry.setAttribute('uv',new FT.BufferAttribute(new Float32Array(uvs),2));
    this.turfMesh=this.addMesh(geometry,material);this.turfMesh.name='Floodlit mown turf';

    // Each path is one joined ribbon. Neighbouring arc segments share exactly
    // the same radial vertices, and square corners use a proper miter join.
    // No alpha strip, independent butt caps, or overlapping translucent paint.
    const vertices=[],indices=[],width=.115,half=width*.5,paintY=.009;
    const pair=(ax,az,bx,bz)=>{const i=vertices.length/3;vertices.push(ax,paintY,az,bx,paintY,bz);return i;};
    const join=(a,b)=>indices.push(a,b,b+1,a,b+1,a+1);
    const path=(points,closed=false)=>{
      const first=vertices.length/3,count=points.length;
      for(let i=0;i<count;i++){
        const p=points[i],previous=points[(i+count-1)%count],next=points[(i+1)%count];
        let ax=p[0]-previous[0],az=p[1]-previous[1],bx=next[0]-p[0],bz=next[1]-p[1];
        if(!closed&&i===0){ax=bx;az=bz;}
        if(!closed&&i===count-1){bx=ax;bz=az;}
        const al=Math.hypot(ax,az),bl=Math.hypot(bx,bz);ax/=al;az/=al;bx/=bl;bz/=bl;
        const m=half/(1+ax*bx+az*bz),ox=-(az+bz)*m,oz=(ax+bx)*m;
        pair(p[0]+ox,p[1]+oz,p[0]-ox,p[1]-oz);
        if(i)join(first+(i-1)*2,first+i*2);
      }
      if(closed)join(first+(count-1)*2,first);
    };
    const arc=(x,z,radius,start=0,end=Math.PI*2)=>{
      // At most 0.1 mm deviation from the true circle, including corner arcs.
      const segments=Math.ceil((end-start)/(2*Math.acos(1-.0001/(radius+half))));
      const first=vertices.length/3;
      for(let i=0;i<=segments;i++){
        // Reuse the exact angle at the closing seam, not sin(2*pi) rounding.
        const a=i===segments&&end-start===Math.PI*2?start:start+(end-start)*i/segments;
        const dx=Math.cos(a),dz=Math.sin(a);
        pair(x+dx*(radius-half),z+dz*(radius-half),x+dx*(radius+half),z+dz*(radius+half));
        if(i)join(first+(i-1)*2,first+i*2);
      }
    };
    const spot=(x,z,radius)=>{
      const first=vertices.length/3;vertices.push(x,paintY,z);
      for(let i=0;i<64;i++){const a=i*Math.PI/32;vertices.push(x+Math.cos(a)*radius,paintY,z+Math.sin(a)*radius);}
      for(let i=0;i<64;i++)indices.push(first,first+1+i,first+1+(i+1)%64);
    };

    path([[-FB.halfWidth,-FB.halfLength],[FB.halfWidth,-FB.halfLength],
      [FB.halfWidth,FB.halfLength],[-FB.halfWidth,FB.halfLength]],true);
    path([[-FB.halfWidth,0],[FB.halfWidth,0]]);
    arc(0,0,9.15);
    spot(0,0,.12);
    for(const end of [-1,1]){
      const goalZ=end*FB.halfLength;
      for(const [depth,halfWidth]of[[16.5,FB.goalWidth*.5+16.5],[5.5,FB.goalWidth*.5+5.5]]){
        const edge=goalZ-end*depth;
        path([[-halfWidth,goalZ],[-halfWidth,edge],[halfWidth,edge],[halfWidth,goalZ]]);
      }
      const penaltyZ=goalZ-end*11,angle=Math.asin(5.5/9.15);
      spot(0,penaltyZ,.105);
      // Exact line/arc intersections prevent the old sampled-endpoint gaps.
      arc(0,penaltyZ,9.15,end<0?angle:Math.PI+angle,end<0?Math.PI-angle:Math.PI*2-angle);
      for(const side of [-1,1]){
        const a=end<0?(side<0?0:Math.PI*.5):(side<0?Math.PI*1.5:Math.PI);
        arc(side*FB.halfWidth,goalZ,1,a,a+Math.PI*.5);
      }
    }
    const linesGeometry=this.geometry(new FT.BufferGeometry());
    linesGeometry.setAttribute('position',new FT.BufferAttribute(new Float32Array(vertices),3));
    linesGeometry.setIndex(indices);linesGeometry.computeVertexNormals();
    this.markingsMesh=new FT.Mesh(linesGeometry,lineMaterial);
    this.markingsMesh.name='Painted pitch markings';
    this.root.add(this.markingsMesh);
    this.pitchBounds = {width: FB.width, length: FB.length, lineWidth: width};
  }

  _makeGoals() {
    const frameMaterial = this.material(new FT.MeshStandardMaterial({color: 0xf0f1e8, roughness: .8, metalness: .05}));
    const frameGeometry = this.geometry(new FT.CylinderGeometry(1, 1, 1, 12));
    const frames = new FT.InstancedMesh(frameGeometry, frameMaterial, 6);
    const half = FB.goalWidth * .5 + FB.postRadius;
    const top = FB.goalHeight + FB.postRadius;
    let index = 0;
    for (const end of [-1, 1]) {
      const z = end * FB.halfLength;
      for (const side of [-1, 1]) {
        this.translation.set(side * half, top * .5, z);
        this.quaternion.identity();
        this.scale.set(FB.postRadius, top, FB.postRadius);
        this.matrix.compose(this.translation, this.quaternion, this.scale);
        frames.setMatrixAt(index++, this.matrix);
      }
      this.translation.set(0, top, z);
      this.quaternion.setFromAxisAngle(new FT.Vector3(0, 0, 1), Math.PI / 2);
      this.scale.set(FB.postRadius, half * 2, FB.postRadius);
      this.matrix.compose(this.translation, this.quaternion, this.scale);
      frames.setMatrixAt(index++, this.matrix);
    }
    frames.instanceMatrix.needsUpdate = true;
    this.root.add(frames);
    this.goalFrames = frames;

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, 32, 32);
    context.strokeStyle = '#f2f3e4';
    context.lineWidth = 1.25;
    context.beginPath(); context.moveTo(0, 0); context.lineTo(32, 0); context.moveTo(0, 0); context.lineTo(0, 32); context.stroke();
    const texture = new FT.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = 1000;
    this.textures.add(texture);
    const netMaterial = this.material(new FT.MeshBasicMaterial({map: texture, color: 0xe3e5dc,
      transparent: true, opacity: .8, alphaTest: .025, depthWrite: false, side: 2}));
    const positions = [], uvs = [];
    const netQuad = (a, b, c, d, width, height) => {
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
      const u = width / .13, v = height / .13;
      uvs.push(0, 0, u, 0, u, v, 0, 0, u, v, 0, v);
    };
    for (const end of [-1, 1]) {
      const front = end * FB.halfLength, back = end * (FB.halfLength + FB.goalDepth);
      netQuad([-half, 0, back], [half, 0, back], [half, top, back], [-half, top, back], half * 2, top);
      netQuad([-half, 0, front], [-half, 0, back], [-half, top, back], [-half, top, front], FB.goalDepth, top);
      netQuad([half, 0, back], [half, 0, front], [half, top, front], [half, top, back], FB.goalDepth, top);
      netQuad([-half, top, front], [half, top, front], [half, top, back], [-half, top, back], half * 2, FB.goalDepth);
    }
    const netGeometry = this.geometry(new FT.BufferGeometry());
    netGeometry.setAttribute('position', new FT.BufferAttribute(new Float32Array(positions), 3));
    netGeometry.setAttribute('uv', new FT.BufferAttribute(new Float32Array(uvs), 2));
    netGeometry.computeVertexNormals();
    this.root.add(new FT.Mesh(netGeometry, netMaterial));
    this.goalBounds = {innerWidth: FB.goalWidth, innerHeight: FB.goalHeight, depth: FB.goalDepth,
      postX: half, crossbarY: top, lineZ: FB.halfLength};
  }

  _makeBall() {
    // Twelve pentagons and twenty hexagons, projected onto a sphere. A single draw call.
    const phi = (1 + Math.sqrt(5)) / 2;
    const original = [[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],
      [0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]];
    const points = original.map(p => new FT.Vector3(...p));
    const neighbours = points.map(() => []), faces = [];
    for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) {
      if (Math.abs(points[a].distanceToSquared(points[b]) - 4) < .001) {
        neighbours[a].push(b); neighbours[b].push(a);
      }
    }
    for (let a = 0; a < 12; a++) for (const b of neighbours[a]) if (b > a) {
      for (const c of neighbours[a]) if (c > b && neighbours[b].includes(c)) faces.push([a, b, c]);
    }
    const truncate = (a, b) => points[a].clone().multiplyScalar(2).add(points[b]).normalize();
    const panels = [];
    for (let a = 0; a < 12; a++) {
      const normal = points[a].clone().normalize();
      const tangent = truncate(a, neighbours[a][0]).addScaledVector(normal, -truncate(a, neighbours[a][0]).dot(normal)).normalize();
      const bitangent = new FT.Vector3().crossVectors(normal, tangent);
      const vertices = neighbours[a].map(b => truncate(a, b));
      vertices.sort((u, v) => Math.atan2(u.dot(bitangent), u.dot(tangent)) - Math.atan2(v.dot(bitangent), v.dot(tangent)));
      panels.push({vertices, black: true});
    }
    for (const [a, b, c] of faces) panels.push({vertices: [truncate(a,b),truncate(b,a),truncate(b,c),truncate(c,b),truncate(c,a),truncate(a,c)], black:false});
    const positions = [], normals = [], colours = [];
    const light = new FT.Color(0xf3f3df), dark = new FT.Color(0x111917);
    const triangle = (a, b, c, colour, level) => {
      if (level > 0) {
        const ab = a.clone().add(b).normalize(), bc = b.clone().add(c).normalize(), ca = c.clone().add(a).normalize();
        triangle(a, ab, ca, colour, level-1); triangle(ab, b, bc, colour, level-1);
        triangle(ca, bc, c, colour, level-1); triangle(ab, bc, ca, colour, level-1); return;
      }
      const cross = b.clone().sub(a).cross(c.clone().sub(a));
      const order = cross.dot(a) >= 0 ? [a,b,c] : [a,c,b];
      for (const point of order) {
        positions.push(point.x * FB.ballRadius, point.y * FB.ballRadius, point.z * FB.ballRadius);
        normals.push(point.x, point.y, point.z); colours.push(colour.r, colour.g, colour.b);
      }
    };
    for (const panel of panels) {
      const center = new FT.Vector3(); for (const p of panel.vertices) center.add(p); center.normalize();
      for (let i = 0; i < panel.vertices.length; i++) triangle(center, panel.vertices[i], panel.vertices[(i+1)%panel.vertices.length], panel.black ? dark : light, 1);
    }
    const geometry = this.geometry(new FT.BufferGeometry());
    geometry.setAttribute('position', new FT.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('normal', new FT.BufferAttribute(new Float32Array(normals), 3));
    geometry.setAttribute('color', new FT.BufferAttribute(new Float32Array(colours), 3));
    const material = this.material(new FT.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.78,metalness:0}));
    this.ballMesh = new FT.Mesh(geometry, material);
    this.ballMesh.name = 'Football'; this.ballMesh.position.set(0, FB.ballRadius, 0);
    this.root.add(this.ballMesh);

    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
    const sc=shadowCanvas.getContext('2d'),gradient=sc.createRadialGradient(64,64,10,64,64,62);
    gradient.addColorStop(0,'rgba(0,0,0,.75)');gradient.addColorStop(.35,'rgba(0,0,0,.48)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    sc.fillStyle=gradient;sc.fillRect(0,0,128,128);const shadowMap=new FT.CanvasTexture(shadowCanvas);this.textures.add(shadowMap);
    this.ballShadowMaterial=this.material(new FT.MeshBasicMaterial({map:shadowMap,color:0x0b1806,transparent:true,opacity:.72,depthWrite:false,side:2}));
    this.ballShadow=new FT.Mesh(this.geometry(new FT.PlaneGeometry(2,2)),this.ballShadowMaterial);
    this.ballShadow.rotation.x=-Math.PI/2;this.ballShadow.scale.set(.19,.19,1);this.ballShadow.position.y=.014;this.root.add(this.ballShadow);
    this.ballPanelCounts = {pentagons: 12, hexagons: 20};
  }

  updateBall(ball) {
    this.ballMesh.position.copy(ball.position);
    this.ballMesh.quaternion.copy(ball.orientation);
    const height = Math.max(0,ball.position.y-FB.ballRadius);
    const scale = .19 + Math.sqrt(Math.min(height,12))*.038;
    this.ballShadow.position.set(ball.position.x,.014,ball.position.z);
    this.ballShadow.scale.set(scale,scale,1);
    this.ballShadowMaterial.opacity = .72 / (1+height*.28);
  }

  makeFoot(hand) { return this.player.makeFoot(hand); }


  dispose() {
    this.player.dispose();
    this.root.removeFromParent();
    for(const geometry of this.geometries)geometry.dispose();
    for(const material of this.materials)material.dispose();
    for(const texture of this.textures)texture.dispose();
    this.geometries.clear();this.materials.clear();this.textures.clear();
  }
}

/* Football rigid sphere simulation; metres, seconds, kilograms.
   The moving boot and visible shin supply contact velocity, lift and spin. Low-speed
   contacts settle; firm strikes use the same material in every instep pose. */
class FootballPhysics {
  constructor(config = {}) {
    this.config = Object.assign({
      radius: FB.ballRadius, mass: FB.ballMass, gravity: FB.gravity,
      maxSpeed: 38, maxSpin: 190, maxFootSurfaceSpeed: 44, maxInstepAngularSpeed: 8, restitution: .57, rollingResistance: .38,
      slowRollingResistance: .08,
      groundFriction: .53, footRadius: .075, footHalfLength: .095,
      footRestitution: .6, footFriction: .4, contactSkin: .002,
      footSoftImpactSpeed: .25, footFirmImpactSpeed: 4.5,
      footPowerCompressionSpeed: 24, footReceiveRestitution: .30,
      airSpinDecay: .13, magnus: .0032, sideCurveMultiplier: 1.12, maxCurveAcceleration: 7.5
    }, config);
    const V = FT.Vector3;
    this.ball = {
      position: new V(0, this.config.radius, 0), velocity: new V(), spin: new V(),
      orientation: new FT.Quaternion(), radius: this.config.radius,
      mass: this.config.mass
    };
    this.events = [];
    this.time = 0;
    this.footStates = new Map();
    this.footData = [];
    this.frames = [];
    const x = FB.goalWidth * .5 + FB.postRadius;
    const y = FB.goalHeight + FB.postRadius;
    for (const sign of [-1, 1]) {
      const z = sign * FB.halfLength;
      this.frames.push(
        {a: new V(-x, 0, z), b: new V(-x, y, z)},
        {a: new V(x, 0, z), b: new V(x, y, z)},
        {a: new V(-x, y, z), b: new V(x, y, z)}
      );
    }
    this._previous = new V(); this._axis = new V(); this._normal = new V();
    this._point = new V(); this._segment = new V(); this._relative = new V();
    this._tangent = new V(); this._impulse = new V(); this._cross = new V();
    this._surface = new V(); this._footCenter = new V(); this._a = new V(); this._b = new V();
    this._ankleCenter = new V(); this._shoePoint = new V(); this._shoeNormal = new V();
    this._spinAxis = new V(); this._rotation = new FT.Quaternion();
    this._footLocal = new V(); this._footLocalNormal = new V(); this._contactArm = new V();
    this._frameEventTime = -10;
  }

  reset(position, velocity) {
    const b = this.ball;
    b.position.copy(position);
    b.position.y = Math.max(b.radius, b.position.y);
    velocity ? b.velocity.copy(velocity) : b.velocity.set(0, 0, 0);
    b.spin.set(0, 0, 0); b.orientation.identity();
    this.events.length = 0;
    this.footStates.clear();
    this._frameEventTime = -10;
  }

  clearContacts() {
    this.footStates.clear();
  }

  prepareFeet(feet, dt) {
    let count = 0;
    for (const state of this.footStates.values()) state.present = false;
    for (let i = 0; i < feet.length; i++) {
      const foot = feet[i];
      if (foot.enabled === false || !foot.position || !foot.previous) continue;
      const distance = foot.position.distanceTo(foot.previous);
      // A lost tracking pose or placement must never become a huge kick.
      if (!Number.isFinite(distance) || distance > Math.max(.7, dt * 25)) continue;
      let f = this.footData[count];
      if (!f) {
        f = {axis:new FT.Vector3(),velocity:new FT.Vector3(),ankleVelocity:new FT.Vector3(),angularVelocity:new FT.Vector3(),bootDriveAngularVelocity:new FT.Vector3(),shinDriveAngularVelocity:new FT.Vector3(),orientation:new FT.Quaternion(),previousOrientation:new FT.Quaternion(),targetOrientation:new FT.Quaternion(),inverse:new FT.Quaternion(),previousAnkle:new FT.Vector3(),targetAnkle:new FT.Vector3(),shinOrientation:new FT.Quaternion(),previousShinOrientation:new FT.Quaternion(),targetShinOrientation:new FT.Quaternion(),shinInverse:new FT.Quaternion(),shinAngularVelocity:new FT.Vector3(),contactPart:'boot',foot:null};
        this.footData[count] = f;
      }
      f.foot = foot; f.id = foot.id == null ? i : foot.id;
      if(foot.orientation)f.targetOrientation.copy(foot.orientation).normalize();else f.targetOrientation.identity();
      f.previousOrientation.copy(foot.previousOrientation||f.targetOrientation).normalize();
      f.orientation.copy(f.targetOrientation);f.inverse.copy(f.orientation).invert();
      f.axis.set(0,0,1).applyQuaternion(f.orientation).normalize();
      f.previousAnkle.copy(foot.previous);f.targetAnkle.copy(foot.position);
      if(foot.contactShape&&foot.contactOffset){
        f.previousAnkle.sub(this._axis.copy(foot.contactOffset).applyQuaternion(f.previousOrientation));
        f.targetAnkle.sub(this._axis.copy(foot.contactOffset).applyQuaternion(f.targetOrientation));
      }
      f.angularVelocity.copy(foot.angularVelocity||this._axis.set(0,0,0));if(!Number.isFinite(f.angularVelocity.lengthSq()))f.angularVelocity.set(0,0,0);
      f.targetShinOrientation.copy(foot.shinOrientation||f.targetOrientation).normalize();
      f.previousShinOrientation.copy(foot.previousShinOrientation||f.targetShinOrientation).normalize();
      f.shinOrientation.copy(f.targetShinOrientation);f.shinInverse.copy(f.shinOrientation).invert();
      f.shinAngularVelocity.copy(foot.shinAngularVelocity||this._axis.set(0,0,0));
      if(!Number.isFinite(f.shinAngularVelocity.lengthSq()))f.shinAngularVelocity.set(0,0,0);
      f.bootDriveAngularVelocity.copy(f.angularVelocity);f.shinDriveAngularVelocity.copy(f.shinAngularVelocity);
      const controllerAngular=foot.controlAngularVelocity||foot.shinAngularVelocity;
      if(controllerAngular&&Number.isFinite(controllerAngular.lengthSq())){
        // Instep remains visually immediate. Its pose change is an ankle
        // adjustment, not an unbounded powered kick from the trigger button.
        f.bootDriveAngularVelocity.sub(controllerAngular).clampLength(0,this.config.maxInstepAngularSpeed).add(controllerAngular);
        f.shinDriveAngularVelocity.copy(controllerAngular);
      }
      f.contactPart='boot';
      if (foot.velocity) f.velocity.copy(foot.velocity);
      else f.velocity.subVectors(foot.position, foot.previous).multiplyScalar(1 / dt);
      if (!Number.isFinite(f.velocity.lengthSq())) f.velocity.set(0, 0, 0);
      f.useAnkleVelocity=!!(foot.driveVelocity||foot.ankleVelocity||(foot.contactShape&&foot.contactOffset&&foot.previousOrientation));
      // Real controller/locomotion motion drives the impact; the visual floor
      // limit must not add energy when changing instep raises the displayed shoe.
      f.ankleVelocity.copy(foot.driveVelocity||foot.ankleVelocity||f.velocity);
      if(!Number.isFinite(f.ankleVelocity.lengthSq()))f.ankleVelocity.set(0,0,0);
      if(f.useAnkleVelocity&&!foot.driveVelocity&&!foot.ankleVelocity){
        // foot.velocity remains the supplied contact-centre average. Remove only
        // its rotating-offset chord; the contact lever below is then ankle-based.
        this._axis.subVectors(f.targetAnkle,f.previousAnkle).sub(foot.position).add(foot.previous);
        f.ankleVelocity.addScaledVector(this._axis,1/dt);
      }
      f.radius = Math.max(.04, Math.min(.11, foot.radius || this.config.footRadius));
      f.halfLength = foot.halfLength == null ? this.config.footHalfLength : Math.max(0, Math.min(.15, foot.halfLength));
      // Angular sweeps count too: a toe can cross the ball while the ankle barely moves.
      const bounds=foot.contactShape?.bounds;
      const sweepRadius=bounds?Math.hypot(Math.max(Math.abs(bounds.min[0]),Math.abs(bounds.max[0])),Math.max(Math.abs(bounds.min[1]),Math.abs(bounds.max[1])),Math.max(Math.abs(bounds.min[2]),Math.abs(bounds.max[2]))):f.halfLength+f.radius;
      const shinBounds=foot.shinContactShape?.bounds;
      const shinRadius=shinBounds?Math.hypot(Math.max(Math.abs(shinBounds.min[0]),Math.abs(shinBounds.max[0])),Math.max(Math.abs(shinBounds.min[1]),Math.abs(shinBounds.max[1])),Math.max(Math.abs(shinBounds.min[2]),Math.abs(shinBounds.max[2]))):0;
      f.distance=f.previousAnkle.distanceTo(f.targetAnkle)+Math.max(f.previousOrientation.angleTo(f.targetOrientation)*sweepRadius,f.previousShinOrientation.angleTo(f.targetShinOrientation)*shinRadius);
      let state = this.footStates.get(f.id);
      if (!state) {
        state = {contact: false, seen: false, present: true};
        this.footStates.set(f.id, state);
      }
      state.seen = false; state.present = true; f.state = state;
      count++;
    }
    for (const state of this.footStates.values()) if (!state.present) {
      state.contact = false;
    }
    return count;
  }

  step(dt, feet = [], goalkeeper = null) {
    this.events.length = 0;
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    dt = Math.min(dt, .05);
    this.time += dt;
    const b = this.ball, cfg = this.config;
    if (!Number.isFinite(b.position.lengthSq() + b.velocity.lengthSq() + b.spin.lengthSq())) {
      this.reset(new FT.Vector3(0, b.radius, 0)); return;
    }
    b.velocity.clampLength(0, cfg.maxSpeed);
    const footCount = this.prepareFeet(feet, dt);
    let travel = b.velocity.length() * dt;
    for (let i = 0; i < footCount; i++) travel = Math.max(travel, this.footData[i].distance);
    if (goalkeeper && goalkeeper.isNear(b, travel)) travel = Math.max(travel, goalkeeper.maxTravel || 0);
    const steps = Math.max(1, Math.min(24, Math.ceil(travel / .042)));
    const h = dt / steps;
    for (let step = 0; step < steps; step++) {
      const alpha = (step + 1) / steps;
      this._previous.copy(b.position);
      this.integrate(h);
      for (let i = 0; i < footCount; i++) this.collideFoot(this.footData[i], alpha, h);
      for (let i = 0; i < this.frames.length; i++) this.collideFrame(this.frames[i]);
      if (goalkeeper) goalkeeper.collide(this, alpha, h);
      this.collideGround(h);
      this.collideNet();
      b.velocity.clampLength(0, cfg.maxSpeed);
      b.spin.clampLength(0, cfg.maxSpin);
      const spinSpeed = b.spin.length();
      if (spinSpeed > .001) {
        this._spinAxis.copy(b.spin).multiplyScalar(1 / spinSpeed);
        this._rotation.setFromAxisAngle(this._spinAxis, spinSpeed * h);
        b.orientation.premultiply(this._rotation).normalize();
      }
    }
    for (let i = 0; i < footCount; i++) {
      const f = this.footData[i];
      if (!f.state.seen) {
        f.orientation.copy(f.targetOrientation);f.inverse.copy(f.orientation).invert();f.axis.set(0,0,1).applyQuaternion(f.orientation);
        f.shinOrientation.copy(f.targetShinOrientation);f.shinInverse.copy(f.shinOrientation).invert();
        this._footCenter.copy(f.foot.position);
        this._ankleCenter.copy(f.targetAnkle);
        let separated;
        if(f.foot.contactShape)separated=this.contactDistance(f,b.radius+.025)>b.radius+.025;
        else{
          this._a.copy(this._footCenter).addScaledVector(f.axis, -f.halfLength);
          this._b.copy(this._footCenter).addScaledVector(f.axis, f.halfLength);
          this.closestPoint(b.position, this._a, this._b, this._point);
          separated=b.position.distanceToSquared(this._point)>(b.radius+f.radius+.025)**2;
        }
        if(separated)f.state.contact=false;
      }
    }
  }

  integrate(dt) {
    const b = this.ball, speed = b.velocity.length();
    // Smooth drag crisis approximation; the aerodynamic coefficient is bounded.
    const drag = .0108 + .0075 / (1 + Math.exp((speed - 16) * .45));
    this._cross.crossVectors(b.spin, b.velocity).multiplyScalar(this.config.magnus);
    // A little more yaw-spin bend without increasing topspin/backspin lift.
    const sideCurve=this.config.magnus*(this.config.sideCurveMultiplier-1)*b.spin.y;
    this._cross.x+=sideCurve*b.velocity.z;
    this._cross.z-=sideCurve*b.velocity.x;
    this._cross.clampLength(0, this.config.maxCurveAcceleration);
    b.velocity.addScaledVector(this._cross, dt);
    b.velocity.multiplyScalar(1 / (1 + drag * speed * dt));
    b.velocity.y -= this.config.gravity * dt;
    b.position.addScaledVector(b.velocity, dt);
    b.spin.multiplyScalar(Math.exp(-this.config.airSpinDecay * dt));
  }

  closestPoint(point, a, c, target) {
    this._segment.subVectors(c, a);
    const length = this._segment.lengthSq();
    const along = length > 1e-12 ? Math.max(0, Math.min(1,
      this._relative.subVectors(point, a).dot(this._segment) / length)) : 0;
    target.copy(a).addScaledVector(this._segment, along);
    return target;
  }

  shoeDistance(f,maxDistance){
    const foot=f.foot;
    this._footLocal.copy(this.ball.position).sub(this._footCenter).applyQuaternion(f.inverse).add(foot.contactOffset);
    const distance=foot.contactShape.query(this._footLocal,this._point,this._footLocalNormal,maxDistance);
    if(Number.isFinite(distance)){
      this._point.sub(foot.contactOffset).applyQuaternion(f.orientation).add(this._footCenter);
      this._normal.copy(this._footLocalNormal).applyQuaternion(f.orientation).normalize();
      if(!Number.isFinite(this._normal.lengthSq())||this._normal.lengthSq()<.5)this._normal.set(0,1,0);
    }
    return distance;
  }

  shinDistance(f,maxDistance){
    this._footLocal.copy(this.ball.position).sub(this._ankleCenter).applyQuaternion(f.shinInverse);
    const distance=f.foot.shinContactShape.query(this._footLocal,this._point,this._footLocalNormal,maxDistance);
    if(Number.isFinite(distance)){
      this._point.applyQuaternion(f.shinOrientation).add(this._ankleCenter);
      this._normal.copy(this._footLocalNormal).applyQuaternion(f.shinOrientation).normalize();
    }
    return distance;
  }

  contactDistance(f,maxDistance){
    const shoe=this.shoeDistance(f,maxDistance);f.contactPart='boot';
    if(!f.foot.shinContactShape)return shoe;
    this._shoePoint.copy(this._point);this._shoeNormal.copy(this._normal);
    const shin=this.shinDistance(f,maxDistance);
    // These are two visible surfaces of one foot, with one contact/release state.
    // The shin must catch an ankle-height sweep before the ball reaches the laces.
    if(shin<shoe){f.contactPart='shin';return shin;}
    this._point.copy(this._shoePoint);this._normal.copy(this._shoeNormal);return shoe;
  }

  footSurfaceVelocity(f,point,target){
    target.copy(f.useAnkleVelocity?f.ankleVelocity:f.velocity);
    if(f.contactPart==='shin'){
      this._contactArm.subVectors(point,this._ankleCenter);
      this._cross.crossVectors(f.shinDriveAngularVelocity,this._contactArm);
      return target.add(this._cross).clampLength(0,this.config.maxFootSurfaceSpeed);
    }
    if(f.foot.contactShape){
      this._contactArm.subVectors(point,this._footCenter);
      if(f.useAnkleVelocity)this._contactArm.add(this._axis.copy(f.foot.contactOffset).applyQuaternion(f.orientation));
      this._cross.crossVectors(f.bootDriveAngularVelocity,this._contactArm);target.add(this._cross);
    }
    // Limit only the assembled velocity at the contact point. Clipping the
    // rotating boot-centre chord first corrupts the recovered ankle motion.
    return target.clampLength(0,this.config.maxFootSurfaceSpeed);
  }

  contactFirmness(speed){
    const cfg=this.config;
    const speedBlend=Math.max(0,Math.min(1,(speed-cfg.footSoftImpactSpeed)/(cfg.footFirmImpactSpeed-cfg.footSoftImpactSpeed)));
    const nudgeBlend=Math.max(0,Math.min(1,(speed-.25)/1.15));
    const controlBlend=Math.max(0,Math.min(1,(speed-.40)/.50));
    const nudge=nudgeBlend*nudgeBlend*(3-2*nudgeBlend),firmness=speedBlend*speedBlend*(3-2*speedBlend);
    return nudge+(firmness-nudge)*controlBlend*controlBlend*(3-2*controlBlend);
  }

  collideFoot(f, alpha, dt) {
    const b = this.ball, foot = f.foot, state = f.state, cfg = this.config;
    const instep=Number.isFinite(foot.instepAmount)?Math.max(0,Math.min(1,foot.instepAmount)):Number(!!foot.instep);
    f.orientation.slerpQuaternions(f.previousOrientation,f.targetOrientation,alpha);
    f.inverse.copy(f.orientation).invert();f.axis.set(0,0,1).applyQuaternion(f.orientation);
    f.shinOrientation.slerpQuaternions(f.previousShinOrientation,f.targetShinOrientation,alpha);
    f.shinInverse.copy(f.shinOrientation).invert();
    this._ankleCenter.lerpVectors(f.previousAnkle,f.targetAnkle,alpha);
    if(foot.contactShape&&foot.contactOffset){
      this._footCenter.copy(this._ankleCenter);
      this._footCenter.add(this._axis.copy(foot.contactOffset).applyQuaternion(f.orientation));
    }else this._footCenter.lerpVectors(foot.previous,foot.position,alpha);
    let distance,radius;
    if(foot.contactShape){
      radius=b.radius+cfg.contactSkin;distance=this.contactDistance(f,radius);
      if(!Number.isFinite(distance)||distance>radius)return;
    }else{
      this._a.copy(this._footCenter).addScaledVector(f.axis, -f.halfLength);
      this._b.copy(this._footCenter).addScaledVector(f.axis, f.halfLength);
      this.closestPoint(b.position,this._a,this._b,this._point);
      this._normal.subVectors(b.position,this._point);radius=b.radius+f.radius+cfg.contactSkin;
      const distSq=this._normal.lengthSq();if(distSq>radius*radius)return;distance=Math.sqrt(distSq);
      if(distance>1e-6)this._normal.multiplyScalar(1/distance);
      else{this._normal.copy(f.velocity);this._normal.y=Math.max(0,this._normal.y);if(this._normal.lengthSq()<.0001)this._normal.set(0,0,-1);this._normal.normalize();}
    }
    state.seen = true;
    this.footSurfaceVelocity(f,this._point,this._surface);
    this._relative.subVectors(b.velocity, this._surface);
    const approach = -this._relative.dot(this._normal);
    const penetration = radius - distance;
    const newContact = !state.contact && (approach > .045 || (penetration > .008 && f.velocity.lengthSq() > .003));
    let touch;
    if (newContact) {
      const event = {
        type: 'touch', footId: f.id, time: this.time, speed: Math.max(0, approach),
        instep: instep>.5, instepAmount: instep, surface: f.contactPart, position: b.position.clone()
      };
      state.contact = true;
      touch = event;
      this.events.push(event);
    }
    // The two-millimetre skin bridges numerical gaps, not a hidden oversized foot.
    // A resting boot may support or trap a ball without repeated bounce impulses.
    if (penetration > 0) b.position.addScaledVector(this._normal, penetration + .0001);
    let impulse=0;
    if (approach > 0) {
      // Contact velocity already includes running once. High-energy impacts
      // compress the boot/ball instead of reaching a low artificial speed cap.
      const activeSpeed=Math.max(0,this._surface.dot(this._normal)),share=Math.min(1,activeSpeed/approach);
      const compression=Math.max(0,Math.min(1,(activeSpeed-cfg.footFirmImpactSpeed)/(cfg.footPowerCompressionSpeed-cfg.footFirmImpactSpeed)));
      const receiveBlend=Math.max(0,Math.min(1,(approach-.40)/(cfg.footFirmImpactSpeed-.40)));
      const firmness=this.contactFirmness(approach);
      const active=cfg.footRestitution*Math.min(firmness,this.contactFirmness(activeSpeed))*(1-compression*compression*(3-2*compression));
      // Incoming ball energy cannot unlock active shot power. A passive boot
      // absorbs more of a hard rebound while tiny receiving touches stay soft.
      const receiving=(cfg.footRestitution+(cfg.footReceiveRestitution-cfg.footRestitution)*receiveBlend*receiveBlend*(3-2*receiveBlend))*firmness;
      const restitution=share>=1?active:receiving+(active-receiving)*share;
      impulse = (1 + restitution) * approach;
      b.velocity.addScaledVector(this._normal, impulse);
    }
    // Gravity supplies a normal load while a ball is supported on a sole/toe.
    // This permits physical balancing and rolling without snapping to the boot.
    const support=Math.max(0,this._normal.y)*cfg.gravity*dt;
    if(impulse>0||support>0)this.surfaceFriction(this._normal,this._surface,
      Math.max(impulse,support)*cfg.footFriction);
    if (touch && foot.matchKick && foot.matchAim && approach > .58 && f.contactPart==='boot') {
      // Desktop commands tune the impulse on the original boot surface. A miss remains a miss.
      const aim = foot.matchAim, yawSupport = aim.x*this._normal.x + aim.z*this._normal.z;
      if (yawSupport > .10) {
        const kind = foot.matchKick, force = Math.min(7,Math.max(0,approach));
        const speed = kind==='pass' ? 9.2+force*.65 : kind==='cross' ? 17+force*.63 : 22+force*.77;
        const lift = kind==='pass' ? .14 : kind==='cross' ? 8+force*.2 : footballClamp(2.4 + (foot.matchPitch+.35)*5,.45,7);
        b.velocity.set(aim.x*speed,lift,aim.z*speed);
        if(kind==='pass')b.spin.set(b.velocity.z,0,-b.velocity.x).multiplyScalar(.93/b.radius);
        else b.spin.multiplyScalar(.3);
        touch.kind = kind;
      }
    }
  }

  surfaceFriction(normal, surfaceVelocity, limit) {
    const b = this.ball, r = b.radius;
    this._cross.copy(normal).multiplyScalar(-r);
    this._tangent.crossVectors(b.spin, this._cross).add(b.velocity).sub(surfaceVelocity);
    this._tangent.addScaledVector(normal, -this._tangent.dot(normal));
    // Solid-sphere translational plus rotational effective inverse mass = 3.5/m.
    this._impulse.copy(this._tangent).multiplyScalar(-1 / 3.5);
    this._impulse.clampLength(0, limit);
    b.velocity.add(this._impulse);
    this._tangent.crossVectors(this._cross, this._impulse).multiplyScalar(2.5 / (r * r));
    b.spin.add(this._tangent);
  }

  collideGround(dt) {
    const b = this.ball, r = b.radius;
    if (b.position.y > r + .00015) return;
    b.position.y = r;
    const incoming = Math.max(0, -b.velocity.y);
    let normalImpulse = this.config.gravity * dt;
    if (b.velocity.y < 0) {
      if (incoming > .65) {
        b.velocity.y = incoming * this.config.restitution;
        normalImpulse += incoming * (1 + this.config.restitution);
      } else {
        normalImpulse += incoming; b.velocity.y = 0;
      }
    }
    this._normal.set(0, 1, 0); this._surface.set(0, 0, 0);
    this.surfaceFriction(this._normal, this._surface, this.config.groundFriction * normalImpulse);
    if (b.velocity.y > .15) return;
    const planarSpeed = Math.hypot(b.velocity.x, b.velocity.z);
    if (planarSpeed > 0) {
      // The final slow roll sheds slightly more energy. Smooth entry/exit keep
      // tiny nudges and the fast part of a pass free of a braking threshold.
      const rise=Math.max(0,Math.min(1,(planarSpeed-.30)/.70));
      const fall=Math.max(0,Math.min(1,(6-planarSpeed)/2));
      const slowBand=rise*rise*(3-2*rise)*fall*fall*(3-2*fall);
      const resistance=this.config.rollingResistance+this.config.slowRollingResistance*slowBand;
      const factor = Math.max(0, 1 - resistance * dt / planarSpeed);
      b.velocity.x *= factor; b.velocity.z *= factor;
      // Rolling resistance removes both translational and rolling energy.
      b.spin.x *= factor; b.spin.z *= factor;
    }
    b.spin.y *= Math.exp(-1.7 * dt);
    if (Math.hypot(b.velocity.x, b.velocity.z) < .025 && Math.hypot(b.spin.x, b.spin.z) < .3) {
      b.velocity.x = 0; b.velocity.z = 0; b.spin.x = 0; b.spin.z = 0;
    }
  }

  collideFrame(frame) {
    const b = this.ball;
    this.closestPoint(b.position, frame.a, frame.b, this._point);
    this._normal.subVectors(b.position, this._point);
    const total = b.radius + FB.postRadius, sq = this._normal.lengthSq();
    if (sq >= total * total) return;
    const distance = Math.sqrt(sq);
    if (distance > 1e-7) this._normal.multiplyScalar(1 / distance);
    else this._normal.copy(b.velocity).negate().normalize();
    const speed = -b.velocity.dot(this._normal);
    b.position.addScaledVector(this._normal, total - distance + .0001);
    if (speed > 0) {
      b.velocity.addScaledVector(this._normal, speed * 1.72);
      this._surface.set(0, 0, 0);
      this.surfaceFriction(this._normal, this._surface, speed * .16);
      if (this.time - this._frameEventTime > .06 && speed > .15) {
        this.events.push({type: 'frame', time: this.time, speed, position: b.position.clone()});
        this._frameEventTime = this.time;
      }
    }
  }

  collideNet() {
    const b = this.ball, p = b.position, prev = this._previous, r = b.radius;
    const half = FB.goalWidth * .5 + FB.postRadius;
    const top = FB.goalHeight + FB.postRadius;
    const front = FB.halfLength, back = front + FB.goalDepth;
    for (const sign of [-1, 1]) {
      const z = p.z * sign, oldZ = prev.z * sign;
      if (z < front - r || z > back + r + .5 || Math.abs(p.x) > half + r + .5 || p.y > top + r + .5) continue;
      if (Math.abs(p.x) <= half && p.y <= top && z >= back - r && oldZ <= back - r) {
        p.z = sign * (back - r); b.velocity.z = -sign * Math.abs(b.velocity.z) * .13;
        b.velocity.x *= .65; b.velocity.y *= .65;
      } else if (Math.abs(p.x) <= half && p.y <= top && z <= back + r && oldZ > back + r) {
        p.z = sign * (back + r); b.velocity.z = sign * Math.abs(b.velocity.z) * .13;
      }
      if (z >= front && z <= back && p.y <= top) {
        for (const side of [-1, 1]) {
          if (p.x * side >= half - r && prev.x * side <= half - r) {
            p.x = side * (half - r); b.velocity.x = -side * Math.abs(b.velocity.x) * .15;
          } else if (p.x * side <= half + r && prev.x * side > half + r) {
            p.x = side * (half + r); b.velocity.x = side * Math.abs(b.velocity.x) * .15;
          }
        }
      }
      if (z >= front && z <= back && Math.abs(p.x) <= half) {
        if (p.y >= top - r && prev.y <= top - r) {
          p.y = top - r; b.velocity.y = -Math.abs(b.velocity.y) * .12;
        } else if (p.y <= top + r && prev.y > top + r) {
          p.y = top + r; b.velocity.y = Math.abs(b.velocity.y) * .12;
        }
      }
    }
  }

}

/* Prebaked smooth keeper geometry. Positions: 16-bit bounds; normals: octahedral. */
class FootballKeeperMeshes {
  static data=globalThis.FirstTouchKeeperMeshes;
  static decoded=new Map();
  static create(name){
    if(this.decoded.has(name))return this.decoded.get(name);
    const mirror=name==='gloveL',m=this.data[mirror?'gloveR':name];
    if(!m)throw new Error('Unknown keeper mesh');
    const raw=atob(m.data),bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const view=new DataView(bytes.buffer),position=new Float32Array(m.vertices*3),normal=new Float32Array(m.vertices*3),uv=new Float32Array(m.vertices*2),index=new Uint16Array(m.count);
    const skinIndex=m.skin?new Uint16Array(m.vertices*4):null,skinWeight=m.skin?new Float32Array(m.vertices*4):null;let offset=0;
    const u16=()=>{const value=view.getUint16(offset,true);offset+=2;return value;};
    for(let i=0;i<m.vertices;i++){
      for(let j=0;j<3;j++)position[i*3+j]=m.min[j]+u16()/65535*m.span[j];
      let x=view.getInt16(offset,true)/32767,y=view.getInt16(offset+2,true)/32767;offset+=4;
      const z=1-Math.abs(x)-Math.abs(y);
      if(z<0){const oldX=x;x=(1-Math.abs(y))*(x<0?-1:1);y=(1-Math.abs(oldX))*(y<0?-1:1);}
      const length=Math.hypot(x,y,z);normal[i*3]=x/length;normal[i*3+1]=y/length;normal[i*3+2]=z/length;
      uv[i*2]=u16()/65535;uv[i*2+1]=u16()/65535;
      if(m.skin){skinIndex[i*4]=view.getUint8(offset++);skinIndex[i*4+1]=view.getUint8(offset++);const weight=u16()/65535;skinWeight[i*4]=weight;skinWeight[i*4+1]=1-weight;}
      if(mirror){position[i*3]*=-1;normal[i*3]*=-1;}
    }
    for(let i=0;i<m.count;i++)index[i]=u16();
    if(mirror)for(let i=0;i<m.count;i+=3){const b=index[i+1];index[i+1]=index[i+2];index[i+2]=b;}
    const geometry=new FT.BufferGeometry();geometry.setAttribute('position',new FT.BufferAttribute(position,3));geometry.setAttribute('normal',new FT.BufferAttribute(normal,3));geometry.setAttribute('uv',new FT.BufferAttribute(uv,2));geometry.setIndex(new FT.BufferAttribute(index,1));
    if(m.skin){geometry.setAttribute('skinIndex',new FT.BufferAttribute(skinIndex,4));geometry.setAttribute('skinWeight',new FT.BufferAttribute(skinWeight,4));}
    geometry.computeBoundingSphere();this.decoded.set(name,geometry);return geometry;
  }
}

/* One smooth goalkeeper: pre-baked geometry, fixed-length limbs and shared visual/contact poses. */
class FootballGoalkeeperVisual {
  static boneNames=['pelvis','torso','head','upperArmL','forearmL','handL','upperArmR','forearmR','handR','thighL','shinL','footL','thighR','shinR','footR','elbowL','elbowR','kneeL','kneeR'];
  static rests=[[0,.95,0],[0,.94,0],[0,1.506,0],[-.207,1.435,0],[-.207,1.154,0],[-.207,.895,0],[.207,1.435,0],[.207,1.154,0],[.207,.895,0],[-.095,.95,0],[-.095,.52,0],[-.095,.08,0],[.095,.95,0],[.095,.52,0],[.095,.08,0],[-.207,1.154,0],[.207,1.154,0],[-.095,.52,0],[.095,.52,0]];
  constructor(owner){
    this.owner=owner;this.scale=1.04;this.root=new FT.Group();this.group=this.root;this.root.name='Goalkeeper';owner.root.add(this.root);this.root.scale.setScalar(this.scale);
    this.up=new FT.Vector3(0,1,0);this.down=new FT.Vector3(0,-1,0);this.forward=new FT.Vector3(0,0,-1);this.xAxis=new FT.Vector3(1,0,0);this.zAxis=new FT.Vector3(0,0,1);
    this.v=new FT.Vector3();this.v2=new FT.Vector3();this.v3=new FT.Vector3();this.v4=new FT.Vector3();this.q=new FT.Quaternion();this.q2=new FT.Quaternion();this.bodyQ=new FT.Quaternion();this.yawQ=new FT.Quaternion();this.inverseYaw=new FT.Quaternion();this.hip=new FT.Vector3();this.target=new FT.Vector3();this.leadTarget=new FT.Vector3();this.handCentreLocal=new FT.Vector3(0,-.094,-.009);
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
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');
    const colours=['#171b20','#171b20','#181d22','#13171b','#151a1e','#161d22','#a6adb1','#101417','#161a1e','#c5cbc8','#313a3d','#252d31','#b7c1bd','#d5dcd7','#20282c','#7f8c8e'];
    let seed=6513;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let k=0;k<16;k++){const x=(k%4)*128,y=Math.floor(k/4)*128;c.save();c.translate(x,y);c.fillStyle=colours[k];c.fillRect(0,0,128,128);
      if(k!==6){for(let j=0;j<1400;j++){c.fillStyle=random()>.5?'rgba(255,255,255,.025)':'rgba(0,0,0,.025)';c.fillRect(random()*128,random()*128,.6,.6);}}
      if([0,1,2,3,4].includes(k)){c.strokeStyle='rgba(125,145,151,.075)';c.lineWidth=.6;for(let xx=5;xx<125;xx+=5){c.beginPath();c.moveTo(xx,0);c.lineTo(xx,128);c.stroke();}c.fillStyle='rgba(0,0,0,.12)';c.fillRect(0,118,128,3);}
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
      wrist.set(sg*(.34-.055*push),hipY+.24-.075*push,-.32+.065*push);
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
      this.v3.set(sg*.22,-.55,1);this.solveJoint(shoulder,wrist,.281,.259,this.v3,elbow);this.aimBone('upperArm'+s,shoulder,elbow);this.aimBone('forearm'+s,elbow,wrist);
      this.bone['hand'+s].quaternion.setFromUnitVectors(this.down,this.v.set(sg*.06,-.78,-.48).normalize()).slerp(this.bone['forearm'+s].quaternion,activeDive);this.bone['elbow'+s].position.copy(elbow);this.bone['elbow'+s].quaternion.copy(this.bone['upperArm'+s].quaternion).slerp(this.bone['forearm'+s].quaternion,.5);
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

/* One keeper, one real body. Shot prediction only chooses the animation;
   the ball is saved exclusively by contact with its moving gloves and limbs. */
class FootballGoalkeeper {
  constructor(field, goalEnd = -1) {
    const V = FT.Vector3;
    this.field = field;
    this.goalEnd = goalEnd < 0 ? -1 : 1;
    this.homeZ = this.goalEnd * (FB.halfLength - .88);
    this.enabled = true;
    this.time = 0;
    this.position = new V(0, 0, this.homeZ);
    this.velocity = new V();
    this.visual = new FootballGoalkeeperVisual(field);
    this.state = {
      position: this.position, yaw: this.goalEnd < 0 ? Math.PI : 0,
      phase: 'ready', phaseProgress: 0, side: 1, targetHeight: 1,
      lateralSpeed: 0, takeoffSpeed: 0, time: 0, reachTarget: new V(0, 1, this.homeZ - this.goalEnd * .36)
    };
    this.previousState = this._newState();
    this.renderState = this._newState();
    this._phaseTime = 0;
    this._predictTimer = 0;
    this._threatAge = 0;
    this._lastImpact = -10;
    this._diveStart = new V();
    this._diveEnd = new V();
    this._prediction = new FootballPhysics();
    this.threat = {valid: false, x: 0, y: 1, time: 9};
    this.maxTravel = 0;
    this.saves = 0;
    this.dives = 0;
    this.colliders = [];
    this._a = new V(); this._b = new V(); this._axis = new V();
    this._point = new V(); this._normal = new V(); this._surface = new V();
    this._velocityA = new V(); this._velocityB = new V(); this._relative = new V();
    this._predictPrevious = new V();
    this._fixedDt = FB.fixedStep;
    this.reset();
  }

  _newState() {
    return {position: new FT.Vector3(), yaw: 0, phase: 'ready', phaseProgress: 0,
      side: 1, targetHeight: 1, lateralSpeed: 0, takeoffSpeed: 0, time: 0, reachTarget: new FT.Vector3()};
  }

  _copyState(target, source) {
    target.position.copy(source.position); target.reachTarget.copy(source.reachTarget);
    target.yaw = source.yaw; target.phase = source.phase; target.phaseProgress = source.phaseProgress;
    target.side = source.side; target.targetHeight = source.targetHeight;
    target.lateralSpeed = source.lateralSpeed; target.takeoffSpeed = source.takeoffSpeed; target.time = source.time;
  }

  reset() {
    this.position.set(0, 0, this.homeZ); this.velocity.set(0, 0, 0);
    this.state.phase = 'ready'; this.state.phaseProgress = 0;
    this.state.side = 1; this.state.targetHeight = 1; this.state.lateralSpeed = 0; this.state.takeoffSpeed = 0;
    this.state.yaw = this.goalEnd < 0 ? Math.PI : 0;
    this.state.reachTarget.set(0, 1, this.homeZ - this.goalEnd * .36);
    this.time = 0; this.state.time = 0; this._phaseTime = 0;
    this.saves = 0; this.dives = 0; this.clearContacts();
    this._copyState(this.previousState, this.state);
    this._copyState(this.renderState, this.state);
    this.visual.updatePose(this.state);
    this._capture(true);
    this.maxTravel = 0;
  }

  clearContacts() {
    this._lastImpact = -10;
    this._threatAge = 0; this._predictTimer = 0;
    this.threat.valid = false; this.threat.time = 9;
  }

  _capture(initial = false) {
    const capsules = this.visual.capsules;
    this.maxTravel = 0;
    for (let i = 0; i < capsules.length; i++) {
      const source = capsules[i];
      let capsule = this.colliders[i];
      if (!capsule) {
        capsule = {a: new FT.Vector3(), b: new FT.Vector3(), previousA: new FT.Vector3(),
          previousB: new FT.Vector3(), radius: source.radius, kind: source.kind};
        this.colliders[i] = capsule; initial = true;
      }
      capsule.previousA.copy(capsule.a); capsule.previousB.copy(capsule.b);
      capsule.a.copy(source.a); capsule.b.copy(source.b);
      capsule.radius = source.radius; capsule.kind = source.kind;
      if (initial) {capsule.previousA.copy(capsule.a); capsule.previousB.copy(capsule.b);}
      this.maxTravel = Math.max(this.maxTravel, capsule.a.distanceTo(capsule.previousA), capsule.b.distanceTo(capsule.previousB));
    }
  }

  _predict(ball) {
    const threat = this.threat, end = this.goalEnd;
    threat.valid = false; threat.time = 9;
    if (!ball || !Number.isFinite(ball.position.lengthSq() + ball.velocity.lengthSq() + ball.spin.lengthSq()) ||
      ball.velocity.z * end < 1.25 || ball.position.z * end < FB.halfLength - 30 ||
      ball.position.z * end > this.homeZ * end + .5) return;
    const simulator = this._prediction, predicted = simulator.ball;
    predicted.position.copy(ball.position); predicted.velocity.copy(ball.velocity); predicted.spin.copy(ball.spin);
    const plane = this.homeZ - end * .36, h = 1 / 90;
    // Reuse the released ball integrator: drag, Magnus and the actual turf
    // friction/bounce all participate. There is no invisible save target force.
    for (let step = 0; step < 198; step++) {
      this._predictPrevious.copy(predicted.position);
      simulator.integrate(h); simulator.collideGround(h);
      if (predicted.position.z * end >= plane * end) {
        const dz = predicted.position.z - this._predictPrevious.z;
        const part = dz === 0 ? 1 : footballClamp((plane - this._predictPrevious.z) / dz, 0, 1);
        threat.x = this._predictPrevious.x + (predicted.position.x - this._predictPrevious.x) * part;
        threat.y = this._predictPrevious.y + (predicted.position.y - this._predictPrevious.y) * part;
        threat.time = (step + part) * h;
        threat.valid = Math.abs(threat.x) < FB.goalWidth * .5 + .75 && threat.y < FB.goalHeight + .45;
        return;
      }
      if (predicted.velocity.z * end < .12) return;
    }
  }

  _phase(phase) {this.state.phase = phase; this.state.phaseProgress = 0; this._phaseTime = 0;}

  _beginSave() {
    const s = this.state, t = this.threat, dx = t.x - this.position.x;
    s.takeoffSpeed = s.lateralSpeed;
    s.side = dx < 0 ? -1 : 1;
    s.targetHeight = footballClamp(t.y, .16, 2.75);
    s.reachTarget.set(t.x, s.targetHeight, this.homeZ - this.goalEnd * .36);
    this._diveStart.copy(this.position);
    // The body covers part of the distance; the remaining reach is the visible
    // bent arm. Both are bounded, so hard shots into the corner can beat him.
    const lateral = footballClamp(Math.abs(dx) - .86, .32, 2.10);
    this._diveEnd.copy(this.position);
    this._diveEnd.x = footballClamp(this.position.x + s.side * lateral, -3.28, 3.28);
    this._diveEnd.z -= this.goalEnd * .12;
    this.velocity.set(0, 0, 0); this._phase('push'); this.dives++;
  }

  update(dt, ball) {
    if (!this.enabled || !(dt > 0) || !Number.isFinite(dt)) return;
    dt = Math.min(dt, .05); this._fixedDt = dt;
    this._copyState(this.previousState, this.state);
    this.time += dt; this.state.time = this.time;
    this._predictTimer -= dt;
    if (this._predictTimer <= 0) {this._predict(ball); this._predictTimer = .045;}
    else this.threat.time = Math.max(0, this.threat.time - dt);
    this._threatAge = this.threat.valid ? this._threatAge + dt : 0;
    const s = this.state;
    if (s.phase === 'ready') {
      const incoming = this.threat.valid && this._threatAge >= .115;
      const collecting = this.matchActive && !incoming && ball && ball.position.y < .52 &&
        ball.position.z*this.goalEnd > FB.halfLength-9.2 && Math.abs(ball.position.x) < 9 &&
        ball.velocity.z*this.goalEnd > -.8 && ball.velocity.lengthSq() < 87;
      const target = incoming ? this.threat.x : collecting ? ball.position.x : (ball ? ball.position.x * .13 : 0);
      const span = collecting ? 6.7 : 2.68;
      const targetX = footballClamp(target, -span, span);
      const delta = targetX - this.position.x;
      const maximum = incoming || collecting ? 3.9 : 1.65;
      const desired = Math.sign(delta) * Math.min(maximum, Math.sqrt(Math.abs(delta) * 17));
      this.velocity.x += footballClamp(desired - this.velocity.x, -13 * dt, 13 * dt);
      this.position.x += this.velocity.x * dt;
      if (this.matchActive && ball) {
        const depth = FB.halfLength - ball.position.z*this.goalEnd;
        const advance = incoming ? 0 : collecting ? footballClamp(depth-1.22,.3,7.2) : footballClamp(depth*.036,.26,2.55);
        const targetZ = this.homeZ - advance*this.goalEnd;
        this.velocity.z += footballClamp((targetZ-this.position.z)*6-this.velocity.z,-11*dt,11*dt);
        this.velocity.z = footballClamp(this.velocity.z,-4.3,4.3);
        this.position.z += this.velocity.z*dt;
      } else this.position.z += (this.homeZ - this.position.z) * Math.min(1, dt * 4);
      this.position.y = 0;
      s.lateralSpeed = this.velocity.x;
      s.targetHeight += ((incoming ? footballClamp(this.threat.y, .18, 2.55) : .92) - s.targetHeight) * Math.min(1, dt * 10);
      s.reachTarget.set(this.position.x, s.targetHeight, this.homeZ - this.goalEnd * .36);
      // Set first, then push off. A central ball is blocked by the ready body;
      // lateral and low balls prompt the actual sideways save animation.
      const dx = this.threat.x - this.position.x;
      if (incoming && this.threat.time < .45 && this.threat.time > .055 &&
          (Math.abs(dx) > .48 || this.threat.y < .55 || this.threat.y > 1.82)) this._beginSave();
    } else {
      this._phaseTime += dt;
      if (s.phase === 'push') {
        s.phaseProgress = footballClamp(this._phaseTime / .075, 0, 1);
        s.lateralSpeed = 0;
        if (this._phaseTime >= .075) this._phase('dive');
      } else if (s.phase === 'dive') {
        const p = footballClamp(this._phaseTime / .64, 0, 1);
        s.phaseProgress = p;
        // A fast takeoff followed by drag at landing; no snapping to the ball.
        const travel = 1 - Math.pow(1 - p, 2.5);
        const previousX = this.position.x;
        this.position.lerpVectors(this._diveStart, this._diveEnd, travel);
        s.lateralSpeed = (this.position.x - previousX) / dt;
        if (this._phaseTime >= .64) {this.position.copy(this._diveEnd); this._phase('land');}
      } else if (s.phase === 'land') {
        s.phaseProgress = footballClamp(this._phaseTime / .25, 0, 1); s.lateralSpeed = 0;
        if (this._phaseTime >= .25) this._phase('recover');
      } else if (s.phase === 'recover') {
        s.phaseProgress = footballClamp(this._phaseTime / 1.05, 0, 1); s.lateralSpeed = 0;
        if (this._phaseTime >= 1.05) {this._phase('ready'); this._threatAge = 0;}
      }
    }
    this.visual.updatePose(s);
    this._capture();
  }

  render(alpha) {
    if (!this.enabled) return;
    const s = this.renderState, a = this.previousState, b = this.state;
    alpha = footballClamp(alpha, 0, 1); this._copyState(s, b);
    s.position.lerpVectors(a.position, b.position, alpha);
    s.time = a.time + (b.time - a.time) * alpha;
    s.lateralSpeed = a.lateralSpeed + (b.lateralSpeed - a.lateralSpeed) * alpha;
    s.targetHeight = a.targetHeight + (b.targetHeight - a.targetHeight) * alpha;
    s.reachTarget.lerpVectors(a.reachTarget, b.reachTarget, alpha);
    if (a.phase === b.phase) s.phaseProgress = a.phaseProgress + (b.phaseProgress - a.phaseProgress) * alpha;
    this.visual.updatePose(s);
  }

  isNear(ball, padding = 0) {
    return this.enabled && Math.abs(ball.position.z - this.position.z) <= 2.4 + padding &&
      Math.abs(ball.position.x - this.position.x) <= 3.4 + padding && ball.position.y <= 3.7 + padding;
  }

  collide(physics, alpha, h) {
    const ball = physics.ball;
    if (!this.isNear(ball)) return;
    const dt = this._fixedDt;
    for (let i = 0; i < this.colliders.length; i++) {
      const capsule = this.colliders[i];
      this._a.lerpVectors(capsule.previousA, capsule.a, alpha);
      this._b.lerpVectors(capsule.previousB, capsule.b, alpha);
      this._axis.subVectors(this._b, this._a);
      const lengthSq = this._axis.lengthSq();
      const along = lengthSq > 1e-12 ? footballClamp(this._relative.subVectors(ball.position, this._a).dot(this._axis) / lengthSq, 0, 1) : 0;
      this._point.copy(this._a).addScaledVector(this._axis, along);
      this._normal.subVectors(ball.position, this._point);
      const sum = ball.radius + capsule.radius, distanceSq = this._normal.lengthSq();
      if (distanceSq >= sum * sum) continue;
      const distance = Math.sqrt(distanceSq);
      this._velocityA.subVectors(capsule.a, capsule.previousA).multiplyScalar(1 / dt);
      this._velocityB.subVectors(capsule.b, capsule.previousB).multiplyScalar(1 / dt);
      this._surface.lerpVectors(this._velocityA, this._velocityB, along).clampLength(0, 12);
      if (distance > 1e-7) this._normal.multiplyScalar(1 / distance);
      else {
        this._normal.copy(this._surface).sub(ball.velocity);
        if (this._normal.lengthSq() > 1e-9) this._normal.normalize(); else this._normal.set(0, 0, -this.goalEnd);
      }
      ball.position.addScaledVector(this._normal, sum - distance + .00015);
      const incoming = -this._relative.copy(ball.velocity).sub(this._surface).dot(this._normal);
      if (incoming <= 0) continue;
      const restitution = capsule.kind === 'glove' ? .23 : capsule.kind === 'leg' ? .40 : .32;
      ball.velocity.addScaledVector(this._normal, incoming * (1 + restitution));
      physics.surfaceFriction(this._normal, this._surface, incoming * .28);
      if (incoming > .4 && physics.time - this._lastImpact > .09) {
        physics.events.push({type: 'save', time: physics.time, speed: incoming, position: ball.position.clone(), surface: capsule.kind, keeperTeam: this.team});
        this._lastImpact = physics.time; this.saves++;
      }
    }
  }

  dispose() {
    if (this.visual.dispose) this.visual.dispose();
    else if (this.visual.group) this.visual.group.removeFromParent();
    this.colliders.length = 0;
  }
}

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
    this.keys=new Set();this.kickAge=10;this.match=false;this.desktopKick='shot';
    this.edges={ball:false,menu:false,calibrate:false};this.left={x:0,y:0};this.turn=0;this.sprint=false;
    this.hands=['left','right'].map((name,index)=>{
      const visual=field.makeFoot(name);scene.add(visual.root);visual.root.visible=false;
      const collider=this.colliderFor(visual);
      const ray=new FT.Mesh(new FT.CylinderGeometry(.002,.002,1,5),new FT.MeshBasicMaterial({color:0xccf191,depthTest:false}));
      ray.renderOrder=50;ray.visible=false;scene.add(ray);
      return {name,index,visual,ray,source:null,tracked:false,ready:false,previousTracked:false,
        length:0,calibrated:false,profile:null,visualProfile:null,colliderOffset:collider.offset,neutralHeight:collider.neutralHeight||.105,instep:false,instepInput:0,instepAmount:0,grip:false,trigger:false,previousTrigger:false,
        lastB:false,lastX:false,lastMenu:false,select:false,
        localPosition:new FT.Vector3(),localOrientation:new FT.Quaternion(),
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
      if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code) && !['BUTTON','SELECT','INPUT'].includes(event.target.tagName))event.preventDefault();
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
  sample(frame,reference,session,dt) {
    this.left.x=0;this.left.y=0;this.turn=0;this.sprint=false;
    for(const hand of this.hands){hand.previousTracked=hand.tracked;hand.tracked=false;hand.select=false;}
    if(this.desktop){this.sampleDesktop(dt);return true;}
    let viewer=null;
    if(frame&&reference)try{viewer=frame.getViewerPose(reference);}catch{}
    this.poseValid=!!viewer;
    if(!viewer){this.invalidate();this.resetCalibrationWindow();return false;}
    const hp=viewer.transform.position,hq=viewer.transform.orientation;
    if(!Number.isFinite(hp.x+hp.y+hp.z+hq.x+hq.y+hq.z+hq.w)){this.poseValid=false;this.invalidate();this.resetCalibrationWindow();return false;}
    this.headLocal.set(hp.x,hp.y,hp.z);this.headOrientation.set(hq.x,hq.y,hq.z,hq.w).normalize();
    for(const source of session?.inputSources||[]) {
      const hand=this.hands.find(h=>h.name===source.handedness);
      if(!hand||!source.gripSpace||source.hand||source.targetRayMode!=='tracked-pointer')continue;
      let pose,rayPose;try{pose=frame.getPose(source.gripSpace,reference);rayPose=frame.getPose(source.targetRaySpace,reference);}catch{continue;}
      if(!pose||pose.emulatedPosition)continue;
      const p=pose.transform.position,o=pose.transform.orientation;
      if(!Number.isFinite(p.x+p.y+p.z+o.x+o.y+o.z+o.w)||Math.hypot(o.x,o.y,o.z,o.w)<.5)continue;
      const connected=hand.source!==source;
      if(connected){this.requireCalibrationRelease();hand.ready=false;hand.previousTrigger=this.button(source.gamepad,0);hand.lastB=this.button(source.gamepad,5);hand.lastX=this.button(source.gamepad,4);hand.lastMenu=this.button(source.gamepad,5)||this.button(source.gamepad,6);}
      hand.source=source;hand.tracked=true;hand.localPosition.set(p.x,p.y,p.z);hand.localOrientation.set(o.x,o.y,o.z,o.w).normalize();
      const rp=(rayPose||pose).transform.position,rq=(rayPose||pose).transform.orientation;
      hand.rayPosition.set(rp.x,rp.y,rp.z);hand.rayOrientation.set(rq.x,rq.y,rq.z,rq.w).normalize();
      const pad=source.gamepad,axes=pad?.axes||[],offset=axes.length>=4?2:0;
      const stick=this.stick(axes[offset]||0,axes[offset+1]||0);
      if(hand.name==='left'){this.left.x=stick[0];this.left.y=stick[1];}else this.turn=stick[0];
      hand.trigger=this.button(pad,0);hand.instep=hand.trigger;hand.instepInput=this.buttonValue(pad,0);hand.grip=this.button(pad,1);
      hand.select=hand.trigger&&!hand.previousTrigger;hand.previousTrigger=hand.trigger;
      this.sprint=this.sprint||hand.grip;
      const b=hand.name==='right'&&this.button(pad,5);
      const x=hand.name==='left'&&this.button(pad,4);
      const menu=hand.name==='left'&&(this.button(pad,5)||this.button(pad,6));
      if(b&&!hand.lastB)this.edges.ball=true;
      if(x&&!hand.lastX)this.edges.calibrate=true;
      if(menu&&!hand.lastMenu)this.edges.menu=true;
      hand.lastB=b;hand.lastX=x;hand.lastMenu=menu;
      if(!hand.previousTracked)hand.ready=false;
    }
    for(const hand of this.hands)if(!hand.tracked){this.resetFootHistory(hand);hand.foot.enabled=false;hand.ready=false;hand.visual.root.visible=false;hand.previousTrigger=false;}
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
    if(!this.poseValid||!this.hands.every(hand=>hand.tracked))return 'Track both controllers.';
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
    const tracked=this.poseValid&&this.hands.every(hand=>hand.tracked);
    // Calibration uses deliberate analog pressure, independently of a device's
    // sometimes hair-trigger `pressed` flag. No progress runs with idle hands.
    if(!tracked||this.calibrationPaused){
      this.requireCalibrationRelease();
      if(calibration.stage!=='ready')calibration.reason=!tracked?'Track both controllers.':'Release both triggers.';
      return;
    }
    const released=this.hands.every(hand=>hand.instepInput<=.15);
    if(released){this._captureArmed=true;calibration.awaitRelease=false;this._calibrationSqueezed[0]=false;this._calibrationSqueezed[1]=false;}
    if(calibration.stage==='ready'){
      calibration.reason=calibration.awaitRelease?'Release both triggers.':'';
      return;
    }
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
    if(this.match&&this.kickAge>.56&&(key('Space')||key('KeyF')||key('KeyQ'))){
      this.kickAge=0;this.desktopKick=key('KeyF')?'pass':key('KeyQ')?'cross':'shot';
    }else if(!this.match&&key('Space')&&this.kickAge>1)this.kickAge=0;
    const a=this.kickAge,phase=footballClamp(a/.18,0,1);
    for(const hand of this.hands){
      hand.tracked=true;hand.localOrientation.identity();hand.rayOrientation.identity();
      const right=hand.name==='right',baseX=right?.16:-.16;
      const active=right&&a<.34;
      const swing=active?(a<.18?-.62+phase*1.3:.68-(a-.18)*4.25):0;
      const effort=this.match&&this.desktopKick==='pass'?.83:1;
      const lift=this.match?.052:.16;
      hand.localPosition.set(baseX,1.02+(active?Math.max(0,Math.sin(phase*Math.PI))*lift:0),-.17-swing*effort);
      hand.instep=key('KeyE');hand.instepInput=Number(hand.instep);
      hand.rayPosition.copy(hand.localPosition);
    }
    this.headOrientation.setFromAxisAngle(this.pitchAxis,this.desktopPitch);
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
      if(!hand.tracked||!this.poseValid){this.resetFootHistory(hand);hand.foot.enabled=false;hand.visual.root.visible=false;hand.ready=false;continue;}
      hand.worldOrientation.copy(this.rig.quaternion).multiply(hand.localOrientation);
      hand.worldPosition.copy(hand.localPosition).applyMatrix4(this.rig.matrixWorld);
      hand.frameStartControllerPosition.copy(hand.frameTargetControllerPosition);hand.frameTargetControllerPosition.copy(hand.worldPosition);
      hand.frameStartControllerOrientation.copy(hand.frameTargetControllerOrientation);hand.frameTargetControllerOrientation.copy(hand.worldOrientation);
      hand.rayPosition.applyMatrix4(this.rig.matrixWorld);
      hand.rayOrientation.premultiply(this.rig.quaternion);
      hand.rayDirection.set(0,0,-1).applyQuaternion(hand.rayOrientation);
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
      if(blocked||!hand.ready||dt<=0||dt>.08||hand.frameStartControllerPosition.distanceToSquared(hand.frameTargetControllerPosition)>Math.max(.4,dt*22)**2||hand.frameStartControllerOrientation.angleTo(hand.frameTargetControllerOrientation)>Math.max(.75,dt*40)||hand.frameStartShinOrientation.angleTo(hand.frameTargetShinOrientation)>Math.max(.75,dt*40)){
        this.resetFootHistory(hand);hand.ready=!blocked;hand.foot.enabled=false;
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
      hand.foot.matchKick = this.desktop && this.match && hand.name==='right' && this.kickAge > .062 && this.kickAge < .205
        ? this.desktopKick : null;
      hand.foot.matchAim = this.forward;
      hand.foot.matchPitch = this.desktopPitch;
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
  invalidate(){this.requireCalibrationRelease();for(const hand of this.hands){this.resetFootHistory(hand);hand.ready=false;hand.foot.enabled=false;}this.velocity.set(0,0,0);}
  clearEdges(){this.edges.ball=false;this.edges.menu=false;this.edges.calibrate=false;}
  dispose(){this.abort.abort();for(const hand of this.hands){hand.ray.geometry.dispose();hand.ray.material.dispose();hand.ray.removeFromParent();hand.visual.root.removeFromParent();}}
}

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
      {id:'resume',label:'Wznów',x:40,y:104,w:688,h:80},
      {id:'calibrate',label:'Kalibruj stopy',x:40,y:202,w:334,h:64},
      {id:'exit',label:'Wyjdź z VR',x:394,y:202,w:334,h:64}
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
    c.fillText('Lewy drążek · ruch  /  Prawy drążek · obrót',40,318);
    c.fillText(this.matchMode?'B · proś o podanie  /  Y · menu':'B · nowa piłka  /  Y · menu',40,352);
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
      if(!hand.tracked||controls.desktop)continue;
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

class FootballCalibrationPanel {
  constructor(camera) {
    this.canvas=document.createElement('canvas');this.canvas.width=900;this.canvas.height=490;
    this.context=this.canvas.getContext('2d');this.texture=new FT.CanvasTexture(this.canvas);
    this.texture.colorSpace=FT.SRGBColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=FT.LinearFilter;
    this.mesh=new FT.Mesh(new FT.PlaneGeometry(1.12,.61),new FT.MeshBasicMaterial({map:this.texture,transparent:true,depthTest:false,depthWrite:false}));
    this.mesh.position.set(0,.08,-1.55);this.mesh.renderOrder=180;this.mesh.visible=false;camera.add(this.mesh);
    this.key='';
  }
  update(controls,active) {
    const cal=controls.calibration;
    const waiting=!!cal?.awaitRelease;
    this.mesh.visible=!!(active&&!controls.desktop&&(!controls.isCalibrated||waiting));
    if(!this.mesh.visible)return;
    const stage=cal?.stage||'floor',ready=stage==='ready';
    const progress=Math.round(footballClamp(cal?.progress||0,0,1)*40)/40;
    const reason=cal?.reason||'';
    const key=[stage,progress,reason,waiting].join('|');if(key===this.key)return;this.key=key;
    const c=this.context;c.clearRect(0,0,900,490);
    c.beginPath();c.roundRect(0,0,900,490,18);c.fillStyle='rgba(17,29,25,.96)';c.fill();
    c.strokeStyle='#64806b';c.lineWidth=2;c.stroke();
    c.fillStyle='#d7eca7';c.textAlign='left';c.textBaseline='alphabetic';c.font='700 38px sans-serif';
    c.fillText(ready?'CALIBRATED':stage==='floor'?'01 / FLOOR':'02 / PLAYING POSITION',42,63);
    c.font='28px sans-serif';c.fillStyle='#e8eee2';
    if(ready)c.fillText('Release both triggers to play.',42,118);
    else if(stage==='floor')c.fillText('Touch both controllers to the floor.',42,118);
    else{
      c.fillText('Stand up. Hold your hands',42,112);
      c.fillText('in your normal playing position.',42,151);
    }
    // The two poses are explained visually so the in-headset flow stays short.
    c.save();c.translate(450,stage==='stance'?251:228);
    c.lineCap='round';c.lineJoin='round';c.strokeStyle='#9ab6a0';c.lineWidth=8;
    if(stage==='floor'){
      c.beginPath();c.moveTo(-150,76);c.lineTo(150,76);c.stroke();
      for(const x of [-66,66]){
        c.save();c.translate(x,22);c.rotate(x<0?-.22:.22);
        c.fillStyle='#cedbc8';c.beginPath();c.roundRect(-14,-40,28,76,9);c.fill();
        c.strokeStyle='#d6eba5';c.lineWidth=6;c.beginPath();c.arc(0,-36,24,0,Math.PI*2);c.stroke();c.restore();
      }
      c.strokeStyle='#d6eba5';c.lineWidth=4;
      for(const x of [-66,66]){c.beginPath();c.moveTo(x,-82);c.lineTo(x,-58);c.moveTo(x-8,-66);c.lineTo(x,-58);c.lineTo(x+8,-66);c.stroke();}
    }else if(!ready){
      c.beginPath();c.arc(0,-62,22,0,Math.PI*2);c.stroke();
      c.beginPath();c.moveTo(0,-33);c.lineTo(0,38);c.moveTo(-40,-13);c.lineTo(40,-13);
      c.moveTo(-40,-13);c.lineTo(-53,28);c.lineTo(-79,12);c.moveTo(40,-13);c.lineTo(53,28);c.lineTo(79,12);
      c.moveTo(0,38);c.lineTo(-26,90);c.moveTo(0,38);c.lineTo(26,90);c.stroke();
      c.fillStyle='#d6eba5';for(const x of [-82,82]){c.beginPath();c.roundRect(x-8,-6,16,30,5);c.fill();}
    }else{
      c.strokeStyle='#d6eba5';c.lineWidth=12;c.beginPath();c.moveTo(-51,1);c.lineTo(-14,39);c.lineTo(59,-44);c.stroke();
    }
    c.restore();
    c.textAlign='center';c.font='600 28px sans-serif';c.fillStyle='#e7eddf';
    c.fillText(ready?'':waiting?'Release both triggers':progress>0?'Keep holding':'Squeeze both triggers',450,380);
    c.fillStyle='#33493b';c.beginPath();c.roundRect(60,402,780,12,6);c.fill();
    if(progress>0){c.fillStyle='#d7eca7';c.beginPath();c.roundRect(60,402,780*progress,12,6);c.fill();}
    const detail=(ready||['Touch both controllers to the floor.','Release both triggers.','Squeeze both triggers.','Keep holding.'].includes(reason))?'':reason;
    c.fillStyle='#b2c4ac';c.font='23px sans-serif';c.fillText(detail,450,454,790);
    this.texture.needsUpdate=true;
  }
  hide(){this.mesh.visible=false;}
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}

class FootballAudio {
  constructor(){this.context=null;this.gain=null;this.noise=null;this.ceiling=null;this.masterLevel=.46;}
  async start(){
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    try{
      if(!this.context){
        this.context=new Audio();this.gain=this.context.createGain();this.gain.gain.value=this.masterLevel;
        this.ceiling=this.context.createWaveShaper();const curve=new Float32Array(513);
        for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1,a=Math.abs(x);curve[i]=Math.sign(x)*(a<=.6?a:.6+.18*Math.tanh((a-.6)/.18));}
        this.ceiling.curve=curve;this.gain.connect(this.ceiling);this.ceiling.connect(this.context.destination);
        this.noise=this.context.createBuffer(1,Math.ceil(this.context.sampleRate*.15),this.context.sampleRate);
        const data=this.noise.getChannelData(0);let seed=1277,last=0;
        for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;last=last*.64+((seed/4294967296)*2-1)*.36;data[i]=last;}
      }
      if(this.context.state==='suspended')await this.context.resume();
    }catch(error){console.warn('Audio unavailable',error);}
  }
  kick(speed=5){
    if(!this.context||this.context.state!=='running')return;
    const c=this.context,now=c.currentTime,level=footballClamp(speed/15,.12,.85);
    const source=c.createBufferSource();source.buffer=this.noise;
    const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1100+level*500;filter.Q.value=-3.0103;
    const gain=c.createGain();gain.gain.setValueAtTime(level*.65,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.035);
    source.connect(filter);filter.connect(gain);gain.connect(this.gain);source.start(now);source.stop(now+.045);
    // A compact low thud carries the impact; the quiet tail adds body without delaying it.
    const osc=c.createOscillator(),body=c.createGain();osc.frequency.setValueAtTime(130,now);osc.frequency.exponentialRampToValueAtTime(105,now+.035);
    body.gain.setValueAtTime(.0001,now);body.gain.linearRampToValueAtTime(level*.9,now+.0015);body.gain.exponentialRampToValueAtTime(.0001,now+.072);
    osc.connect(body);body.connect(this.gain);osc.start(now);osc.stop(now+.075);
    const tail=c.createOscillator(),resonance=c.createGain();tail.frequency.setValueAtTime(100,now+.04);tail.frequency.exponentialRampToValueAtTime(80,now+.18);
    resonance.gain.setValueAtTime(.0001,now+.04);resonance.gain.linearRampToValueAtTime(level*.05,now+.055);
    resonance.gain.linearRampToValueAtTime(level*.0375,now+.12);resonance.gain.exponentialRampToValueAtTime(.0001,now+.165);
    tail.connect(resonance);resonance.connect(this.gain);tail.start(now+.04);tail.stop(now+.175);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    osc.onended=()=>{osc.disconnect();body.disconnect();};
    tail.onended=()=>{tail.disconnect();resonance.disconnect();};
  }
  pause(paused){if(this.gain&&this.context)this.gain.gain.setTargetAtTime(paused?0:this.masterLevel,this.context.currentTime,.04);}
  dispose(){this.context?.close().catch(()=>{});}
}

class FootballMatchPhysics {
  constructor(engine, keepers) {
    this.engine = engine;
    this.keepers = keepers;
    this.feet = new Map();
    this.contacts = [];
    this.maxTravel = .053;
    this.normal = new FT.Vector3();
    this.surface = new FT.Vector3();
    this.relative = new FT.Vector3();
    this.up = new FT.Vector3(0, 1, 0);
    const geometry = new FT.SphereGeometry(.105, 12, 8);
    const material = new FT.MeshStandardMaterial({color:0xefe6cd, roughness:.78});
    this.gloves = [-1, 1].map(side => ({side, p:new FT.Vector3(), old:new FT.Vector3(), mesh:new FT.Mesh(geometry, material), ready:false}));
  }

  configure(scene) {
    for (const glove of this.gloves) { glove.mesh.visible = false; scene.add(glove.mesh); }
  }

  reset() {
    this.feet.clear();
    this.contacts.length = 0;
    for (const glove of this.gloves) { glove.ready = false; glove.mesh.visible = false; }
  }

  dispose() {
    for (const glove of this.gloves) glove.mesh.removeFromParent();
    this.gloves[0].mesh.geometry.dispose();
    this.gloves[0].mesh.material.dispose();
  }

  slot(player) {
    let slot = this.feet.get(player.id);
    if (!slot) {
      slot = {player, gait:0, cooldown:0, lastContact:-Infinity, kick:null, boots:[-1, 1].map(side => ({
        side, p:new FT.Vector3(player.x, .105, player.z), old:new FT.Vector3(), placed:false
      }))};
      this.feet.set(player.id, slot);
    }
    return slot;
  }

  keeperKick(player, keeper, ball, time) {
    const {x, y, z} = ball.position;
    if (keeper.state.phase !== 'ready' || y > .24 || Math.hypot(x - keeper.position.x, z - keeper.position.z) > 1.03 || ball.velocity.lengthSq() > 64) return null;
    const teammates = this.engine.players.filter(p => p.team === player.team && !p.isKeeper);
    const opponents = this.engine.players.filter(p => p.team !== player.team && !p.isKeeper);
    const forward = player.team === 0 ? -1 : 1;
    const options = teammates.filter(p => (p.z - z)*forward > 5 && Math.hypot(p.x - x, p.z - z) < 31);
    const safety = p => Math.min(...opponents.map(op => Math.hypot(p.x - op.x, p.z - op.z))) - .16*Math.hypot(p.x - x, p.z - z);
    options.sort((a,b) => safety(b) - safety(a));
    const target = options[0];
    const dx = target ? target.x - x : (Math.sin(time*.8) > 0 ? 8 : -8);
    const dz = target ? target.z - z : forward*31;
    const length = Math.max(1, Math.hypot(dx, dz));
    const speed = target ? footballClamp(length*1.08 + 4.5, 8, 22) : 23;
    return {playerId:player.id, kind:target ? 'pass' : 'clear', vx:dx*speed/length, vy:target ? .15 : 9.5, vz:dz*speed/length, targetId:target?.id};
  }

  prepare(dt, ball, intent, controls, alpha, time) {
    this.contacts.length = 0;
    this.dt = dt;
    this.time = time;
    const bx = ball.position.x, bz = ball.position.z;
    for (const player of this.engine.players) {
      if (player.isHuman) continue;
      const slot = this.slot(player);
      const keeper = player.isKeeper ? this.keepers[player.team] : null;
      const x = keeper ? keeper.position.x : player.x, z = keeper ? keeper.position.z : player.z;
      slot.x = x; slot.z = z;
      if (keeper) {
        const previous = keeper.previousState.position;
        player.x = x; player.z = z; player.px = previous.x; player.pz = previous.z;
      }
      slot.cooldown = Math.max(0, slot.cooldown - dt);
      const speed = Math.hypot(player.vx, player.vz), yaw = keeper?.state.yaw ?? player.yaw;
      const co = Math.cos(yaw), si = Math.sin(yaw);
      slot.gait += dt*(1.6 + speed*.31)*Math.PI*2;
      const candidate = keeper ? (!slot.cooldown && this.keeperKick(player, keeper, ball, time)) : intent?.playerId === player.id && intent;
      const kick = slot.cooldown <= 0 && candidate && Math.hypot(x-bx, z-bz) < 1.19 && ball.position.y <= .41 ? candidate : null;
      slot.throwing = candidate?.kind === 'throw' ? candidate : null;
      const side = (bx-x)*co - (bz-z)*si > 0 ? 1 : -1;
      slot.kick = kick;
      slot.side = side;
      slot.near = Math.abs(x-bx) < 2.2 && Math.abs(z-bz) < 2.2 && ball.position.y < 2.28;
      for (const boot of slot.boots) {
        boot.old.copy(boot.p);
        const stride = keeper ? 0 : Math.sin(slot.gait + (boot.side === 1 ? Math.PI : 0))*speed*.047;
        const lateral = boot.side*.135, forward = .12 + stride;
        const restX = x + co*lateral - si*forward, restY = .105 + Math.max(0,stride)*.13, restZ = z - si*lateral - co*forward;
        let tx = restX, ty = restY, tz = restZ;
        if (kick && boot.side === side) {
          const velocity = Math.max(.1, Math.hypot(kick.vx, kick.vz));
          const offset = kick.kind === 'tackle' ? .055 : .092;
          tx = bx - kick.vx/velocity*offset;
          tz = bz - kick.vz/velocity*offset;
          const dx = tx-x, dz = tz-z, reach = Math.hypot(dx, dz);
          if (reach > .84) { tx = x + dx*.84/reach; tz = z + dz*.84/reach; }
          ty = footballClamp(ball.position.y-.015, .092, .29);
        }
        if (!boot.placed) { boot.p.set(restX,restY,restZ); boot.old.copy(boot.p); boot.placed = true; }
        const dx = tx-boot.p.x, dy = ty-boot.p.y, dz = tz-boot.p.z;
        const fraction = Math.min(1, dt*(kick && boot.side === side ? 8.8 : 7.2)/Math.max(1e-7, Math.hypot(dx,dy,dz)));
        boot.p.x += dx*fraction; boot.p.y += dy*fraction; boot.p.z += dz*fraction;
      }
      if (slot.near) this.contacts.push(slot);
    }
    this.prepareGloves(controls, alpha);
  }

  prepareGloves(controls, alpha) {
    const human = this.engine.human;
    const active = human.isKeeper && human.z > FB.halfLength-16.5 && Math.abs(human.x) < 20.16;
    for (let i=0;i<this.gloves.length;i++) {
      const glove = this.gloves[i], hand = controls.hands[i];
      glove.old.copy(glove.p);
      if (!active || (controls.desktop ? !controls.keys.has('KeyG') : !hand.tracked || !hand.grip)) {
        glove.ready = false; glove.mesh.visible = false; continue;
      }
      if (controls.desktop) {
        const aim = this.relative.set(0,0,-1).applyQuaternion(controls.viewOrientation);
        glove.p.copy(controls.headWorld).addScaledVector(aim,.64).addScaledVector(controls.right,glove.side*.22);
        glove.p.y -= .18;
      } else glove.p.lerpVectors(hand.frameStartControllerPosition, hand.frameTargetControllerPosition, alpha);
      if (!glove.ready || glove.old.distanceToSquared(glove.p) > .36) glove.old.copy(glove.p);
      glove.ready = true; glove.mesh.visible = true; glove.mesh.position.copy(glove.p);
    }
  }

  isNear(ball, padding) {
    return this.contacts.length > 0 || this.gloves.some(g => g.ready) || this.keepers.some(keeper => keeper?.isNear(ball,padding));
  }

  sphere(physics, x, y, z, radius, old, current, hitter, kind, slot, boot) {
    const ball = physics.ball;
    const dx = ball.position.x-x, dy = ball.position.y-y, dz = ball.position.z-z;
    const sum = ball.radius+radius, distanceSq = dx*dx+dy*dy+dz*dz;
    if (distanceSq >= sum*sum) return;
    const distance = Math.sqrt(distanceSq);
    old ? this.surface.subVectors(current, old).divideScalar(this.dt).clampLength(0, 14) : this.surface.set(hitter.vx||0, 0, hitter.vz||0);
    this.relative.subVectors(ball.velocity, this.surface);
    if (distance > 1e-6) this.normal.set(dx,dy,dz).divideScalar(distance);
    else if (this.relative.lengthSq() > 1e-7) this.normal.copy(this.relative).normalize().negate();
    else this.normal.set(0,0,hitter.team === 0 ? -1 : 1);
    const approach = -this.relative.dot(this.normal);
    const kick = kind === 'throwHand' ? slot.throwing : kind === 'foot' && boot.side === slot.side && slot.kick;
    ball.position.addScaledVector(this.normal, sum-distance+.0001);
    if (kick && (approach > -.8 || distance < sum-.018)) {
      const horizontal = Math.hypot(kick.vx, kick.vz);
      const strikeIntoBall = horizontal < .2 || (this.normal.x*kick.vx+this.normal.z*kick.vz)/horizontal > -.38;
      if (strikeIntoBall) {
        // An AI foot applies its chosen impulse at the same physical contact surface used for an interception.
        ball.velocity.set(kick.vx, kick.vy, kick.vz);
        if (kick.vy < .75) ball.spin.set(kick.vz, 0, -kick.vx).multiplyScalar(.92/ball.radius);
        else ball.spin.multiplyScalar(.28);
        slot.cooldown = kick.kind === 'dribble' ? .17 : .36;
        slot.lastContact = this.time;
        slot.kick = null;
        slot.throwing = null;
        physics.events.push({type:'match-contact', playerId:hitter.id, kind:kick.kind, targetId:kick.targetId,
          speed:ball.velocity.length(), foot:boot?.side, point:{x,y,z}, contactDistance:distance, contactLimit:sum});
        return;
      }
    }
    if (approach <= .045) return;
    const softFoot = kind === 'foot' && Math.abs(ball.velocity.y) < 2.1 && this.relative.lengthSq() < 48;
    const glove = kind === 'glove';
    ball.velocity.addScaledVector(this.normal, approach*(glove ? 1.12 : softFoot ? 1.02 : 1.36));
    physics.surfaceFriction(this.normal, this.surface, approach*(softFoot || glove ? .7 : .24));
    if (softFoot) {
      // The receiving surface damps the incoming velocity. There is no pull or follow force between touches.
      ball.velocity.x = ball.velocity.x*.58 + this.surface.x*.26;
      ball.velocity.z = ball.velocity.z*.58 + this.surface.z*.26;
    }
    if (slot && this.time-slot.lastContact < .12) return;
    if (slot) slot.lastContact = this.time;
    physics.events.push({type:'match-contact', playerId:hitter.id, kind:glove ? 'save' : softFoot ? 'control' : 'deflection', speed:approach});
  }

  collide(physics, alpha, dt) {
    const ball = physics.ball;
    for (const keeper of this.keepers) keeper?.collide(physics, alpha, dt);
    for (const slot of this.contacts) {
      const player = slot.player;
      if (Math.abs(ball.position.x-slot.x) > 1.26 || Math.abs(ball.position.z-slot.z) > 1.26) continue;
      if (slot.throwing) {
        const co = Math.cos(player.yaw), si = Math.sin(player.yaw);
        for (const side of [-1,1]) if (slot.throwing) {
          this.sphere(physics, slot.x-si*.49+co*side*.084,1.96,slot.z-co*.49-si*side*.084,
            .095,null,null,player,'throwHand',slot);
        }
      }
      for (const boot of slot.boots) {
        this.sphere(physics, boot.old.x+(boot.p.x-boot.old.x)*alpha, boot.old.y+(boot.p.y-boot.old.y)*alpha,
          boot.old.z+(boot.p.z-boot.old.z)*alpha, .106, boot.old, boot.p, player, 'foot', slot, boot);
      }
      if (player.isKeeper) continue; // The animated keeper already supplies its own torso and leg capsules.
      const x = player.px+(player.x-player.px)*alpha, z = player.pz+(player.z-player.pz)*alpha;
      if (ball.position.y > .30) this.sphere(physics, x, footballClamp(ball.position.y,.48,1.45), z, .175, null, null, player, 'body', slot);
      if (ball.position.y < .7) {
        const co = Math.cos(player.yaw), si = Math.sin(player.yaw);
        for (const side of [-1,1]) this.sphere(physics, x+co*side*.115, footballClamp(ball.position.y,.23,.49), z-si*side*.115, .086, null, null, player, 'body', slot);
      }
    }
    const human = this.engine.human;
    for (const glove of this.gloves) if (glove.ready && ball.position.z > FB.halfLength-16.5 && Math.abs(ball.position.x) < 20.16) {
      this.sphere(physics, glove.old.x+(glove.p.x-glove.old.x)*alpha, glove.old.y+(glove.p.y-glove.old.y)*alpha,
        glove.old.z+(glove.p.z-glove.old.z)*alpha, .13, glove.old, glove.p, human, 'glove');
    }
  }
}

class FootballMatchHud {
  constructor(scene, controls, canvas) {
    this.screen = canvas;
    this.controls = controls;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 420; this.canvas.height = 278;
    this.context = this.canvas.getContext('2d');
    this.texture = new FT.CanvasTexture(this.canvas);
    this.texture.colorSpace = FT.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = FT.LinearFilter;
    this.mesh = new FT.Mesh(new FT.PlaneGeometry(.50,.331), new FT.MeshBasicMaterial({
      map:this.texture, transparent:true, depthTest:false, depthWrite:false, toneMapped:false
    }));
    this.mesh.renderOrder = 50;
    this.mesh.frustumCulled = false;
    this.offset = new FT.Vector3();
    this.mesh.visible = false; scene.add(this.mesh);
    this.last = -Infinity;
  }

  hide() { this.screen.hidden = true; this.mesh.visible = false; this.last = -Infinity; }

  render(engine, ball, now, desktop) {
    this.screen.hidden = !desktop;
    this.mesh.visible = !desktop;
    if (!desktop) {
      this.offset.set(-.48,-.43,-1.9).applyQuaternion(this.controls.viewOrientation);
      this.mesh.position.copy(this.controls.headWorld).add(this.offset);
      this.mesh.quaternion.copy(this.controls.viewOrientation);
    }
    if (now-this.last < .085) return;
    this.last = now;
    const c = this.context;
    c.clearRect(0,0,420,278); c.beginPath(); c.roundRect(0,0,420,278,16);
    c.fillStyle = 'rgba(12,29,24,.91)'; c.fill();
    c.strokeStyle = '#768f80'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#dce6dc'; c.textBaseline = 'middle';
    c.font = '600 24px system-ui'; c.textAlign = 'left';
    c.fillText(engine.phase === 'finished' ? '90′' : `${Math.max(1,Math.floor(engine.minute))}′`,26,37);
    c.font = '800 38px system-ui'; c.textAlign = 'center';
    c.fillStyle = '#71dfc4'; c.fillText(engine.score[0],157,36);
    c.fillStyle = '#c2c9bc'; c.fillText('–',210,35);
    c.fillStyle = '#ff9d91'; c.fillText(engine.score[1],263,36);
    c.fillStyle = '#e7eedf'; c.font = '600 24px system-ui'; c.textAlign = 'right';
    c.fillText(engine.human.role,394,37);
    const x0 = 27, y0 = 70, w = 366, h = 150;
    const px = z => x0+w/2 + z*(w/FB.length), py = x => y0+h/2 - x*(h/FB.width);
    c.fillStyle = '#253e33'; c.fillRect(x0,y0,w,h);
    c.strokeStyle = '#789184'; c.lineWidth = 1.7; c.strokeRect(x0,y0,w,h);
    c.beginPath();c.moveTo(x0+w/2,y0);c.lineTo(x0+w/2,y0+h);
    c.moveTo(x0+w/2+9.15*w/FB.length,y0+h/2);
    c.ellipse(x0+w/2,y0+h/2,9.15*w/FB.length,9.15*h/FB.width,0,0,Math.PI*2); c.stroke();
    const area = 40.32*h/FB.width, depth = 16.5*w/FB.length;
    c.strokeRect(x0,y0+(h-area)/2,depth,area);
    c.strokeRect(x0+w-depth,y0+(h-area)/2,depth,area);
    c.save();c.beginPath();c.rect(x0,y0,w,h);c.clip();
    for (const p of engine.players) {
      c.beginPath(); c.arc(px(p.z),py(p.x),p.isHuman ? 7.3 : p.isKeeper ? 4.4 : 3.9,0,Math.PI*2);
      c.fillStyle = p.isHuman ? '#fff' : p.team === 0 ? '#71dfc4' : '#ff9d91'; c.fill();
      if (p.isHuman) { c.strokeStyle = '#17382c'; c.lineWidth = 2; c.stroke(); }
    }
    c.beginPath(); c.arc(px(ball.position.z),py(ball.position.x),4.8,0,Math.PI*2);
    c.fillStyle = '#f8e68b'; c.fill(); c.strokeStyle = '#17241e'; c.lineWidth = 1.3; c.stroke(); c.restore();
    c.font = '600 23px system-ui'; c.textAlign = 'center';
    if (engine.opponentSeconds > 0 && engine.phase === 'live') {
      c.fillStyle = '#5a4c40'; c.fillRect(25,245,370,7);
      c.fillStyle = '#ffac9a'; c.fillRect(25,245,370*Math.min(1,engine.opponentSeconds/5),7);
    } else {
      c.fillStyle = '#e8ecd9';
      c.fillText(engine.phase === 'finished' ? 'Koniec meczu · B od nowa' : engine.notice,210,251,382);
    }
    if (desktop) {
      const screen = this.screen.getContext('2d');
      screen.clearRect(0,0,420,278); screen.drawImage(this.canvas,0,0);
    } else this.texture.needsUpdate = true;
  }

  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.texture.dispose(); }
}

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
    this.goalkeeper=new FootballGoalkeeper(this.field,-1);
    this.goalkeeper.team=1;
    this.homeKeeper=null;
    this.keepers=[null,this.goalkeeper];
    this.controls=new FootballControls(this.scene,this.rig,this.camera,this.field);
    this.match=new MatchEngine();
    this.matchVisuals=new MatchVisuals(FT,this.scene,this.match);
    this.matchVisuals.setVisible(false);
    this.matchPhysics=new FootballMatchPhysics(this.match,this.keepers);
    this.matchPhysics.configure(this.scene);
    this.matchHud=new FootballMatchHud(this.scene,this.controls,document.querySelector('#match-hud'));
    this.mode=this.selectedMode='free';
    this.humanBefore=new FT.Vector3();this.humanPose={x:0,z:0,yaw:0};this.launchVelocity=new FT.Vector3();
    this.audio=new FootballAudio();this.interface=new FootballInterface(this.scene,{
      resume:()=>this.setMenu(false),calibrate:()=>this.beginCalibration(),exit:()=>this.exit()
    });
    this.calibrationPanel=new FootballCalibrationPanel(this.camera);
    this.active=false;this.menu=false;this.pending=false;this.pendingInitialPlacement=false;
    this.session=null;this.reference=null;this.paused=false;this.contextLost=false;this.disposed=false;
    this.lastTime=0;this.accumulator=0;this.calibrationRevision=0;this.calibrationCompletePending=false;
    this.abort=new AbortController();this.spawnPoint=new FT.Vector3();this.origin=new FT.Vector3();
    this.ballBefore=new FT.Vector3();this.ballDraw=new FT.Vector3();this.orientationBefore=new FT.Quaternion();
    this.renderBall={position:this.ballDraw,orientation:new FT.Quaternion(),radius:FB.ballRadius};
    this.ui={launcher:document.querySelector('#launcher'),status:document.querySelector('#status'),enter:document.querySelector('#enter-vr'),
      desktop:document.querySelector('#desktop'),resume:document.querySelector('#resume'),exit:document.querySelector('#exit'),
      hint:document.querySelector('#desktop-hint'),free:document.querySelector('#mode-free'),match:document.querySelector('#mode-match'),
      modes:document.querySelector('#modes'),position:document.querySelector('#position'),positionRow:document.querySelector('#position-row'),
      modeControl:document.querySelector('#mode-control')};
    for (const position of MATCH_POSITIONS) this.ui.position.add(new Option(position.label,position.id));
    this.ui.position.value='ST';
    const on=(el,event,fn)=>el?.addEventListener(event,fn,{signal:this.abort.signal});
    on(this.ui.free,'click',()=>this.selectMode('free'));on(this.ui.match,'click',()=>this.selectMode('match'));
    on(this.ui.enter,'click',()=>this.enterVR());on(this.ui.desktop,'click',()=>this.enterDesktop());
    on(this.ui.resume,'click',()=>this.setMenu(false));on(this.ui.exit,'click',()=>this.exit());
    on(window,'resize',()=>this.resize());
    on(window,'pagehide',event=>{if(!event.persisted)this.dispose();});
    on(document,'visibilitychange',()=>{
      if(!this.session){this.paused=document.hidden;this.controls.invalidate();this.physics.clearContacts();this.accumulator=0;this.lastTime=0;this.audio.pause(this.paused||this.menu||!this.active);}
    });
    on(this.renderer.domElement,'webglcontextlost',event=>{
      event.preventDefault();this.contextLost=true;this.controls.invalidate();this.audio.pause(true);
      this.ui.status.textContent='Przerwano działanie grafiki. Odśwież stronę.';this.ui.launcher.hidden=false;
    });
    on(this.renderer.domElement,'webglcontextrestored',()=>{
      this.contextLost=false;this.lastTime=0;this.accumulator=0;this.physics.clearContacts();
      this.ui.status.textContent='';this.ui.launcher.hidden=this.active&&(!this.menu||!this.controls.desktop);
      this.audio.pause(this.paused||this.menu||!this.active);
    });
    on(this.renderer.domElement,'click',()=>{
      if(this.active&&this.controls.desktop&&!this.menu){
        if(document.pointerLockElement!==this.renderer.domElement)this.renderer.domElement.requestPointerLock?.();
        else if(this.controls.kickAge>.7){this.controls.desktopKick='shot';this.controls.kickAge=0;}
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
  syncPage() {
    this.ui.resume.hidden=!this.active;this.ui.exit.hidden=!this.active;
    this.ui.enter.hidden=this.active;this.ui.desktop.hidden=this.active;
    this.ui.modes.hidden=this.active;this.ui.positionRow.hidden=this.active||this.selectedMode!=='match';
  }
  // The selected mode is locked when play starts. Both modes share the renderer and tracked boots.
  selectMode(mode) {
    if (this.active || this.pending) return;
    this.selectedMode = mode;
    this.ui.free.setAttribute('aria-pressed',String(mode === 'free'));
    this.ui.match.setAttribute('aria-pressed',String(mode === 'match'));
    this.ui.positionRow.hidden = mode !== 'match';
    this.ui.modeControl.replaceChildren();
    const key = document.createElement('b'); key.textContent = 'B';
    this.ui.modeControl.append(key, mode === 'match' ? ' proś o podanie' : ' nowa piłka');
  }

  configureMode() {
    this.mode = this.selectedMode;
    const match = this.mode === 'match';
    this.controls.match = match;
    this.controls.desktopPitch = match ? -.42 : -.78;
    this.ui.hint.textContent = match
      ? 'WASD Ruch · Shift Sprint · Mysz / ← → Obrót · F Podanie · Q Dośrodkowanie · Spacja Strzał · B Proś o podanie · Esc Menu'
      : 'WASD Ruch · Shift Sprint · Mysz / ← → Obrót · Spacja / Klik Kopnięcie · E Podbicie · B Nowa piłka · Esc Menu';
    this.goalkeeper.enabled = true;
    this.goalkeeper.matchActive = match;
    const setVisible = (keeper, visible) => {
      keeper.enabled = visible;
      keeper.visual.root.visible = visible;
      keeper.visual.shadow.visible = visible;
    };
    if (match) {
      this.matchSpawn = this.match.start(this.ui.position.value);
      if (!this.homeKeeper) {
        this.homeKeeper = new FootballGoalkeeper(this.field,1);
        this.homeKeeper.team = 0;
        this.homeKeeper.matchActive = true;
        this.homeKeeper.visual.material.color.setHex(0x98d4c2);
        this.keepers[0] = this.homeKeeper;
      }
      setVisible(this.homeKeeper,!this.match.human.isKeeper);
      if (this.match.human.isKeeper) this.ui.hint.textContent += ' · G Rękawice';
      this.matchVisuals.setVisible(true);
      this.matchBreakAge = 0;
    } else {
      if (this.homeKeeper) setVisible(this.homeKeeper,false);
      this.matchPhysics.reset();
      this.matchVisuals.setVisible(false);
      this.matchHud.hide();
    }
  }

  placeAction(spawn) {
    this.controls.place(this.origin.set(spawn.x,0,spawn.z),spawn.yaw ?? 0);
    this.controls.kickAge = 10;
    this.goalkeeper.reset();
    this.homeKeeper?.reset();
    this.matchBreakAge = 0;
    this.applyMatchBall(this.match.ballStart);
    if (this.match.ballStart?.passerId) this.matchVisuals.kick(this.match.ballStart.passerId);
  }

  applyMatchBall(start) {
    if (!start) return;
    this.spawnPoint.set(start.x,start.y,start.z);
    this.launchVelocity.set(start.vx||0,start.vy||0,start.vz||0);
    this.physics.reset(this.spawnPoint,this.launchVelocity);
    if (start.y < FB.ballRadius+.025 && Math.abs(start.vy||0)<.45) {
      this.physics.ball.spin.set(this.launchVelocity.z,0,-this.launchVelocity.x).multiplyScalar(1/FB.ballRadius);
    }
    this.goalkeeper.clearContacts(); this.homeKeeper?.clearContacts();
    this.matchPhysics.reset(); this.controls.invalidate(); this.syncBallHistory();
  }

  hideMatchPresentation() {
    this.matchVisuals.setVisible(false);
    this.matchHud.hide();
    this.matchPhysics.reset();
    if (this.homeKeeper) {
      this.homeKeeper.enabled = false;
      this.homeKeeper.visual.root.visible = false;
      this.homeKeeper.visual.shadow.visible = false;
    }
  }

  ballButton() {
    if (this.mode !== 'match') { this.spawnBall(); return; }
    if (this.match.phase === 'finished') {
      this.matchSpawn = this.match.start(this.ui.position.value);
      this.placeAction(this.matchSpawn);
    } else if (this.match.phase === 'live') this.match.requestPass?.();
  }

  matchStep(dt, alpha) {
    const engine = this.match;
    if (engine.phase !== 'live') {
      if (engine.phase === 'break' && (this.matchBreakAge += dt) > 1.45) {
        const spawn = engine.nextAction();
        if (spawn) this.placeAction(spawn);
      }
      return;
    }
    const ball = this.physics.ball, feet = this.controls.physicsFeet(alpha);
    this.humanPose.x = this.humanBefore.x+(this.controls.headWorld.x-this.humanBefore.x)*alpha;
    this.humanPose.z = this.humanBefore.z+(this.controls.headWorld.z-this.humanBefore.z)*alpha;
    this.humanPose.yaw = Math.atan2(-this.controls.forward.x,-this.controls.forward.z);
    const intent = engine.step(dt,ball,this.humanPose);
    if (engine.phase !== 'live') return;
    if (engine.restartKind === 'throwIn' && intent?.kind !== 'throw') return; // Ball rests between the taker's hands before release.
    for (const keeper of this.keepers) keeper?.update(dt,ball);
    this.matchPhysics.prepare(dt,ball,intent,this.controls,alpha,this.physics.time+dt);
    this.physics.step(dt,feet,this.matchPhysics);
    for (const event of this.physics.events) {
      this.handleEvent(event);
      if (engine.pendingRestart) break;
    }
    const restart = engine.takeRestart();
    if (restart) { this.applyMatchBall(restart); return; }
    const p = ball.position, previous = this.ballBefore, line = FB.halfLength+ball.radius;
    if (Math.abs(p.z) > line) {
      const end = Math.sign(p.z), t = footballClamp((end*line-previous.z)/(p.z-previous.z || 1),0,1);
      const x = previous.x+(p.x-previous.x)*t, y = previous.y+(p.y-previous.y)*t;
      if (Math.abs(x)+ball.radius < FB.goalWidth/2 && y+ball.radius < FB.goalHeight) {
        engine.goal(end < 0 ? 0 : 1);
        return;
      }
    }
    if (Math.abs(p.x) > FB.halfWidth+ball.radius || Math.abs(p.z) > line) {
      engine.out(ball);
      const start = engine.takeRestart();
      if (start) this.applyMatchBall(start);
    }
  }

  avoidPlayers(dt) {
    const controls = this.controls;
    if (controls.velocity.lengthSq() < .015) return;
    const head = controls.headWorld;
    let offsetX = 0, offsetZ = 0;
    for (const player of this.match.players) {
      if (player.isHuman) continue;
      const dx = head.x+offsetX-player.x, dz = head.z+offsetZ-player.z, distance = Math.hypot(dx,dz);
      if (distance >= .49 || distance < 1e-5) continue;
      const nx = dx/distance, nz = dz/distance;
      const speedIntoPlayer = Math.min(0, controls.velocity.x*nx+controls.velocity.z*nz);
      const correction = Math.min(.49-distance, Math.max(.015, dt*4.5));
      offsetX += nx*correction; offsetZ += nz*correction;
      controls.velocity.x -= nx*speedIntoPlayer; controls.velocity.z -= nz*speedIntoPlayer;
    }
    if (offsetX || offsetZ) {
      this.rig.position.x += offsetX; this.rig.position.z += offsetZ;
      controls.refreshHead();
    }
  }

  async detectVR() {
    if(!window.isSecureContext||!navigator.xr){this.ui.enter.disabled=true;this.ui.status.textContent='Aby zagrać w VR, otwórz adres HTTPS w przeglądarce gogli.';return;}
    this.ui.enter.disabled=true;
    try{const supported=await navigator.xr.isSessionSupported('immersive-vr');
      if(this.disposed)return;this.ui.enter.disabled=!supported;this.ui.status.textContent=supported?'':'Gogle VR są niedostępne. Możesz zagrać na ekranie.';
    }catch{this.ui.status.textContent='VR jest niedostępne. Możesz zagrać na ekranie.';}
  }
  async enterVR() {
    if(this.pending||this.session||!navigator.xr)return;this.pending=true;this.ui.enter.disabled=true;this.ui.status.textContent='Uruchamianie VR…';
    try{
      const session=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor']});
      if(this.disposed){await session.end();return;}
      this.session=session;session.addEventListener('end',this.onSessionEnd);session.addEventListener('visibilitychange',this.onXRVisibility);
      await this.renderer.xr.setSession(session);
      this.reference=this.renderer.xr.getReferenceSpace();this.reference?.addEventListener('reset',this.onReferenceReset);
      this.controls.setDesktop(false);this.active=true;this.paused=false;this.lastTime=0;
      this.start();this.onXRVisibility();this.audio.start();this.ui.status.textContent='';
    }catch(error){
      console.warn('VR session could not start',error);
      if(this.session)try{await this.session.end();}catch{this.onSessionEnd();}
      this.ui.status.textContent='Otwórz stronę w goglach i zezwól na uruchomienie VR.';
    }finally{this.pending=false;this.ui.enter.disabled=false;}
  }
  enterDesktop(){if(this.session)return;this.controls.setDesktop(true);this.active=true;this.paused=false;this.lastTime=0;this.start();this.audio.start();}
  onXRVisibility=()=>{
    this.paused=this.session?.visibilityState!=='visible';this.controls.invalidate();this.physics.clearContacts();
    this.accumulator=0;this.lastTime=0;this.audio.pause(this.paused||this.menu);
  };
  onReferenceReset=()=>{this.controls.invalidate();this.physics.clearContacts();this.accumulator=0;this.lastTime=0;};
  onSessionEnd=()=>{
    this.reference?.removeEventListener('reset',this.onReferenceReset);
    this.session?.removeEventListener('end',this.onSessionEnd);this.session?.removeEventListener('visibilitychange',this.onXRVisibility);
    this.session=null;this.reference=null;this.active=false;this.menu=false;this.paused=false;this.pendingInitialPlacement=false;this.hideMatchPresentation();
    this.interface.show(false,this.controls);this.calibrationPanel.hide();this.controls.setDesktop(true);this.controls.invalidate();
    this.physics.clearContacts();this.accumulator=0;this.audio.pause(true);
    this.ui.launcher.hidden=false;this.ui.hint.hidden=true;this.ui.status.textContent='';this.syncPage();this.resize();this.lastTime=0;
  };
  exit(){
    if(this.session){this.session.end().catch(()=>{this.ui.status.textContent='Aby wyjść z VR, użyj menu gogli.';});return;}
    document.exitPointerLock?.();this.active=false;this.menu=false;this.pendingInitialPlacement=false;this.hideMatchPresentation();
    this.controls.keys.clear();this.controls.invalidate();this.physics.clearContacts();this.accumulator=0;
    this.interface.show(false,this.controls);this.calibrationPanel.hide();
    this.ui.launcher.hidden=false;this.ui.hint.hidden=true;this.audio.pause(true);this.syncPage();
  }
  start() {
    // The first tracked pose and calibration must be available before centering a VR player.
    this.pendingInitialPlacement=!this.controls.desktop;this.calibrationCompletePending=false;
    this.configureMode();
    this.goalkeeper.reset();
    if(this.controls.desktop){
      if(this.mode==='match')this.placeAction(this.matchSpawn);
      else{this.controls.place(this.origin.set(0,0,0),0);this.spawnBall();}
    }
    this.controls.invalidate();this.physics.clearContacts();this.accumulator=0;this.lastTime=0;
    this.syncBallHistory();this.field.updateBall(this.physics.ball);this.setMenu(false);this.audio.pause(false);
  }
  syncBallHistory(){this.ballBefore.copy(this.physics.ball.position);this.orientationBefore.copy(this.physics.ball.orientation);}
  spawnBall() {
    this.controls.refreshHead();this.spawnPoint.copy(this.controls.headWorld).addScaledVector(this.controls.forward,.72);
    this.spawnPoint.x=footballClamp(this.spawnPoint.x,-FB.halfWidth+.5,FB.halfWidth-.5);
    this.spawnPoint.z=footballClamp(this.spawnPoint.z,-FB.halfLength+.7,FB.halfLength-.7);this.spawnPoint.y=FB.ballRadius+.025;
    this.physics.reset(this.spawnPoint);this.goalkeeper.clearContacts();this.controls.invalidate();this.syncBallHistory();
  }
  setMenu(show) {
    this.menu=show;this.controls.keys.clear();this.controls.invalidate();this.physics.clearContacts();this.accumulator=0;
    this.interface.matchMode=this.mode==='match';
    this.interface.show(show&&!this.controls.desktop,this.controls);
    if(show)this.matchHud.hide();
    this.ui.launcher.hidden=!(show&&this.controls.desktop);this.ui.hint.hidden=!(this.active&&this.controls.desktop&&!show);
    if(show)document.exitPointerLock?.();this.audio.pause(show||this.paused);this.syncPage();
  }
  beginCalibration() {
    if(this.controls.desktop)return;
    this.setMenu(false);this.controls.beginCalibration();this.calibrationCompletePending=true;
    this.physics.clearContacts();this.accumulator=0;this.controls.invalidate();
  }
  handleEvent(event) {
    if(event.type==='touch'){
      this.audio.kick(event.speed||this.physics.ball.velocity.length());this.controls.pulse(event.footId,.18+Math.min(.5,(event.speed||0)/24));
      if(this.mode==='match') {
        const velocity = this.physics.ball.velocity;
        const released = Math.hypot(velocity.x,velocity.z)>6.7 || velocity.y>2.4;
        const kind = event.kind || (released ? (velocity.y>4 ? 'cross' : velocity.z < -13 && this.match.human.z < -27 ? 'shot' : 'pass') : 'control');
        this.match.touch(this.match.human.id,kind);
      }
    }else if(event.type==='frame')this.audio.kick(2);
    else if(event.type==='save'){
      this.audio.kick(Math.min(16,event.speed||4));
      if(this.mode==='match')this.match.touch(`${event.keeperTeam}:GK`,'deflection');
    }else if(event.type==='match-contact'){
      this.match.touch(event.playerId,event.kind,event.targetId);
      if(event.kind==='throw')this.matchVisuals.throwIn(event.playerId,event.point);
      else if(event.point)this.matchVisuals.kick(event.playerId,event.foot,event.point);
      if(event.speed>.45)this.audio.kick(Math.min(20,event.speed));
    }
  }
  frame=(milliseconds,frame)=>{
    if(this.disposed||this.contextLost)return;
    const now=milliseconds*.001,rawDt=this.lastTime?now-this.lastTime:0;this.lastTime=now;
    const dt=footballClamp(rawDt,0,.05);
    if(rawDt>.1){this.controls.invalidate();this.physics.clearContacts();this.accumulator=0;}
    if(this.active&&!this.paused){
      this.controls.calibrationPaused=this.menu;
      const tracked=this.controls.sample(frame,this.reference,this.session,dt),cal=this.controls.calibration;
      if(!this.controls.desktop&&cal.revision!==this.calibrationRevision&&this.controls.isCalibrated){
        this.calibrationRevision=cal.revision;this.calibrationCompletePending=true;
        this.controls.invalidate();this.physics.clearContacts();this.accumulator=0;
      }
      const ready=this.controls.isCalibrated&&(this.controls.desktop||!cal.awaitRelease);
      if(tracked&&ready&&!this.menu){
        const needsBall=this.pendingInitialPlacement||this.calibrationCompletePending;
        if(this.pendingInitialPlacement){
          if(this.mode==='match')this.placeAction(this.matchSpawn);
          else this.controls.place(this.origin.set(0,0,0),0);
          this.pendingInitialPlacement=false;
        }
        if(this.calibrationCompletePending){
          this.calibrationCompletePending=false;this.controls.invalidate();this.physics.clearContacts();this.accumulator=0;
          this.controls.pulse('left',.35);this.controls.pulse('right',.35);
        }
        if(needsBall&&this.mode==='free')this.spawnBall();
      }
      if(this.controls.edges.menu)this.setMenu(!this.menu);
      if(this.controls.edges.calibrate)this.beginCalibration();
      if(this.controls.edges.ball&&!this.menu&&this.controls.isCalibrated&&(this.controls.desktop||!this.controls.calibration.awaitRelease))this.ballButton();
      this.controls.clearEdges();
      const calibrating=!this.controls.isCalibrated||(!this.controls.desktop&&!!this.controls.calibration.awaitRelease);
      const blocked=this.menu||!tracked||calibrating||this.pendingInitialPlacement;
      const betweenActions=this.mode==='match'&&this.match.phase!=='live';
      this.humanBefore.copy(this.controls.headWorld);
      this.controls.move(dt,blocked||betweenActions);
      if(this.mode==='match'&&!blocked&&!betweenActions)this.avoidPlayers(dt);
      this.controls.prepareFeet(dt,blocked||betweenActions);
      if(this.menu)this.interface.point(this.controls);
      if(!blocked){
        const oldAccumulator=this.accumulator;this.accumulator+=dt;
        const count=Math.min(8,Math.floor((this.accumulator+1e-9)/FB.fixedStep));
        for(let step=0;step<count;step++){
          this.syncBallHistory();
          const sampleAlpha=dt>0?footballClamp(((step+1)*FB.fixedStep-oldAccumulator)/dt,0,1):1;
          if(this.mode==='match')this.matchStep(FB.fixedStep,sampleAlpha);
          else {
            this.goalkeeper.update(FB.fixedStep,this.physics.ball);
            this.physics.step(FB.fixedStep,this.controls.physicsFeet(sampleAlpha),this.goalkeeper);
            for(const event of this.physics.events)this.handleEvent(event);
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
      if(this.mode==='match') {
        this.homeKeeper?.render(blocked?1:alpha);
        this.matchVisuals.render(blocked?1:alpha);
        if(!blocked)this.matchHud.render(this.match,this.physics.ball,now,this.controls.desktop);
      }
      this.calibrationPanel.update(this.controls,!this.menu);
    }else{
      for(const hand of this.controls.hands){hand.visual.root.visible=false;hand.ray.visible=false;}
      this.calibrationPanel.hide();
    }
    this.renderer.render(this.scene,this.camera);
  };
  dispose(){
    if(this.disposed)return;this.disposed=true;this.renderer.setAnimationLoop(null);
    this.abort.abort();if(this.session)this.session.end().catch(()=>{});
    this.controls.dispose();this.interface.dispose();this.calibrationPanel.dispose();this.audio.dispose();this.goalkeeper.dispose();this.homeKeeper?.dispose();this.matchPhysics.dispose();this.matchVisuals.dispose();this.matchHud.dispose();this.field.dispose();this.renderer.dispose();
  }
}

// Football application startup
let footballApp;
try { footballApp=new FootballApp(); }
catch(error) {
  console.error('Football initialization failed',error);
  const status=document.querySelector('#status');
  if(status)status.textContent='Do uruchomienia gry potrzebna jest przeglądarka z WebGL 2.';
  for(const id of ['#enter-vr','#desktop']){const button=document.querySelector(id);if(button)button.disabled=true;}
}


})();
