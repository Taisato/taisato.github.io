

const FB = Object.freeze({
  length:105, width:68, halfLength:52.5, halfWidth:34,
  goalWidth:7.32, goalHeight:2.44, goalDepth:2.4, postRadius:.06, goalAreaDepth:5.5, penaltyDepth:16.5,
  ballRadius:.11, ballMass:.43, gravity:9.81, fixedStep:1/120,
  walkSpeed:4.3, sprintSpeed:5.8, turnSpeed:1.8
});
const footballClamp = (value,min,max)=>Math.max(min,Math.min(max,value));
const KEEPER_PEAK_LEVEL = 75;

const SKY_OPTIONS = Object.freeze([
  {id:'quiet-orbit',name:'Blue'},
  {id:'solar-edge',name:'Amber'},
  {id:'violet-hour',name:'Violet'},
  {id:'jade',name:'Jade'},
  {id:'crimson',name:'Crimson'},
  {id:'turquoise',name:'Turquoise'},
  {id:'gold',name:'Gold'},
  {id:'indigo',name:'Indigo'},
  {id:'rose',name:'Rose'},
  {id:'lime',name:'Lime'}
].map(Object.freeze));
export { FB, footballClamp, KEEPER_PEAK_LEVEL, SKY_OPTIONS };
