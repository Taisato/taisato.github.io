const PHASE_LABELS = ['I', 'II', 'III'];

const THREE_TOUCH_TREES = Object.freeze([
  ['first-time-finish', 'First-Time Finish', [
    ['Score with a genuine strike on first contact to add one goal.', {firstTimeFinish: 1}],
    ['Your opening strike gains 10% forward pace.', {openingStrikePace: .10}],
    ['Keep the bonus with an immediate airborne finish after a keeper parry.', {firstTimeParry: 1}]
  ]],
  ['double-from-distance', 'Double From Distance', [
    ['Score from outside the penalty area to add one goal.', {doubleFromDistance: 1}],
    ['Shots from outside the penalty area gain 10% forward pace.', {outsideShotPace: .10}],
    ['Score from 23 m or farther to bank a retry for an outside shot that goes straight out.', {distanceProtection: 1}]
  ]],
  ['bend-it', 'Bend It', [
    ['Add 10% sideways curve to spinning shots.', {curve: .10}],
    ['Increase the curve bonus to 20%.', {curve: .10}],
    ['Low curlers retain their sidespin on the first bounce.', {lowCurveBounce: 1}]
  ]],
  ['grass-cutter', 'Grass Cutter', [
    ['Firm ground shots have up to 40% less rolling resistance.', {grassCutter: 1}],
    ['Increase the rolling resistance reduction to 55%.', {grassCutter: 1}],
    ['Drive a knee-high ball downward to activate the bonus on landing.', {grassAirLanding: 1}]
  ]],
  ['volley-boost', 'Volley Boost', [
    ['Airborne strikes gain 25% shot strength.', {airShotStrength: .25}],
    ['Keep the volley bonus for 0.25 s after a bounce.', {volleyBounceGrace: .25}],
    ['Downward volleys retain more forward pace.', {volleyDriven: 1}]
  ]],
  ['woodwork-credit', 'Woodwork Credit', [
    ['The first post or bar hit each chance refunds one touch.', {woodworkCredit: 1}],
    ['A shot out directly off the frame costs a life but carries one touch to the next chance.', {woodworkCarry: 1}],
    ['Score off a post or the crossbar to add one goal.', {woodworkGoal: 1}]
  ]],
  ['quick-feet', 'Quick Feet', [
    ['Move 10% faster.', {playerSpeed: .10}],
    ['Move 25% faster for 2 s after a frame hit or keeper parry.', {recoverySpeedBonus: .15}],
    ['Your first recovery touch is free once per chance.', {freeRecoveryTouch: 1}]
  ]],
  ['touch-window', 'Touch Window', [
    ['Add 0.5 s to the gap needed to count a new touch.', {touchCooldown: .5}],
    ['Gentle control uses a 1.25 s touch window.', {gentleTouchCooldown: .25}],
    ['Once per chance, a soft trap that would use your last touch is free.', {freeLastTrap: 1}]
  ]],
  ['long-range-bonus', 'Long-Range Bonus', [
    ['A goal from outside the box adds one touch to your next chance.', {longRangeBonus: 1}],
    ['Keep that extra touch in reserve until you spend it.', {longRangeBank: 1}],
    ['Bank up to two extra touches and spend both in one chance.', {longRangeBank: 1}]
  ]],
  ['keeper-setback', 'Keeper Setback', [
    ['Lower the keeper difficulty by five goal levels.', {keeperLevelOffset: 5}],
    ['The keeper takes 0.12 s longer to reverse after committing.', {keeperReverseDelay: .12}],
    ['Once per chance, a wrong-footed keeper parries a ball they would have caught.', {keeperWrongFootParry: 1}]
  ]],
  ['last-chance', 'Last Chance', [
    ['Once per run, a miss on your last life gives a same-spot retry.', {lastChance: 1}],
    ['Start a chance or retry on your last life with one extra touch.', {lastLifeTouch: 1}],
    ['Your run can use two retries in total.', {lastChance: 1}]
  ]]
].map(([treeId, name, phases]) => Object.freeze({
  id: treeId,
  name,
  phases: Object.freeze(phases.map(([description, effects], index) => Object.freeze({
    id: index === 0 ? treeId : `${treeId}-${index + 1}`,
    treeId,
    treeName: name,
    name: `${name} ${PHASE_LABELS[index]}`,
    phase: index + 1,
    description,
    effects: Object.freeze(effects)
  })))
})));

const THREE_TOUCH_RARES = Object.freeze([
  ['life-slot', '1 Life Slot', 'Add one life slot and refill one life.', {maxLives: 1}],
  ['extra-touch', 'Extra Touch', 'Add one touch to each chance.', {maxTouches: 1}],
  ['power-strike', 'Power Strike', 'Add 10% shot strength.', {shotStrength: .10}]
].map(([id, name, description, effects]) => Object.freeze({id, name, description, rare: true, effects: Object.freeze(effects)})));

const THREE_TOUCH_ABILITIES = Object.freeze([...THREE_TOUCH_TREES, ...THREE_TOUCH_RARES]);

const THREE_TOUCH_BASE_EFFECTS = Object.freeze({
  shotStrength: 1, curve: 1, airShotStrength: 1, playerSpeed: 1,
  maxLives: 3, maxTouches: 3, keeperLevelOffset: 0, touchCooldown: .5,
  firstTimeFinish: 0, openingStrikePace: 0, firstTimeParry: 0,
  doubleFromDistance: 0, outsideShotPace: 0, distanceProtection: 0,
  lowCurveBounce: 0, grassCutter: 0, grassAirLanding: 0, volleyBounceGrace: 0, volleyDriven: 0,
  woodworkCredit: 0, woodworkCarry: 0, woodworkGoal: 0, recoverySpeedBonus: 0, freeRecoveryTouch: 0,
  gentleTouchCooldown: 0, freeLastTrap: 0, longRangeBonus: 0, longRangeBank: 0,
  keeperReverseDelay: 0, keeperWrongFootParry: 0, lastChance: 0, lastLifeTouch: 0
});

function normalizeAbilityLevels(levels) {
  const normalized = {};
  for (const ability of THREE_TOUCH_ABILITIES) {
    const level = levels?.[ability.id];
    if (Number.isSafeInteger(level) && level > 0) {
      normalized[ability.id] = ability.rare ? level : Math.min(ability.phases.length, level);
    }
  }
  return normalized;
}

function addAbilityEffects(effects, added, multiplier = 1) {
  for (const [stat, amount] of Object.entries(added)) effects[stat] += amount * multiplier;
}

function buildAbilityEffects(levels) {
  const normalized = normalizeAbilityLevels(levels);
  const effects = {...THREE_TOUCH_BASE_EFFECTS};
  for (const ability of THREE_TOUCH_ABILITIES) {
    const level = normalized[ability.id];
    if (!level) continue;
    if (ability.rare) addAbilityEffects(effects, ability.effects, level);
    else for (let index = 0; index < level; index++) addAbilityEffects(effects, ability.phases[index].effects);
  }
  return effects;
}

export { THREE_TOUCH_ABILITIES, THREE_TOUCH_TREES, THREE_TOUCH_RARES, THREE_TOUCH_BASE_EFFECTS,
  normalizeAbilityLevels, buildAbilityEffects, addAbilityEffects };
