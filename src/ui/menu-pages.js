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
    this.settingsFirst=document.querySelector('#turn-speed');
    this.creditsTitle=document.querySelector('#credits-title');
    this.abilitiesTitle=document.querySelector('#abilities-title');
    this.page='main';

    this.settingsButton.addEventListener('click',()=>navigate('settings'));
    this.creditsButton.addEventListener('click',()=>navigate('credits'));
    this.abilitiesButton.addEventListener('click',()=>navigate('abilities'));
    document.querySelector('#settings-back').addEventListener('click',()=>navigate('main'));
    document.querySelector('#credits-back').addEventListener('click',()=>navigate('settings'));
    document.querySelector('#abilities-back').addEventListener('click',()=>navigate('settings'));
    this.settingsButton.disabled=false;
  }

  setPage(page,focus=true) {
    if(!Object.hasOwn(this.sections,page))return;
    const previous=this.page;
    this.page=page;
    for(const [name,section] of Object.entries(this.sections))section.hidden=name!==page;
    this.settingsButton.setAttribute('aria-expanded',String(page==='settings'));
    this.creditsButton.setAttribute('aria-expanded',String(page==='credits'));
    this.abilitiesButton.setAttribute('aria-expanded',String(page==='abilities'));
    this.launcher.dataset.page=page;

    if(focus&&!this.launcher.hidden){
      const settingsFocus={credits:this.creditsButton,abilities:this.abilitiesButton}[previous]??this.settingsFirst;
      const target={main:this.settingsButton,settings:settingsFocus,credits:this.creditsTitle,abilities:this.abilitiesTitle};
      target[page].focus();
    }
  }

  get backPage() {return this.page==='credits'||this.page==='abilities'?'settings':'main';}
}

export { FootballMenuPages };
