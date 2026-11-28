import { FT } from "../../vendor/three.js";
import { FB } from "../config.js";

/* Joined, two-sided goal cloth. The rendered triangles and contact surface share
   these particles. Metres / seconds; kinematic boots push the cloth, never the XR pose. */
class FootballGoalNets {
  constructor() {
    this.goals=[this._makeGoal(-1),this._makeGoal(1)];
    this.feet=[];this.footCount=0;this.dt=FB.fixedStep;this.time=0;this.tearSpeed=34.5;
    this._normal=new FT.Vector3();this._surface=new FT.Vector3();this._point=new FT.Vector3();
    this._impulseNormal=new FT.Vector3();
    this._seamNormalA=new FT.Vector3();this._seamNormalB=new FT.Vector3();
    this._local=new FT.Vector3();this._shoePoint=new FT.Vector3();this._shoeNormal=new FT.Vector3();
    this._bootDirection=new FT.Vector3();
    this._ankle=new FT.Vector3();this._seed=new FT.Vector3();this._velocity=new FT.Vector3();this._arm=new FT.Vector3();
    this._quaternion=new FT.Quaternion();this._inverse=new FT.Quaternion();
    this._bary=new Float64Array(3);this._closest=new Float64Array(3);
    this._ids=new Uint16Array(3);this._weights=new Float64Array(3);
    this._patchIds=new Uint16Array(64);this._patchWeights=new Float64Array(64);this._patchCount=0;this._patchSerial=0;
    this._seeds=[new FT.Vector3(),new FT.Vector3(),new FT.Vector3(),new FT.Vector3(),new FT.Vector3()];
    this._lastEvent=-10;this._disposed=false;this._freshContact=true;
    this.stats={clothSteps:0,ballContacts:0,bootContacts:0,bootPasses:0,sleptSteps:0,invalidStates:0,tears:0};
  }
  static relaxedOffsets() {
    if(this._relaxedOffsets)return this._relaxedOffsets;
    // Offline-settled drape, quantized to 0.1 mm; no startup cloth simulation.
    const data=atob("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwGD/oQCpQDj/CoAMAA2+REAEAD+9xEA//9k9hEAAABk9hEA//9k9hEAAABk9hEA//9k9hEAAABk9hEAAABk9hEAAABk9hEAAABk9hEAAABk9hEAAABk9hEAAABk9hEAAABk9hEAAABk9hEAAABk9hEAAABk9hEAAABk9hEAAABk9hEAAQBk9hEAAQBk9hEAAQBk9hEA8f/+9xEA0P81+REAW//i/B8A+f6D/oQCbwGZ//kB9gDN+3wAsABe+jQAYADi9hEAKQC29REAAADs8hEABAA38xEA+//W8REA//8u8hEA/P988REA/v+48REA/v9h8REA//+G8REA//9Y8REAAAB58REAAQBY8REAAQCG8REAAwBg8REAAgC38REABAB88REAAgAu8hEABQDW8REA/P838xEAAADr8hEA1/+29REAoP/i9hEAUf9e+hMACv/M+3wAj/6Z//kBngGI/oIC/gDq/EsAqgA5+R4AaAAB+BEAIwCW9O//CgAS9BEAAQA18hEA/f+A8hEA/v978REA/P/Q8REA//9Q8REA/f+E8REA//9G8REA//9p8REAAABE8REAAQBo8REAAABG8REAAwCE8REAAQBQ8REABADP8REAAQB78REAAwB+8hEA//818hEA9v8Q9BEA3P+V9BEAl/8B+BEAVv84+R4AA//p/EcAYP6I/oMCkAGi//cB+QDT+3sArgBl+hEAYQDm9hEAJwC59REAAQDt8u//AgA58+//+//W8e///f8v8u///P988REA/f+48REA/v9h8REA//+G8REA//9Y8REAAAB58REAAQBY8REAAgCG8REAAgBg8REAAwC38REABAB88REABAAu8u//BQDW8e////848+/////s8u//2f+59REAnv/l9hEAU/9k+hEACP/S+3sAbv6i//cBswGe/nQC8wD6/FkApgBG+TQAWQAO+BEAHgCa9BEA/v8T9O///f828u//8/+A8u///P978REA9f/Q8e///f9Q8REA+f+E8REA//9G8REA/v9p8REAAABE8REAAwBo8REAAgBG8REACACE8REABABQ8READADP8e//BQB78READgB/8u//AwA18u//AwAR9O//4v+a9BEAp/8N+BEAW/9G+TQADv/5/FgATP6e/nQChAG5/8wB9ADi+44AYwBy+iUAWQD29hMA1f/F9RIA+v/v8hIAxv878wQA9v/X8e//0P8w8hEA+P988REA3/+48QUA+/9h8e//7/+H8Q4A//9Y8e//AAB58REAAgBY8e//EACG8REABQBh8e//IQC48QcACAB88e//MAAv8ggACwDX8e//OgA68xEABwDt8hIALADF9RIAqP/19hMAnv9x+h8ADf/h+40AfP65/8wBuQG//j4CrAAN/U0AdgBk+UwA1P8f+BkA9v+U9BIAlv8V9BAA3f838hEAov+B8g0A5P988REAuv/Q8RAA7f9Q8REA1f+F8QgA9v9G8REA8P9p8REAAABE8READABp8QgACQBG8RAAJwCE8QgAEwBQ8QMAQgDP8QEAHAB78RAAWgCA8gkAIgA28gkAZwAT9BIACQCU9BMALQAe+BgAi/9j+UQAVf8N/UwARv7A/j4COwHc/2ABygD++8MA0f+M+iAAEwBd9lgAdP+99SYA1//x8m0Ac/898zcA2v/X8VcAkf8x8jwA5P998TQAtP+58TUA7/9h8RMA2f+H8S4A+v9Y8REA/f968SgABQBY8REAIgCH8S4AEABh8RMARgC48TUAGwB88TQAagAw8jsAJQDW8VcAiAA98zYAKQDw8m4AhwC99SYA7f9Y9lkAMACL+h8AN//++8MAxf7c/2ABqgEL/9EB4P8k/R4AQQDH+I0ANP9/9ykA4v+T9KAAI/8W9B0Azf838m8ASP+C8hYA1/988TYAev/Q8REA4/9Q8RMArv+F8REA8P9G8REA4v9p8REA/f9E8REAFgBp8REACgBG8REASgCE8REAFgBQ8R8AfgDP8REAIwB78TYArwCB8hMALQA38m4A1QAV9BoAFwCT9J8AxAB89ycAvP/S+JIAIgAj/R4AVv4L/9EBAAAAAAAAzP+y+uABBf91+ZYCZv+49ScD5/5r9RkDWP/A8i4DBf8F8yUDeP+i8TADP//48SwDnv9C8TID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"),offsets=new Int16Array(data.length/2);
    for(let i=0;i<offsets.length;i++)offsets[i]=data.charCodeAt(i*2)|(data.charCodeAt(i*2+1)<<8);
    return this._relaxedOffsets=offsets;
  }
  _makeGoal(sign) {
    const nx=28,ny=10,nz=10,half=FB.goalWidth*.5+FB.postRadius,top=FB.goalHeight+FB.postRadius;
    const nodes=[],pins=[],map=new Map(),panels=[],triangles=[],constraints=[],edgeMap=new Set();
    const node=(i,j,k)=>{
      const key=(i*(ny+1)+j)*(nz+1)+k;let id=map.get(key);if(id!==undefined)return id;
      id=nodes.length/3;map.set(key,id);nodes.push(-half+i/nx*half*2,j/ny*top,sign*(FB.halfLength+k/nz*FB.goalDepth));
      pins.push(j===0||(k===0&&(i===0||i===nx||j===ny))||(k===nz&&j===ny&&(i===0||i===nx))?0:1/.012);return id;
    };
    const addConstraint=(a,b,compliance)=>{
      const key=Math.min(a,b)*4096+Math.max(a,b);if(edgeMap.has(key))return;edgeMap.add(key);
      // Spare cord length lets a pocket form before the mesh becomes taut.
      const length=Math.hypot(nodes[a*3]-nodes[b*3],nodes[a*3+1]-nodes[b*3+1],nodes[a*3+2]-nodes[b*3+2]);
      constraints.push(a,b,length*(compliance<.001?1.12:1),compliance);
    };
    const panel=(name,columns,rows,point,axis,inward)=>{
      const ids=new Uint16Array((columns+1)*(rows+1));for(let v=0;v<=rows;v++)for(let u=0;u<=columns;u++)ids[v*(columns+1)+u]=point(u,v);
      const start=triangles.length;
      for(let v=0;v<rows;v++)for(let u=0;u<columns;u++){
        const a=ids[v*(columns+1)+u],b=ids[v*(columns+1)+u+1],c=ids[(v+1)*(columns+1)+u],d=ids[(v+1)*(columns+1)+u+1];
        triangles.push(a,b,c,b,d,c);addConstraint(a,b,.00006);addConstraint(a,c,.00006);addConstraint(b,d,.00006);addConstraint(c,d,.00006);
        addConstraint(a,d,.0005);addConstraint(b,c,.0005);
      }
      for(let v=0;v<=rows;v++)for(let u=0;u<=columns;u++){
        const a=ids[v*(columns+1)+u];if(u+2<=columns)addConstraint(a,ids[v*(columns+1)+u+2],.008);if(v+2<=rows)addConstraint(a,ids[(v+2)*(columns+1)+u],.008);
      }
      panels.push({name,columns,rows,nodes:ids,axis,inward,triangleStart:start,triangleCount:triangles.length-start});
    };
    panel('back',nx,ny,(i,j)=>node(i,j,nz),2,-sign);
    panel('left',nz,ny,(k,j)=>node(0,j,k),0,1);
    panel('right',nz,ny,(k,j)=>node(nx,j,k),0,-1);
    panel('roof',nx,nz,(i,k)=>node(i,ny,k),1,-1);
    const rest=new Float32Array(nodes),relaxed=rest.slice(),offsets=FootballGoalNets.relaxedOffsets();let relaxedDisplacement=0;
    for(const panel of panels){
      // The rows run along height on the upright panels and depth on the roof.
      const axis=panel.axis===1?2:1;panel.rowEdges=new Float32Array(panel.rows+1);
      for(let row=0;row<=panel.rows;row++)panel.rowEdges[row]=rest[panel.nodes[row*(panel.columns+1)]*3+axis];
    }
    for(let i=0;i<rest.length;i+=3){const x=offsets[i]*.0001,y=offsets[i+1]*.0001,z=offsets[i+2]*.0001*-sign;relaxed[i]+=x;relaxed[i+1]+=y;relaxed[i+2]+=z;relaxedDisplacement=Math.max(relaxedDisplacement,Math.sqrt(x*x+y*y+z*z));}
    const positions=relaxed.slice(),previous=relaxed.slice(),neighborSets=Array.from({length:pins.length},()=>new Set()),constraintLookup=new Map();
    for(let k=0;k<constraints.length;k+=4){const a=constraints[k],b=constraints[k+1];constraintLookup.set(Math.min(a,b)*4096+Math.max(a,b),k/4);if(constraints[k+3]<.001){neighborSets[a].add(b);neighborSets[b].add(a);}}
    const neighbors=neighborSets.map(s=>new Uint16Array(s)),neighborLinks=neighbors.map((list,a)=>new Uint16Array(Array.from(list,b=>constraintLookup.get(Math.min(a,b)*4096+Math.max(a,b)))));
    const seamEdges=[],faceEdges=new Map();
    for(let pi=0;pi<panels.length;pi++){
      const panel=panels[pi];
      for(let t=panel.triangleStart;t<panel.triangleStart+panel.triangleCount;t+=3)for(let e=0;e<3;e++){
        const a=triangles[t+e],b=triangles[t+(e+1)%3],key=Math.min(a,b)*4096+Math.max(a,b),other=faceEdges.get(key);
        if(other&&other.pi!==pi)seamEdges.push(a,b,other.t,t,other.pi,pi);
        else if(!other)faceEdges.set(key,{pi,t});
      }
    }
    // Index offsets and rest lengths are fixed. Only a handful of mass and
    // compliance combinations need a timestep-specific projection coefficient.
    const links=new Float32Array(constraints),mass=new Float32Array(pins),linkCount=links.length/4;
    const endpoints=new Uint16Array(linkCount*2),restSquared=new Float64Array(linkCount);
    const linkType=new Uint8Array(linkCount),types=[];
    for(let i=0;i<linkCount;i++){
      const k=i*4,a=links[k],b=links[k+1];
      endpoints[i*2]=a*3;endpoints[i*2+1]=b*3;restSquared[i]=links[k+2]*links[k+2];
      const wa=mass[a],wb=mass[b],compliance=links[k+3];
      let type=types.findIndex(t=>t.wa===wa&&t.wb===wb&&t.compliance===compliance);
      if(type===-1){type=types.length;types.push({wa,wb,compliance,alpha:0,denominator:0});}
      linkType[i]=type;
    }
    return{sign,end:sign,rest,relaxed,relaxedDisplacement,positions,current:positions,previous,renderPrevious:previous,
      velocity:new Float32Array(rest.length),normalPositions:new Float32Array(rest.length),normals:new Float32Array(rest.length),normalsDirty:false,inverseMass:mass,
      indices:new Uint16Array(triangles),panels,constraints:links,lambda:new Float32Array(linkCount),
      endpoints,restSquared,linkType,types,queryDisplacement:Infinity,
      neighbors,neighborLinks,constraintLookup,seamEdges:new Uint16Array(seamEdges),visited:new Uint32Array(pins.length),
      triangleActive:new Uint8Array(triangles.length/3).fill(1),constraintActive:new Uint8Array(constraints.length/4).fill(1),
      nodeDamage:new Float32Array(pins.length),damageRest:rest.slice(),nodeSupport:new Uint16Array(pins.length),edgeSupport:new Uint8Array(constraints.length/4),
      tornTriangles:new Uint16Array(triangles.length/3),tornCount:0,tearCount:0,damageRevision:0,tears:[],lastTearTime:-10,
      bootStates:[0,1].map(()=>({id:null,mask:0,sides:new Int8Array(4),lastTouch:new Float64Array(4)})),
      half,top,front:sign*FB.halfLength,back:sign*(FB.halfLength+FB.goalDepth),
      sleeping:true,revision:0,active:false,quietTime:0,maxDisplacement:relaxedDisplacement,maxSpeed:0,ballInside:null,exteriorMask:0,ballContact:false,footContact:false};
  }
  reset({repair=true}={}) {
    this.clearContacts(true);
    for(const net of this.goals){
      if(!repair&&net.tearCount){net.ballInside=null;net.exteriorMask=0;net.revision++;continue;}
      net.queryDisplacement=Infinity;
      net.positions.set(net.relaxed);net.previous.set(net.relaxed);net.velocity.fill(0);net.lambda.fill(0);net.normals.fill(0);net.normalsDirty=false;net.sleeping=true;net.active=false;net.quietTime=0;net.maxDisplacement=net.relaxedDisplacement;net.maxSpeed=0;net.ballInside=null;net.exteriorMask=0;net.ballContact=false;net.footContact=false;net.revision++;
      if(repair){net.triangleActive.fill(1);net.constraintActive.fill(1);net.nodeDamage.fill(0);net.damageRest.set(net.rest);net.nodeSupport.fill(0);net.edgeSupport.fill(0);net.tornCount=0;net.tearCount=0;net.tears.length=0;net.lastTearTime=-10;net.damageRevision++;}
    }
    if(repair)this.time=0;
  }
  _releaseBoot(net,state){if(state.mask){net.sleeping=false;net.quietTime=0;}state.id=null;state.mask=0;state.sides.fill(0);state.lastTouch.fill(0);}
  clearContacts(resetBall=false){this.feet=[];this.footCount=0;this._lastEvent=-10;this._freshContact=true;for(const net of this.goals){for(const state of net.bootStates)this._releaseBoot(net,state);if(resetBall){net.ballInside=null;net.exteriorMask=0;}net.ballContact=false;net.footContact=false;}}
  contactClearance(net,x,y,z) {
    const depth=z*net.sign-FB.halfLength;
    return Math.max(-.35-depth,depth-FB.goalDepth-.35,Math.abs(x)-net.half-.35,-.45-y,y-net.top-.35)-net.maxDisplacement;
  }
  _near(net,x,y,z,padding=0){return this.contactClearance(net,x,y,z)<=padding;}
  _nearSurface(net,x,y,z,padding=0) {
    if(!this._near(net,x,y,z,padding))return false;
    const depth=z*net.sign-FB.halfLength,range=.38+padding+net.maxDisplacement;
    return Math.abs(depth-FB.goalDepth)<range||Math.abs(Math.abs(x)-net.half)<range||Math.abs(y-net.top)<range;
  }
  beginStep(dt,physics,footData=[],footCount=footData.length) {
    if(this._disposed)return;this.dt=dt;this.time+=dt;this.feet=footData;this.footCount=footCount;
    let footTravel=0;for(let f=0;f<footCount;f++)footTravel=Math.max(footTravel,footData[f].distance);
    this._bootSamples=Math.max(1,Math.min(32,Math.ceil(footTravel/.025)));this._bootIndex=0;
    const b=physics.ball,p=b.position,travel=b.velocity.length()*dt;
    for(const net of this.goals){
      net.ballContact=false;net.footContact=false;net.energyContact=false;
      // Prepared feet are compacted when a controller disappears. Material
      // sides belong to handedness/id, never to its current array index.
      for(const state of net.bootStates){
        if(state.id===null)continue;let foot=null;for(let f=0;f<footCount;f++)if(footData[f].id===state.id){foot=footData[f];break;}
        if(!foot||!this._nearSurface(net,foot.targetAnkle.x,foot.targetAnkle.y,foot.targetAnkle.z,.45+foot.distance)){this._releaseBoot(net,state);continue;}
        if(!net.sleeping)for(let panel=0;panel<4;panel++)if((state.mask&(1<<panel))&&physics.time-state.lastTouch[panel]>.2){state.mask&=~(1<<panel);state.sides[panel]=0;}
      }
      const depth=p.z*net.sign-FB.halfLength;
      if(net.ballInside===null){net.ballInside=depth>=0&&depth<=FB.goalDepth+net.maxDisplacement&&Math.abs(p.x)<net.half&&p.y<net.top;net.exteriorMask=(depth>FB.goalDepth?1:0)|(p.x<-net.half?2:0)|(p.x>net.half?4:0)|(p.y>net.top?8:0);}
      if(depth<-.18)net.ballInside=false;
      if(net.ballInside)net.exteriorMask=0;
      let near=(this._freshContact||b.velocity.lengthSq()>.0064)&&this._nearSurface(net,p.x,p.y,p.z,travel+b.radius);
      for(let f=0;f<footCount&&!near;f++){const foot=footData[f],a=foot.previousAnkle,c=foot.targetAnkle;let known=false;for(const state of net.bootStates)if(state.id===foot.id){known=true;break;}if(this._freshContact||foot.distance>.00005||!known)near=this._nearSurface(net,c.x,c.y,c.z,.42+foot.distance)||this._nearSurface(net,a.x,a.y,a.z,.42);}
      if(near){net.sleeping=false;net.quietTime=0;}
      net.active=!net.sleeping;if(!net.active)this.stats.sleptSteps++;
      // Cloth has its own fixed 120 Hz clock. A fast ball may take many CCD
      // substeps, but must not multiply the cost of the whole cloth solve.
      if(net.active)this._advance(net,dt);
    }
    this._freshContact=false;
  }
  _advance(net,h) {
    // The solver and visual interpolation both start from these same particles.
    // A sleeping net already has matching snapshots from reset or its last step.
    const p=net.positions,r=net.rest,v=net.velocity,w=net.inverseMass,start=net.previous,c=net.constraints;
    start.set(p);const damping=Math.exp(-3.5*h),spring=16*h,sqrt=Math.sqrt;
    for(let i=0;i<w.length;i++){
      const j=i*3;if(!w[i]){p[j]=r[j];p[j+1]=r[j+1];p[j+2]=r[j+2];v[j]=v[j+1]=v[j+2]=0;continue;}
      if(net.tearCount&&!net.nodeSupport[i]){p[j]=net.relaxed[j];p[j+1]=net.relaxed[j+1];p[j+2]=net.relaxed[j+2];v[j]=v[j+1]=v[j+2]=0;continue;}
      if(net.nodeDamage[i]){
        const target=net.damageRest;
        v[j]=(v[j]+(target[j]-p[j])*spring*.35)*damping;v[j+1]=(v[j+1]+((target[j+1]-p[j+1])*17-9.81)*h)*damping;v[j+2]=(v[j+2]+(target[j+2]-p[j+2])*spring*.35)*damping;
      }else{v[j]=(v[j]+(r[j]-p[j])*spring)*damping;v[j+1]=(v[j+1]+((r[j+1]-p[j+1])*26-9.81)*h)*damping;v[j+2]=(v[j+2]+(r[j+2]-p[j+2])*spring)*damping;}
      p[j]+=v[j]*h;p[j+1]+=v[j+1]*h;p[j+2]+=v[j+2]*h;
    }
    const {lambda,endpoints,restSquared,linkType,types,constraintActive}=net,count=lambda.length;
    lambda.fill(0);const invH2=1/(h*h);
    for(const type of types){type.alpha=type.compliance*invH2;type.denominator=type.wa+type.wb+type.alpha;}
    for(let pass=0;pass<2;pass++)for(let order=0;order<count;order++){
      const i=pass?count-1-order:order;
      if(!constraintActive[i])continue;
      const ai=endpoints[i*2],bi=endpoints[i*2+1],dx=p[bi]-p[ai],dy=p[bi+1]-p[ai+1],dz=p[bi+2]-p[ai+2],lengthSq=dx*dx+dy*dy+dz*dz;
      // Cord resists extension; a loose span folds instead of pushing apart
      // like a compressed spring. Soft bending links keep the fold coherent.
      if(lengthSq<=restSquared[i])continue;
      const type=types[linkType[i]],wa=type.wa,wb=type.wb;if(wa+wb===0)continue;
      const restLength=c[i*4+2],length=sqrt(lengthSq);if(length<=restLength||length<1e-7)continue;
      const change=(-(length-restLength)-type.alpha*lambda[i])/type.denominator;lambda[i]+=change;
      const scale=change/length;p[ai]-=wa*dx*scale;p[ai+1]-=wa*dy*scale;p[ai+2]-=wa*dz*scale;p[bi]+=wb*dx*scale;p[bi+1]+=wb*dy*scale;p[bi+2]+=wb*dz*scale;
    }
    let maxDisplacementSquared=0;
    for(let i=0;i<w.length;i++){
      if(!w[i])continue;const j=i*3;
      if(p[j+1]<.004)p[j+1]=.004;
      const dx=p[j]-r[j],dy=p[j+1]-r[j+1],dz=p[j+2]-r[j+2],distanceSq=dx*dx+dy*dy+dz*dz;
      maxDisplacementSquared=Math.max(maxDisplacementSquared,distanceSq);
      // Tension limiting is applied to the visible particles themselves.
      if(distanceSq>1.8225){const factor=1.35/sqrt(distanceSq);p[j]=r[j]+dx*factor;p[j+1]=r[j+1]+dy*factor;p[j+2]=r[j+2]+dz*factor;}
      let vx=(p[j]-start[j])/h,vy=(p[j+1]-start[j+1])/h,vz=(p[j+2]-start[j+2])/h,speedSq=vx*vx+vy*vy+vz*vz;
      if(speedSq>256){const q=16/sqrt(speedSq);vx*=q;vy*=q;vz*=q;}v[j]=vx;v[j+1]=vy;v[j+2]=vz;
    }
    net.queryDisplacement=sqrt(maxDisplacementSquared)+.00001;
    this.stats.clothSteps++;
    // Only a ball contact uses these normals. Snapshot the exact solved shape,
    // since a boot can move shared particles before that contact in the same tick.
    net.normalPositions.set(p);net.normalsDirty=true;
  }
  _updateNormals(net,p=net.positions){
    const normals=net.normals,idx=net.indices;normals.fill(0);net.normalsDirty=false;
    for(let t=0;t<idx.length;t+=3){if(!net.triangleActive[t/3])continue;const a=idx[t]*3,b=idx[t+1]*3,c=idx[t+2]*3,ax=p[b]-p[a],ay=p[b+1]-p[a+1],az=p[b+2]-p[a+2],bx=p[c]-p[a],by=p[c+1]-p[a+1],bz=p[c+2]-p[a+2],nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
      normals[a]+=nx;normals[a+1]+=ny;normals[a+2]+=nz;normals[b]+=nx;normals[b+1]+=ny;normals[b+2]+=nz;normals[c]+=nx;normals[c+1]+=ny;normals[c+2]+=nz;}
  }
  _rowNear(net,panel,row,point,radius){
    // Preserve the original triangle order. A whole row can be excluded only
    // if even the most displaced knot cannot bring it into the contact range.
    const value=panel.axis===1?point.z:point.y,a=panel.rowEdges[row],b=panel.rowEdges[row+1],range=radius+net.queryDisplacement;
    return value>=Math.min(a,b)-range&&value<=Math.max(a,b)+range;
  }
  _growQueryBounds(net,j){
    const p=net.positions,r=net.rest;
    net.queryDisplacement=Math.max(net.queryDisplacement,Math.abs(p[j]-r[j]),Math.abs(p[j+1]-r[j+1]),Math.abs(p[j+2]-r[j+2]));
  }
  _closestTriangle(px,py,pz,p,ia,ib,ic) {
    const a=ia*3,b=ib*3,c=ic*3,ax=p[a],ay=p[a+1],az=p[a+2],abx=p[b]-ax,aby=p[b+1]-ay,abz=p[b+2]-az,acx=p[c]-ax,acy=p[c+1]-ay,acz=p[c+2]-az;
    const apx=px-ax,apy=py-ay,apz=pz-az,d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz;
    let wa,wb,wc;
    if(d1<=0&&d2<=0){wa=1;wb=wc=0;}
    else{
      const bpx=px-p[b],bpy=py-p[b+1],bpz=pz-p[b+2],d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;
      if(d3>=0&&d4<=d3){wb=1;wa=wc=0;}
      else{
        const vc=d1*d4-d3*d2;
        if(vc<=0&&d1>=0&&d3<=0){wb=d1/(d1-d3);wa=1-wb;wc=0;}
        else{
          const cpx=px-p[c],cpy=py-p[c+1],cpz=pz-p[c+2],d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;
          if(d6>=0&&d5<=d6){wc=1;wa=wb=0;}
          else{
            const vb=d5*d2-d1*d6;
            if(vb<=0&&d2>=0&&d6<=0){wc=d2/(d2-d6);wa=1-wc;wb=0;}
            else{
              const va=d3*d6-d5*d4;
              if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){wc=(d4-d3)/((d4-d3)+(d5-d6));wb=1-wc;wa=0;}
              else{const total=va+vb+vc;if(Math.abs(total)<1e-15){wa=1;wb=wc=0;}else{wb=vb/total;wc=vc/total;wa=1-wb-wc;}}
            }
          }
        }
      }
    }
    this._bary[0]=wa;this._bary[1]=wb;this._bary[2]=wc;
    this._closest[0]=ax+wb*abx+wc*acx;this._closest[1]=ay+wb*aby+wc*acy;this._closest[2]=az+wb*abz+wc*acz;
    this._normal.set(aby*acz-abz*acy,abz*acx-abx*acz,abx*acy-aby*acx);const length=this._normal.length();if(length<1e-9)return false;this._normal.multiplyScalar(1/length);return true;
  }
  _triangleNear(p,ia,ib,ic,x,y,z,range,axis=-1) {
    const a=ia*3,b=ib*3,c=ic*3;
    return(axis===0||(x>=Math.min(p[a],p[b],p[c])-range&&x<=Math.max(p[a],p[b],p[c])+range))&&
      (axis===1||(y>=Math.min(p[a+1],p[b+1],p[c+1])-range&&y<=Math.max(p[a+1],p[b+1],p[c+1])+range))&&
      (axis===2||(z>=Math.min(p[a+2],p[b+2],p[c+2])-range&&z<=Math.max(p[a+2],p[b+2],p[c+2])+range));
  }
  _projectedTriangle(x,y,z,p,ia,ib,ic,axis) {
    const u=axis===0?1:0,v=axis===2?1:2,a=ia*3,b=ib*3,c=ic*3,pu=u===0?x:y,pv=v===1?y:z;
    const bx=p[b+u]-p[a+u],by=p[b+v]-p[a+v],cx=p[c+u]-p[a+u],cy=p[c+v]-p[a+v],px=pu-p[a+u],py=pv-p[a+v],det=bx*cy-by*cx;
    if(Math.abs(det)<1e-10)return false;const wb=(px*cy-py*cx)/det,wc=(bx*py-by*px)/det,wa=1-wb-wc;
    if(wa<-.000001||wb<-.000001||wc<-.000001)return false;
    this._bary[0]=wa;this._bary[1]=wb;this._bary[2]=wc;
    for(let k=0;k<3;k++)this._closest[k]=p[a+k]*wa+p[b+k]*wb+p[c+k]*wc;
    return true;
  }
  _segmentTriangle(net,triangle,from,to){
    const p=net.positions,idx=net.indices,a=idx[triangle]*3,b=idx[triangle+1]*3,c=idx[triangle+2]*3;
    if(Math.max(from.x,to.x)<Math.min(p[a],p[b],p[c])||Math.min(from.x,to.x)>Math.max(p[a],p[b],p[c])||
      Math.max(from.y,to.y)<Math.min(p[a+1],p[b+1],p[c+1])||Math.min(from.y,to.y)>Math.max(p[a+1],p[b+1],p[c+1])||
      Math.max(from.z,to.z)<Math.min(p[a+2],p[b+2],p[c+2])||Math.min(from.z,to.z)>Math.max(p[a+2],p[b+2],p[c+2]))return false;
    const ax=p[a],ay=p[a+1],az=p[a+2],ux=p[b]-ax,uy=p[b+1]-ay,uz=p[b+2]-az,vx=p[c]-ax,vy=p[c+1]-ay,vz=p[c+2]-az;
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,den=nx*dx+ny*dy+nz*dz;
    if(Math.abs(den)<1e-12)return false;
    const t=(nx*(ax-from.x)+ny*(ay-from.y)+nz*(az-from.z))/den;if(t<0||t>1)return false;
    const x=from.x+dx*t,y=from.y+dy*t,z=from.z+dz*t,px=x-ax,py=y-ay,pz=z-az;
    const uu=ux*ux+uy*uy+uz*uz,uv=ux*vx+uy*vy+uz*vz,vv=vx*vx+vy*vy+vz*vz,pu=px*ux+py*uy+pz*uz,pv=px*vx+py*vy+pz*vz,det=uu*vv-uv*uv;
    if(det<1e-15)return false;const wb=(pu*vv-pv*uv)/det,wc=(pv*uu-pu*uv)/det,wa=1-wb-wc;
    if(wa<-1e-6||wb<-1e-6||wc<-1e-6)return false;
    this._normal.set(nx,ny,nz).normalize();this._closest[0]=x;this._closest[1]=y;this._closest[2]=z;this._bary[0]=wa;this._bary[1]=wb;this._bary[2]=wc;this._sweepT=t;return true;
  }
  _updateHoleSide(net,physics){
    if(!net.tornCount)return;const from=physics._previous,to=physics.ball.position;
    if(from.distanceToSquared(to)<1e-14||!this._near(net,to.x,to.y,to.z,from.distanceTo(to)+physics.ball.radius))return;
    let earliest=2,inside=net.ballInside,mask=net.exteriorMask;
    for(const panel of net.panels){
      const end=panel.triangleStart+panel.triangleCount;
      for(let i=0;i<net.tornCount;i++){
        const triangle=net.tornTriangles[i]*3;if(triangle<panel.triangleStart||triangle>=end||!this._segmentTriangle(net,triangle,from,to)||this._sweepT>=earliest)continue;
        const n=this._normal;if(n.getComponent(panel.axis)*panel.inward<0)n.negate();
        const entering=(to.x-from.x)*n.x+(to.y-from.y)*n.y+(to.z-from.z)*n.z>0;
        earliest=this._sweepT;inside=entering;mask=entering?0:1<<net.panels.indexOf(panel);
      }
    }
    if(earliest<=1){net.ballInside=inside;net.exteriorMask=mask;}
  }
  _linkCrossesTriangle(net,k,t,axis){
    // Strict interior overlap: a surviving boundary cord stays attached, but
    // diagonal/shear and two-knot bending links cannot bridge an open hole.
    const p=net.rest,c=net.constraints,idx=net.indices,a=idx[t]*3,b=idx[t+1]*3,d=idx[t+2]*3,s=(c[k]|0)*3,e=(c[k+1]|0)*3;
    if(Math.abs(p[s+axis]-p[a+axis])>1e-5||Math.abs(p[e+axis]-p[a+axis])>1e-5)return false;
    const u=axis===0?1:0,v=axis===2?1:2,bx=p[b+u]-p[a+u],by=p[b+v]-p[a+v],cx=p[d+u]-p[a+u],cy=p[d+v]-p[a+v],det=bx*cy-by*cx;
    if(Math.abs(det)<1e-12)return false;
    const sx=p[s+u]-p[a+u],sy=p[s+v]-p[a+v],ex=p[e+u]-p[a+u],ey=p[e+v]-p[a+v],b0=(sx*cy-sy*cx)/det,c0=(bx*sy-by*sx)/det,b1=(ex*cy-ey*cx)/det,c1=(bx*ey-by*ex)/det;
    let lo=0,hi=1;
    for(let i=0;i<3;i++){
      const start=i===0?1-b0-c0:i===1?b0:c0,finish=i===0?1-b1-c1:i===1?b1:c1,delta=finish-start;
      if(Math.abs(delta)<1e-12){if(start<1e-6)return false;}
      else{const edge=(1e-6-start)/delta;if(delta>0)lo=Math.max(lo,edge);else hi=Math.min(hi,edge);if(hi<=lo)return false;}
    }
    return hi-lo>1e-5;
  }
  _rebuildDamage(net,firstTorn){
    const idx=net.indices,support=net.nodeSupport,damage=net.nodeDamage,edges=net.edgeSupport,c=net.constraints;
    support.fill(0);damage.fill(0);edges.fill(0);
    for(let t=0;t<idx.length;t+=3){
      const a=idx[t],b=idx[t+1],d=idx[t+2];
      if(net.triangleActive[t/3]){
        support[a]++;support[b]++;support[d]++;
        for(let e=0;e<3;e++){const x=e===0?a:e===1?b:d,y=e===0?b:e===1?d:a,key=net.constraintLookup.get(Math.min(x,y)*4096+Math.max(x,y));if(key!==undefined)edges[key]=1;}
      }else{damage[a]=damage[b]=damage[d]=1;}
    }
    for(let k=0;k<c.length;k+=4){
      if(!net.constraintActive[k/4]||edges[k/4])continue;
      if(!support[c[k]|0]||!support[c[k+1]|0]){net.constraintActive[k/4]=0;continue;}
      for(const panel of net.panels){
        const end=panel.triangleStart+panel.triangleCount;
        for(let i=firstTorn;i<net.tornCount;i++){const t=net.tornTriangles[i]*3;if(t>=panel.triangleStart&&t<end&&this._linkCrossesTriangle(net,k,t,panel.axis)){net.constraintActive[k/4]=0;break;}}
        if(!net.constraintActive[k/4])break;
      }
    }
  }
  _tear(net,physics,panelIndex,triangle,speed){
    if(!net.triangleActive[triangle/3]||this.time-net.lastTearTime<.12)return false;
    const panel=net.panels[panelIndex],axis=panel.axis,u=axis===0?1:0,v=axis===2?1:2,rest=net.rest,idx=net.indices,bary=this._bary;
    const point=new FT.Vector3(...this._closest),material=new FT.Vector3(),normal=this._normal.clone();
    if(normal.getComponent(axis)*panel.inward>0)normal.negate();
    for(let k=0;k<3;k++)material.setComponent(k,rest[idx[triangle]*3+k]*bary[0]+rest[idx[triangle+1]*3+k]*bary[1]+rest[idx[triangle+2]*3+k]*bary[2]);
    // Hole size follows the impact speed independently of the tear threshold.
    const radius=.245+Math.min(.07,Math.max(0,speed-33)*.007),cu=material.getComponent(u),cv=material.getComponent(v),firstCell=panel.triangleStart+Math.floor((triangle-panel.triangleStart)/6)*6;
    let removed=0;const firstTorn=net.tornCount;
    for(let t=panel.triangleStart;t<panel.triangleStart+panel.triangleCount;t+=6){
      const a=idx[t]*3,b=idx[t+1]*3,c=idx[t+2]*3,d=idx[t+4]*3;
      const minU=Math.min(rest[a+u],rest[b+u],rest[c+u],rest[d+u]),maxU=Math.max(rest[a+u],rest[b+u],rest[c+u],rest[d+u]),minV=Math.min(rest[a+v],rest[b+v],rest[c+v],rest[d+v]),maxV=Math.max(rest[a+v],rest[b+v],rest[c+v],rest[d+v]);
      const dx=(minU+maxU)*.5-cu,dy=(minV+maxV)*.5-cv,ex=Math.max(minU-cu,0,cu-maxU),ey=Math.max(minV-cv,0,cv-maxV),jitter=.8+(((t*1103515245+net.tearCount*12345)>>>8)&255)/255*.42;
      if(t!==firstCell&&ex*ex+ey*ey>.15*.15&&(dx*dx/(radius*radius*1.12)+dy*dy/(radius*radius*.9))>jitter)continue;
      for(let j=0;j<2;j++){const id=t/3+j;if(net.triangleActive[id]){net.triangleActive[id]=0;net.tornTriangles[net.tornCount++]=id;removed++;}}
    }
    if(!removed)return false;
    net.queryDisplacement=Infinity;
    net.tearCount++;net.lastTearTime=this.time;net.damageRevision++;net.revision++;net.sleeping=false;net.active=true;net.quietTime=0;net.energyContact=true;
    this._rebuildDamage(net,firstTorn);
    for(let i=0;i<net.nodeDamage.length;i++){
      if(!net.nodeDamage[i]||!net.nodeSupport[i]||!net.inverseMass[i])continue;const j=i*3,dx=rest[j+u]-cu,dy=rest[j+v]-cv,dist=Math.hypot(dx,dy);if(dist>radius+.38||dist<1e-6)continue;
      const weight=Math.max(0,1-dist/(radius+.4)),radial=.045*weight;
      net.damageRest[j+u]+=dx/dist*radial;net.damageRest[j+v]+=dy/dist*radial;net.damageRest[j+1]-=.025*weight;
      for(let k=0;k<3;k++){const outward=normal.getComponent(k);net.damageRest[j+k]+=outward*.04*weight;net.positions[j+k]+=outward*.02*weight;net.velocity[j+k]+=outward*Math.min(5,speed*.13)*weight;}
      net.positions[j+u]+=dx/dist*radial;net.positions[j+v]+=dy/dist*radial;
      const rx=net.damageRest[j]-rest[j],ry=net.damageRest[j+1]-rest[j+1],rz=net.damageRest[j+2]-rest[j+2],offset=Math.hypot(rx,ry,rz);
      if(offset>.2){const scale=.2/offset;net.damageRest[j]=rest[j]+rx*scale;net.damageRest[j+1]=rest[j+1]+ry*scale;net.damageRest[j+2]=rest[j+2]+rz*scale;}
    }
    // Breaking cords costs energy; it never boosts or redirects the shot.
    physics.redirectPlayerShot('net');
    physics.ball.velocity.multiplyScalar(.87);physics.ball.spin.multiplyScalar(.94);
    const tear={panelIndex,position:point,restPosition:material,normal,radius,speed,time:this.time,firstTriangle:triangle/3};
    if(net.tears.length===16)net.tears.shift();net.tears.push(tear);this.stats.tears++;
    physics.events.push({type:'net',speed,position:point.clone(),torn:true});this._lastEvent=physics.time;
    this._updateNormals(net);return true;
  }
  _sweptBreak(net,physics){
    if(!net.ballInside||physics.ball.velocity.lengthSq()<this.tearSpeed*this.tearSpeed)return false;
    const from=physics._previous,to=physics.ball.position;if(from.distanceToSquared(to)<1e-14)return false;
    for(let pi=0;pi<net.panels.length;pi++){
      const panel=net.panels[pi];if(-physics.ball.velocity.getComponent(panel.axis)*panel.inward<=0)continue;
      for(let t=panel.triangleStart;t<panel.triangleStart+panel.triangleCount;t+=3){
        if(!net.triangleActive[t/3]||!this._segmentTriangle(net,t,from,to))continue;
        const n=this._normal;if(n.getComponent(panel.axis)*panel.inward<0)n.negate();
        const travel=(to.x-from.x)*n.x+(to.y-from.y)*n.y+(to.z-from.z)*n.z;if(travel>=0)continue;
        const ids=net.indices,bary=this._bary,vel=net.velocity;let relative=-physics.ball.velocity.dot(n);
        for(let j=0;j<3;j++){const k=ids[t+j]*3;relative+=(vel[k]*n.x+vel[k+1]*n.y+vel[k+2]*n.z)*bary[j];}
        if(relative>=this.tearSpeed&&this._tear(net,physics,pi,t,relative)){net.ballInside=false;net.exteriorMask=1<<pi;return true;}
      }
    }
    return false;
  }
  _contactPatch(net,ia,ib,ic,wa,wb,wc) {
    const rest=net.rest,rx=rest[ia*3]*wa+rest[ib*3]*wb+rest[ic*3]*wc,ry=rest[ia*3+1]*wa+rest[ib*3+1]*wb+rest[ic*3+1]*wc,rz=rest[ia*3+2]*wa+rest[ib*3+2]*wb+rest[ic*3+2]*wc;
    const ids=this._patchIds,weights=this._patchWeights,visited=net.visited,serial=++this._patchSerial;let count=0,sum=0;
    const seeds=this._ids;seeds[0]=ia;seeds[1]=ib;seeds[2]=ic;
    for(let s=0;s<3;s++){
      const neighbors=net.neighbors[seeds[s]];
      for(let k=-1;k<neighbors.length;k++){
        const id=k<0?seeds[s]:neighbors[k];if(visited[id]===serial)continue;
        if(net.tearCount&&(!net.nodeSupport[id]||(k>=0&&!net.constraintActive[net.neighborLinks[seeds[s]][k]])))continue;
        visited[id]=serial;
        const j=id*3,dx=rest[j]-rx,dy=rest[j+1]-ry,dz=rest[j+2]-rz,weight=Math.max(0,1-(dx*dx+dy*dy+dz*dz)/.25);if(weight<=0)continue;
        ids[count]=id;weights[count]=weight*weight;sum+=weights[count];count++;
      }
    }
    let invMass=0;for(let k=0;k<count;k++){weights[k]/=sum;invMass+=weights[k]*weights[k]*net.inverseMass[ids[k]];}this._patchCount=count;return invMass;
  }
  _updateMouthSide(net,physics) {
    // Topological side changes at the open mouth must follow each ball CCD
    // segment, not wait for the next cloth tick. Otherwise an exterior side
    // remembered on approach projects a legal entry onto a distant side net.
    const bp=physics.ball.position,last=physics._previous,from=last.z*net.sign-FB.halfLength,to=bp.z*net.sign-FB.halfLength;
    if(!net.ballInside&&from<0&&to>=0){
      const t=-from/(to-from),x=last.x+(bp.x-last.x)*t,y=last.y+(bp.y-last.y)*t;
      if(Math.abs(x)<net.half&&y>=-physics.ball.radius&&y<net.top){net.ballInside=true;net.exteriorMask=0;}
    }else if(net.ballInside&&from>=0&&to<0){net.ballInside=false;net.exteriorMask=0;}
  }
  _ball(net,physics,h) {
    const ball=physics.ball,bp=ball.position,p=net.positions,idx=net.indices,w=net.inverseMass,vel=net.velocity,r=ball.radius+.003,ballW=1/ball.mass;
    if(!this._near(net,bp.x,bp.y,bp.z,r+.15)&&!(net.ballInside&&bp.z*net.sign>=FB.halfLength&&Math.abs(bp.x)<net.half+.35&&bp.y<net.top+.35))return;
    if(this._sweptBreak(net,physics))return;
    for(let panelIndex=0;panelIndex<net.panels.length;panelIndex++){
      const panel=net.panels[panelIndex],retainSide=net.ballInside||!!(net.exteriorMask&(1<<panelIndex));
      const rowSize=panel.columns*6;
      for(let row=0;row<panel.rows;row++){
        if(!this._rowNear(net,panel,row,bp,r+.04))continue;
        const start=panel.triangleStart+row*rowSize;
        for(let t=start;t<start+rowSize;t+=3){
          if(!net.triangleActive[t/3])continue;
          const ia=idx[t],ib=idx[t+1],ic=idx[t+2];
          if(!this._triangleNear(p,ia,ib,ic,bp.x,bp.y,bp.z,r+.04,retainSide?panel.axis:-1))continue;
          if(!this._closestTriangle(bp.x,bp.y,bp.z,p,ia,ib,ic))continue;
          const nearestDistanceSq=(bp.x-this._closest[0])**2+(bp.y-this._closest[1])**2+(bp.z-this._closest[2])**2;
          const projected=retainSide&&this._projectedTriangle(bp.x,bp.y,bp.z,p,ia,ib,ic,panel.axis);
          const bary=this._bary,q=this._closest,n=this._normal,wa=bary[0],wb=bary[1],wc=bary[2],dx=bp.x-q[0],dy=bp.y-q[1],dz=bp.z-q[2];
          const orientation=(net.ballInside?1:-1)*panel.inward;
          if(n.getComponent(panel.axis)*orientation<0)n.negate();
          const signed=dx*n.x+dy*n.y+dz*n.z,distance=Math.sqrt(dx*dx+dy*dy+dz*dz);
          // Retention catches crossings, but an approaching sphere must touch
          // the finite triangle, not only its extended sloping plane.
          if(projected&&signed>=0&&nearestDistanceSq>=r*r)continue;
          // A diagonal or welded cell edge is still a continuous sheet. Retain
          // its sided contact when a fast sphere crosses the exact shared edge.
          const tangentSq=Math.max(0,distance*distance-signed*signed);
          const face=projected||(wa>1e-7&&wb>1e-7&&wc>1e-7)||tangentSq<1e-9||(net.ballInside&&signed<0&&tangentSq<r*r*.95);
          if(!face){if(distance>=r)continue;if(distance>1e-7)n.set(dx/distance,dy/distance,dz/distance);}
          else if(signed>=r||(!retainSide&&signed<-.10))continue;
          const penetration=face?r-signed:r-distance;
          if(penetration<=0||penetration>1.6)continue;
          // A ball can go around a post and later approach a different panel
          // from outside. Remember that material side at the actual first touch.
          if(!net.ballInside&&signed>=-.10)net.exteriorMask|=1<<panelIndex;
          const ca=ia*3,cb=ib*3,cc=ic*3,invCloth=wa*wa*w[ia]+wb*wb*w[ib]+wc*wc*w[ic],total=ballW+invCloth;
          this._surface.set(vel[ca]*wa+vel[cb]*wb+vel[cc]*wc,vel[ca+1]*wa+vel[cb+1]*wb+vel[cc+1]*wc,vel[ca+2]*wa+vel[cb+2]*wb+vel[cc+2]*wc);
          if(net.normalsDirty)this._updateNormals(net,net.normalPositions);
          const response=this._impulseNormal,normals=net.normals,patchInverse=this._contactPatch(net,ia,ib,ic,wa,wb,wc),patchIds=this._patchIds,patchWeights=this._patchWeights;
          response.set(0,0,0);for(let k=0;k<this._patchCount;k++){const j=patchIds[k]*3,pw=patchWeights[k];response.x+=normals[j]*pw;response.y+=normals[j+1]*pw;response.z+=normals[j+2]*pw;}
          if(response.lengthSq()<1e-12)response.copy(n);else response.normalize();if(response.dot(n)<0)response.negate();response.multiplyScalar(.97).addScaledVector(n,.03).normalize();
          const incoming=-(ball.velocity.x-this._surface.x)*response.x-(ball.velocity.y-this._surface.y)*response.y-(ball.velocity.z-this._surface.z)*response.z;
          // The sphere has reached this finite sheet. A strong outward impact
          // ruptures its local cords before the retention constraint pulls back.
          if(net.ballInside&&incoming>=this.tearSpeed&&ball.velocity.lengthSq()>=this.tearSpeed*this.tearSpeed&&nearestDistanceSq<=r*r&&this._tear(net,physics,panelIndex,t,incoming))return;
          const correction=(penetration+.00005)/total;
          bp.addScaledVector(n,correction*ballW);
          const ids=this._ids,weights=this._weights;ids[0]=ia;ids[1]=ib;ids[2]=ic;weights[0]=wa;weights[1]=wb;weights[2]=wc;
          for(let k=0;k<3;k++){const id=ids[k],j=id*3,d=-correction*weights[k]*w[id];p[j]+=n.x*d;p[j+1]+=n.y*d;p[j+2]+=n.z*d;this._growQueryBounds(net,j);}
          if(incoming>0){
            if(incoming>.2)net.energyContact=true;
            physics.redirectPlayerShot('net');
            // The tensioned neighboring knots share the collision impulse. This
            // is a real distributed cloth mass, not an oversized ball collider.
            const impulse=incoming*1.04/(ballW+patchInverse);
            ball.velocity.addScaledVector(response,impulse*ballW);
            for(let k=0;k<this._patchCount;k++){const id=patchIds[k],j=id*3,d=-impulse*patchWeights[k]*w[id];vel[j]+=response.x*d;vel[j+1]+=response.y*d;vel[j+2]+=response.z*d;}
            this._velocity.copy(ball.velocity);physics.surfaceFriction(response,this._surface,impulse*ballW*.075);
            this._velocity.sub(ball.velocity).multiplyScalar(ball.mass);
            for(let k=0;k<this._patchCount;k++){const id=patchIds[k],j=id*3,d=patchWeights[k]*w[id];vel[j]+=this._velocity.x*d;vel[j+1]+=this._velocity.y*d;vel[j+2]+=this._velocity.z*d;}
            if(!net.ballContact&&incoming>1.1&&physics.time-this._lastEvent>.14){physics.events.push({type:'net',speed:incoming,position:new FT.Vector3(q[0],q[1],q[2])});this._lastEvent=physics.time;}
          }
          net.ballContact=true;this.stats.ballContacts++;
        }
      }
    }
  }
  _retainSeams(net,physics) {
    if(!net.ballInside)return;
    const ball=physics.ball,bp=ball.position,p=net.positions,idx=net.indices,seams=net.seamEdges,r=ball.radius+.003,ballW=1/ball.mass;
    // The welded panels move together, but separate face projections can miss
    // the outside wedge of their common edge. Retain that finite material seam,
    // never an extended plane across the open mouth or an already torn face.
    for(let k=0;k<seams.length;k+=6){
      const a=seams[k],b=seams[k+1],ta=seams[k+2],tb=seams[k+3],pa=net.panels[seams[k+4]],pb=net.panels[seams[k+5]];
      if(!net.triangleActive[ta/3]||!net.triangleActive[tb/3])continue;
      const ai=a*3,bi=b*3,ex=p[bi]-p[ai],ey=p[bi+1]-p[ai+1],ez=p[bi+2]-p[ai+2],lengthSq=ex*ex+ey*ey+ez*ez;
      if(lengthSq<1e-10)continue;
      const t=Math.max(0,Math.min(1,((bp.x-p[ai])*ex+(bp.y-p[ai+1])*ey+(bp.z-p[ai+2])*ez)/lengthSq));
      const qx=p[ai]+ex*t,qy=p[ai+1]+ey*t,qz=p[ai+2]+ez*t,dx=bp.x-qx,dy=bp.y-qy,dz=bp.z-qz;
      if(dx*dx+dy*dy+dz*dz>(r+.35)*(r+.35))continue;
      if(!this._closestTriangle(qx,qy,qz,p,idx[ta],idx[ta+1],idx[ta+2]))continue;
      const na=this._seamNormalA.copy(this._normal);if(na.getComponent(pa.axis)*pa.inward<0)na.negate();
      if(!this._closestTriangle(qx,qy,qz,p,idx[tb],idx[tb+1],idx[tb+2]))continue;
      const nb=this._seamNormalB.copy(this._normal);if(nb.getComponent(pb.axis)*pb.inward<0)nb.negate();
      const sa=dx*na.x+dy*na.y+dz*na.z,sb=dx*nb.x+dy*nb.y+dz*nb.z;if(sa>=r||sb>=r)continue;
      if((sa>=0||sb>=0)&&dx*dx+dy*dy+dz*dz>r*r*2)continue;
      const n=this._normal.copy(na).add(nb);if(n.lengthSq()<1e-8)continue;n.normalize();
      const da=n.dot(na),db=n.dot(nb);if(da<.15||db<.15)continue;
      // Engage at the sphere surface and recover one small step at a time;
      // a retracting folded knot must not teleport the ball across the pocket.
      const correction=Math.min(.06,Math.max((r-sa)/da,(r-sb)/db)+.00005);
      this._surface.set(net.velocity[ai]*(1-t)+net.velocity[bi]*t,net.velocity[ai+1]*(1-t)+net.velocity[bi+1]*t,net.velocity[ai+2]*(1-t)+net.velocity[bi+2]*t);
      const incoming=-(ball.velocity.x-this._surface.x)*n.x-(ball.velocity.y-this._surface.y)*n.y-(ball.velocity.z-this._surface.z)*n.z;
      const wa=idx[ta]===a?1-t:idx[ta]===b?t:0,wb=idx[ta+1]===a?1-t:idx[ta+1]===b?t:0,wc=1-wa-wb;
      this._closest[0]=qx;this._closest[1]=qy;this._closest[2]=qz;this._bary[0]=wa;this._bary[1]=wb;this._bary[2]=wc;
      if(incoming>=this.tearSpeed&&ball.velocity.lengthSq()>=this.tearSpeed*this.tearSpeed&&this._tear(net,physics,seams[k+4],ta,incoming)){net.ballInside=false;net.exteriorMask=1<<seams[k+4];return;}
      bp.addScaledVector(n,correction);
      if(incoming>0){
        physics.redirectPlayerShot('net');
        const invPatch=this._contactPatch(net,idx[ta],idx[ta+1],idx[ta+2],wa,wb,wc),impulse=incoming*1.04/(ballW+invPatch);
        ball.velocity.addScaledVector(n,impulse*ballW);
        for(let j=0;j<this._patchCount;j++){const id=this._patchIds[j],offset=id*3,d=-impulse*this._patchWeights[j]*net.inverseMass[id];net.velocity[offset]+=n.x*d;net.velocity[offset+1]+=n.y*d;net.velocity[offset+2]+=n.z*d;}
        if(incoming>.2)net.energyContact=true;
      }
      net.ballContact=true;this.stats.ballContacts++;
      return;
    }
  }
  _boots(net,physics,alpha,h) {
    if(this.footCount)this.stats.bootPasses++;
    const p=net.positions,idx=net.indices,w=net.inverseMass,vel=net.velocity;
    for(let fi=0;fi<this.footCount;fi++){
      const foot=this.feet[fi],shape=foot.foot.contactShape;if(!shape)continue;
      this._ankle.lerpVectors(foot.previousAnkle,foot.targetAnkle,alpha);
      if(!this._nearSurface(net,this._ankle.x,this._ankle.y,this._ankle.z,.45))continue;
      let state=null,free=null;for(const candidate of net.bootStates){if(candidate.id===foot.id)state=candidate;else if(candidate.id===null)free=candidate;}
      if(!state){state=free||net.bootStates[0];this._releaseBoot(net,state);state.id=foot.id;}
      this._quaternion.slerpQuaternions(foot.previousOrientation,foot.targetOrientation,alpha);this._inverse.copy(this._quaternion).invert();
      const bounds=shape.bounds,min=bounds.min,max=bounds.max,cx=(min[0]+max[0])*.5,cy=(min[1]+max[1])*.5,dz=max[2]-min[2];
      for(let s=0;s<3;s++)this._seeds[s].set(cx,cy,min[2]+dz*(.18+s*.32)).applyQuaternion(this._quaternion).add(this._ankle);
      this._seeds[3].set(min[0]*.5,cy,min[2]+dz*.4).applyQuaternion(this._quaternion).add(this._ankle);
      this._seeds[4].set(max[0]*.5,cy,min[2]+dz*.4).applyQuaternion(this._quaternion).add(this._ankle);
      for(let panelIndex=0;panelIndex<net.panels.length;panelIndex++){
        const panel=net.panels[panelIndex],bit=1<<panelIndex,rowSize=panel.columns*6;
        for(let row=0;row<panel.rows;row++){
          if(!this._rowNear(net,panel,row,this._ankle,.39))continue;
          const start=panel.triangleStart+row*rowSize;
          for(let t=start;t<start+rowSize;t+=3){
            if(!net.triangleActive[t/3])continue;
            const ia=idx[t],ib=idx[t+1],ic=idx[t+2];if(!this._triangleNear(p,ia,ib,ic,this._ankle.x,this._ankle.y,this._ankle.z,.39))continue;
            for(let s=0;s<this._seeds.length;s++){
              const seed=this._seeds[s];if(!this._closestTriangle(seed.x,seed.y,seed.z,p,ia,ib,ic))continue;
              const q=this._closest;this._point.set(q[0],q[1],q[2]);
              if(this._point.distanceToSquared(seed)>.04)continue;
              this._local.copy(this._point).sub(this._ankle).applyQuaternion(this._inverse);
              if(this._local.x<min[0]-.004||this._local.x>max[0]+.004||this._local.y<min[1]-.004||this._local.y>max[1]+.004||this._local.z<min[2]-.004||this._local.z>max[2]+.004)continue;
              const side=state.mask&bit?state.sides[panelIndex]:(this._point.getComponent(panel.axis)>=this._ankle.getComponent(panel.axis)?1:-1);
              const direction=this._bootDirection.set(0,0,0).setComponent(panel.axis,side).applyQuaternion(this._inverse),hull=shape.triangles;let distance=Infinity;
              if(hull){
                // Half-space tests include deep interior points and reject distant
                // exterior points cheaply. Only a near exterior needs the full
                // closest-triangle query; an interior exits the real convex hull.
                let planeMax=-Infinity,exit=Infinity;
                for(let k=0;k<hull.length;k+=19){const plane=hull[k+9]*this._local.x+hull[k+10]*this._local.y+hull[k+11]*this._local.z-hull[k+12];if(plane>planeMax)planeMax=plane;if(plane>.004)break;
                  const denominator=hull[k+9]*direction.x+hull[k+10]*direction.y+hull[k+11]*direction.z;if(denominator>1e-7){const t=-plane/denominator;if(t>=-1e-5&&t<exit)exit=t;}}
                if(planeMax>.004)continue;
                if(planeMax<=1e-7&&Number.isFinite(exit)&&exit<.5){distance=-Math.max(0,exit);this._shoeNormal.copy(direction);}
                else distance=shape.query(this._local,this._shoePoint,this._shoeNormal,.004);
              }else distance=shape.query(this._local,this._shoePoint,this._shoeNormal,.36);
              if(!Number.isFinite(distance)||distance>=.004)continue;
              const bary=this._bary,wa=bary[0],wb=bary[1],wc=bary[2],total=wa*wa*w[ia]+wb*wb*w[ib]+wc*wc*w[ic];if(total<1e-9)continue;
              if(!(state.mask&bit)){state.sides[panelIndex]=side;state.mask|=bit;}
              state.lastTouch[panelIndex]=physics.time;
              this._normal.copy(this._shoeNormal).applyQuaternion(this._quaternion).normalize();
              const correction=Math.min(.065,.004-distance)/total,ids=this._ids,weights=this._weights,n=this._normal;ids[0]=ia;ids[1]=ib;ids[2]=ic;weights[0]=wa;weights[1]=wb;weights[2]=wc;
              this._surface.copy(foot.ankleVelocity);this._arm.copy(this._point).sub(this._ankle);this._velocity.crossVectors(foot.bootDriveAngularVelocity,this._arm);this._surface.add(this._velocity).clampLength(0,12);
              const ca=ia*3,cb=ib*3,cc=ic*3,normalSpeed=(this._surface.x-(vel[ca]*wa+vel[cb]*wb+vel[cc]*wc))*n.x+(this._surface.y-(vel[ca+1]*wa+vel[cb+1]*wb+vel[cc+1]*wc))*n.y+(this._surface.z-(vel[ca+2]*wa+vel[cb+2]*wb+vel[cc+2]*wc))*n.z;
              if(normalSpeed>.2)net.energyContact=true;
              for(let k=0;k<3;k++){const id=ids[k],j=id*3,d=correction*weights[k]*w[id];p[j]+=n.x*d;p[j+1]+=n.y*d;p[j+2]+=n.z*d;this._growQueryBounds(net,j);
                if(normalSpeed>0){const dv=normalSpeed*.72*weights[k]*w[id]/total;vel[j]+=n.x*dv;vel[j+1]+=n.y*dv;vel[j+2]+=n.z*dv;}}
              if(!net.footContact&&normalSpeed>.7&&physics.time-this._lastEvent>.18){physics.events.push({type:'net',footId:foot.id,speed:normalSpeed,position:this._point.clone()});this._lastEvent=physics.time;}
              net.footContact=true;this.stats.bootContacts++;break;
            }
          }
        }
      }
    }
  }
  substep(physics,alpha,h) {
    if(this._disposed)return;
    // A clear central entry can happen while both cloth meshes are asleep.
    for(const net of this.goals){this._updateMouthSide(net,physics);this._updateHoleSide(net,physics);}
    // Sample the tracked translation and angular sweep at their own rate.
    // A stationary shoe takes one contact pass at 120 Hz even when a distant
    // fast ball requires many CCD substeps.
    while(this._bootIndex<this._bootSamples&&(this._bootIndex+1)/this._bootSamples<=alpha+1e-8){
      const footAlpha=++this._bootIndex/this._bootSamples;for(const net of this.goals)if(net.active)this._boots(net,physics,footAlpha,this.dt/this._bootSamples);
    }
    for(const net of this.goals){
      if(!net.active)continue;
      this._ball(net,physics,h);
      this._retainSeams(net,physics);
    }
  }
  endStep() {
    for(const net of this.goals){
      if(!net.active)continue;const p=net.positions,r=net.rest,v=net.velocity,w=net.inverseMass,sqrt=Math.sqrt;let maxSpeedSq=0,maxDisplacementSq=0;
      for(let i=0;i<w.length;i++){
        const j=i*3;
        if(!Number.isFinite(p[j]+p[j+1]+p[j+2]+v[j]+v[j+1]+v[j+2])){this.stats.invalidStates++;p[j]=r[j];p[j+1]=r[j+1];p[j+2]=r[j+2];v[j]=v[j+1]=v[j+2]=0;}
        if(!w[i]){p[j]=r[j];p[j+1]=r[j+1];p[j+2]=r[j+2];v[j]=v[j+1]=v[j+2]=0;}
        let speedSq=v[j]*v[j]+v[j+1]*v[j+1]+v[j+2]*v[j+2];if(speedSq>256){const scale=16/sqrt(speedSq);v[j]*=scale;v[j+1]*=scale;v[j+2]*=scale;speedSq=256;}if(speedSq>maxSpeedSq)maxSpeedSq=speedSq;
        const dx=p[j]-r[j],dy=p[j+1]-r[j+1],dz=p[j+2]-r[j+2],displacementSq=dx*dx+dy*dy+dz*dz;if(displacementSq>maxDisplacementSq)maxDisplacementSq=displacementSq;
      }
      net.maxSpeed=sqrt(maxSpeedSq);net.maxDisplacement=sqrt(maxDisplacementSq);net.revision++;
      if(!net.energyContact&&maxSpeedSq<.0049)net.quietTime+=this.dt;else net.quietTime=0;
      if(net.quietTime>.65){net.sleeping=true;net.active=false;net.velocity.fill(0);net.maxSpeed=0;net.previous.set(net.positions);}
    }
  }
  dispose(){this.clearContacts();this._disposed=true;this.goals.length=0;}
}

export { FootballGoalNets };
