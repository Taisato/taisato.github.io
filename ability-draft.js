import { THREE_TOUCH_RARES, THREE_TOUCH_TREES } from './abilities.js';

const SLOT_COUNT = 3;
const RARE_CHANCE = .20;

function emptyAbilitySlots() {
  return Array(SLOT_COUNT).fill(null);
}

function abilityReelPool(slots) {
  if (!slots.includes(null)) return [];
  return [...unownedTrees(slots).map(tree => tree.phases[0]), ...THREE_TOUCH_RARES];
}

function unownedTrees(slots) {
  const owned = new Set(slots.filter(Boolean).map(slot => slot.treeId));
  return THREE_TOUCH_TREES.filter(tree => !owned.has(tree.id));
}

function draftAbilityChoices(slots, random) {
  const openSlots = slots.flatMap((slot, index) => slot === null ? [index] : []);
  const available = unownedTrees(slots);
  const rareSlot = openSlots.length && random() < RARE_CHANCE
    ? openSlots[Math.floor(random() * openSlots.length)] : -1;
  return Object.freeze(slots.map((owned, slot) => {
    if (owned !== null) {
      const tree = THREE_TOUCH_TREES.find(entry => entry.id === owned.treeId);
      const next = tree.phases[owned.phase];
      return Object.freeze(next ? {...next, slot, pinned: true, reel: false}
        : {id: null, name: 'Complete', description: '', closed: true, masteredName: tree.name, slot, reel: false});
    }
    if (slot === rareSlot) {
      return Object.freeze({...THREE_TOUCH_RARES[Math.floor(random() * THREE_TOUCH_RARES.length)], slot, reel: true});
    }
    const [tree] = available.splice(Math.floor(random() * available.length), 1);
    return Object.freeze({...tree.phases[0], slot, reel: true});
  }));
}

export { abilityReelPool, draftAbilityChoices, emptyAbilitySlots };
