// Assets finish loading before play and Settings become available.
export let footballApp=null;
async function bootstrap(){
  const status=document.querySelector('#status');
  const desktop=document.querySelector('#desktop');
  const enter=document.querySelector('#enter-vr');
  const settings=document.querySelector('#settings');
  desktop.disabled=true;enter.disabled=true;settings.disabled=true;
  status.textContent='Loading…';
  try{
    const [{FootballApp},{FootballKeeperMeshes},{FootballAudio}]=await Promise.all([
      import('./app.js'),import('./keeper/meshes.js'),import('./audio.js')
    ]);
    await Promise.all([FootballKeeperMeshes.load(),FootballAudio.load()]);
    status.textContent='';
    footballApp=new FootballApp();
    desktop.disabled=false;settings.disabled=false;
    return footballApp;
  }catch(error){
    console.error('Football initialization failed',error);
    status.textContent='Could not load. Reload.';
    desktop.disabled=true;enter.disabled=true;settings.disabled=true;
    return null;
  }
}
export const ready=bootstrap();
