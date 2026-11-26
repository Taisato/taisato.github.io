

const FB = Object.freeze({
  length:105, width:68, halfLength:52.5, halfWidth:34,
  goalWidth:7.32, goalHeight:2.44, goalDepth:2.4, postRadius:.06,
  ballRadius:.11, ballMass:.43, gravity:9.81, fixedStep:1/120,
  walkSpeed:3.2, sprintSpeed:6.6, turnSpeed:1.8
});
const footballClamp = (value,min,max)=>Math.max(min,Math.min(max,value));

export { FB, footballClamp };
