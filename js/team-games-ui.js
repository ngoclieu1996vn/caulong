import {drawNext,teamsFromOrder,createMixedTeams,createMatchups,resolveGameParticipants,isGameCurrent,wheelTargetAngle} from './team-games.js';
import {buildParticipants,rosterFingerprint} from './participants.js';
import {createAvatarButton} from './avatar-preview.js';
import {el,button,dataError} from './ui-elements.js';

export function createTeamGamesController({date,root}) {
  let participants=[],peopleReady=false,loaded=false,active=false,generation=0,unsubscribe,service,checkins;
  let saved=null,remote=null,revision=0,mode='wheel',session=null,order=[],overrides=[],result=null;
  let local=false,stale=false,animating=false,busy=false,error='',angle=0,animation,runToken=0;
  const fingerprint=people=>rosterFingerprint(people,{includeGender:true});
  const tools=el('div','day-tools game-tools');
  const wheelIcon=button('◉',()=>open('wheel'));
  const mixedIcon=button('⚄',()=>open('mixed'));
  for(const [icon,label] of [[wheelIcon,'Vòng quay'],[mixedIcon,'Chia đội ngẫu nhiên']]) {
    icon.setAttribute('aria-label',label);icon.title=label;icon.setAttribute('aria-controls','games-panel');icon.setAttribute('aria-expanded','false');
    const text=el('span','tool-caption',label);icon.append(text);
  }
  tools.append(wheelIcon,mixedIcon);
  const panel=el('section','day-panel games-panel');panel.id='games-panel';panel.hidden=true;panel.setAttribute('aria-label','Trò chơi chia đội');
  const heading=el('h2'),description=el('p','panel-note');
  const genderList=el('div','game-genders');
  const wheel=el('div','wheel-stage'),pointer=el('span','wheel-pointer','▼');pointer.setAttribute('aria-hidden','true');
  const canvas=el('canvas','team-wheel');canvas.width=520;canvas.height=520;canvas.setAttribute('aria-label','Vòng quay những người chưa được chọn');canvas.setAttribute('role','img');
  // Clip the rotating square canvas inside a disc; keep the pointer outside it.
  const disc=el('div','wheel-disc');disc.append(canvas);wheel.append(disc,pointer);
  const shuffleStage=el('div','shuffle-stage');shuffleStage.setAttribute('aria-hidden','true');
  const drawList=el('ol','draw-order');drawList.id='draw-order';drawList.setAttribute('aria-label','Thứ tự người đã quay');
  const history=el('details','wheel-history');
  history.append(el('summary',null,'Xem thứ tự quay'),drawList);
  const controls=el('div','panel-actions');
  const drawButton=button('Quay',draw,'button button-primary wheel-spin-button'),mixedButton=button('Chia đội',mix,'button button-primary');
  wheel.append(drawButton);
  drawButton.addEventListener('keydown',event=>{
    if(event.repeat && ['Enter',' '].includes(event.key))event.preventDefault();
  });
  const restart=button('↻',()=>reset(),'button button-light game-restart');
  restart.setAttribute('aria-label','Bắt đầu lại');restart.title='Bắt đầu lại';
  const gamesHeading=el('div','games-heading');gamesHeading.append(heading,restart);
  const retrySave=button('Thử lưu kết quả',()=>persist());retrySave.hidden=true;
  controls.append(mixedButton,retrySave);
  const message=el('p','panel-status','Đang tải trò chơi…');message.id='games-status';message.setAttribute('role','status');
  const output=el('div','game-result');
  const loadNew=button('Tải kết quả mới',()=>{if(remote){apply(remote);remote=null;error='';render();drawWheel();}});loadNew.hidden=true;
  const retry=button('Kết nối lại trò chơi',()=>{stop();start();});retry.hidden=true;
  panel.append(el('p','eyebrow','CHƠI VUI · CHIA ĐỘI'),gamesHeading,description,genderList,wheel,shuffleStage,controls,output,history,loadNew,retry);
  root.append(tools,panel,message);

  function open(nextMode) {
    if(animating||busy)return;
    if(mode!==nextMode){mode=nextMode;reset(false);}
    else if(!session&&!result) reset(false);
    panel.hidden=false;
    wheelIcon.setAttribute('aria-expanded',String(mode==='wheel'));mixedIcon.setAttribute('aria-expanded',String(mode==='mixed'));
    render();drawWheel();
  }
  function cancelAnimation(){++runToken;animation?.cancel();animation=undefined;animating=false;shuffleStage.classList.remove('is-shuffling');}
  function reset(markLocal=true) {
    cancelAnimation();session=null;order=[];result=null;local=markLocal;stale=false;error='';angle=0;
    history.open=false;
    overrides=overrides.filter(o=>participants.some(p=>p.id===o.id&&p.version===o.version));
    render();drawWheel();
  }
  function resolved(){return resolveGameParticipants(session?.participants??participants,overrides);}
  function remaining(){return resolved().filter(p=>!order.includes(p.id));}
  function begin(){
    if(!session){session={participants:structuredClone(participants),sourceFingerprint:fingerprint(participants)};local=true;}
    error='';
  }
  function refresh() {
    updateWheelPresentation();
    const blocked=!peopleReady||!participants.length||busy||animating;
    wheelIcon.disabled=blocked;mixedIcon.disabled=blocked;
    drawButton.disabled=blocked||!loaded||stale||Boolean(result)||!remaining().length;
    mixedButton.disabled=blocked||!loaded||stale||Boolean(result)||resolved().some(p=>!p.gender);
    restart.disabled=busy||animating||!peopleReady||!participants.length;
    retrySave.hidden=!(error&&result&&local&&!stale);retrySave.disabled=busy||animating||!loaded;
    controls.hidden=mode==='wheel'&&retrySave.hidden;
    loadNew.hidden=!remote;loadNew.disabled=busy||animating;
    retry.hidden=!error||loaded;retry.disabled=busy;
    for(const select of genderList.querySelectorAll('select'))select.disabled=busy||animating;
    const text=error || (busy?'Đang lưu kết quả, chờ Firebase xác nhận…':stale?'Danh sách đã thay đổi — chia lại đội. Nhấn Bắt đầu lại.':
      animating?'Đang xáo trộn…':remote?'Kết quả đã được sửa từ thiết bị khác. Hãy tải kết quả mới.':
      !loaded?'Đang tải trò chơi…':!participants.length?'Check-in trước để bắt đầu trò chơi.':result&&!local?'Đã lưu kết quả chia đội.':
      order.length?`Đã chọn ${order.length}/${participants.length} người. Hai người liên tiếp thành một đội.`:'Chọn trò chơi và bắt đầu chia đội.');
    message.textContent=text;message.classList.toggle('is-error',Boolean(error));
    root.dataset.state=stale?'stale':animating?'animating':busy?'saving':result?'completed':'idle';
  }
  function updateWheelPresentation() {
    const completed=mode==='wheel'&&Boolean(result);
    wheel.hidden=mode!=='wheel'||completed;
    drawButton.hidden=mode!=='wheel'||completed;
    history.hidden=mode!=='wheel'||!order.length;
    panel.classList.toggle('is-wheel-complete',completed);
  }
  function renderGenders() {
    genderList.replaceChildren();
    genderList.hidden=mode!=='mixed';
    if(mode!=='mixed')return;
    for(const person of participants){
      const row=el('div','game-gender-row');row.append(el('span',null,person.name));
      if(person.gender) row.append(el('span','gender-badge',person.gender));
      else {
        const label=el('label','cost-field',`Giới tính của ${person.name}`),select=el('select','gender-select');
        for(const [value,text] of [['','Chọn giới tính'],['Nam','Nam'],['Nữ','Nữ']]){const option=el('option',null,text);option.value=value;select.append(option);}
        select.value=overrides.find(o=>o.id===person.id&&o.version===person.version)?.gender??'';
        select.addEventListener('change',()=>{
          overrides=overrides.filter(o=>o.id!==person.id);
          if(select.value)overrides.push({id:person.id,version:person.version,gender:select.value});
          local=true;result=null;error='';renderOutput();refresh();
        });label.append(select);row.append(label);
      }
      genderList.append(row);
    }
  }
  function renderTeamCard(team,pending=false) {
    const card=el('article',`game-team${pending?' is-awaiting':''}`);card.dataset.kind=pending?'pending':team.kind;
    const kind=pending?'Chờ đồng đội':team.kind==='single'?'Đội đơn':team.kind==='mixed'?'Nam – Nữ':team.members.every(p=>p.gender)?'Cùng giới':'Đội đôi';
    card.append(el('h4',null,`Đội ${team.id.split('-').at(-1)}`),el('span','team-kind',kind));
    for(const person of team.members){
      const row=el('div','team-person');
      row.append(createAvatarButton(person.avatar,person.name,40),el('span',null,person.name));card.append(row);
    }
    if(pending){
      const slot=el('div','team-person team-pending-slot'),mark=el('span','pending-avatar','?');
      mark.setAttribute('aria-hidden','true');slot.append(mark,el('span',null,'Chờ lượt quay tiếp theo'));card.append(slot);
    }
    return card;
  }
  function renderOutput() {
    const focusResult=Boolean(result)&&document.activeElement===drawButton;
    const people=session?.participants??result?.participants??participants;
    drawList.replaceChildren(...order.map((id,index)=>{
      const person=people.find(p=>p.id===id);
      const row=el('li',null,`Đội ${Math.floor(index/2)+1} · ${person?.name??id}`);row.dataset.personId=id;return row;
    }));
    updateWheelPresentation();
    output.replaceChildren();
    if(!result && (mode!=='wheel'||!order.length))return;
    if(stale)output.append(el('p','stale-label','Kết quả cũ — cần chia lại theo danh sách hiện tại.'));
    if(result&&mode==='wheel'){
      const summary=el('div','wheel-results-summary'),mark=el('span','results-mark','✓'),info=el('div');
      mark.setAttribute('aria-hidden','true');
      info.append(el('h3',null,'Kết quả vòng quay'),el('p',null,`${result.participants.length} người · ${result.teams.length} đội · ${result.matchups.length} cặp đấu`));
      summary.append(mark,info);output.append(summary);
    }
    output.append(el('h3',null,result?'Các đội đã ghép':'Đội đang ghép'));
    const teams=el('div','game-teams');
    const drawnTeams=result?.teams??teamsFromOrder(resolved().filter(p=>order.includes(p.id)),order);
    for(const team of drawnTeams){
      teams.append(renderTeamCard(team,!result&&team.members.length===1));
    }
    output.append(teams);
    if(!result)return;
    output.append(el('h3',null,'Cặp đấu gợi ý'));
    const label=id=>`Đội ${id.split('-').at(-1)}`;
    for(const match of result.matchups)output.append(el('p','game-match',`${label(match.teamIds[0])}  ×  ${label(match.teamIds[1])}`));
    for(const id of result.waitingTeamIds)output.append(el('p','game-waiting',`${label(id)} · Chờ lượt`));
    if(focusResult){const title=output.querySelector('h3');title.tabIndex=-1;title.focus({preventScroll:true});}
  }
  function render() {
    heading.textContent=mode==='wheel'?'Vòng quay may mắn':'Chia đội ngẫu nhiên';
    restart.textContent=mode==='wheel'?'↻':'Bắt đầu lại';
    restart.classList.toggle('game-restart',mode==='wheel');
    if(mode==='wheel'&&restart.parentElement!==gamesHeading)gamesHeading.append(restart);
    else if(mode!=='wheel'&&restart.parentElement!==controls)controls.insertBefore(restart,retrySave);
    description.textContent=mode==='wheel'?'Quay từng người, hai lượt liên tiếp thành một đội. Người lẻ vẫn có đội riêng.':
      'Ưu tiên nam – nữ tối đa. Người dư ghép cùng giới, người lẻ thành đội riêng.';
    shuffleStage.hidden=mode!=='mixed';mixedButton.hidden=mode!=='mixed';
    shuffleStage.replaceChildren(...participants.map((p,i)=>{const chip=el('span','shuffle-chip',p.name);chip.style.setProperty('--i',i);return chip;}));
    renderGenders();renderOutput();refresh();
  }
  function drawWheel() {
    const people=remaining(),context=canvas.getContext('2d'),size=canvas.width,radius=size/2;
    angle=0;canvas.style.transform='rotate(0deg)';canvas.dataset.angle='0';context.clearRect(0,0,size,size);
    if(!people.length){context.fillStyle='#e8efdf';context.beginPath();context.arc(radius,radius,radius-5,0,Math.PI*2);context.fill();return;}
    const colors=['#245c45','#d8ab66','#87a88b','#d4dfbd','#66846d','#efdcb8'];
    people.forEach((person,index)=>{
      const start=-Math.PI/2+index*Math.PI*2/people.length,end=start+Math.PI*2/people.length;
      context.beginPath();context.moveTo(radius,radius);context.arc(radius,radius,radius-5,start,end);context.closePath();
      context.fillStyle=colors[index%colors.length];context.fill();context.strokeStyle='#fff';context.lineWidth=3;context.stroke();
      context.save();context.translate(radius,radius);context.rotate((start+end)/2);
      context.fillStyle=index%colors.length===0?'#fff':'#183d2b';context.textAlign='right';context.font='bold 20px system-ui';
      context.fillText(person.name.length>17?person.name.slice(0,16)+'…':person.name,radius-27,6);context.restore();
    });
    canvas.setAttribute('aria-label',`Người chưa chọn: ${people.map(p=>p.name).join(', ')}`);
  }
  async function animate(target,wheelMode) {
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    // A disabled button can reset the browser's click count. Keep one activation
    // locked through the double-click interval, even when there is no motion.
    const duration=reduced?500:wheelMode?2200:1700;
    const stationary=wheelMode?{transform:`rotate(${target}deg)`}:{transform:'none',opacity:1};
    animation=(wheelMode?canvas:shuffleStage).animate(reduced?[stationary,stationary]:wheelMode?
      [{transform:`rotate(${angle}deg)`},{transform:`rotate(${target}deg)`}]:
      [{transform:'scale(.96)',opacity:.5},{transform:'scale(1.02)',opacity:1},{transform:'scale(1)',opacity:1}],
      {duration,easing:'cubic-bezier(.12,.7,.12,1)',fill:'forwards'});
    await animation.finished;
    if(wheelMode){angle=target;canvas.style.transform=`rotate(${angle}deg)`;canvas.dataset.angle=String(angle);}
    animation.cancel();animation=undefined;
  }
  async function draw(event) {
    if(event?.detail>1 || drawButton.disabled||animating||busy)return;
    begin();drawWheel();const people=remaining(),drawn=drawNext(people),index=people.findIndex(p=>p.id===drawn.selected.id);
    animating=true;const token=++runToken;refresh();
    try{
      if(people.length>1)await animate(wheelTargetAngle(angle,people.length,index),true);
      if(token!==runToken)return;
      order.push(drawn.selected.id);
      // The final remaining participant is already determined; include them
      // without requiring a separate click or playing another spin animation.
      if(drawn.remaining.length===1)order.push(drawn.remaining[0].id);
      animating=false;
      if(order.length===session.participants.length){
        result=complete(teamsFromOrder(resolved(),order));renderOutput();await persist();
      }else renderOutput();
    }catch(e){if(token===runToken)error=dataError(e);}
    finally{if(token===runToken){animating=false;refresh();}}
  }
  function complete(teams) {
    return {mode,participants:resolved(),sourceFingerprint:session.sourceFingerprint,genderOverrides:structuredClone(overrides),drawOrder:[...order],...createMatchups(teams)};
  }
  async function mix() {
    if(mixedButton.disabled||animating||busy)return;
    begin();const selected=complete(createMixedTeams(resolved()));
    animating=true;shuffleStage.classList.add('is-shuffling');const token=++runToken;refresh();
    try{
      await animate(0,false);
      if(token!==runToken)return;
      animating=false;shuffleStage.classList.remove('is-shuffling');result=selected;renderOutput();await persist();
    }catch(e){if(token===runToken)error=dataError(e);}
    finally{if(token===runToken){animating=false;shuffleStage.classList.remove('is-shuffling');refresh();}}
  }
  async function persist() {
    if(busy||!result||stale)return;
    busy=true;error='';refresh();const payload={schemaVersion:1,...structuredClone(result)},expected=revision;
    try{
      if(!navigator.onLine)throw new Error('Bạn đang ngoại tuyến. Kết quả chưa lưu.');
      const fresh=buildParticipants(await checkins.readDayCheckins(date));
      if(payload.sourceFingerprint!==fingerprint(fresh) || payload.sourceFingerprint!==fingerprint(participants))throw new Error('Danh sách đã thay đổi. Hãy bắt đầu lại.');
      const next=await service.saveTeamGame(date,payload,expected);
      const newer=remote&&remote.revision>next?remote:null;
      saved={...payload,revision:next};revision=next;local=false;remote=newer;
      stale=!isGameCurrent(saved,participants);
      if(newer)error='Kết quả đã được sửa từ thiết bị khác. Hãy tải kết quả mới.';
    }catch(e){error=dataError(e);}
    finally{busy=false;refresh();}
  }
  function apply(document) {
    saved=document;revision=document?.revision??0;result=document;order=[...(document?.drawOrder??[])];overrides=structuredClone(document?.genderOverrides??[]);
    if(document){mode=document.mode;panel.hidden=false;}
    stale=Boolean(document&&peopleReady&&!isGameCurrent(document,participants));local=false;session=null;
  }
  async function start() {
    if(active)return;active=true;const token=++generation;error='';refresh();
    try{
      [service,checkins]=await Promise.all([import('./team-games-service.js'),import('./checkin-service.js')]);
      if(!active||token!==generation)return;
      unsubscribe=service.watchTeamGame(date,snapshot=>{
        if(!active||token!==generation||snapshot.fromCache)return;
        loaded=true;
        if(local||busy||animating){if((snapshot.data?.revision??0)!==revision)remote=snapshot.data;refresh();return;}
        remote=null;apply(snapshot.data);error='';render();drawWheel();
      },e=>{if(active&&token===generation){loaded=false;error=dataError(e);refresh();}});
    }catch(e){if(active&&token===generation){error=dataError(e);refresh();}}
  }
  function stop(){active=false;++generation;unsubscribe?.();unsubscribe=undefined;cancelAnimation();}
  function setParticipants(next,{ready}) {
    const wasReady=peopleReady;
    const changed=fingerprint(next)!==fingerprint(participants);participants=next;peopleReady=ready;
    if(changed && session && session.sourceFingerprint!==fingerprint(next)){
      cancelAnimation();session=null;order=[];result=null;stale=true;error='';
    }else if(result && ready && (changed||!wasReady))stale=!isGameCurrent(result,next);
    if(changed||ready!==wasReady){render();if(!animating)drawWheel();}else refresh();
  }
  render();drawWheel();return {start,stop,setParticipants};
}
