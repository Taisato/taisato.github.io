import { FB, footballClamp, KEEPER_PEAK_LEVEL } from '../config.js';
import { outsidePenaltyArea } from '../physics/shot-surface.js';
import { THREE_TOUCH_BASE_EFFECTS, addAbilityEffects, buildAbilityEffects, continuesTouchWindow, normalizeAbilityLevels } from './abilities.js';
import { abilityReelPool, draftAbilityChoices, emptyAbilitySlots } from './ability-draft.js';

const EMPTY_REWARDS=Object.freeze([]);
const GOALS_PER_REWARD=5;
const RECOVERY_SECONDS=2;
const FIRST_TIME_PARRY_SECONDS=1;
const DISTANCE_BANK_METERS=23;
const MAX_GOAL_CARRY_TOUCHES=2;

class FootballChallenge {
  constructor({random=Math.random,drafts=true,highScore=0}={}) {
    this.random=random;this.drafts=drafts;
    this.setHighScore(highScore);
    this.active=false;this.phase='idle';this.score=0;this.lives=3;this.touches=3;
    this.round=0;this.outcome=null;this.resultAge=0;this.chance=null;this.goalValue=0;
    this.time=0;this.lastTouchTime=0;this.settledAge=0;this.saveStoppedAge=0;
    this.savePending=false;this._lastPhysicalTouchTime=-Infinity;this._lastTouchGentle=false;
    this._motion=null;this._motionObserved=false;
    this.effects={...THREE_TOUCH_BASE_EFFECTS};
    this._practiceLevels={};
    this.rewardSlots=emptyAbilitySlots();this.rewardChoices=EMPTY_REWARDS;this._acceptedRewards=0;this.rerollsLeft=0;
    this._chanceBonusTouches=0;this._recoveryUntil=-Infinity;
    this._snapshot={mode:drafts?'challenge':'freeroam',practice:!drafts,phase:'idle',score:0,lives:3,touches:3,
      maxLives:3,maxTouches:3,round:0,outcome:null,goalValue:0};
  }

  get maxLives() {return this.effects.maxLives;}
  get maxTouches() {return this.effects.maxTouches+this._chanceBonusTouches;}
  get acceptedRewardCount() {return this._acceptedRewards;}
  setHighScore(score) {this.highScore=Number.isSafeInteger(score)&&score>=0?score:0;}
  get rewardPool() {return abilityReelPool(this.rewardSlots,this.highScore,this.effects);}
  get canReroll() {return this.phase==='reward'&&this.rerollsLeft>0&&this.rewardSlots.includes(null);}
  get movementSpeedMultiplier() {
    return this.effects.playerSpeed+(this.time<this._recoveryUntil?this.effects.recoverySpeedBonus:0);
  }
  get keeperDifficulty() {
    return Math.max(0,Math.min(this.score,KEEPER_PEAK_LEVEL)-this.effects.keeperLevelOffset);
  }

  get snapshot() {
    const s=this._snapshot;
    s.phase=this.phase;s.score=this.score;s.lives=this.lives;s.touches=this.touches;
    s.maxLives=this.maxLives;s.maxTouches=this.maxTouches;
    s.round=this.round;s.outcome=this.outcome;s.goalValue=this.goalValue;
    return s;
  }

  get rewardDue() {
    return this.drafts&&this.active&&this.phase==='result'&&this.outcome==='goal'&&
      this.score>=(this._acceptedRewards+1)*GOALS_PER_REWARD&&this.rewardSlots.some(slot=>slot?.phase!==3);
  }

  beginReward() {
    if(!this.rewardDue)return null;
    this.rewardChoices=draftAbilityChoices(this.rewardSlots,()=>this._random(),this.highScore,this.effects);
    this.rerollsLeft=this.effects.extraReroll&&this.rewardSlots.includes(null)?1:0;
    this.phase='reward';
    return this.rewardChoices;
  }

  rerollReward() {
    if(!this.canReroll)return null;
    this.rewardChoices=draftAbilityChoices(this.rewardSlots,()=>this._random(),this.highScore,this.effects,this.rewardChoices);
    this.rerollsLeft=0;
    return this.rewardChoices;
  }

  chooseReward(id) {
    if(!this.active||this.phase!=='reward')return false;
    const reward=this.rewardChoices.find(choice=>!choice.closed&&choice.id===id);
    if(!reward)return false;
    addAbilityEffects(this.effects,reward.effects);
    if(reward.effects.maxLives)this.lives=Math.min(this.maxLives,this.lives+reward.effects.maxLives);
    if(!reward.rare)this.rewardSlots[reward.slot]={treeId:reward.treeId,phase:reward.phase};
    this._acceptedRewards++;
    this.rewardChoices=EMPTY_REWARDS;this.rerollsLeft=0;
    this.phase='result';
    return true;
  }

  start() {
    Object.assign(this.effects,this.drafts?THREE_TOUCH_BASE_EFFECTS:buildAbilityEffects(this._practiceLevels));
    this.rewardSlots=emptyAbilitySlots();this.rewardChoices=EMPTY_REWARDS;this._acceptedRewards=0;this.rerollsLeft=0;
    this._chanceBonusTouches=0;this._nextWoodworkTouches=0;
    this._scoringStreak=0;this._goalCarry=null;
    this._lastChanceRetries=0;this._distanceProtected=false;
    this._practiceLifeCredit=this.maxLives;
    this.active=true;this.score=0;this.lives=this.maxLives;this.round=0;this.time=0;
    this.chance=null;
    return this.drafts?this._newChance():this._newPracticeChance();
  }

  next() {
    if(!this.active||this.phase!=='result'||this.lives<=0||this.rewardDue)return null;
    if(this.outcome==='retry'){this._resetAttempt();return this.chance;}
    return this.drafts?this._newChance():this._newPracticeChance();
  }

  setPracticeBuild(levels) {
    if(this.drafts)return this.effects;
    this._practiceLevels=normalizeAbilityLevels(levels,this.highScore);
    Object.assign(this.effects,buildAbilityEffects(this._practiceLevels));
    if(this.active){
      this.lives=Math.min(this.maxLives,this.lives+Math.max(0,this.maxLives-this._practiceLifeCredit));
      this.touches=Math.min(this.maxTouches,this.touches+Math.max(0,this.effects.maxTouches-this._practiceTouchCredit));
      this._practiceLifeCredit=Math.max(this._practiceLifeCredit,this.maxLives);
      this._practiceTouchCredit=Math.max(this._practiceTouchCredit,this.effects.maxTouches);
    }
    return this.effects;
  }

  practiceBall(levels=this._practiceLevels) {
    if(this.drafts)return null;
    this.setPracticeBuild(levels);
    if(!this.active||this.phase==='gameover')return this.start();
    if(this.outcome==='retry'){this._resetAttempt();return this.chance;}
    if(this.phase==='ready'||this.phase==='live')this._scoringStreak=0;
    return this._newPracticeChance();
  }

  stop() {
    this.active=false;this.phase='idle';this.outcome=null;this.resultAge=0;
    this.rewardChoices=EMPTY_REWARDS;this.rerollsLeft=0;
    this._motion=null;this._motionObserved=false;this._lastPhysicalTouchTime=-Infinity;this._lastTouchGentle=false;
  }

  _random() {
    const n=this.random();return Number.isFinite(n)?footballClamp(n,0,1-.000000001):.5;
  }

  _newPracticeChance() {
    this.chance={difficulty:this.keeperDifficulty};
    this._prepareChance();
    return this.chance;
  }

  _newChance() {
    const progress=1-Math.exp(-Math.max(0,this.score)/6);
    let depth=11+progress*6+this._random()*(4+progress*6);
    let x=(this._random()*2-1)*(3+progress*10);
    // Both central and angled chances move back with score. At 15 goals their
    // combined mean depth is about 20.7 m; the furthest limit approaches 27 m.
    if(this._random()<progress*.62){
      depth=11+progress*7+this._random()*(4+progress*2);
      x=(this._random()<.5?-1:1)*(4+progress*6+this._random()*(3+progress*5));
    }
    const z=-FB.halfLength+depth,previous=this.chance?.ball;
    if(previous&&Math.hypot(x-previous.x,z-previous.z)<2){
      x=Math.abs(x)>2?-x:(x<=0?2.8:-2.8);
    }
    const distance=Math.hypot(x,depth),forwardX=-x/distance,forwardZ=-depth/distance;
    this.chance={
      ball:{x,y:FB.ballRadius,z},
      player:{x:x-forwardX*.84,y:0,z:z-forwardZ*.84},
      yaw:Math.atan2(-forwardX,-forwardZ),difficulty:this.keeperDifficulty
    };
    this._prepareChance();
    return this.chance;
  }

  _prepareChance() {
    this.round++;
    this._chanceWoodworkTouches=this.effects.woodworkCarry?this._nextWoodworkTouches:0;
    this._nextWoodworkTouches=0;
    const carry=this._goalCarry,e=this.effects;
    this._chanceGoalTouches=carry?Math.min(MAX_GOAL_CARRY_TOUCHES,
      (carry.streak?e.streakTouch:0)+(carry.corner?e.cornerTouch:0)+(carry.lastShot?e.lastShotCarry:0)):0;
    this._goalCarry=null;
    this._resetAttempt();
  }

  _resetAttempt() {
    const lastLifeTouch=this.lives===1?this.effects.lastLifeTouch:0;
    this._chanceBonusTouches=this._chanceWoodworkTouches+this._chanceGoalTouches+lastLifeTouch;
    this._practiceTouchCredit=this.effects.maxTouches;
    this.touches=this.maxTouches;this.phase='ready';this.outcome=null;this.resultAge=0;
    this.goalValue=0;
    this.lastTouchTime=this.time;this.settledAge=0;this.saveStoppedAge=0;this.savePending=false;
    this._physicalTouches=0;this._lastTouchLeft=false;this._woodworkUsed=false;this._lastTouchOutsideBox=false;this._shotDistance=0;
    this._lastTouchInstepVolley=false;
    this._lastShot=null;this._lastTouchSpentFinal=false;
    this._switchFreeUsed=false;this._halfVolleyFreeUsed=false;this._boxRefundUsed=false;
    this._lastFrameEnd=0;this._directOutsideShot=false;
    this._firstTimeQualified=false;this._firstTimeRescueUsed=false;this._firstTimeParryUntil=-Infinity;
    this._recoveryUntil=-Infinity;this._recoveryTouchUsed=false;
    this._lastPhysicalTouchTime=-Infinity;this._lastTouchGentle=false;this._motion=null;this._motionObserved=false;
  }

  _crossing(from,to,plane) {
    return from<plane&&to>=plane?(plane-from)/(to-from):Infinity;
  }

  observeMotion(previous,current,radius=FB.ballRadius,events=null,offWoodwork) {
    if(!this.active||(this.phase!=='ready'&&this.phase!=='live')||!previous||!current)return;
    this._motionObserved=true;
    if(this._motion||!Number.isFinite(previous.x+previous.y+previous.z+current.x+current.y+current.z))return;
    const r=Number.isFinite(radius)?Math.max(0,radius):FB.ballRadius;
    let first=Infinity,kind=null,goalX=0,goalY=0;
    const end=this._crossing(-previous.z,-current.z,FB.halfLength+r);
    if(end<first){
      const x=previous.x+(current.x-previous.x)*end;
      const y=previous.y+(current.y-previous.y)*end;
      first=end;
      kind=Math.abs(x)<=FB.goalWidth*.5-r+.000001&&y>=r-.005&&y<=FB.goalHeight-r+.000001?'goal':'out';
      goalX=x;goalY=y;
    }
    const far=this._crossing(previous.z,current.z,FB.halfLength+r);
    const right=this._crossing(previous.x,current.x,FB.halfWidth+r);
    const left=this._crossing(-previous.x,-current.x,FB.halfWidth+r);
    const outside=Math.min(far,right,left);
    if(outside<first){first=outside;kind='out';}
    if(kind)this._motion={kind,eventCount:events?events.length:Infinity,offWoodwork,goalX,goalY};
  }

  _touch(event) {
    const time=Number.isFinite(event.time)?event.time:this.time;
    const gap=time-this._lastPhysicalTouchTime;
    const gentle=!event.shot&&(event.control??(Number.isFinite(event.speed)&&event.speed<=2.2));
    const inWindow=continuesTouchWindow(gap,this.effects,gentle,this._lastTouchGentle);
    // The required gap is shared by both feet. Every physical contact slides
    // the window forward, including contacts in the same touch sequence.
    this._lastPhysicalTouchTime=time;this._lastTouchGentle=gentle;
    this.lastTouchTime=this.time;this.settledAge=0;this.saveStoppedAge=0;this.savePending=false;
    this.phase='live';
    this._physicalTouches++;
    // The latest ball contact owns the finish, even during the touch cooldown.
    this._lastTouchLeft=event.footId==='left';
    this._lastShot=event.shot===true?event:null;
    this._lastTouchSpentFinal=false;
    this._lastTouchInstepVolley=event.shot===true&&event.instep===true&&event.airborne===true;
    const isAirborne=event.airborne??(event.position?.y>FB.ballRadius+.05);
    const parryFinish=this.effects.firstTimeParry&&event.shot&&isAirborne&&this.time<=this._firstTimeParryUntil;
    this._firstTimeQualified=!!event.shot&&(this._physicalTouches===1||!!parryFinish);
    if(parryFinish)this._firstTimeRescueUsed=true;
    this._firstTimeParryUntil=-Infinity;

    const point=event.position;
    this._lastTouchOutsideBox=outsidePenaltyArea(point);
    this._shotDistance=this._lastTouchOutsideBox?Math.hypot(point.x,point.z+FB.halfLength):0;
    this._directOutsideShot=this._lastTouchOutsideBox&&!!event.shot;
    this._lastFrameEnd=0;
    if(!inWindow){
      if(this.effects.freeRecoveryTouch&&!this._recoveryTouchUsed&&this.time<this._recoveryUntil){
        this._recoveryTouchUsed=true;
      }else if(this.effects.switchFree&&!this._switchFreeUsed&&this._lastShot?.switchShot){
        this._switchFreeUsed=true;
      }else if(this.effects.halfVolleyFree&&!this._halfVolleyFreeUsed&&this._lastShot?.halfVolley){
        this._halfVolleyFreeUsed=true;
      }else{
        if(this.touches===0)return true;
        this.touches--;
        this._lastTouchSpentFinal=this.touches===0&&this._lastShot!==null;
      }
    }
    if(gentle&&event.boxEntry&&this.effects.boxRefund&&!this._boxRefundUsed){
      this._boxRefundUsed=true;
      this.touches=Math.min(this.maxTouches,this.touches+1);
    }
    return false;
  }

  _frameHit(event) {
    if(this.phase!=='live')return;
    this._lastFrameEnd=event.position?.z>0?1:-1;
    this._directOutsideShot=false;
    this._recoveryUntil=this.time+RECOVERY_SECONDS;
    if(this.effects.woodworkCredit&&!this._woodworkUsed){
      this._woodworkUsed=true;
      this.touches=Math.min(this.maxTouches,this.touches+this.effects.woodworkCredit);
    }
  }

  _keeperSave(event) {
    this.savePending=!event.forcedParry;
    this._lastFrameEnd=0;
    this._directOutsideShot=false;
    this._firstTimeParryUntil=-Infinity;
    if(!event.parry||this.phase!=='live')return;
    this._recoveryUntil=this.time+RECOVERY_SECONDS;
    if(this.effects.firstTimeParry&&this._firstTimeQualified&&!this._firstTimeRescueUsed){
      this._firstTimeParryUntil=this.time+FIRST_TIME_PARRY_SECONDS;
    }
  }

  _scoreGoal(offWoodwork,x,y) {
    const e=this.effects,shot=this._lastShot;
    const high=y>=FB.goalHeight*2/3,outer=Math.abs(x)>=FB.goalWidth/6,corner=high&&outer;
    const lastLife=this.lives===1;
    this._scoringStreak++;
    const pair=this._scoringStreak%2===0;
    let points=1+e.bonusGoal;
    if(e.firstTimeFinish&&this._firstTimeQualified)points++;
    if(e.doubleFromDistance&&this._lastTouchOutsideBox)points++;
    if(e.woodworkGoal&&offWoodwork)points++;
    if(e.leftFootGoalBonus&&this._lastTouchLeft)points++;
    if(e.instepVolleyGoal&&this._lastTouchInstepVolley)points++;
    if(e.boxGoal&&shot?.boxShot)points++;
    if(e.reboundGoal&&shot?.reboundShot)points++;
    if(e.farGoal&&outer&&shot?.farSide===Math.sign(x))points++;
    if(e.streakGoal&&this._scoringStreak%3===0)points++;
    if(e.cornerGoal&&corner)points++;
    if(e.clutchGoal&&lastLife&&this._lastTouchSpentFinal)points++;
    if(e.doubleGoals)points*=2;
    this.goalValue=points;this.score+=points;
    if(this.drafts)this.highScore=Math.max(this.highScore,this.score);
    const healing=1+(pair?e.streakHeal:0)+(high?e.highHeal:0)+(lastLife?e.clutchHeal:0);
    this.lives=Math.min(this.maxLives,this.lives+healing);
    this._goalCarry={streak:pair&&!!e.streakTouch,corner:corner&&!!e.cornerTouch,lastShot:this._lastTouchSpentFinal&&!!e.lastShotCarry};
    if(e.distanceProtection&&this._shotDistance>=DISTANCE_BANK_METERS)this._distanceProtected=true;
  }

  _resolve(outcome,offWoodwork=false,x=0,y=0) {
    if(this.phase!=='ready'&&this.phase!=='live')return null;
    if(outcome==='goal'){
      this._scoreGoal(offWoodwork,x,y);
    }else if(outcome==='out'&&this._directOutsideShot&&this.effects.distanceProtection&&this._distanceProtected){
      this._distanceProtected=false;outcome='retry';
    }else if(this.lives===1&&this._lastChanceRetries<this.effects.lastChance){
      this._lastChanceRetries++;outcome='retry';
    }else{
      if(outcome==='out'&&this._lastFrameEnd)this._nextWoodworkTouches=this.effects.woodworkCarry;
      this.lives=Math.max(0,this.lives-1);
    }
    if(outcome!=='goal'){this._scoringStreak=0;this._goalCarry=null;}
    this.outcome=outcome;this.resultAge=0;
    this.phase=this.lives>0?'result':'gameover';
    this._motion=null;this._motionObserved=false;
    return outcome;
  }

  update(dt,{ball,previous,events=[],keeper=null}={}) {
    if(!this.active||!(dt>0)||!Number.isFinite(dt))return null;
    dt=Math.min(dt,.1);this.time+=dt;
    if(this.phase==='result'||this.phase==='gameover'){this.resultAge+=dt;return null;}
    if(this.phase==='reward')return null;
    if(!ball?.position||!ball.velocity)return null;
    const p=ball.position,v=ball.velocity,r=ball.radius??FB.ballRadius;
    if(!Number.isFinite(p.x+p.y+p.z+v.x+v.y+v.z))return this._resolve('miss');
    if(!this._motionObserved&&previous)this.observeMotion(previous,p,r,events,ball.offWoodwork);
    const motion=this._motion;
    const count=Math.min(events.length,motion?.eventCount??events.length);
    for(let i=0;i<count;i++){
      const event=events[i];
      if(event.type==='touch'){
        if(this._touch(event))return this._resolve('touches');
      }
      else if(event.type==='save')this._keeperSave(event);
      else if(event.type==='frame')this._frameHit(event);
      else if(event.type==='bounce')this._firstTimeParryUntil=-Infinity;
    }
    this._motion=null;this._motionObserved=false;
    if(motion){
      if(motion.kind!=='goal'||this.phase==='live')return this._resolve(motion.kind,motion.offWoodwork??(this._lastFrameEnd===-1),motion.goalX,motion.goalY);
    }
    // Also handle a boundary state after a pause/relocalization without assuming
    // that a ball placed behind the goal entered through the mouth.
    if(Math.abs(p.x)>FB.halfWidth+r||Math.abs(p.z)>FB.halfLength+r)return this._resolve('out');
    if(this.phase==='ready')return null;
    const speed=Math.hypot(v.x,v.y,v.z),grounded=p.y<=r+.045;
    const nearKeeper=keeper?.enabled!==false&&!keeper?.ragdoll?.active&&keeper?.position&&
      Math.hypot(p.x-keeper.position.x,p.z-keeper.position.z)<1.35&&p.y<2.2;
    // A parry is live. Only a ball that genuinely settles at the keeper for a
    // sustained interval counts as secured; a player's recovery clears this.
    this.saveStoppedAge=this.savePending&&nearKeeper&&speed<.38?this.saveStoppedAge+dt:0;
    if(this.saveStoppedAge>=.8)return this._resolve('saved');
    this.settledAge=this.touches===0&&grounded&&speed<.16?this.settledAge+dt:0;
    if(this.settledAge>=.55)return this._resolve('touches');
    // The last shot gets time to complete its flight, bounces and goal-line
    // crossing. There is no time limit before shooting or with touches left.
    if(this.touches===0&&this.time-this.lastTouchTime>14)return this._resolve('touches');
    return null;
  }
}

export { FootballChallenge };
