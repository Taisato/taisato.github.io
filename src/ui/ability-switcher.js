import {availableTrees,THREE_TOUCH_RARES} from '../game/abilities.js';
import {UI,brand,button,label,panel,shape,tracked} from './theme.js';

const PHASE_LABELS=['Off','I','II','III'];
const VR_ROWS=3;
const BASE_TREES=availableTrees(0);
const UNLOCK_GOLD='#efc877';

function levelOf(levels,ability) {
  const value=levels instanceof Map?levels.get(ability.id):levels?.[ability.id];
  const maximum=ability.rare?Number.MAX_SAFE_INTEGER:ability.phases.length;
  return Number.isFinite(value)?Math.max(0,Math.min(maximum,Math.floor(value))):0;
}

function abilityDescription(ability,level) {
  return ability.rare?ability.description:ability.phases[Math.max(0,level-1)].description;
}

function abilityPages(trees) {
  const pages=[];
  for(const group of [trees,THREE_TOUCH_RARES]){
    for(let i=0;i<group.length;i+=VR_ROWS)pages.push(group.slice(i,i+VR_ROWS));
  }
  return pages;
}

class FootballAbilitySwitcher {
  constructor(section,callbacks) {
    this.section=section;
    this.callbacks=callbacks;
    this.opener=document.querySelector('#abilities');
    this.count=section.querySelector('#abilities-count');
    this.clear=section.querySelector('#abilities-clear');
    this.catalog=section.querySelector('.ability-catalog');
    this.levels={};this.enabled=false;this.rows=[];this.trees=[];this.unseen=new Set();
    this.open=false;this.highlights=new Set();this.seenFrame=0;
    this.abort=new AbortController();
    this.groups={trees:section.querySelector('#ability-trees'),rares:section.querySelector('#ability-rares')};
    this.groups.rares.append(...THREE_TOUCH_RARES.map(ability=>this.makeRow(ability)));
    this.setProgression(BASE_TREES,[]);
    const options={signal:this.abort.signal};
    // A desktop tree is seen only after its heading actually enters the scroll viewport.
    this.catalog.addEventListener('scroll',()=>this.scheduleSeen(),options);
    section.closest('#launcher').addEventListener('scroll',()=>this.scheduleSeen(),options);
    window.addEventListener('resize',()=>this.scheduleSeen(),options);
    document.addEventListener('visibilitychange',()=>this.scheduleSeen(),options);
    this.catalog.addEventListener('click',event=>this.select(event),{signal:this.abort.signal});
    this.clear.addEventListener('click',()=>{if(this.enabled)this.callbacks.clear();},{signal:this.abort.signal});
    this.refresh();
  }

  makeRow(ability) {
    const row=document.createElement('div'), name=document.createElement('h4'), description=document.createElement('p');
    row.className='ability-row';row.dataset.ability=ability.id;
    name.textContent=ability.name;
    const mark=document.createElement('span');mark.className='unlock-mark';mark.textContent='?';
    mark.setAttribute('role','img');mark.setAttribute('aria-label','Newly unlocked');mark.hidden=true;
    const controls=document.createElement('div');controls.className='ability-controls';
    controls.setAttribute('role','group');controls.setAttribute('aria-label',ability.name);
    const makeButton=(text,accessibility)=>{
      const item=document.createElement('button');item.className='ability-choice';item.type='button';
      item.textContent=text;item.setAttribute('aria-label',accessibility);return item;
    };
    const record={row,ability,name,mark,description,buttons:[],value:null};
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
    row.append(name,mark,description,controls);this.rows.push(record);
    return row;
  }

  select(event) {
    const button=event.target.closest('button'), row=button?.closest('[data-ability]');
    if(!this.enabled||!row||button.disabled)return;
    const ability=this.rows.find(entry=>entry.row===row)?.ability;
    if(!ability)return;
    const level=ability.rare?levelOf(this.levels,ability)+Number(button.dataset.delta):Number(button.dataset.level);
    this.callbacks.change(ability.id,level);
  }

  setEnabled(enabled) {
    const next=!!enabled;
    if(next===this.enabled)return;
    this.enabled=next;this.opener.disabled=!next;this.refresh();
  }

  setLevels(levels) {this.levels=levels;this.refresh();}

  setProgression(trees,unseenIds) {
    const rosterChanged=trees.length!==this.trees.length||trees.some((ability,i)=>ability!==this.trees[i]);
    const unseen=new Set(unseenIds);
    if(!rosterChanged&&unseen.size===this.unseen.size&&[...unseen].every(id=>this.unseen.has(id)))return;
    if(rosterChanged){
      this.trees=trees;
      this.rows=this.rows.filter(record=>record.ability.rare);
      this.groups.trees.replaceChildren(...trees.map(ability=>this.makeRow(ability)));
    }
    this.unseen=unseen;
    for(const id of this.unseen)if(this.open)this.highlights.add(id);
    this.opener.dataset.new=String(this.unseen.size>0);
    this.opener.querySelector('.unlock-mark').hidden=!this.unseen.size;
    this.refresh();this.scheduleSeen();
  }

  setOpen(open) {
    if(this.open===open)return;
    this.open=open;this.highlights=new Set(open?this.unseen:[]);
    this.refresh();
    if(open){
      const first=this.rows.find(record=>this.unseen.has(record.ability.id));
      if(first)first.row.scrollIntoView({block:'nearest'});
      this.scheduleSeen();
    }
  }

  scheduleSeen() {
    if(!this.open||!this.unseen.size||this.seenFrame)return;
    this.seenFrame=requestAnimationFrame(()=>{
      this.seenFrame=0;
      if(!this.open||!this.enabled||document.hidden||!this.section.getClientRects().length)return;
      const box=this.catalog.getBoundingClientRect(),seen=[];
      for(const record of this.rows){
        if(!this.unseen.has(record.ability.id))continue;
        const heading=record.name.getBoundingClientRect();
        if(heading.height>0&&heading.top>=Math.max(box.top,0)-1&&heading.bottom<=Math.min(box.bottom,innerHeight)+1)seen.push(record.ability.id);
      }
      if(seen.length)this.callbacks.seen?.(seen);
    });
  }

  refresh() {
    const count=this.rows.filter(record=>levelOf(this.levels,record.ability)>0).length;
    this.count.textContent=count?`${count} equipped`:'None equipped';
    this.clear.disabled=!this.enabled||count===0;
    for(const {row,ability,mark,description,buttons,value} of this.rows) {
      const level=levelOf(this.levels,ability);
      mark.hidden=!this.highlights.has(ability.id);
      row.dataset.new=String(!mark.hidden);
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

  dispose() {cancelAnimationFrame(this.seenFrame);this.abort.abort();}
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

function drawAbilitySwitcher(canvas,pages,page,levels,hover,highlights) {
  panel(canvas,960,660);brand(canvas,48,58);tracked(canvas,'FREEROAM',731,58,18,UI.mint,2);
  canvas.fillStyle=UI.line;canvas.fillRect(48,106,864,1);
  const section=pages[page],rare=!!section[0].rare;
  label(canvas,rare?'Rare upgrades':'Ability trees',48,139,30,rare?UI.lilac:UI.white,'left',800);
  label(canvas,rare?'Each copy adds another bonus.':'A phase includes the phases before it.',48,172,22,UI.muted);
  label(canvas,`${page+1} / ${pages.length}`,912,139,22,UI.mint,'right');
  const buttons=[];
  const add=(specification,selected=false,primary=false)=>{
    buttons.push(specification);
    canvas.save();if(specification.disabled)canvas.globalAlpha=.34;
    button(canvas,specification,{hover:hover===specification.id&&!specification.disabled,selected,primary});
    canvas.restore();
  };

  for(const [index,ability] of section.entries()) {
    const y=192+index*102, level=levelOf(levels,ability);
    shape(canvas,48,y,864,96,12);canvas.fillStyle=level?'#102635':UI.panel;canvas.fill();
    const isNew=highlights.has(ability.id);
    canvas.strokeStyle=isNew?UNLOCK_GOLD:level?'#52736f':UI.line;canvas.lineWidth=isNew?2.5:1.5;canvas.stroke();
    if(isNew)drawUnlockMark(canvas,499,y+27);
    label(canvas,ability.name,66,y+26,26,rare?UI.lilac:UI.white,'left',800);
    let size=20;
    const detail=abilityDescription(ability,level);
    canvas.font=`550 ${size}px Arial, "Liberation Sans", sans-serif`;
    let description=wrap(canvas,detail,440);
    if(description.length>2){
      size=18;canvas.font=`550 ${size}px Arial, "Liberation Sans", sans-serif`;
      description=wrap(canvas,detail,440);
    }
    const firstLine=description.length>2?48:53;
    for(const [line,text] of description.entries())label(canvas,text,66,y+firstLine+line*size,size,UI.muted,'left',550);

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
  add({id:'ability-page-next',label:'›',x:404,y:520,w:94,h:66,disabled:page===pages.length-1});
  add({id:'abilities-clear',label:'Clear all',x:690,y:520,w:222,h:66,disabled:!pages.some(items=>items.some(ability=>levelOf(levels,ability)>0))});
  label(canvas,'Trigger  Select',48,615,20,UI.muted);label(canvas,'Y  Menu',912,615,20,UI.muted,'right');
  return buttons;
}

function drawUnlockMark(c,x,y){
  c.beginPath();c.arc(x,y,13,0,Math.PI*2);
  c.fillStyle='#322b20';c.fill();c.strokeStyle=UNLOCK_GOLD;c.lineWidth=1.5;c.stroke();
  label(c,'?',x,y+1,19,UNLOCK_GOLD,'center',800);
}

export {FootballAbilitySwitcher,drawAbilitySwitcher,abilityPages,drawUnlockMark,BASE_TREES,UNLOCK_GOLD};
