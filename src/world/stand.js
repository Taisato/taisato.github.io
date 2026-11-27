import { FT } from '../../vendor/three.js';

const BOX_CORNERS = [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],
  [-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];
const BOX_FACES = [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]];
const BOX_NORMALS = [[0,0,-1],[0,0,1],[-1,0,0],[1,0,0],[0,-1,0],[0,1,0]];

function unitBox() {
  const positions = [], normals = [];
  BOX_FACES.forEach(([a,b,c,d], index) => {
    for (const corner of [a,b,c,a,c,d]) {
      positions.push(...BOX_CORNERS[corner]);
      normals.push(...BOX_NORMALS[index]);
    }
  });
  const geometry = new FT.BufferGeometry();
  geometry.setAttribute('position', new FT.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new FT.BufferAttribute(new Float32Array(normals), 3));
  return geometry;
}

class FootballSidelineStand {
  constructor(scene) {
    this.root = new FT.Group();
    this.root.name = 'Sideline viewing stand';
    // The stand sits beyond the playable runoff. Its benches face the pitch.
    this.root.position.set(-42.7, 0, -16);
    this.geometry = unitBox();
    const body = new FT.MeshStandardMaterial({color: 0x252e3c, roughness: .89, metalness: .12});
    const deck = new FT.MeshStandardMaterial({color: 0x3b4654, roughness: .82, metalness: .13});
    const bench = new FT.MeshStandardMaterial({color: 0x526274, roughness: .76, metalness: .11});
    const rails = new FT.MeshStandardMaterial({color: 0x657585, roughness: .57, metalness: .30});
    this.light = new FT.MeshBasicMaterial({color: 0xb4d9f2, toneMapped: false});
    this.materials = [body, deck, bench, rails, this.light];

    this.addBatch('Foundation and stair risers', body, [
      [0,.205,0,4.68,.41,14.5], [-1.19,.65,0,2.30,.48,14.35],
      [2.17,.11,0,.52,.22,1.24], [1.73,.215,0,.36,.43,1.24],
      [1.36,.322,0,.37,.64,1.24], [.99,.431,0,.38,.86,1.24]
    ]);
    this.addBatch('Textured deck plates', deck, [
      [0,.431,0,4.69,.042,14.51], [-1.19,.913,0,2.30,.046,14.33],
      [2.17,.227,0,.49,.014,1.22], [1.73,.437,0,.34,.014,1.22],
      [1.36,.648,0,.35,.014,1.22], [.99,.867,0,.36,.014,1.22]
    ]);

    const seats = [], supports = [];
    for (const row of [{x:.52,y:.82,deck:.45},{x:-1.22,y:1.31,deck:.94}]) {
      for (const end of [-1,1]) {
        const z = end * 3.85;
        seats.push([row.x,row.y,z,.47,.088,5.55],[row.x-.205,row.y+.218,z,.08,.32,5.55]);
        for (const offset of [-2.34,0,2.34]) {
          supports.push([row.x,row.deck+.16,z+offset,.27,.31,.085],
            [row.x-.19,row.y+.13,z+offset,.064,.23,.095]);
        }
      }
    }
    this.addBatch('Two rows of benches', bench, seats);

    const guardrails = [[-2.28,2.035,0,.075,.075,14.29],[-2.28,1.65,0,.06,.06,14.29]];
    for (const z of [-7.12,-4.73,-2.36,0,2.36,4.73,7.12]) {
      guardrails.push([-2.28,1.49,z,.083,1.10,.083]);
    }
    for (const end of [-1,1]) {
      const z = end * 7.12;
      guardrails.push([-1.36,2.035,z,1.82,.075,.075],[-.45,1.49,z,.083,1.10,.083],
        [.85,1.47,z,2.53,.075,.075],[2.08,.965,z,.083,1.04,.083]);
    }
    this.addBatch('Open steel rails and bench supports', rails, [...supports,...guardrails]);
    this.addBatch('Step marker lights', this.light, [
      [2.35,.325,-6.99,.024,.042,.31], [2.35,.325,6.99,.024,.042,.31],
      [.082,.806,-.55,.023,.033,.13], [.082,.806,.55,.023,.033,.13]
    ]);
    scene.add(this.root);
  }

  addBatch(name, material, blocks) {
    const mesh = new FT.InstancedMesh(this.geometry, material, blocks.length);
    const matrix = new FT.Matrix4();
    blocks.forEach(([x,y,z,w,h,d], index) => {
      matrix.makeScale(w,h,d).setPosition(x,y,z);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = name;
    this.root.add(mesh);
  }

  setAccent(color) {this.light.color.set(color);}

  dispose() {
    this.root.removeFromParent();
    for (const mesh of this.root.children) mesh.dispose();
    this.geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}

export { FootballSidelineStand };
