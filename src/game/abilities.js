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
    ['Gentle touches open a 1.5 s window for your next touch or shot.', {gentleTouchCooldown: .5}],
    ['Shots gain 10% power for each earlier touch in the same window.', {touchWindowStrength: .10}]
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
  ]],
  ['instep', 'Instep Specialist', [
    ['Instep shots gain 10% shot power.', {instepShotStrength: .10}],
    ['Instep volleys gain 10% forward pace.', {instepVolleyPace: .10}],
    ['Score with an instep volley to add one goal.', {instepVolleyGoal: 1}]
  ], 10],
  ['left-foot-maestro', 'Left foot maestro', [
    ['Left-foot strikes gain 25% shot power.', {leftFootShotPace: .25}],
    ['Left-foot shots gain 25% sideways curve.', {leftFootCurve: .25}],
    ['Score with your left foot to add one goal.', {leftFootGoalBonus: 1}]
  ], 20],
  ['switch-hitter', 'Switch Hitter', [
    ['Control with one foot, then shoot with the other within 2 s for 10% more forward pace.', {switchPace: .10}],
    ['That opposite-foot shot also gains 15% sideways curve.', {switchCurve: .15}],
    ['Once per chance, that shot is free if it would spend a touch.', {switchFree: 1}]
  ], 30],
  ['box-raider', 'Box Raider', [
    ['Control outside the box, then control inside to refund one touch. Once per chance.', {boxRefund: 1}],
    ['Your first shot after that entry gains 10% forward pace if struck inside the box.', {boxPace: .10}],
    ['Score with that inside-box shot to add one goal.', {boxGoal: 1}]
  ], 40],
  ['second-ball', 'Second Ball', [
    ['Your first shot within 2 s of a keeper parry or a live frame rebound gains 15% forward pace.', {reboundPace: .15}],
    ['You have 4 s to reach the rebound and take that shot.', {reboundWindow: 2}],
    ['Score with that follow-up to add one goal.', {reboundGoal: 1}]
  ], 50],
  ['far-post', 'Far Post', [
    ['Shoot across goal from at least 4 m off centre to gain 10% sideways curve.', {farCurve: .10}],
    ['That cross-goal shot also gains 10% forward pace.', {farPace: .10}],
    ['Put that shot into the far outer third of the goal to add one goal.', {farGoal: 1}]
  ], 60],
  ['hot-streak', 'Hot Streak', [
    ['Every second consecutive scoring chance grants one touch on the next chance.', {streakTouch: 1}],
    ['Every second consecutive scoring chance also restores one extra life.', {streakHeal: 1}],
    ['Every third consecutive scoring chance adds one goal. A miss resets the streak.', {streakGoal: 1}]
  ], 70],
  ['half-volley', 'Half Volley', [
    ['Strike within 0.30 s of a bounce for 12% more shot power. Take the shot before your next control touch.', {halfVolleyStrength: .12}],
    ['The half-volley window extends to 0.50 s.', {halfVolleyWindow: .20}],
    ['Once per chance, a half-volley is free if it would spend a touch.', {halfVolleyFree: 1}]
  ], 80],
  ['top-bins', 'Top Bins', [
    ['Score in the upper third of the goal to restore one extra life.', {highHeal: 1}],
    ['Find either top corner to start the next chance with an extra touch.', {cornerTouch: 1}],
    ['Finish in both the upper third and an outer third of the goal to add one goal.', {cornerGoal: 1}]
  ], 90],
  ['clutch-captain', 'Clutch Captain', [
    ['Scoring on your last life restores one extra life.', {clutchHeal: 1}],
    ['Score with the strike that spends your final touch to carry one touch into the next chance.', {lastShotCarry: 1}],
    ['On your last life, score with that final-touch strike to add one goal.', {clutchGoal: 1}]
  ], 100]
].map(([treeId, name, phases, unlockAt=0]) => Object.freeze({
  id: treeId,
  name,
  unlockAt,
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
  ['power-strike', 'Power Strike', 'Add 10% shot strength.', {shotStrength: .10}],
  ['extra-reroll', 'Extra Reroll', 'Reroll open cards once per future 3 Touch draft. Pinned trees stay in place.', {extraReroll: 1}, 25, 1],
  ['bonus-goal', 'Bonus Goal', 'Every finish earns one extra goal per copy.', {bonusGoal: 1}, 50],
  ['double-goals', 'Double Goals', 'Double the full value of each goal, including all bonuses.', {doubleGoals: 1}, 75, 1]
].map(([id, name, description, effects, unlockAt=0, maxStacks=Number.MAX_SAFE_INTEGER]) =>
  Object.freeze({id, name, description, rare: true, unlockAt, maxStacks, effects: Object.freeze(effects)})));

const THREE_TOUCH_ABILITIES = Object.freeze([...THREE_TOUCH_TREES, ...THREE_TOUCH_RARES]);

const THREE_TOUCH_BASE_EFFECTS = Object.freeze({
  shotStrength: 1, curve: 1, airShotStrength: 1, playerSpeed: 1,
  maxLives: 3, maxTouches: 3, keeperLevelOffset: 0, touchCooldown: .5,
  firstTimeFinish: 0, openingStrikePace: 0, firstTimeParry: 0,
  doubleFromDistance: 0, outsideShotPace: 0, distanceProtection: 0,
  lowCurveBounce: 0, grassCutter: 0, grassAirLanding: 0, volleyBounceGrace: 0, volleyDriven: 0,
  woodworkCredit: 0, woodworkCarry: 0, woodworkGoal: 0, recoverySpeedBonus: 0, freeRecoveryTouch: 0,
  gentleTouchCooldown: 0, touchWindowStrength: 0,
  instepShotStrength: 0, instepVolleyPace: 0, instepVolleyGoal: 0,
  keeperReverseDelay: 0, keeperWrongFootParry: 0, lastChance: 0, lastLifeTouch: 0,
  leftFootShotPace: 0, leftFootCurve: 0, leftFootGoalBonus: 0,
  switchPace: 0, switchCurve: 0, switchFree: 0, boxRefund: 0, boxPace: 0, boxGoal: 0,
  reboundPace: 0, reboundWindow: 0, reboundGoal: 0, farCurve: 0, farPace: 0, farGoal: 0,
  streakTouch: 0, streakHeal: 0, streakGoal: 0, halfVolleyStrength: 0, halfVolleyWindow: 0, halfVolleyFree: 0,
  highHeal: 0, cornerTouch: 0, cornerGoal: 0, clutchHeal: 0, lastShotCarry: 0, clutchGoal: 0,
  extraReroll: 0, bonusGoal: 0, doubleGoals: 0
});

function continuesTouchWindow(gap, effects, gentle, previousGentle) {
  const base = effects.touchCooldown ?? THREE_TOUCH_BASE_EFFECTS.touchCooldown;
  const extension = effects.gentleTouchCooldown ?? 0;
  const duration = base + (gentle || previousGentle ? extension : 0);
  return gap < duration - 1e-9;
}

function availableTrees(highScore) {
  return THREE_TOUCH_TREES.filter(tree=>tree.unlockAt<=highScore);
}
function availableRares(highScore) {
  return THREE_TOUCH_RARES.filter(rare=>rare.unlockAt<=highScore);
}

function normalizeAbilityLevels(levels,highScore=Infinity) {
  const normalized = {};
  for (const ability of THREE_TOUCH_ABILITIES) {
    const level = levels?.[ability.id];
    if (ability.unlockAt<=highScore && Number.isSafeInteger(level) && level > 0) {
      normalized[ability.id] = Math.min(ability.rare ? ability.maxStacks : ability.phases.length,level);
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
  availableTrees, availableRares, normalizeAbilityLevels, buildAbilityEffects, addAbilityEffects, continuesTouchWindow };
