// Launcher pages are available before the graphics and sound finish loading.
const PROGRESS_ACTIONS=Object.freeze({
  'unlock-all':{
    question:'Unlock all abilities?',confirm:'Unlock all',done:'All abilities unlocked.',
    lines:['Unlock every tree and rare upgrade for drafts and Freeroam.','Your high score stays the same.']
  },
  'reset-progress':{
    question:'Reset your progress?',confirm:'Reset progress',done:'Progress reset.',
    lines:['Clear your high score, unlocks and Freeroam loadout.','Any active 3 Touch run will restart.','Your settings and calibration stay saved.']
  }
});

class FootballMenuPages {
  constructor(navigate) {
    this.launcher=document.querySelector('#launcher');
    this.sections={
      main:document.querySelector('#menu-main'),
      settings:document.querySelector('#settings-page'),
      credits:document.querySelector('#credits-page'),
      abilities:document.querySelector('#abilities-page')
    };
    this.settingsButton=document.querySelector('#settings');
    this.creditsButton=document.querySelector('#credits');
    this.abilitiesButton=document.querySelector('#abilities');
    this.tabs=[...document.querySelectorAll('[data-settings-category]')];
    this.category='graphics';
    this.creditsTitle=document.querySelector('#credits-title');
    this.abilitiesTitle=document.querySelector('#abilities-title');
    this.highScores=this.launcher.querySelectorAll('[data-high-score]');
    this.page='main';
    this.progressButtons=[...document.querySelectorAll('#other-options .progress-actions button')];
    this.otherOptions=document.querySelector('#other-options');
    this.progressPrompt=document.querySelector('#progress-prompt');
    this.progressTitle=document.querySelector('#progress-title');
    this.progressDescription=document.querySelector('#progress-description');
    this.progressCancel=document.querySelector('#progress-cancel');
    this.progressConfirm=document.querySelector('#progress-confirm');
    this.progressStatus=document.querySelector('#progress-status');
    this.pendingProgress=null;this.progressHandler=null;
    for(const button of this.progressButtons)button.addEventListener('click',()=>this.openProgressPrompt(button.id));
    this.progressCancel.addEventListener('click',()=>this.closeProgressPrompt(true));
    this.progressConfirm.addEventListener('click',()=>{
      const action=this.pendingProgress;
      if(!action||!this.progressHandler||this.page!=='settings'||this.category!=='other')return;
      this.closeProgressPrompt(true);
      this.progressHandler(action);
      if(this.page==='settings'&&this.category==='other')this.progressStatus.textContent=PROGRESS_ACTIONS[action].done;
    });

    this.settingsButton.addEventListener('click',()=>navigate('settings'));
    this.creditsButton.addEventListener('click',()=>navigate('credits'));
    this.abilitiesButton.addEventListener('click',()=>navigate('abilities'));
    document.querySelector('#settings-back').addEventListener('click',()=>navigate('main'));
    document.querySelector('#credits-back').addEventListener('click',()=>navigate('settings'));
    document.querySelector('#abilities-back').addEventListener('click',()=>navigate('settings'));
    this.tabs.forEach((tab,index)=>{
      tab.addEventListener('click',()=>navigate('settings',tab.dataset.settingsCategory));
      tab.addEventListener('keydown',event=>{
        const count=this.tabs.length;
        const next={ArrowLeft:(index+count-1)%count,ArrowRight:(index+1)%count,Home:0,End:count-1}[event.key];
        if(next===undefined)return;
        event.preventDefault();
        event.stopPropagation();
        navigate('settings',this.tabs[next].dataset.settingsCategory);
      });
    });
    this.settingsButton.disabled=false;
  }

  setHighScore(score) {
    for(const element of this.highScores)element.textContent=String(score);
  }

  set onProgressAction(handler) {
    this.progressHandler=handler;
    for(const button of this.progressButtons)button.disabled=!handler;
  }

  openProgressPrompt(action) {
    if(!this.progressHandler||this.page!=='settings'||this.category!=='other')return;
    const info=PROGRESS_ACTIONS[action];
    this.pendingProgress=action;this.progressStatus.textContent='';
    this.progressTitle.textContent=info.question;
    this.progressDescription.textContent=info.lines.join(' ');
    this.progressConfirm.textContent=info.confirm;
    this.progressPrompt.dataset.action=action;
    this.otherOptions.hidden=true;this.progressPrompt.hidden=false;
    this.progressCancel.focus();
  }

  closeProgressPrompt(focus=false) {
    const action=this.pendingProgress;
    this.pendingProgress=null;this.progressPrompt.hidden=true;this.otherOptions.hidden=false;
    if(focus&&action)document.getElementById(action).focus();
  }

  setPage(page,focus=true,category) {
    if(!Object.hasOwn(this.sections,page))return;
    const previous=this.page,lastCategory=this.category;
    if(page==='settings'){
      this.category=category??({credits:'other',abilities:'gameplay',main:'graphics'}[previous]??this.category);
      for(const tab of this.tabs){
        const active=tab.dataset.settingsCategory===this.category;
        tab.setAttribute('aria-selected',String(active));
        tab.tabIndex=active?0:-1;
        document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;
      }
    }
    if(page!==previous||this.category!==lastCategory){
      this.closeProgressPrompt();this.progressStatus.textContent='';
    }
    this.page=page;
    for(const [name,section] of Object.entries(this.sections))section.hidden=name!==page;
    this.settingsButton.setAttribute('aria-expanded',String(page==='settings'));
    this.creditsButton.setAttribute('aria-expanded',String(page==='credits'));
    this.abilitiesButton.setAttribute('aria-expanded',String(page==='abilities'));
    this.launcher.dataset.page=page;

    if(focus&&!this.launcher.hidden){
      const activeTab=this.tabs.find(tab=>tab.dataset.settingsCategory===this.category);
      const settingsFocus={credits:this.creditsButton,abilities:this.abilitiesButton}[previous]??activeTab;
      const target={main:this.settingsButton,settings:settingsFocus,credits:this.creditsTitle,abilities:this.abilitiesTitle};
      target[page].focus();
    }
  }

  get backPage() {return this.page==='credits'||this.page==='abilities'?'settings':'main';}
}

export { FootballMenuPages, PROGRESS_ACTIONS };
