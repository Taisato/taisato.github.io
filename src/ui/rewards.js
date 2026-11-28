import { FT } from '../../vendor/three.js';
import { footballClamp } from '../config.js';
import { createOpticalMaterial } from '../render/optics.js';
import { UI, label, panel, shape, tracked } from './theme.js';

const WIDTH = 1080, HEIGHT = 430, PLANE_WIDTH = 1.76, PLANE_HEIGHT = PLANE_WIDTH * HEIGHT / WIDTH;
const HOLD_SECONDS = .78;
const RARE_GOLD = '#efc877';
const CARDS = Array.from({length: 3}, (_, i) => ({x: 38 + i * 340, y: 152, w: 324, h: 200}));
const REROLL = {x: 778, y: 365, w: 264, h: 52};
const REROLL_INDEX = CARDS.length;

function cardTitle(choice) {
  return choice.masteredName ?? choice.treeName ?? choice.name;
}

function cardAccent(choice, state) {
  if (state.next) return '';
  if (choice.rare) return 'rare';
  return choice.pinned ? 'pinned' : '';
}

function makeReel(catalog, selected, lane) {
  if (!selected.reel || !catalog.length) return {entries:[selected], ends:[], end:0};
  const deck = [...catalog], steps = deck.length + 3 + lane * 2;
  const entries = [], ends = [];
  for (let i = deck.length - 1; i > 0; i--) {
    const pick = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[pick]] = [deck[pick], deck[i]];
  }
  // Keep the reel cadence brisk as the ability pool grows. Every entry still appears.
  const pace = Math.min(1, (12 + lane * 2) / steps);
  let end = 0;
  for (let i = 0; i < steps; i++) {
    entries.push(deck[i % deck.length]);
    end += (.067 + i * .005 * pace) * pace + Math.max(0, i - steps + 4) * .032;
    ends.push(end);
  }
  if (entries.at(-1).id === selected.id) [entries[steps - 2], entries[steps - 1]] = [entries[steps - 1], entries[steps - 2]];
  entries.push(selected);
  return {entries, ends, end};
}

function reelAt(reel, elapsed) {
  const index = reel.ends.findIndex(end => elapsed < end);
  if (index < 0) return {entry: reel.entries.at(-1), next: null, progress: 0};
  const start = reel.ends[index - 1] || 0;
  return {entry: reel.entries[index], next: reel.entries[index + 1], progress: (elapsed - start) / (reel.ends[index] - start)};
}

function linesFor(context, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > width) {lines.push(line); line = word;}
    else line = next;
  }
  lines.push(line);
  return lines;
}

class FootballRewardPicker {
  constructor(scene, onChoose, onReroll) {
    this.onChoose = onChoose;
    this.onReroll = onReroll;
    this.rerollsLeft = 0;
    this.active = false;
    this.visible = false;
    this.ready = false;
    this.controls = null;
    this.desktop = false;
    this.elapsed = this.heldFor = 0;
    this.commitAt = Infinity;
    this.hold = null;
    this.hover = -1;
    this.paintKey = '';
    this.triggerReady = new Set();
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH; this.canvas.height = HEIGHT;
    this.context = this.canvas.getContext('2d');
    this.texture = new FT.CanvasTexture(this.canvas);
    this.texture.colorSpace = FT.SRGBColorSpace; this.texture.generateMipmaps = false; this.texture.minFilter = FT.LinearFilter;
    this.root = new FT.Mesh(new FT.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT), createOpticalMaterial(this.texture, {strength: .35}));
    this.root.name = '3 Touch abilities'; this.root.visible = false; this.root.frustumCulled = false; this.root.renderOrder = 90;
    this.reticle = new FT.Mesh(new FT.SphereGeometry(.008, 10, 6), new FT.MeshBasicMaterial({color: UI.mint, transparent: true, depthTest: false, depthWrite: false, toneMapped: false}));
    this.reticle.visible = false; this.reticle.renderOrder = 211;
    scene.add(this.root, this.reticle);
    this.localRay = new FT.Vector3(); this.localDirection = new FT.Vector3();
    this.hitPoint = new FT.Vector3(); this.inverse = new FT.Quaternion();
    this.abort = new AbortController();
    this.overlay = document.querySelector('#desktop-rewards');
    this.hint = document.querySelector('#reward-hint');
    this.scoreLabel = document.querySelector('#reward-score');
    this.rerollButton = this.overlay.querySelector('#reward-reroll');
    this.rerollLabel = this.rerollButton.querySelector('span');
    this.desktopCards = this.buildDesktopCards();
    this.bindDesktop();
  }

  buildDesktopCards() {
    const group = this.overlay.querySelector('.reward-cards');
    const template = document.querySelector('#reward-card-template');
    return CARDS.map((_, index) => {
      const card = template.content.firstElementChild.cloneNode(true);
      const get = name => card.querySelector('.reward-' + name);
      get('key').textContent = index + 1;
      const status = document.createElement('span');
      status.className = 'reward-stage';
      get('info').prepend(status);
      group.append(card);
      return {card, status, reel: get('reel'), current: get('current'), next: get('next'),
        info: get('info'), name: get('name'), description: get('description')};
    });
  }

  bindDesktop() {
    const on = (element, type, fn) => element.addEventListener(type, fn, {signal: this.abort.signal});
    on(this.rerollButton, 'click', () => this.requestReroll());
    this.desktopCards.forEach(({card}, index) => {
      on(card, 'pointerdown', event => {
        if (event.button !== 0 || !this.visible || !this.ready) return;
        event.preventDefault();
        card.focus({preventScroll: true});
        this.beginHold(index, 'pointer', event.pointerId);
      });
      on(card, 'pointerleave', event => this.endHold('pointer', event.pointerId));
    });
    for (const type of ['pointerup', 'pointercancel']) on(window, type, event => this.endHold('pointer', event.pointerId));
    on(window, 'pointermove', event => {
      const hold = this.hold;
      if (hold?.type !== 'pointer' || hold.id !== event.pointerId || this.commitAt < Infinity) return;
      const box = this.desktopCards[hold.index].card.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)
        this.endHold('pointer', event.pointerId);
    });
    on(window, 'keydown', event => {
      if (!this.visible || !this.desktop) return;
      if (this.rerollsLeft && !event.ctrlKey && !event.altKey && !event.metaKey &&
          (event.code === 'KeyR' || (event.target === this.rerollButton &&
          (event.code === 'Space' || event.code === 'Enter')))) {
        event.preventDefault();
        if (!event.repeat) this.requestReroll();
        return;
      }
      const digit = /^(?:Digit|Numpad)([1-3])$/.exec(event.code);
      const index = digit ? Number(digit[1]) - 1 : (event.code === 'Space' || event.code === 'Enter')
        ? this.desktopCards.findIndex(({card}) => card === event.target) : -1;
      if (index < 0) return;
      event.preventDefault();
      if (!event.repeat) this.beginHold(index, 'key', event.code);
    });
    on(window, 'keyup', event => this.endHold('key', event.code));
    on(window, 'blur', () => this.resetHold());
  }

  show(choices, catalog, controls, score, rerollsLeft = 0) {
    this.hide();
    this.score = score;
    this.scoreLabel.textContent = `${score} GOALS`;
    this.setRoll(choices, catalog, rerollsLeft);
    this.active = true;
    this.present(controls);
  }

  setRoll(choices, catalog, rerollsLeft) {
    this.commitAt = Infinity;
    this.resetHold();
    this.choices = choices;
    this.rerollsLeft = rerollsLeft;
    this.rerollButton.hidden = !rerollsLeft;
    this.rerollLabel.textContent = rerollsLeft ? `Reroll · ${rerollsLeft} left` : '';
    this.desktopCards.forEach(({card}, index) => {
      if (choices[index].pinned) card.setAttribute('aria-description', 'This slot continues your selected tree.');
      else card.removeAttribute('aria-description');
    });
    this.reels = choices.map((choice, lane) => makeReel(catalog, choice, lane));
    this.rollDuration = Math.max(...this.reels.map(reel => reel.end));
    this.elapsed = 0;
    this.ready = this.rollDuration === 0;
    this.paintKey = '';
  }

  requestReroll(hand = null) {
    if (!this.visible || !this.ready || !this.rerollsLeft || this.hold || !this.onReroll) return false;
    this.onReroll(hand);
    return true;
  }

  reroll(choices, catalog, rerollsLeft) {
    this.setRoll(choices, catalog, rerollsLeft);
    if (this.desktop) this.overlay.focus({preventScroll: true});
    this.paint();
  }

  present(controls) {
    this.controls = controls;
    this.desktop = controls.desktop;
    this.visible = true;
    this.root.visible = !this.desktop;
    this.overlay.hidden = !this.desktop;
    if (this.desktop) this.overlay.focus({preventScroll: true});
    else {
      controls.refreshHead();
      this.root.position.copy(controls.headWorld).addScaledVector(controls.forward, 1.78);
      this.root.position.y = controls.headWorld.y - .04;
      this.root.rotation.set(0, Math.atan2(-controls.forward.x, -controls.forward.z), 0);
      this.root.updateMatrixWorld(true);
      this.inverse.copy(this.root.quaternion).invert();
    }
    this.paintKey = '';
    this.paint();
  }

  resetHold() {
    this.triggerReady.clear(); this.hover = -1;
    if (this.commitAt === Infinity) {this.hold = null; this.heldFor = 0;}
  }

  suspend() {
    if (!this.visible) return;
    this.visible = this.root.visible = this.reticle.visible = false;
    this.overlay.hidden = true;
    for (const hand of this.controls?.hands || []) if (hand.ray) hand.ray.visible = false;
    this.resetHold();
  }

  hide() {
    this.active = false;
    this.commitAt = Infinity;
    this.suspend();
    this.resetHold();
    this.ready = false;
  }

  beginHold(index, type, id) {
    if (!this.visible || !this.ready || this.hold || this.commitAt < Infinity || !this.choices[index]?.id) return;
    this.hold = {index, type, id};
  }

  endHold(type, id) {
    if (this.commitAt < Infinity || this.hold?.type !== type || this.hold.id !== id) return;
    this.hold = null; this.heldFor = 0;
  }

  hitCard(hand) {
    this.localRay.copy(hand.rayPosition).sub(this.root.position).applyQuaternion(this.inverse);
    this.localDirection.copy(hand.rayDirection).applyQuaternion(this.inverse);
    if (this.localDirection.z >= -.0001) return -1;
    const distance = -this.localRay.z / this.localDirection.z;
    if (!(distance >= 0 && distance < 8)) return -1;
    const x = ((this.localRay.x + this.localDirection.x * distance) / PLANE_WIDTH + .5) * WIDTH;
    const y = (.5 - (this.localRay.y + this.localDirection.y * distance) / PLANE_HEIGHT) * HEIGHT;
    if (x < 0 || y < 0 || x > WIDTH || y > HEIGHT) return -1;
    this.hitPoint.copy(hand.rayDirection).multiplyScalar(distance).add(hand.rayPosition);
    this.controls.showRay(hand, this.hitPoint);
    if (this.rerollsLeft && x >= REROLL.x && x <= REROLL.x + REROLL.w &&
        y >= REROLL.y && y <= REROLL.y + REROLL.h) return REROLL_INDEX;
    return CARDS.findIndex((card,index) => !this.choices[index].closed &&
      x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h);
  }

  point(controls) {
    this.reticle.visible = false;
    this.hover = -1;
    for (const hand of controls.hands) {
      const name = hand.name;
      if (!hand.rayTracked) {
        this.triggerReady.delete(name);
        this.endHold('trigger', name);
        continue;
      }
      const index = this.hitCard(hand);
      const holding = this.hold?.type === 'trigger' && this.hold.id === name;
      if (holding && (!hand.trigger || index !== this.hold.index)) this.endHold('trigger', name);
      if (hand.trigger) {
        const fresh = this.triggerReady.delete(name);
        if (fresh && index === REROLL_INDEX) {
          if (this.requestReroll(name)) return;
        } else if (fresh && index >= 0) this.beginHold(index, 'trigger', name);
      } else this.triggerReady.add(name);
      if (index >= 0 && (this.hover < 0 || this.hold?.id === name)) {
        this.hover = index;
        this.reticle.position.copy(this.hitPoint);
        this.reticle.visible = true;
      }
    }
  }

  update(dt, controls, interactive = true) {
    if (!this.active) return;
    if (!interactive) {this.suspend(); return;}
    if (!this.visible || controls.desktop !== this.desktop) this.present(controls);
    this.elapsed += dt;
    this.ready = this.elapsed >= this.rollDuration;
    if (!this.desktop) this.point(controls);
    if (this.hold && this.commitAt === Infinity) {
      this.heldFor = Math.min(HOLD_SECONDS, this.heldFor + dt);
      if (this.heldFor >= HOLD_SECONDS) this.commitAt = this.elapsed + .10;
    }
    this.paint();
    if (this.elapsed >= this.commitAt) {
      const {index, type, id} = this.hold;
      const choice = this.choices[index].id;
      this.hide();
      this.onChoose(choice, type === 'trigger' ? id : null);
    }
  }

  paint() {
    const progress = this.heldFor / HOLD_SECONDS;
    const frame = this.ready ? '-' : Math.floor(this.elapsed * (this.desktop ? 60 : 36));
    const key = `${frame}|${this.hover}|${this.hold?.index ?? '-'}|${Math.round(progress * 60)}`;
    if (key === this.paintKey) return;
    this.paintKey = key;
    const states = this.reels.map(reel => reelAt(reel, this.elapsed));
    if (this.desktop) this.paintDesktop(states, progress);
    else this.paintWorld(states, progress);
  }

  paintDesktop(states, progress) {
    this.rerollButton.disabled = !this.rerollsLeft || !this.ready || !!this.hold;
    const hint = this.ready ? 'Hold an available card or its number key.' : 'Rolling abilities…';
    if (this.hint.textContent !== hint) this.hint.textContent = hint;
    this.desktopCards.forEach(({card, status, reel, current, next, info, name, description}, index) => {
      const state = states[index];
      const choice = this.choices[index];
      const accent = cardAccent(choice, state);
      if (card.dataset.accent !== accent) card.dataset.accent = accent;
      card.disabled = !this.ready || choice.closed === true;
      card.dataset.closed = String(Boolean(choice.closed));
      card.style.setProperty('--held', this.hold?.index === index ? progress : 0);
      reel.hidden = !state.next; info.hidden = !!state.next;
      if (state.next) {
        current.textContent = cardTitle(state.entry); next.textContent = cardTitle(state.next);
        reel.style.setProperty('--reel', state.progress);
      } else {
        const title = cardTitle(choice);
        const detail = choice.closed ? '' : choice.description;
        const stage = this.stageLabel(choice);
        if (status.textContent !== stage) status.textContent = stage;
        if (name.textContent !== title) name.textContent = title;
        if (description.textContent !== detail) description.textContent = detail;
      }
    });
  }

  stageLabel(choice) {
    if (choice.closed) return 'Complete';
    if (choice.rare) return 'Rare · Slot stays open';
    const numeral = ['I','II','III'][choice.phase - 1];
    return 'Phase ' + numeral;
  }

  paintWorld(states, progress) {
    const c = this.context;
    panel(c, WIDTH, HEIGHT);
    tracked(c, '3 TOUCH', 38, 44, 18, UI.mint, 3);
    label(c, `${this.score} GOALS`, WIDTH - 38, 44, 21, UI.lilac, 'right', 750);
    label(c, 'Choose an ability', 38, 102, 46, UI.white, 'left', 850);
    states.forEach((state, i) => {
      const {x, y, w, h} = CARDS[i], cx = x + w / 2;
      const choice = this.choices[i];
      const accent = cardAccent(choice, state);
      const hot = !choice.closed && this.ready && this.hover === i;
      shape(c, x, y, w, h, 14); c.fillStyle = hot ? '#182e38' : UI.panel; c.fill();
      c.save(); c.clip();
      if (this.hold?.index === i) {
        c.fillStyle = '#26564d'; c.fillRect(x, y, w * progress, h);
        c.fillStyle = UI.mint; c.fillRect(x, y + h - 4, w * progress, 4);
      }
      if (state.next) {
        c.beginPath(); c.rect(x + 11, y + 62, w - 22, 76); c.clip();
        label(c, cardTitle(state.entry), cx, y + 100 - 66 * state.progress, 24, UI.white, 'center', 780);
        label(c, cardTitle(state.next), cx, y + 166 - 66 * state.progress, 24, UI.lilac, 'center', 780);
      } else {
        label(c, this.stageLabel(choice), cx, y + 26, 18, choice.rare ? RARE_GOLD : UI.mint, 'center', 700);
        label(c, cardTitle(choice), cx, y + 65, 24, choice.closed ? UI.muted : UI.white, 'center', 800);
        c.font = '500 21px Arial, "Liberation Sans", sans-serif';
        const lines = linesFor(c, choice.description, w - 30);
        lines.forEach((line, row) => label(c, line, cx, y + 105 + row * 23, 21, UI.muted, 'center', 500));
      }
      c.restore();
      shape(c, x, y, w, h, 14);
      c.save();
      if (accent === 'rare') {
        c.strokeStyle = RARE_GOLD;
        c.shadowColor = 'rgba(239,200,119,.48)';
        c.shadowBlur = 8;
      } else {
        c.strokeStyle = accent === 'pinned' ? UI.lilac : hot ? UI.mint : state.next ? UI.line : '#566483';
      }
      c.lineWidth = hot ? 3.5 : accent ? 3 : 1.5;
      c.stroke(); c.restore();
    });
    label(c, this.ready ? 'Point at an ability and hold the trigger.' : 'Rolling abilities…', 38, 391, 21, UI.muted, 'left', 550);
    if (this.rerollsLeft) {
      const {x,y,w,h} = REROLL;
      const enabled = this.ready && !this.hold, hot = enabled && this.hover === REROLL_INDEX;
      shape(c,x,y,w,h,10);
      c.fillStyle = hot ? '#182e38' : UI.panel; c.fill();
      c.strokeStyle = hot ? UI.mint : UI.line; c.lineWidth = hot ? 2.5 : 1.5; c.stroke();
      label(c,`Reroll · ${this.rerollsLeft} left`,x+w/2,y+h/2,23,enabled ? UI.white : UI.muted,'center',700);
    }
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.hide(); this.abort.abort(); this.texture.dispose();
    for (const mesh of [this.root, this.reticle]) {mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose();}
    for (const {card} of this.desktopCards) card.remove();
  }
}

export { FootballRewardPicker };
