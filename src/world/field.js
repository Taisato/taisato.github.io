import { FT } from "../../vendor/three.js";
import { FB } from "../config.js";
import { FootballPlayerVisuals } from "../player/visuals.js";
import { applyPitchPaint, PITCH_PAINT } from "../render/markings.js";

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
    this.skyLight = new FT.HemisphereLight(0xf3f6e8, 0x2d421d, 1.38);
    this.keyLight = new FT.DirectionalLight(0xf4f6ff, .9);
    this.fillLight = new FT.DirectionalLight(0xfff9df, .65);
    this.keyLight.position.set(-42,22,-28);
    this.fillLight.position.set(42,22,28);
    this.root.add(this.skyLight,this.keyLight,this.fillLight);
  }

  setSkyLighting(lighting,horizon) {
    this.skyLight.color.set(lighting.sky);
    this.skyLight.groundColor.set(lighting.ground);
    this.keyLight.color.set(lighting.key);
    this.fillLight.color.set(lighting.fill);
    this.pitchLighting.flood.value.set(lighting.pitch);
    this.pitchLighting.ambient.value.set(lighting.runoff).multiplyScalar(.28);
    this.pitchLighting.horizon.value.copy(horizon);
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
    const material=this.material(applyPitchPaint(new FT.MeshBasicMaterial({map:grass,color:0xffffff,vertexColors:true})));
    this.pitchLighting=material.userData.pitchLighting;
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

    // The opaque turf shader owns the paint, including filtered distant coverage.
    // No independent thin triangles or second depth surface can break up a line.
    this.pitchBounds = {width: FB.width, length: FB.length, lineWidth: PITCH_PAINT.lineWidth};
  }

  _makeGoals() {
    const frameMaterial = this.material(new FT.MeshStandardMaterial({color: 0xf0f1e8, roughness: .8, metalness: .05}));
    const frameGeometry = this.geometry(new FT.CylinderGeometry(1, 1, 1, 24));
    const frames = new FT.InstancedMesh(frameGeometry, frameMaterial, 6);
    const jointGeometry = this.geometry(new FT.SphereGeometry(1, 24, 12));
    const joints = new FT.InstancedMesh(jointGeometry, frameMaterial, 4);
    const half = FB.goalWidth * .5 + FB.postRadius;
    const top = FB.goalHeight + FB.postRadius;
    let index = 0, jointIndex = 0;
    for (const end of [-1, 1]) {
      const z = end * FB.halfLength;
      for (const side of [-1, 1]) {
        this.translation.set(side * half, top * .5, z);
        this.quaternion.identity();
        this.scale.set(FB.postRadius, top, FB.postRadius);
        this.matrix.compose(this.translation, this.quaternion, this.scale);
        frames.setMatrixAt(index++, this.matrix);
        // The capsule collision frame already has rounded endpoints. Fill
        // the missing outer corner where the two flat-ended tubes meet.
        this.translation.set(side * half, top, z);
        this.scale.setScalar(FB.postRadius);
        this.matrix.compose(this.translation, this.quaternion, this.scale);
        joints.setMatrixAt(jointIndex++, this.matrix);
      }
      this.translation.set(0, top, z);
      this.quaternion.setFromAxisAngle(new FT.Vector3(0, 0, 1), Math.PI / 2);
      this.scale.set(FB.postRadius, half * 2, FB.postRadius);
      this.matrix.compose(this.translation, this.quaternion, this.scale);
      frames.setMatrixAt(index++, this.matrix);
    }
    frames.instanceMatrix.needsUpdate = true;
    joints.instanceMatrix.needsUpdate = true;
    this.root.add(frames, joints);
    this.goalFrames = frames;
    this.goalJoints = joints;

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

export { FootballField };
