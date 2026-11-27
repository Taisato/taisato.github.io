

const FB = Object.freeze({
  length:105, width:68, halfLength:52.5, halfWidth:34,
  goalWidth:7.32, goalHeight:2.44, goalDepth:2.4, postRadius:.06, penaltyDepth:16.5,
  ballRadius:.11, ballMass:.43, gravity:9.81, fixedStep:1/120,
  walkSpeed:4.3, sprintSpeed:5.8, turnSpeed:1.8
});
const footballClamp = (value,min,max)=>Math.max(min,Math.min(max,value));

const SKY_OPTIONS = Object.freeze([
  Object.freeze({id:'quiet-orbit',name:'Quiet Orbit'}),
  Object.freeze({id:'solar-edge',name:'Solar Edge'}),
  Object.freeze({id:'violet-hour',name:'Violet Hour'})
]);

export { FB, footballClamp, SKY_OPTIONS };
