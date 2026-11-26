(() => {
'use strict';
const TAU = 2 * Math.PI;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;

const KITS = [
  { shirt: 0x36d6c4, sleeve: 0x21998e, collar: 0xcff6e2, shorts: 0x133a3e, socks: 0x20796e, band: 0xc9eee3 },
  { shirt: 0xf16b49, sleeve: 0xcc4d39, collar: 0xffe6b5, shorts: 0x462022, socks: 0xab3c31, band: 0xffc9a2 },
];
const SKIN = [0xd59b72, 0x9f654a, 0xc28364, 0x77462f, 0xe1b495, 0xb57d5c];
const HAIR = [0x30221a, 0x171715, 0x3a2a21, 0x211716, 0x63432b, 0x2e211a];
const BOOTS = [0x161e22, 0xf3dec3, 0x161d1b, 0xa6d871, 0xd6e1e5];

class MatchVisuals {
  constructor(FT, scene, engine) {
    this.FT = FT;
    this.engine = engine;
    this.root = new FT.Group();
    this.root.name = 'Outfield players';
    this.root.visible = false;
    scene.add(this.root);
    this.records = new Map();
    this.throwReleases = new Map();
    this.materials = [];
    this.geometries = [];
    this.textures = [];
    this.batches = [];
    this.clock = 0;
    this.lastDraw = null;

    this.base = new FT.Vector3();
    this.position = new FT.Vector3();
    this.scale = new FT.Vector3();
    this.direction = new FT.Vector3();
    this.up = new FT.Vector3(0, 1, 0);
    this.matrix = new FT.Matrix4();
    this.rotation = new FT.Quaternion();
    this.worldRotation = new FT.Quaternion();
    this.colour = new FT.Color();
    this.shadowRotation = new FT.Quaternion().setFromAxisAngle(new FT.Vector3(1, 0, 0), -Math.PI / 2);

    const fabric = this.material(new FT.MeshStandardMaterial({ roughness: .91, metalness: 0 }));
    const leather = this.material(new FT.MeshStandardMaterial({ roughness: .66, metalness: 0 }));
    const skin = this.material(new FT.MeshStandardMaterial({ roughness: .82, metalness: 0 }));
    const unit = this.geometry(new FT.SphereGeometry(1, 10, 7));
    const limb = this.geometry(new FT.CylinderGeometry(.89, 1, 1, 8, 1));
    const collar = this.geometry(new FT.CylinderGeometry(1, 1, 1, 12, 1));
    const jersey = this.bodyGeometry([
      [0, .160, .102], [.065, .173, .102], [.34, .210, .112],
      [.425, .211, .104], [.470, .148, .085], [.485, .088, .069],
    ]);
    const shorts = this.bodyGeometry([
      [0, .156, .105], [.045, .177, .111], [.165, .174, .108], [.202, .164, .101],
    ]);
    const boot = this.bodyGeometry([
      [0, .050, .129], [.014, .053, .133], [.053, .055, .130], [.082, .047, .109], [.107, .034, .069],
    ]);

    this.shirts = this.batch(jersey, fabric, 22);
    this.hips = this.batch(shorts, fabric, 22);
    this.sleeves = this.batch(limb, fabric, 44);
    this.cloth = this.batch(limb, fabric, 88);
    this.bands = this.batch(collar, fabric, 66);
    this.skin = this.batch(unit, skin, 264);
    this.hair = this.batch(unit, fabric, 22);
    this.boots = this.batch(boot, leather, 44);
    this.shadows = this.makeShadows();
  }

  geometry(geometry) {
    this.geometries.push(geometry);
    return geometry;
  }

  material(material) {
    this.materials.push(material);
    return material;
  }

  bodyGeometry(profile) {
    const vertices = [], indices = [], rings = 12;
    const first = profile[0], last = profile[profile.length - 1];
    const rows = [[first[0], .0001, .0001], ...profile, [last[0], .0001, .0001]];
    rows.forEach(([y, width, depth], row) => {
      for (let column = 0; column < rings; column++) {
        const angle = column * TAU / rings;
        vertices.push(Math.cos(angle) * width, y, Math.sin(angle) * depth);
        if (row === rows.length - 1) continue;
        const a = row * rings + column, b = row * rings + (column + 1) % rings;
        indices.push(a, a + rings, b, b, a + rings, b + rings);
      }
    });
    const geometry = this.geometry(new this.FT.BufferGeometry());
    geometry.setAttribute('position', new this.FT.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  batch(geometry, material, limit) {
    const mesh = new this.FT.InstancedMesh(geometry, material, limit);
    mesh.count = 0;
    mesh.frustumCulled = false;
    this.root.add(mesh);
    const batch = { mesh, count: 0 };
    this.batches.push(batch);
    return batch;
  }

  makeShadows() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const fade = ctx.createRadialGradient(16, 16, 1, 16, 16, 15.5);
    fade.addColorStop(0, 'rgba(5,9,12,.60)');
    fade.addColorStop(.54, 'rgba(5,9,12,.28)');
    fade.addColorStop(1, 'rgba(5,9,12,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 32, 32);
    const map = new this.FT.CanvasTexture(canvas);
    map.colorSpace = this.FT.SRGBColorSpace;
    this.textures.push(map);
    const material = this.material(new this.FT.MeshBasicMaterial({
      map, transparent: true, depthWrite: false, polygonOffset: true,
      polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
    const batch = this.batch(this.geometry(new this.FT.PlaneGeometry(1, 1)), material, 44);
    batch.mesh.renderOrder = 1;
    return batch;
  }

  setVisible(visible) {
    if (this.root.visible === visible) return;
    this.root.visible = visible;
    this.lastDraw = null;
    if (!visible) {
      this.records.clear();
      this.throwReleases.clear();
    }
  }

  kick(playerId, side = 1, contact = null) {
    const record = this.records.get(playerId);
    if (!record) return;
    record.kick = null;
    record.side = side === -1 || side === 'left' ? -1 : 1;
    record.contact = contact ? { x: contact.x, y: contact.y, z: contact.z } : null;
  }

  throwIn(playerId, contact = null) {
    this.throwReleases.set(playerId, contact ? { x: contact.x, y: contact.y, z: contact.z } : null);
  }

  put(batch, x, y, z, sx, sy, sz, colour, rotation = this.worldRotation) {
    this.position.set(x, y, z).applyQuaternion(this.worldRotation).add(this.base);
    this.scale.set(sx, sy, sz);
    this.matrix.compose(this.position, rotation, this.scale);
    batch.mesh.setMatrixAt(batch.count, this.matrix);
    if (colour !== null) batch.mesh.setColorAt(batch.count, this.colour.setHex(colour));
    batch.count++;
  }

  link(batch, x1, y1, z1, x2, y2, z2, rx, rz, colour, sphere = false) {
    this.direction.set(x2 - x1, y2 - y1, z2 - z1);
    const length = this.direction.length();
    if (length < .001) return;
    this.rotation.setFromUnitVectors(this.up, this.direction.multiplyScalar(1 / length)).premultiply(this.worldRotation);
    this.put(batch, (x1 + x2) * .5, (y1 + y2) * .5, (z1 + z2) * .5, rx, length * (sphere ? .58 : 1), rz, colour, this.rotation);
  }

  render(alpha = 1) {
    if (!this.root.visible) return;
    const now = performance.now() / 1000;
    const dt = this.lastDraw === null ? 0 : clamp(now - this.lastDraw, 0, .05);
    this.lastDraw = now;
    this.clock += dt;
    for (const batch of this.batches) batch.count = 0;
    this.engine.players.forEach((player, index) => {
      if (!player.isHuman && !player.isKeeper) this.drawPlayer(player, index, alpha, dt);
    });
    for (const { mesh, count } of this.batches) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  drawPlayer(player, index, alpha, dt) {
    const kit = KITS[player.team] || KITS[0];
    const variation = (index * 7 + player.team) % SKIN.length;
    const skin = SKIN[variation], hair = HAIR[variation], boot = BOOTS[(index * 3) % BOOTS.length];
    const height = .963 + (index * 11 % 8) * .011;
    const width = .961 + (index * 13 % 5) * .019;
    let record = this.records.get(player.id);
    if (!record) {
      record = {
        stride: index * 1.83, speed: 0, kick: -Infinity, contact: null, side: 1, yaw: player.yaw || 0,
        throwAt: -Infinity, throwPoint: null, throwSetup: 0,
      };
      this.records.set(player.id, record);
    }
    if (this.throwReleases.has(player.id)) {
      record.throwAt = this.clock;
      record.throwPoint = this.throwReleases.get(player.id);
      record.kick = -Infinity;
      this.throwReleases.delete(player.id);
    }
    const speed = Math.hypot(player.vx || 0, player.vz || 0);
    const response = 1 - Math.exp(-dt * 19);
    record.speed = mix(record.speed, speed, response);
    const targetYaw = player.yaw || 0;
    let turn = targetYaw - record.yaw;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    if (Math.abs(turn) > .002) record.yaw += turn * response;
    const pace = clamp((record.speed - .12) / 5.8, 0, 1);
    const move = clamp(record.speed / 2.1, 0, 1);
    record.stride += dt * TAU * mix(.9, 2.68, pace) * Math.max(.29, move);
    const swing = Math.sin(record.stride);
    const bob = move * (.016 + .032 * pace) * (Math.cos(record.stride * 2 - .7) - .2);
    if (record.kick === null) record.kick = this.clock;
    const kick = clamp((this.clock - record.kick) / .32, 0, 1);
    const kickBlend = Math.pow(1 - kick, 1.6);
    const hipY = (.942 + bob - kickBlend * .012) * height;
    const defensive = player.action === 'mark' || player.action === 'cover' || player.action === 'press';
    const dribbling = player.action === 'dribble';
    const throwAge = this.clock - record.throwAt;
    const throwProgress = clamp(throwAge / .52, 0, 1);
    const throwPrep = player.action === 'throw' && throwAge > .74;
    record.throwSetup = throwPrep ? Math.min(1, record.throwSetup + dt * 5.5) : 0;
    const throwBlend = throwPrep ? record.throwSetup : Math.pow(1 - throwProgress, 1.2);
    const forward = .07 * pace + .035 * kickBlend + (defensive ? .025 : 0) - (throwPrep ? .023 : 0);
    const chestY = hipY + .44 * height;
    const chestZ = -forward;
    const headY = chestY + .224 * height;
    const headZ = chestZ - .005;

    this.base.set(mix(player.px ?? player.x, player.x, alpha), 0, mix(player.pz ?? player.z, player.z, alpha));
    this.worldRotation.setFromAxisAngle(this.up, record.yaw);
    const sin = Math.sin(record.yaw), cos = Math.cos(record.yaw);
    const vx = player.vx || 0, vz = player.vz || 0, directionScale = Math.max(.25, speed);
    const sideways = (vx * cos - vz * sin) / directionScale;
    const forwardMotion = -(vx * sin + vz * cos) / directionScale;
    let throwX = 0, throwY = headY + .27, throwZ = -.07;
    if (throwPrep) throwZ = .14;
    if (throwBlend > 0 && !throwPrep && record.throwPoint) {
      const dx = record.throwPoint.x - this.base.x, dz = record.throwPoint.z - this.base.z;
      throwX = clamp(dx * cos - dz * sin, -.19, .19);
      throwY = clamp(record.throwPoint.y, headY + .14, headY + .39);
      throwZ = clamp(dx * sin + dz * cos, -.40, .21);
    }
    const follow = throwPrep ? 0 : Math.min(1, throwProgress * 2.4);
    this.put(this.shadows, 0, .007, 0, .87 + pace * .15, .73 + pace * .18, 1, null, this.shadowRotation);

    this.put(this.hips, 0, hipY - .068 * height, 0, width, height, 1, kit.shorts);
    this.rotation.setFromAxisAngle(this.direction.set(1, 0, 0), forward * 1.25).premultiply(this.worldRotation);
    this.put(this.shirts, 0, hipY + .092 * height, 0, width, height, 1, kit.shirt, this.rotation);
    this.put(this.bands, 0, chestY + .118 * height, chestZ - .007, .085, .016, .071, kit.collar);
    this.put(this.skin, 0, chestY + .13 * height, chestZ, .064 * width, .076 * height, .063, skin);
    this.put(this.skin, 0, headY + .014 * height, headZ, .087 * width, .111 * height, .094, skin);
    this.put(this.skin, 0, headY - .022 * height, headZ - .024, .069 * width, .073 * height, .079, skin);
    this.put(this.skin, 0, headY + .010 * height, headZ - .090, .022, .025, .029, skin);
    this.put(this.hair, 0, headY + .063 * height, headZ + .011, .089 * width, .069 * height, .089, hair);

    for (const side of [-1, 1]) {
      const armSwing = swing * side * move;
      const kickSide = side === record.side ? kickBlend : 0;
      const shoulderX = .189 * side * width;
      const shoulderY = chestY + .033 * height;
      const shoulderZ = chestZ;
      const normalElbowX = side * (.232 + pace * .027 + kickBlend * .059);
      const normalElbowY = shoulderY - (.233 - .038 * Math.abs(armSwing));
      const normalElbowZ = shoulderZ + armSwing * (.088 + pace * .15);
      const normalHandX = normalElbowX + side * (.004 + kickBlend * .042);
      const normalHandY = normalElbowY - (.232 - pace * .078 - kickBlend * .06);
      const normalHandZ = normalElbowZ - (.020 + pace * .162) + armSwing * .035;
      const elbowX = mix(normalElbowX, throwX * .55 + side * .242, throwBlend);
      const elbowY = mix(normalElbowY, shoulderY + .23 - follow * .13, throwBlend);
      const elbowZ = mix(normalElbowZ, throwZ * .52 - follow * .10, throwBlend);
      const handX = mix(normalHandX, throwX + side * (.105 + follow * .05), throwBlend);
      const handY = mix(normalHandY, throwY - .024 - follow * .31, throwBlend);
      const handZ = mix(normalHandZ, throwZ - follow * .19, throwBlend);
      const cuffX = mix(shoulderX, elbowX, .57), cuffY = mix(shoulderY, elbowY, .57);
      const cuffZ = mix(shoulderZ, elbowZ, .57);
      this.link(this.sleeves, cuffX, cuffY, cuffZ, shoulderX, shoulderY + .029, shoulderZ, .080 * width, .079, kit.sleeve);
      this.link(this.skin, cuffX, cuffY, cuffZ, elbowX, elbowY, elbowZ, .043, .047, skin, true);
      this.link(this.skin, elbowX, elbowY, elbowZ, handX, handY, handZ, .035, .038, skin, true);
      this.put(this.skin, handX, handY, handZ, .034, .060, .033, skin);

      const phase = record.stride + (side > 0 ? 0 : Math.PI);
      const step = Math.cos(phase) * move * (.13 + pace * .265) * (dribbling ? .72 : 1) * (1 - throwBlend);
      const lift = Math.pow(Math.max(0, -Math.sin(phase)), 1.55) * move * (.055 + pace * .22) * (1 - throwBlend);
      let strikeX = side * (.121 * width + .029), strikeY = .087, strikeZ = -.46;
      if (kickSide > 0 && record.contact) {
        const dx = record.contact.x - this.base.x, dz = record.contact.z - this.base.z;
        strikeX = clamp(dx * cos - dz * sin, -.45, .45);
        strikeY = clamp(record.contact.y - .063, 0, .44);
        strikeZ = clamp(dx * sin + dz * cos + .049, -.77, .25);
      }
      const footX = mix(side * (.121 * width + (defensive ? .026 : 0)) - sideways * step * .52, strikeX, kickSide);
      const footY = mix(lift, strikeY, kickSide);
      const footZ = mix(.01 + step * forwardMotion, strikeZ, kickSide);
      const kneeY = mix(hipY, footY + .083, .51) + .015 * move;
      const kneeZ = footZ * .46 - .092 - lift * .53 - kickSide * .032;
      const kneeX = side * (.106 * width + kickSide * .014);
      const thighX = side * .094 * width, thighZ = -.002;
      const hemX = mix(thighX, kneeX, .65), hemY = mix(hipY, kneeY, .65), hemZ = mix(thighZ, kneeZ, .65);
      const sockX = mix(footX, kneeX, .77), sockY = mix(footY + .075, kneeY, .77);
      const sockZ = mix(footZ, kneeZ, .77);
      this.link(this.cloth, hemX, hemY, hemZ, thighX, hipY + .028, thighZ, .091 * width, .096, kit.shorts);
      this.link(this.skin, hemX, hemY + .014, hemZ, sockX, sockY, sockZ, .059 * width, .067, skin, true);
      this.link(this.cloth, footX, footY + .062, footZ, sockX, sockY, sockZ, .050 * width, .056, kit.socks);
      this.link(this.bands, sockX, sockY - .026, sockZ, sockX, sockY - .012, sockZ, .057 * width, .058, kit.band);
      this.put(this.boots, footX, footY + .013, footZ - .049, width, 1, 1, boot);
    }
  }

  dispose() {
    this.root.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    for (const { mesh } of this.batches) mesh.dispose();
    this.records.clear();
    this.throwReleases.clear();
  }
}

globalThis.FirstTouchVisuals = {MatchVisuals};
})();
