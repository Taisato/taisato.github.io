import {THREE_TOUCH_ABILITIES,availableTrees,availableRares} from './abilities.js';

const PROGRESSION_KEY='first-touch.progression.v1';
const validScore=value=>Number.isSafeInteger(value)&&value>=0;
const LAST_UNLOCK=Math.max(...THREE_TOUCH_ABILITIES.map(ability=>ability.unlockAt));
const milestones=THREE_TOUCH_ABILITIES.filter(ability=>ability.unlockAt).sort((a,b)=>a.unlockAt-b.unlockAt);

class FootballProgression {
  constructor(storage) {
    try {this.storage=storage===undefined?globalThis.localStorage:storage;} catch {this.storage=null;}
    this.highScore=0;this.epoch=0;this.allUnlocked=false;
    this.seen=new Set();
    this.merge(this.read());
  }

  read() {
    try {return JSON.parse(this.storage?.getItem(PROGRESSION_KEY)||'null');} catch {return null;}
  }
  merge(record) {
    if(!validScore(record?.highScore))return false;
    const epoch=validScore(record.epoch)?record.epoch:0;
    if(epoch<this.epoch)return false;
    const reset=epoch>this.epoch;
    if(reset){this.epoch=epoch;this.highScore=0;this.allUnlocked=false;this.seen.clear();}
    const before=this.highScore,count=this.seen.size,all=this.allUnlocked;
    this.highScore=Math.max(before,record.highScore);
    this.allUnlocked ||= record.allUnlocked===true;
    if(Array.isArray(record.seen)){
      for(const ability of milestones){
        if((record.allUnlocked===true||ability.unlockAt<=record.highScore)&&record.seen.includes(ability.id))this.seen.add(ability.id);
      }
    }
    return reset||all!==this.allUnlocked||before!==this.highScore||count!==this.seen.size;
  }
  persist() {
    try {
      const record={highScore:this.highScore,seen:[...this.seen].sort()};
      if(this.epoch)record.epoch=this.epoch;
      if(this.allUnlocked)record.allUnlocked=true;
      this.storage?.setItem(PROGRESSION_KEY,JSON.stringify(record));
    } catch {}
  }
  // Retain independent progress across tabs within a reset generation. A reset
  // supersedes every score and sighting from the previous generation.
  refresh() {
    const record=this.read(),changed=this.merge(record);
    if(validScore(record?.highScore)&&(this.epoch>(record.epoch||0)||this.highScore>record.highScore||
      (this.allUnlocked&&record.allUnlocked!==true)||
      [...this.seen].some(id=>!Array.isArray(record.seen)||!record.seen.includes(id))))this.persist();
    return changed;
  }
  get unlockScore(){return this.allUnlocked?Math.max(this.highScore,LAST_UNLOCK):this.highScore;}
  get trees(){return availableTrees(this.unlockScore);}
  get rares(){return availableRares(this.unlockScore);}
  get unseenIds(){return milestones.filter(a=>a.unlockAt<=this.unlockScore&&!this.seen.has(a.id)).map(a=>a.id);}

  recordScore(score) {
    const epoch=this.epoch;
    this.refresh();
    if(epoch!==this.epoch||!validScore(score)||score<=this.highScore)return [];
    const previous=this.unlockScore;
    this.highScore=score;
    this.persist();
    return milestones.filter(a=>a.unlockAt>previous&&a.unlockAt<=this.unlockScore);
  }
  unlockAll() {
    this.refresh();
    if(this.allUnlocked)return;
    this.allUnlocked=true;
    this.persist();
  }
  reset() {
    this.refresh();
    this.epoch++;
    this.highScore=0;this.allUnlocked=false;this.seen.clear();
    this.persist();
  }
  markSeen(ids) {
    const changed=this.refresh(),before=this.seen.size;
    for(const id of this.unseenIds)if(ids.includes(id))this.seen.add(id);
    if(this.seen.size===before)return changed;
    this.persist();
    return true;
  }
}

export {FootballProgression,PROGRESSION_KEY};
