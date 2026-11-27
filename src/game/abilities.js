const THREE_TOUCH_ABILITIES = Object.freeze([
  ['power-strike', 'Power Strike', '+10% strength on every shot.', 'shotStrength', .10],
  ['bend-it', 'Bend It', '+10% sideways curve on shots with spin.', 'curve', .10],
  ['life-slot', '1 Life Slot', 'Add a life slot and restore one life.', 'maxLives', 1],
  ['extra-touch', 'Extra Touch', 'Add one touch to each chance.', 'maxTouches', 1],
  ['volley-boost', 'Volley Boost', '+25% strength when you strike an airborne ball.', 'airShotStrength', .25],
  ['quick-feet', 'Quick Feet', '+10% walk and sprint speed.', 'playerSpeed', .10],
  ['keeper-setback', 'Keeper Setback', 'Lower the keeper difficulty by five goals.', 'keeperLevelOffset', 5],
  ['touch-window', 'Touch Window', 'Add 0.5 s to the gap needed to count a new touch.', 'touchCooldown', .5],
  ['shot-trace', 'Shot Trace', 'Trace your shot. Add 2.5 s of visibility.', 'shotPathSeconds', 2.5],
  ['woodwork-credit', 'Woodwork Credit', 'First post or bar hit each chance refunds a touch.', 'woodworkCredit', 1],
  ['soft-landing', 'Soft Landing', 'The first turf bounce takes extra pace off the ball.', 'softLanding', 1],
  ['first-time-finish', 'First-Time Finish', 'A first-touch goal restores one extra life.', 'firstTimeFinish', 1],
  ['last-chance', 'Last Chance', 'One retry from the same spot on your last life.', 'lastChance', 1],
  ['grass-cutter', 'Grass Cutter', 'Firm ground shots hold their speed longer.', 'grassCutter', 1],
  ['long-range-bonus', 'Long-Range Bonus', 'Score from outside the box for a touch next chance.', 'longRangeBonus', 1]
].map(([id, name, description, stat, amount]) => Object.freeze({id, name, description, stat, amount})));

const THREE_TOUCH_BASE_EFFECTS = Object.freeze({
  shotStrength: 1, curve: 1, airShotStrength: 1, playerSpeed: 1, shotPathSeconds: 0,
  maxLives: 3, maxTouches: 3, keeperLevelOffset: 0, touchCooldown: .5,
  woodworkCredit: 0, softLanding: 0, firstTimeFinish: 0, lastChance: 0, grassCutter: 0, longRangeBonus: 0
});

export { THREE_TOUCH_ABILITIES, THREE_TOUCH_BASE_EFFECTS };
