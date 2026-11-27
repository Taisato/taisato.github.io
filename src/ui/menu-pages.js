// Launcher pages are available before the graphics and sound finish loading.
class FootballMenuPages {
  constructor(navigate) {
    this.launcher=document.querySelector('#launcher');
    this.sections={
      main:document.querySelector('#menu-main'),
      settings:document.querySelector('#settings-page'),
      credits:document.querySelector('#credits-page')
    };
    this.settingsButton=document.querySelector('#settings');
    this.creditsButton=document.querySelector('#credits');
    this.settingsFirst=document.querySelector('#turn-speed');
    this.creditsTitle=document.querySelector('#credits-title');
    this.page='main';

    this.settingsButton.addEventListener('click',()=>navigate('settings'));
    this.creditsButton.addEventListener('click',()=>navigate('credits'));
    document.querySelector('#settings-back').addEventListener('click',()=>navigate('main'));
    document.querySelector('#credits-back').addEventListener('click',()=>navigate('settings'));
    this.settingsButton.disabled=false;
  }

  setPage(page,focus=true) {
    const previous=this.page;
    this.page=page;
    for(const [name,section] of Object.entries(this.sections))section.hidden=name!==page;
    this.settingsButton.setAttribute('aria-expanded',String(page==='settings'));
    this.creditsButton.setAttribute('aria-expanded',String(page==='credits'));
    this.launcher.dataset.page=page;

    if(focus&&!this.launcher.hidden){
      const settingsFocus=previous==='credits'?this.creditsButton:this.settingsFirst;
      const target=page==='main'?this.settingsButton:page==='credits'?this.creditsTitle:settingsFocus;
      target.focus();
    }
  }
}

export { FootballMenuPages };
