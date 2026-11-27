// Launcher pages are available before the graphics and sound finish loading.
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
    this.page='main';

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

  setPage(page,focus=true,category) {
    if(!Object.hasOwn(this.sections,page))return;
    const previous=this.page;
    if(page==='settings'){
      this.category=category??({credits:'other',abilities:'gameplay',main:'graphics'}[previous]??this.category);
      for(const tab of this.tabs){
        const active=tab.dataset.settingsCategory===this.category;
        tab.setAttribute('aria-selected',String(active));
        tab.tabIndex=active?0:-1;
        document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;
      }
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

export { FootballMenuPages };
