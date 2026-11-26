(() => {
'use strict';
const HALF_WIDTH = 34;
const HALF_LENGTH = 52.5;
const BALL_RADIUS = .11;
const GOAL_HALF_WIDTH = 3.66;
const GRAVITY = 9.81;
const CLOCK_RATE = .78;
const PRESS_REFRESH = .12;
const RESTART_DELAY = .32;
const ATTACK = [-1, 1];
const RELEASES = new Set(['pass', 'cross', 'shot', 'clear', 'release', 'throw']);
const BALL_ACTIONS = new Set(['dribble', 'tackle', 'pass', 'cross', 'shot', 'clear', 'throw']);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const yawFor = (dx, dz) => Math.atan2(-dx, -dz);
const angleDifference = (target, current) => Math.atan2(Math.sin(target - current), Math.cos(target - current));

// Each side rotates the same starting shape by 180 degrees at the centre spot.
const MATCH_POSITIONS = Object.freeze([
  {id:'GK', label:'Bramkarz', unit:'keeper', x:0, z:50},
  {id:'LB', label:'Lewy obrońca', unit:'back', x:-24, z:23},
  {id:'LCB', label:'Lewy stoper', unit:'back', x:-8, z:27},
  {id:'RCB', label:'Prawy stoper', unit:'back', x:8, z:27},
  {id:'RB', label:'Prawy obrońca', unit:'back', x:24, z:23},
  {id:'DM', label:'Defensywny pomocnik', unit:'middle', x:0, z:11},
  {id:'LCM', label:'Lewy pomocnik', unit:'middle', x:-11, z:2},
  {id:'RCM', label:'Prawy pomocnik', unit:'middle', x:11, z:2},
  {id:'LW', label:'Lewy skrzydłowy', unit:'front', x:-24, z:-18},
  {id:'ST', label:'Napastnik', unit:'front', x:0, z:-22},
  {id:'RW', label:'Prawy skrzydłowy', unit:'front', x:24, z:-18}
].map(Object.freeze));

const SCENES = [
  {side:1, width:0, depth:0, passDepth:6.7, passWidth:4.8},
  {side:-1, width:-5, depth:-8, passDepth:5.8, passWidth:5.6},
  {side:1, width:4, depth:7, passDepth:7.4, passWidth:4.2},
  {side:-1, width:2, depth:-3, passDepth:6.4, passWidth:6.0},
  {side:1, width:-3, depth:-10, passDepth:8.0, passWidth:4.8},
  {side:-1, width:6, depth:5, passDepth:5.4, passWidth:5.1},
  {side:1, width:-2, depth:-5, passDepth:7.1, passWidth:5.7}
];

function makePlayer(team, slot) {
  return {
    id:`${team}:${slot.id}`, team, role:slot.id, slot, isKeeper:slot.unit === 'keeper', isHuman:false,
    x:0, z:0, px:0, pz:0, vx:0, vz:0, yaw:team ? Math.PI : 0,
    action:'shape', tx:0, tz:0, kickAt:-Infinity, kickKind:null, intent:null, intentUntil:0, controlAt:-Infinity
  };
}

function setPose(player, x, z, yaw = player.yaw) {
  player.x = player.px = player.tx = x;
  player.z = player.pz = player.tz = z;
  player.vx = player.vz = 0;
  player.yaw = yaw;
}

function aim(player, kind, position, targetX, targetZ, speed, rise = 0, targetId = null) {
  const dx = targetX - position.x;
  const dz = targetZ - position.z;
  const length = Math.hypot(dx, dz) || 1;
  return {playerId:player.id, kind, vx:dx * speed / length, vy:rise, vz:dz * speed / length, targetId};
}

class MatchEngine {
  constructor({random = Math.random} = {}) {
    this.random = random;
    this.teams = ATTACK.map((_, team) => MATCH_POSITIONS.map(slot => makePlayer(team, slot)));
    this.players = this.teams.flat();
    this.byId = new Map(this.players.map(player => [player.id, player]));
    this.outfield = this.teams.map(team => team.filter(player => !player.isKeeper));
    this.score = [0, 0];
    this.human = this.teams[0].find(player => player.role === 'ST');
    this.phase = 'idle';
    this.time = 0;
    this.minute = 0;
    this.notice = '';
    this.opponentSeconds = 0;
    this.possessionTeam = null;
    this.controllerId = null;
    this.lastTouchId = null;
    this.ballStart = null;
    this.pendingRestart = null;
    this.offsidePlayers = new Set();
  }

  start(positionId = 'ST') {
    this.human.isHuman = false;
    this.human = this.byId.get(`0:${String(positionId).toUpperCase()}`) || this.byId.get('0:ST');
    this.human.isHuman = true;
    this.score.fill(0);
    this.time = 0;
    this.clock = 0;
    this.minute = 1;
    this.actionNumber = 0;
    return this.setupAction();
  }

  nextAction() {
    if (this.phase !== 'break') return null;
    if (this.clock >= 90 || this.actionNumber >= SCENES.length) {
      this.phase = 'finished';
      this.minute = 90;
      this.notice = 'Koniec meczu';
      return null;
    }
    return this.setupAction();
  }

  setupAction() {
    const scene = SCENES[this.actionNumber++];
    this.clock = Math.max(this.clock, 1 + (this.actionNumber - 1) * 13);
    this.minute = Math.floor(this.clock);
    this.phase = 'live';
    this.notice = '';
    this.oppositionSince = null;
    this.opponentSeconds = 0;
    this.possessionTeam = 0;
    this.controllerId = null;
    this.lastTouchId = null;
    this.receiveId = this.human.id;
    this.receiveUntil = this.time + 2.4;
    this.openingUntil = this.time + 1.77;
    this.offsidePlayers.clear();
    this.restartPlayerId = null;
    this.restartKind = null;
    this.restartAt = null;
    this.pendingRestart = null;
    this.tacticsIn = 0;
    this.callForBallUntil = -Infinity;
    this.presser = [null, null];

    const {slot} = this.human;
    const x = slot.unit === 'keeper' ? scene.width * .3 : clamp(slot.x + scene.width, -29, 29);
    const z = slot.unit === 'keeper' ? 47.3 : clamp(slot.z + scene.depth, -34, 36);
    const yaw = 0;
    const target = {x:x + .035, z:z - .39};
    const launch = {
      x:clamp(x + scene.side * scene.passWidth, -31, 31),
      z:clamp(target.z - scene.passDepth, -46, 49)
    };
    if (Math.abs(launch.x - x) < 4) launch.x = x - scene.side * scene.passWidth;
    const passDistance = distance(launch, target);
    const dx = (target.x - launch.x) / passDistance;
    const dz = (target.z - launch.z) / passDistance;
    this.openingPass = {x:launch.x, z:launch.z, dx, dz, length:passDistance};

    for (const team of this.teams) {
      for (const player of team) {
        const tact = this.basePosition(player, target, player.team === 0);
        if (!player.isKeeper && !player.isHuman && distance(tact, target) < 5.7) {
          const away = player.team === 1 ? ATTACK[0] : -ATTACK[0];
          tact.z += away * 4;
          tact.x += (tact.x < x ? -1 : 1) * 2.5;
        }
        if (!player.isKeeper && !player.isHuman) this.clearOpeningLane(tact, tact, 3.0);
        setPose(player, tact.x, tact.z, player.team ? Math.PI : 0);
        player.action = player.isKeeper ? 'keeper' : 'shape';
        player.kickAt = player.controlAt = -Infinity;
        player.kickKind = player.intent = null;
        player.intentUntil = 0;
      }
    }

    setPose(this.human, x, z, yaw);
    const passer = this.outfield[0].filter(player => !player.isHuman)
      .sort((a, b) => distance(a, launch) - distance(b, launch))[0];
    const passSpeed = clamp(passDistance / 1.52 + .34, 4.1, 7.3);
    setPose(passer, launch.x - dx * .84, launch.z - dz * .84, yawFor(dx, dz));
    passer.kickKind = 'pass';
    passer.kickAt = this.time;
    passer.action = 'pass';
    this.openingPass.passerId = passer.id;
    this.lastTouchId = passer.id;
    this.ballStart = {x:launch.x, y:BALL_RADIUS, z:launch.z, vx:dx * passSpeed, vy:0, vz:dz * passSpeed, passerId:passer.id};
    return {x, z, yaw};
  }

  step(dt, ball, humanPose) {
    if (this.phase !== 'live' || !Number.isFinite(dt) || dt <= 0) return null;
    this.time += dt;
    this.clock = Math.min(90, this.clock + dt * CLOCK_RATE);
    this.minute = Math.floor(this.clock);
    const liveTime = this.restartAt ?? this.time;
    this.opponentSeconds = this.oppositionSince === null ? 0 : liveTime - this.oppositionSince;
    if (this.opponentSeconds > 5 + 1e-7) {
      this.phase = 'break';
      this.notice = 'Strata posiadania';
      return null;
    }

    const player = this.human;
    if (humanPose) {
      player.px = player.x;
      player.pz = player.z;
      player.x = humanPose.x;
      player.z = humanPose.z;
      const vx = (player.x - player.px) / dt;
      const vz = (player.z - player.pz) / dt;
      if (Math.hypot(vx, vz) < 11) {player.vx = vx; player.vz = vz;}
      else {player.vx = 0; player.vz = 0;}
      if (Number.isFinite(humanPose.yaw)) player.yaw = humanPose.yaw;
    }

    if (this.receiveUntil < this.time) this.receiveId = null;
    this.tacticsIn -= dt;
    if (this.tacticsIn <= 0) {
      this.tacticsIn += PRESS_REFRESH;
      this.assignTactics(ball);
    }
    this.advancePlayers(dt, ball.position);
    return this.pickIntent(ball);
  }

  requestPass() {
    if (this.phase !== 'live' || this.controllerId === this.human.id) return;
    this.callForBallUntil = this.time + 2.5;
    for (const player of this.outfield[0]) player.intent = null;
  }

  touch(playerId, kind = 'control', targetId = null) {
    if (this.phase !== 'live') return null;
    const player = this.byId.get(playerId);
    if (!player) return null;
    this.lastTouchId = player.id;
    if (this.offsidePlayers.has(player.id) && !player.isKeeper) {
      this.offsidePlayers.clear();
      return this.setRestart(1 - player.team, player.x, player.z, 'offside');
    }
    if (kind === 'deflection') {
      if (this.controllerId !== playerId && this.controllerId !== null) {
        const previous = this.byId.get(this.controllerId);
        if (previous.team !== player.team) this.controllerId = null;
      }
      return null;
    }

    const exempt = playerId === this.restartPlayerId && this.restartKind !== 'offside';
    const previousTeam = this.possessionTeam;
    if (this.restartAt !== null && this.oppositionSince !== null) this.oppositionSince += this.time - this.restartAt;
    this.restartAt = null;
    this.restartPlayerId = null;
    this.restartKind = null;
    this.notice = '';
    this.possessionTeam = player.team;
    if (player.team === 0) {
      this.oppositionSince = null;
      this.opponentSeconds = 0;
    } else if (this.oppositionSince === null) {
      this.oppositionSince = this.time;
    }
    if (this.controllerId !== player.id) player.controlAt = this.time;
    this.controllerId = RELEASES.has(kind) ? null : player.id;
    player.kickAt = this.time;
    player.kickKind = kind;
    player.intent = null;
    if (BALL_ACTIONS.has(kind)) player.action = kind;
    this.receiveId = targetId && RELEASES.has(kind) ? targetId : null;
    this.receiveUntil = this.time + (kind === 'cross' ? 2.5 : 2.2);
    this.tacticsIn = 0;
    if (previousTeam !== player.team || !RELEASES.has(kind)) this.offsidePlayers.clear();
    if (player.isHuman) this.openingUntil = this.time;
    if (player.isHuman || targetId === this.human.id) this.callForBallUntil = -Infinity;
    if (RELEASES.has(kind)) this.setOffside(player, exempt);
    return null;
  }

  goal(team) {
    if (this.phase !== 'live' || (team !== 0 && team !== 1)) return;
    this.score[team]++;
    this.phase = 'break';
    this.notice = 'Gol';
  }

  out(ball) {
    if (this.phase !== 'live') return null;
    const {x, z} = ball.position;
    const lastTeam = this.byId.get(this.lastTouchId)?.team ?? 0;
    const side = x < 0 ? -1 : 1;
    const end = z < 0 ? -1 : 1;
    if (Math.abs(z) > HALF_LENGTH + BALL_RADIUS) {
      const defendingTeam = end < 0 ? 1 : 0;
      if (lastTeam === defendingTeam) {
        return this.setRestart(1 - defendingTeam, side * (HALF_WIDTH - .55), end * (HALF_LENGTH - .55), 'corner');
      }
      return this.setRestart(defendingTeam, side * 4, end * (HALF_LENGTH - 5.5), 'goalKick');
    }
    if (Math.abs(x) > HALF_WIDTH + BALL_RADIUS) {
      return this.setRestart(1 - lastTeam, side * (HALF_WIDTH - .20), clamp(z, -51.1, 51.1), 'throwIn');
    }
    return null;
  }

  setRestart(team, x, z, kind) {
    const options = this.outfield[team].filter(player => !player.isHuman);
    const position = {x, z};
    const taker = options.reduce((a, b) => distance(a, position) < distance(b, position) ? a : b);
    const dx = clamp(-x * .15, -2.3, 2.3);
    const dz = ATTACK[team] * 3;
    const length = Math.hypot(dx, dz);
    const throwIn = kind === 'throwIn';
    if (throwIn) {
      const side = Math.sign(x);
      setPose(taker, side * (HALF_WIDTH + .35), z, side * Math.PI / 2);
    } else setPose(taker, x - dx / length * .63, z - dz / length * .63, yawFor(dx, dz));
    taker.kickAt = -Infinity;
    taker.intent = null;
    taker.action = throwIn ? 'throw' : 'receive';
    this.restartPlayerId = taker.id;
    this.restartKind = kind;
    this.restartAt = this.time;
    this.receiveId = this.controllerId = null;
    this.openingUntil = this.time;
    this.offsidePlayers.clear();
    this.tacticsIn = 0;
    this.notice = {corner:'Rzut rożny', goalKick:'Rzut od bramki', throwIn:'Aut', offside:'Spalony'}[kind] || '';
    const restart = {x, y:throwIn ? 1.96 : BALL_RADIUS, z, vx:0, vy:0, vz:0, restartId:taker.id, kind};
    this.pendingRestart = restart;
    return restart;
  }

  takeRestart() {
    const restart = this.pendingRestart;
    this.pendingRestart = null;
    return restart;
  }

  setOffside(passer, exempt) {
    this.offsidePlayers.clear();
    if (exempt) return;
    const forward = ATTACK[passer.team];
    const line = this.offsideLine(passer.team, passer.z);
    for (const candidate of this.outfield[passer.team]) {
      if (candidate !== passer && candidate.z * forward > line + .35) this.offsidePlayers.add(candidate.id);
    }
  }

  offsideLine(team, ballZ) {
    const forward = ATTACK[team];
    let deepest = -HALF_LENGTH;
    let line = -HALF_LENGTH;
    for (const opponent of this.teams[1 - team]) {
      const depth = opponent.z * forward;
      if (depth >= deepest) {line = deepest; deepest = depth;}
      else if (depth > line) line = depth;
    }
    return Math.max(0, ballZ * forward, line);
  }

  basePosition(player, ball, attacking) {
    const direction = ATTACK[player.team];
    if (player.isKeeper) {
      const advance = clamp((52.5 + direction * ball.z) * .038, .7, 4.8);
      return {x:clamp(ball.x * .12, -4.2, 4.2), z:-direction * (HALF_LENGTH - advance)};
    }
    const {slot} = player;
    const progress = ball.z * direction;
    const shift = clamp(progress * .57, -23, 22) + (attacking ? 4.6 : -3.5);
    const width = (attacking ? 1.0 : .77) + Math.abs(ball.x) * .0028;
    const x = slot.x * -direction * width + ball.x * (attacking ? .16 : .26);
    const frontAdjust = slot.unit === 'front' ? clamp(progress * -.07, -3, 2) : 0;
    return {x:clamp(x, -31.5, 31.5), z:clamp(-direction * slot.z + direction * (shift + frontAdjust), -48, 48)};
  }

  assignTactics(ball) {
    const {position, velocity} = ball;
    const speed = Math.hypot(velocity.x, velocity.z);
    const owner = this.byId.get(this.controllerId);
    const delayed = this.time < this.openingUntil;
    const receiver = this.byId.get(this.receiveId);
    const restart = this.byId.get(this.restartPlayerId);
    let timeToGround = 0;
    if (position.y > .30 || velocity.y > 1) {
      timeToGround = clamp((velocity.y + Math.sqrt(velocity.y ** 2 + 2 * GRAVITY * Math.max(0, position.y - .2))) / GRAVITY, 0, 1.8);
    }
    const leadTime = Math.max(timeToGround, clamp(speed * .035, .12, .58));
    const predicted = {
      x:clamp(position.x + velocity.x * leadTime, -33, 33),
      z:clamp(position.z + velocity.z * leadTime, -51.6, 51.6)
    };
    if (restart) {predicted.x = position.x; predicted.z = position.z;}

    for (let team = 0; team < this.teams.length; team++) {
      const own = this.possessionTeam === team;
      const dir = ATTACK[team];
      const side = this.outfield[team].filter(player => !player.isHuman);
      const reserved = new Set();
      for (const player of this.teams[team]) {
        if (!player.isHuman) this.order(player, this.basePosition(player, position, own), player.isKeeper ? 'keeper' : 'shape');
      }
      const ranked = side.filter(player => !this.offsidePlayers.has(player.id))
        .sort((a, b) => this.timeToBall(a, predicted) - this.timeToBall(b, predicted));

      if (restart && restart.team === team) {
        if (this.restartKind === 'throwIn') restart.action = 'throw';
        else this.order(restart, position, 'receive');
        reserved.add(restart.id);
      } else if (owner && own && !owner.isHuman && !owner.isKeeper) {
        const ahead = dir * (position.z - owner.z);
        const target = distance(owner, position) > .67 || ahead < -.25 ? predicted : this.carryLane(owner, position, 5.2);
        this.order(owner, target, 'dribble');
        reserved.add(owner.id);
      } else if (own && receiver && receiver.team === team && !receiver.isHuman && !receiver.isKeeper) {
        const intercept = this.receivePoint(receiver, position, velocity, leadTime);
        this.order(receiver, intercept, 'receive');
        reserved.add(receiver.id);
      } else if (!restart && !delayed && (!own || !owner && !receiver)) {
        const presser = ranked[0];
        const incumbent = this.presser?.[team];
        const stable = incumbent && ranked.includes(incumbent) && this.timeToBall(incumbent, predicted) < this.timeToBall(presser, predicted) + .57;
        const first = stable ? incumbent : presser;
        if (first && distance(first, predicted) < (own ? 18 : 25)) {
          this.presser ??= [null, null];
          this.presser[team] = first;
          this.order(first, predicted, own || !owner ? 'recover' : 'press');
          reserved.add(first.id);
          if (!own) this.assignCover(ranked, first, predicted, dir, reserved);
        }
      }

      if (own) this.assignSupport(side, position, owner, team, reserved);
      else this.assignMarks(side, position, owner, team, reserved);
    }
  }

  order(player, target, action) {
    const requested = {x:target.x, z:target.z};
    if (this.time < this.openingUntil && !player.isKeeper && player.id !== this.openingPass.passerId) {
      this.clearOpeningLane(requested, player, 2.65);
    }
    player.tx = clamp(requested.x, -33.25, 33.25);
    player.tz = clamp(requested.z, -51.75, 51.75);
    player.action = action;
  }

  clearOpeningLane(target, startingPosition, halfWidth) {
    const pass = this.openingPass;
    const openingX = target.x - pass.x;
    const openingZ = target.z - pass.z;
    const projection = openingX * pass.dx + openingZ * pass.dz;
    if (projection < -2.0 || projection > pass.length + 1.1) return;
    const normalX = -pass.dz;
    const normalZ = pass.dx;
    const lateral = openingX * normalX + openingZ * normalZ;
    const startLateral = (startingPosition.x - pass.x) * normalX + (startingPosition.z - pass.z) * normalZ;
    const side = startLateral < 0 ? -1 : 1;
    if (lateral * side >= halfWidth) return;
    const push = side * halfWidth - lateral;
    target.x += normalX * push;
    target.z += normalZ * push;
  }

  timeToBall(player, point) {
    if (!player) return Infinity;
    const dx = point.x - player.x;
    const dz = point.z - player.z;
    const length = Math.hypot(dx, dz);
    const heading = (player.vx * dx + player.vz * dz) / Math.max(.5, length);
    return length / (6.6 + clamp(heading * .2, -.8, 1.3)) + (player.slot.unit === 'back' ? .09 : 0);
  }

  receivePoint(receiver, position, velocity, leadTime) {
    const denominator = velocity.x ** 2 + velocity.z ** 2;
    const travel = denominator > .09 ? ((receiver.x - position.x) * velocity.x + (receiver.z - position.z) * velocity.z) / denominator : 0;
    const t = Math.max(Math.min(1.15, leadTime), clamp(travel, 0, 1.5));
    return {x:position.x + velocity.x * t, z:position.z + velocity.z * t};
  }

  assignCover(ranked, presser, ball, direction, reserved) {
    const helper = ranked.find(player => player !== presser && distance(player, ball) < 11.8);
    if (!helper) return;
    const side = helper.x < ball.x ? -1 : 1;
    this.order(helper, {x:ball.x + side * 4.1, z:ball.z - direction * 4.8}, 'cover');
    reserved.add(helper.id);
  }

  assignMarks(side, ball, owner, team, reserved) {
    const direction = ATTACK[team];
    const threats = this.outfield[1 - team].filter(player => player !== owner &&
      (player.z - ball.z) * direction < 8 && distance(player, ball) < 34);
    threats.sort((a, b) => (a.z - b.z) * direction + (distance(a, ball) - distance(b, ball)) * .26);
    for (const threat of threats) {
      let marker = null;
      let cost = Infinity;
      for (const candidate of side) {
        if (reserved.has(candidate.id)) continue;
        const d = Math.hypot(candidate.tx - threat.x, candidate.tz - threat.z);
        const actual = distance(candidate, threat);
        const score = d * .92 + actual * .42 + (candidate.slot.unit === 'front' ? 3 : 0);
        if (d < 12.8 && actual < 18 && score < cost) {marker = candidate; cost = score;}
      }
      if (!marker) continue;
      const lean = clamp((ball.x - threat.x) * .18, -1.4, 1.4);
      this.order(marker, {x:threat.x + lean, z:threat.z - direction * 1.45}, 'mark');
      reserved.add(marker.id);
    }
  }

  assignSupport(side, position, owner, team, reserved) {
    const direction = ATTACK[team];
    const line = this.offsideLine(team, position.z);
    const base = owner || position;
    const available = side.filter(player => player !== owner && !reserved.has(player.id));
    for (const flank of [-1, 1]) {
      const supporter = available.filter(player =>
        !reserved.has(player.id) && (player.x - base.x) * flank > .65 && distance(player, base) < 22)
        .sort((a, b) => distance(a, base) - distance(b, base))[0];
      if (!supporter) continue;
      const tx = base.x + flank * (Math.abs(base.x) > 27 ? 7.4 : 9.3);
      const progress = (supporter.z - base.z) * direction;
      const offset = progress > 2 ? 5.8 : -4.2;
      const z = Math.min(line - .6, base.z * direction + offset) * direction;
      this.order(supporter, {x:tx, z}, 'support');
      reserved.add(supporter.id);
    }

    const runs = available.filter(player => !reserved.has(player.id) && player.role !== 'DM' &&
      (player.slot.unit === 'front' || player.role === 'LB' || player.role === 'RB' || player.slot.unit === 'middle') &&
      Math.abs(player.x - base.x) < 28 && (player.z - base.z) * direction > -12.4 && distance(player, base) < 30);
    runs.sort((a, b) => (a.slot.unit === 'front' ? -4 : 0) - (b.slot.unit === 'front' ? -4 : 0) + distance(a, base) - distance(b, base));
    const firstRun = runs[0];
    const secondRun = firstRun && runs.find(player => player !== firstRun && Math.abs(player.x - firstRun.x) > 9.7);
    for (const runner of [firstRun, secondRun]) {
      if (!runner) continue;
      const xOffset = runner.x < base.x ? -1 : 1;
      const tx = runner.role === 'ST' ? clamp(position.x * .3 + xOffset * 3.8, -13, 13) : runner.tx + xOffset * 3.5;
      const nearby = this.nearestOpponent(runner.team, runner);
      const breakSide = nearby && distance(nearby, runner) < 4.1 && nearby.x < runner.x ? 2.1 : -2.1;
      const depth = Math.min(line - 1.1, Math.max(runner.tz * direction, base.z * direction + 8.5));
      this.order(runner, {x:tx + breakSide, z:depth * direction}, 'run');
      reserved.add(runner.id);
    }
  }

  advancePlayers(dt, ball) {
    for (const player of this.players) {
      if (player.isHuman) continue;
      player.px = player.x;
      player.pz = player.z;
    }
    for (const player of this.players) {
      if (player.isHuman) continue;
      if (player.id === this.restartPlayerId && (this.restartKind === 'throwIn' || this.time - this.restartAt < RESTART_DELAY)) continue;
      let dx = player.tx - player.x;
      let dz = player.tz - player.z;
      const remaining = Math.hypot(dx, dz);
      const aggressive = ['press', 'recover', 'receive', 'run'].includes(player.action);
      const topSpeed = aggressive ? 6.9 : player.action === 'dribble' ? 5.15 : player.isKeeper ? 3.3 : 4.95;
      const desiredSpeed = Math.min(topSpeed, Math.sqrt(2 * 8.4 * remaining), remaining * 5);
      const scale = desiredSpeed / Math.max(.001, remaining);
      dx *= scale;
      dz *= scale;
      for (const other of this.players) {
        if (other === player) continue;
        const ax = player.px - other.px;
        const az = player.pz - other.pz;
        if (Math.abs(ax) > 1.05 || Math.abs(az) > 1.05) continue;
        const gap = Math.hypot(ax, az);
        const radius = other.team === player.team ? 1.08 : .66;
        if (gap >= radius) continue;
        const strength = (radius - gap) * 6;
        if (gap > .01) {dx += ax / gap * strength; dz += az / gap * strength;}
        else dx += (player.id < other.id ? -1 : 1) * strength;
      }
      const acceleration = aggressive ? 10.4 : 8.9;
      const changeX = dx - player.vx;
      const changeZ = dz - player.vz;
      const rate = Math.min(1, acceleration * dt / Math.max(.001, Math.hypot(changeX, changeZ)));
      player.vx += changeX * rate;
      player.vz += changeZ * rate;
      player.x = clamp(player.x + player.vx * dt, -33.55, 33.55);
      player.z = clamp(player.z + player.vz * dt, -51.95, 51.95);
      const pace = Math.hypot(player.vx, player.vz);
      const faceBall = pace < 1.35 || distance(player, ball) < 2.0 || player.isKeeper || player.action === 'mark';
      const lookX = faceBall ? ball.x - player.x : player.vx;
      const lookZ = faceBall ? ball.z - player.z : player.vz;
      player.yaw += clamp(angleDifference(yawFor(lookX, lookZ), player.yaw), -dt * 8.4, dt * 8.4);
    }
  }

  pickIntent(ball) {
    const {position, velocity} = ball;
    if (this.restartAt !== null && this.time - this.restartAt < RESTART_DELAY) return null;
    if (this.restartKind === 'throwIn') {
      const thrower = this.byId.get(this.restartPlayerId);
      return thrower ? this.chooseThrow(thrower, position) : null;
    }
    if (position.y > .39 || this.time < this.openingUntil) return null;
    let chosen = null;
    let best = .94;
    for (const player of this.players) {
      if (player.isHuman || player.isKeeper || this.time - player.kickAt < .21 ||
          (this.restartPlayerId && this.restartPlayerId !== player.id)) continue;
      const gap = distance(player, position);
      if (gap < best) {best = gap; chosen = player;}
    }
    if (!chosen) return null;
    if (chosen.intent && chosen.intentUntil > this.time && distance(chosen.intent, position) < .65) return chosen.intent.plan;
    const plan = this.chooseAction(chosen, position, velocity);
    chosen.intent = {plan, x:position.x, z:position.z};
    chosen.intentUntil = this.time + .16;
    return plan;
  }

  chooseThrow(player, ball) {
    const direction = ATTACK[player.team];
    const side = Math.sign(ball.x);
    const choices = this.passOptions(player, ball, true);
    const receiver = choices.find(option => option.length >= 7 && option.length <= 23 &&
      Math.abs(option.z - ball.z) < 18 && (ball.x - option.x) * side >= 4.5);
    const x = receiver ? receiver.x : side * (HALF_WIDTH - 10.3);
    const z = receiver ? receiver.z : clamp(ball.z + direction * 8.2, -49, 49);
    const range = Math.hypot(x - ball.x, z - ball.z);
    const speed = clamp(6.9 + range * .22, 8.2, 13.2);
    const flight = Math.max(.67, range / speed);
    const rise = clamp((BALL_RADIUS - ball.y + .5 * GRAVITY * flight ** 2) / flight, 2.0, 5.7);
    return aim(player, 'throw', ball, x, z, speed, rise, receiver?.player.id);
  }

  chooseAction(player, ball, velocity) {
    const direction = ATTACK[player.team];
    const speed = Math.hypot(velocity.x, velocity.z);
    const marker = this.nearestOpponent(player.team, ball);
    const pressure = marker ? distance(marker, ball) : 30;
    const escape = this.carryLane(player, ball, 6.4);
    const own = this.possessionTeam === player.team;
    const reuse = this.controllerId === player.id;
    const restart = this.restartPlayerId === player.id;
    const goalZ = direction * HALF_LENGTH;
    const goalDistance = Math.hypot(ball.x, goalZ - ball.z);
    const options = this.passOptions(player, ball);

    if (!reuse && !restart && speed > 16.8) {
      return aim(player, 'deflection', ball, escape.x, escape.z, Math.min(8.5, speed * .5), .35);
    }
    if (!reuse && !restart && !own) {
      return aim(player, 'tackle', ball, escape.x, escape.z, pressure < 1.5 ? 3.6 : 2.3, .07);
    }
    if (!reuse && !restart && speed > 7.0 && pressure > 1.5) {
      return aim(player, 'control', ball, escape.x, escape.z, 1.8, .03);
    }

    if (goalDistance < 24.5 && Math.abs(ball.x) < 14.8 && ball.z * direction > 27.5 &&
        this.shotOpening(player, ball, goalZ) > (goalDistance < 15 ? .3 : .68)) {
      const keeper = this.teams[1 - player.team][0];
      const side = keeper.x > .2 ? -1 : keeper.x < -.2 ? 1 : this.random() < .5 ? -1 : 1;
      const targetX = side * (GOAL_HALF_WIDTH - .43 - this.random() * .75);
      const pace = clamp(20.5 + goalDistance * .31 + this.random() * 2, 21, 30);
      const flight = Math.hypot(targetX - ball.x, goalZ - ball.z) / pace;
      const rise = clamp((.83 + this.random() * .63 - ball.y) / Math.max(.12, flight) + .5 * GRAVITY * flight, 1.4, 8.4);
      return aim(player, 'shot', ball, targetX, goalZ, pace, rise);
    }

    const crossTarget = Math.abs(ball.x) > 16 && ball.z * direction > 31 && (pressure < 6.2 || ball.z * direction > 41 || restart) &&
      this.passOptions(player, ball, true).find(option => Math.abs(option.x) < 14 && option.z * direction > 31 && option.length > 10 && option.length < 35);
    if (crossTarget) {
      const t = clamp(crossTarget.length / 16.2, .8, 1.9);
      return aim(player, 'cross', ball, crossTarget.x, crossTarget.z, crossTarget.length / t + .35, GRAVITY * t * .5 + .35, crossTarget.player.id);
    }

    const pass = options[0];
    const carrying = reuse && this.time - player.controlAt > .76;
    if (pass && (restart || pressure < 3.35 || pass.score > 5.75 || carrying && pass.score > 3.55)) {
      const pace = clamp(Math.sqrt(5.2 ** 2 + pass.length * 6.3), 6.0, 17.8);
      return aim(player, 'pass', ball, pass.x, pass.z, pace, 0, pass.player.id);
    }

    if (ball.z * direction < -32 && pressure < 2.1 && !pass) {
      return aim(player, 'clear', ball, ball.x * .35, ball.z + direction * 31, 20, 5.4);
    }
    if (restart) return aim(player, 'clear', ball, ball.x * .38, ball.z + direction * 19, 13, 2.2);
    const pace = Math.min(5.0, Math.max(2.4, Math.hypot(player.vx, player.vz) * .72 + 1.7));
    return aim(player, 'dribble', ball, escape.x, escape.z, pace, .05);
  }

  nearestOpponent(team, point) {
    let nearest = null;
    let best = Infinity;
    for (const opponent of this.teams[1 - team]) {
      const d = distance(opponent, point);
      if (d < best) {best = d; nearest = opponent;}
    }
    return nearest;
  }

  carryLane(player, ball, stride) {
    const direction = ATTACK[player.team];
    const goalDrag = ball.z * direction > 22 ? clamp(-ball.x * .12, -3, 3) : 0;
    let best = -Infinity;
    let destination = {x:ball.x, z:ball.z + direction * stride};
    for (const angle of [-1.12, -.65, -.30, 0, .30, .65, 1.12]) {
      const tx = ball.x + Math.sin(angle) * stride + goalDrag * .5;
      const tz = ball.z + Math.cos(angle) * stride * direction;
      if (Math.abs(tx) > HALF_WIDTH - 1.0 || Math.abs(tz) > HALF_LENGTH - 1.65) continue;
      const target = {x:tx, z:tz};
      const marker = this.nearestOpponent(player.team, target);
      const gap = marker ? distance(marker, target) : 16;
      const blocking = this.laneRoom(player.team, ball, target, 6);
      const score = gap * .44 + blocking * .62 + Math.cos(angle) * 2.85;
      if (score > best) {best = score; destination = target;}
    }
    if (best === -Infinity) return {x:ball.x * .78, z:ball.z - direction * 2.2};
    return destination;
  }

  passOptions(player, ball, lofted = false) {
    const direction = ATTACK[player.team];
    const line = this.offsideLine(player.team, ball.z);
    const list = [];
    for (const mate of this.teams[player.team]) {
      if (mate === player || (mate.isKeeper && ball.z * direction > -19)) continue;
      const x = clamp(mate.x + mate.vx * .50, -32, 32);
      const z = clamp(mate.z + mate.vz * .50, -50.8, 50.8);
      const target = {x, z};
      const length = distance(ball, target);
      if (length < 2.4 || length > 35.5 || mate.z * direction > line + .06 && !this.restartPlayerId) continue;
      const marker = this.nearestOpponent(player.team, target);
      const separation = marker ? distance(marker, target) : 15;
      const path = lofted ? clamp((separation - 1) * .4, -.7, 3.5) : this.laneRoom(player.team, ball, target, 12);
      const gain = (z - ball.z) * direction;
      if (!lofted && path < .2 && length > 6) continue;
      const backpass = mate.isKeeper ? -2.2 : 0;
      const userOpening = mate.isHuman && separation > 2.0 ? (this.callForBallUntil > this.time && path > .75 ? 4.35 : .85) : 0;
      const score = .42 * Math.min(separation, 9) + path * .83 + clamp(gain * .19, -3.9, 4.3) - length * .078 + backpass + userOpening;
      list.push({player:mate, x, z, length, score});
    }
    return list.sort((a, b) => b.score - a.score);
  }

  laneRoom(team, from, target, speed) {
    const dx = target.x - from.x;
    const dz = target.z - from.z;
    const length = Math.hypot(dx, dz);
    const denominator = Math.max(.01, length ** 2);
    let room = 5.5;
    for (const opponent of this.teams[1 - team]) {
      if (opponent.isKeeper) continue;
      const t = ((opponent.x - from.x) * dx + (opponent.z - from.z) * dz) / denominator;
      if (t <= .06 || t > 1.04) continue;
      const lateral = Math.hypot(opponent.x - from.x - dx * t, opponent.z - from.z - dz * t);
      room = Math.min(room, lateral - Math.min(2.85, t * length / speed * 2.7));
    }
    return room;
  }

  shotOpening(player, ball, goalZ) {
    const left = this.laneRoom(player.team, ball, {x:-2.8, z:goalZ}, 24);
    const right = this.laneRoom(player.team, ball, {x:2.8, z:goalZ}, 24);
    return Math.max(left, right);
  }
}

globalThis.FirstTouchTactics = {MATCH_POSITIONS,MatchEngine};
})();
