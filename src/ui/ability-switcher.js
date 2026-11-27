import {THREE_TOUCH_ABILITIES,THREE_TOUCH_TREES,THREE_TOUCH_RARES} from '../game/abilities.js';
import {UI,brand,button,label,panel,shape,tracked} from './theme.js';

const PHASE_LABELS=['Off','I','II','III'];
const VR_ROWS=3;
const TREE_PAGES=Math.ceil(THREE_TOUCH_TREES.length/VR_ROWS);
const VR_PAGES=TREE_PAGES+Math.ceil(THREE_TOUCH_RARES.length/VR_ROWS);

function levelOf(levels,ability) {
  const value=levels instanceof Map?levels.get(ability.id):levels?.[ability.id];
  const maximum=ability.rare?Number.MAX_SAFE_INTEGER:ability.phases.length;
  return Number.isFinite(value)?Math.max(0,Math.min(maximum,Math.floor(value))):0;
}

function abilityDescription(ability,level) {
  return ability.rare?ability.description:ability.phases[Math.max(0,level-1)].description;
}

function equippedCount(levels) {
  return THREE_TOUCH_ABILITIES.reduce((count,ability)=>count+(levelOf(levels,ability)>0),0);
}

class FootballAbilitySwitcher {
  constructor(section,callbacks) {
    this.section=section;
    this.callbacks=callbacks;
    this.opener=document.querySelector('#abilities');
    this.count=section.querySelector('#abilities-count');
    this.clear=section.querySelector('#abilities-clear');
    this.catalog=section.querySelector('.ability-catalog');
    this.levels={};this.enabled=false;this.rows=[];
    this.abort=new AbortController();
    for(const [selector,abilities] of [['#ability-trees',THREE_TOUCH_TREES],['#ability-rares',THREE_TOUCH_RARES]]) {
      const group=section.querySelector(selector);
      for(const ability of abilities)group.append(this.makeRow(ability));
    }
    this.catalog.addEventListener('click',event=>this.select(event),{signal:this.abort.signal});
    this.clear.addEventListener('click',()=>{if(this.enabled)this.callbacks.clear();},{signal:this.abort.signal});
    this.refresh();
  }

  makeRow(ability) {
    const row=document.createElement('div'), name=document.createElement('h4'), description=document.createElement('p');
    row.className='ability-row';row.dataset.ability=ability.id;
    name.textContent=ability.name;
    const controls=document.createElement('div');controls.className='ability-controls';
    controls.setAttribute('role','group');controls.setAttribute('aria-label',ability.name);
    const makeButton=(text,accessibility)=>{
      const item=document.createElement('button');item.className='ability-choice';item.type='button';
      item.textContent=text;item.setAttribute('aria-label',accessibility);return item;
    };
    const record={row,ability,description,buttons:[],value:null};
    if(ability.rare) {
      const minus=makeButton('−',`Remove one ${ability.name}`);
      const plus=makeButton('+',`Add one ${ability.name}`);
      const value=document.createElement('output');value.className='ability-value';
      value.setAttribute('aria-live','polite');value.setAttribute('aria-label',`${ability.name} copies`);
      minus.dataset.delta=-1;plus.dataset.delta=1;
      controls.classList.add('rare-controls');controls.append(minus,value,plus);
      record.buttons=[minus,plus];record.value=value;
    } else {
      for(let level=0;level<=ability.phases.length;level++) {
        const phase=PHASE_LABELS[level];
        const action=level?`Equip ${ability.name} through phase ${phase}`:`Remove ${ability.name}`;
        const item=makeButton(phase,action);
        item.dataset.level=level;
        if(level)item.title=ability.phases[level-1].description;
        controls.append(item);record.buttons.push(item);
      }
    }
    row.append(name,description,controls);this.rows.push(record);
    return row;
  }

  select(event) {
    const button=event.target.closest('button'), row=button?.closest('[data-ability]');
    if(!this.enabled||!row||button.disabled)return;
    const ability=THREE_TOUCH_ABILITIES.find(entry=>entry.id===row.dataset.ability);
    const level=ability.rare?levelOf(this.levels,ability)+Number(button.dataset.delta):Number(button.dataset.level);
    this.callbacks.change(ability.id,level);
  }

  setEnabled(enabled) {
    const next=!!enabled;
    if(next===this.enabled)return;
    this.enabled=next;this.opener.disabled=!next;this.refresh();
  }

  setLevels(levels) {this.levels=levels;this.refresh();}

  refresh() {
    const count=equippedCount(this.levels);
    this.count.textContent=count?`${count} equipped`:'None equipped';
    this.clear.disabled=!this.enabled||count===0;
    for(const {row,ability,description,buttons,value} of this.rows) {
      const level=levelOf(this.levels,ability);
      row.dataset.equipped=String(level>0);
      description.textContent=abilityDescription(ability,level);
      if(ability.rare){
        value.value=String(level);
        buttons[0].disabled=!this.enabled||level===0;
        buttons[1].disabled=!this.enabled||level===Number.MAX_SAFE_INTEGER;
        continue;
      }
      buttons.forEach((item,index)=>{
        item.disabled=!this.enabled;
        item.setAttribute('aria-pressed',String(index===level));
        item.dataset.included=String(index>0&&index<level);
      });
    }
  }

  dispose() {this.abort.abort();}
}

function wrap(canvas,text,limit) {
  const lines=[];
  for(const word of text.split(' ')) {
    const last=lines.length-1;
    if(last<0||canvas.measureText(`${lines[last]} ${word}`).width>limit)lines.push(word);
    else lines[last]+=` ${word}`;
  }
  return lines;
}

function drawAbilitySwitcher(canvas,page,levels,hover) {
  panel(canvas,960,660);brand(canvas,48,58);tracked(canvas,'FREEROAM',731,58,18,UI.mint,2);
  canvas.fillStyle=UI.line;canvas.fillRect(48,106,864,1);
  const rare=page>=TREE_PAGES;
  const section=rare?THREE_TOUCH_RARES:THREE_TOUCH_TREES;
  const offset=(rare?page-TREE_PAGES:page)*VR_ROWS;
  label(canvas,rare?'Rare upgrades':'Ability trees',48,139,30,rare?UI.lilac:UI.white,'left',800);
  label(canvas,rare?'Each copy adds another bonus.':'A phase includes the phases before it.',48,172,22,UI.muted);
  label(canvas,`${page+1} / ${VR_PAGES}`,912,139,22,UI.mint,'right');
  const buttons=[];
  const add=(specification,selected=false,primary=false)=>{
    buttons.push(specification);
    canvas.save();if(specification.disabled)canvas.globalAlpha=.34;
    button(canvas,specification,{hover:hover===specification.id&&!specification.disabled,selected,primary});
    canvas.restore();
  };

  for(const [index,ability] of section.slice(offset,offset+VR_ROWS).entries()) {
    const y=192+index*102, level=levelOf(levels,ability);
    shape(canvas,48,y,864,96,12);canvas.fillStyle=level?'#102635':UI.panel;canvas.fill();
    canvas.strokeStyle=level?'#52736f':UI.line;canvas.lineWidth=1.5;canvas.stroke();
    label(canvas,ability.name,66,y+26,26,rare?UI.lilac:UI.white,'left',800);
    let size=20;
    const detail=abilityDescription(ability,level);
    canvas.font=`550 ${size}px Arial, "Liberation Sans", sans-serif`;
    let description=wrap(canvas,detail,440);
    if(description.length>2){
      size=18;canvas.font=`550 ${size}px Arial, "Liberation Sans", sans-serif`;
      description=wrap(canvas,detail,440);
    }
    for(const [line,text] of description.entries())label(canvas,text,66,y+53+line*size,size,UI.muted,'left',550);

    if(rare){
      const control={y:y+18,w:80,h:56,abilityId:ability.id};
      add({...control,id:`ability-${ability.id}-minus`,label:'−',x:585,level:level-1,disabled:level===0});
      label(canvas,String(level),730,y+46,28,level?UI.lilac:UI.muted,'center',800);
      add({...control,id:`ability-${ability.id}-plus`,label:'+',x:795,level:level+1,disabled:level===Number.MAX_SAFE_INTEGER});
    }else{
      for(let phase=0;phase<=ability.phases.length;phase++){
        add({id:`ability-${ability.id}-${phase}`,label:PHASE_LABELS[phase],x:534+phase*89,y:y+18,w:80,h:56,
          abilityId:ability.id,level:phase},(phase>0&&phase<level)||(phase===0&&level===0),phase>0&&phase===level);
      }
    }
  }
  add({id:'abilities-back',label:'Back',x:48,y:520,w:222,h:66},false,true);
  add({id:'ability-page-prev',label:'‹',x:290,y:520,w:94,h:66,disabled:page===0});
  add({id:'ability-page-next',label:'›',x:404,y:520,w:94,h:66,disabled:page===VR_PAGES-1});
  add({id:'abilities-clear',label:'Clear all',x:690,y:520,w:222,h:66,disabled:equippedCount(levels)===0});
  label(canvas,'Trigger  Select',48,615,20,UI.muted);label(canvas,'Y  Menu',912,615,20,UI.muted,'right');
  return buttons;
}

export {FootballAbilitySwitcher,drawAbilitySwitcher,VR_PAGES};
