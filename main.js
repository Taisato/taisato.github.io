import { FootballMenuPages } from './ui/menu-pages.js';

export let footballApp=null;
const pages=new FootballMenuPages((page,category)=>{
  if(footballApp)footballApp.setMenuPage(page,true,category);
  else pages.setPage(page,true,category);
});
window.addEventListener('keydown',event=>{
  if(footballApp||event.code!=='Escape'||pages.page==='main')return;
  pages.setPage(pages.backPage);
  event.preventDefault();
});

// Play waits for the assets, while launcher navigation is ready immediately.
async function bootstrap(){
  const status=document.querySelector('#status');
  const desktop=document.querySelector('#desktop');
  const enter=document.querySelector('#enter-vr');
  desktop.disabled=true;enter.disabled=true;
  status.textContent='Loading…';
  try{
    const [{FootballApp},{FootballKeeperMeshes},{FootballAudio}]=await Promise.all([
      import('./app.js'),import('./keeper/meshes.js'),import('./audio.js')
    ]);
    await Promise.all([FootballKeeperMeshes.load(),FootballAudio.load()]);
    status.textContent='';
    footballApp=new FootballApp(pages);
    desktop.disabled=false;
    return footballApp;
  }catch(error){
    console.error('Football initialization failed',error);
    status.textContent='Could not load. Reload.';
    desktop.disabled=true;enter.disabled=true;
    return null;
  }
}
export const ready=bootstrap();
