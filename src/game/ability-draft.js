import { THREE_TOUCH_TREES, availableRares, availableTrees } from './abilities.js';

const SLOT_COUNT = 3;
const RARE_CHANCE = .20;

function emptyAbilitySlots() {
  return Array(SLOT_COUNT).fill(null);
}

function abilityReelPool(slots, highScore=0, effects={}) {
  if (!slots.includes(null)) return [];
  return [...unownedTrees(slots,highScore).map(tree => tree.phases[0]), ...draftRares(highScore,effects)];
}

function unownedTrees(slots, highScore) {
  const owned = new Set(slots.filter(Boolean).map(slot => slot.treeId));
  return availableTrees(highScore).filter(tree => !owned.has(tree.id));
}

function draftRares(highScore,effects) {
  return availableRares(highScore).filter(rare=>
    !(rare.effects.doubleGoals&&effects.doubleGoals) && !(rare.effects.extraReroll&&effects.extraReroll));
}

function draftAbilityChoices(slots, random, highScore=0, effects={}, previous=[]) {
  const openSlots = slots.flatMap((slot, index) => slot === null ? [index] : []);
  // Even the starter catalog has ten trees and three rares. It always has
  // enough alternatives to replace every unpinned card without repeating one.
  const replace=new Set(previous.filter(choice=>choice.reel).map(choice=>choice.id));
  const available = unownedTrees(slots,highScore).filter(tree=>!replace.has(tree.id));
  const rares = draftRares(highScore,effects).filter(rare=>!replace.has(rare.id));
  const rareSlot = openSlots.length && random() < RARE_CHANCE
    ? openSlots[Math.floor(random() * openSlots.length)] : -1;
  return Object.freeze(slots.map((owned, slot) => {
    if (owned !== null) {
      if(previous[slot])return previous[slot];
      const tree = THREE_TOUCH_TREES.find(entry => entry.id === owned.treeId);
      const next = tree.phases[owned.phase];
      return Object.freeze(next ? {...next, slot, pinned: true, reel: false}
        : {id: null, name: 'Complete', description: '', closed: true, masteredName: tree.name, slot, reel: false});
    }
    if (slot === rareSlot) {
      return Object.freeze({...rares[Math.floor(random() * rares.length)], slot, reel: true});
    }
    const [tree] = available.splice(Math.floor(random() * available.length), 1);
    return Object.freeze({...tree.phases[0], slot, reel: true});
  }));
}

export { abilityReelPool, draftAbilityChoices, emptyAbilitySlots };
