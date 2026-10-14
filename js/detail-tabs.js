export function initializeDetailTabs(root){
  const tablist=root.querySelector('[role="tablist"]');
  const tabs=[...tablist.querySelectorAll('[role="tab"]')];
  const panels=tabs.map(tab=>document.getElementById(tab.getAttribute('aria-controls')));
  const keys=tabs.map(tab=>tab.id.slice('tab-'.length));
  function select(index,{focus=false,remember=false,scroll=false}={}){
    const previousPanel=panels.find(panel=>!panel.hidden);
    const restoreFocus=previousPanel?.contains(document.activeElement)&&previousPanel!==panels[index];
    tabs.forEach((tab,i)=>{
      const selected=i===index;
      tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;panels[i].hidden=!selected;
    });
    if(remember){
      const url=new URL(location.href);url.hash=keys[index];
      if(url.href!==location.href)history.pushState(history.state,'',url);
    }
    if(focus||restoreFocus)tabs[index].focus({preventScroll:true});
    if(scroll)tablist.scrollIntoView({block:'nearest'});
  }
  function fromLocation(){
    // Back/Forward can happen while a modal makes the tabs inert. Keep its
    // panel visible until it closes, then apply the latest requested tab.
    if(document.querySelector('dialog[open]'))return;
    const index=keys.indexOf(location.hash.slice(1));select(index<0?0:index);
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>select(index,{remember:true,scroll:true}));
    tab.addEventListener('keydown',event=>{
      const next={ArrowRight:(index+1)%tabs.length,ArrowLeft:(index+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[event.key];
      if(next===undefined)return;
      event.preventDefault();select(next,{focus:true,remember:true,scroll:true});
    });
  });
  window.addEventListener('popstate',fromLocation);window.addEventListener('hashchange',fromLocation);
  document.addEventListener('close',fromLocation,true);
  fromLocation();
}
