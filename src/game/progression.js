import {availableTrees} from './abilities.js';

const PROGRESSION_KEY='first-touch.progression.v1';
const validScore=value=>Number.isSafeInteger(value)&&value>=0;

class FootballProgression {
  constructor(storage) {
    try {this.storage=storage===undefined?globalThis.localStorage:storage;} catch {this.storage=null;}
    this.highScore=0;
    this.seen=new Set();
    this.merge(this.read());
  }

  read() {
    try {return JSON.parse(this.storage?.getItem(PROGRESSION_KEY)||'null');} catch {return null;}
  }
  merge(record) {
    if(!validScore(record?.highScore))return false;
    const before=this.highScore,count=this.seen.size;
    this.highScore=Math.max(before,record.highScore);
    if(Array.isArray(record.seen)){
      for(const tree of availableTrees(record.highScore)){
        if(tree.unlockAt&&record.seen.includes(tree.id))this.seen.add(tree.id);
      }
    }
    return before!==this.highScore||count!==this.seen.size;
  }
  persist() {
    try {
      this.storage?.setItem(PROGRESSION_KEY,JSON.stringify({highScore:this.highScore,seen:[...this.seen].sort()}));
    } catch {}
  }
  // Another tab may have written between our last read and write. Retain the
  // larger best and the union of sightings, whichever storage event arrives first.
  refresh() {
    const record=this.read(),changed=this.merge(record);
    if(validScore(record?.highScore)&&(this.highScore>record.highScore||
      [...this.seen].some(id=>!Array.isArray(record.seen)||!record.seen.includes(id))))this.persist();
    return changed;
  }
  get trees(){return availableTrees(this.highScore);}
  get unseenIds(){return this.trees.filter(t=>t.unlockAt&&!this.seen.has(t.id)).map(t=>t.id);}

  recordScore(score) {
    this.refresh();
    if(!validScore(score)||score<=this.highScore)return [];
    const previous=this.highScore;
    this.highScore=score;
    this.persist();
    return this.trees.filter(tree=>tree.unlockAt>previous);
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
