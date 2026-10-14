import { createBillingInput, reconcileHours, calculateTotals, calculateBill, isBillingCurrent, formatMoney } from './billing.js';
import { buildParticipants, rosterFingerprint } from './participants.js';
import { createAvatarButton } from './avatar-preview.js';
import { el, button, numberField, dataError } from './ui-elements.js';

export function createBillingController({date,root,onAllocationsChange}) {
  let participants=[],peopleReady=false,loaded=false,active=false,generation=0,unsubscribe;
  let service,checkins,saved=null,remote=null,revision=0,input=createBillingInput([]),dirty=false,stale=false,busy=false,error='';
  const toggle=button('Tính tiền',()=>{
    panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));
  },'button button-primary');
  toggle.id='billing-toggle';toggle.setAttribute('aria-controls','billing-panel');toggle.setAttribute('aria-expanded','false');
  const panel=el('section','day-panel');panel.id='billing-panel';panel.hidden=true;
  panel.setAttribute('aria-label','Chi phí buổi cầu');
  panel.append(el('p','eyebrow','CHI PHÍ BUỔI CẦU'),el('h2',null,'Cùng chia, cùng vui'));
  const description=el('p','panel-note','Tiền sân chia theo giờ · Cầu và trà chia đều mọi người. Nhập tiền bằng đồng.');
  const fields=el('fieldset','cost-fields');
  const costs=el('div','cost-inputs'),hours=el('div','hours-grid');
  const summary=el('div','cost-summary');summary.id='billing-summary';summary.setAttribute('aria-live','polite');
  const controls=el('div','panel-actions');
  const saveButton=button('Lưu',()=>save(false));
  const calculateButton=button('Lưu & tính tiền',()=>save(true),'button button-primary');
  controls.append(saveButton,calculateButton);
  fields.append(costs,el('h3',null,'Giờ chơi của từng người'),el('p','panel-note','Bước 0,5 giờ. Người mới mặc định 2 giờ.'),hours,summary,controls);
  const message=el('p','panel-status','Đang tải chi phí…');message.id='billing-status';message.setAttribute('role','status');
  const loadNew=button('Tải bản mới',()=>{if(remote!==null){apply(remote);remote=null;error='';render();}});
  loadNew.hidden=true;
  const retry=button('Kết nối lại chi phí',()=>{stop();start();});retry.hidden=true;
  panel.append(description,fields,message,loadNew,retry);
  root.append(toggle,panel);
  // Always expose connection state, including when the cost editor is collapsed.
  root.append(message);

  function state() {
    if(error) return 'error';
    if(!loaded||!peopleReady) return 'loading';
    if(stale) return 'stale';
    if(dirty) return 'dirty';
    return isBillingCurrent(saved,participants)?'calculated':'draft';
  }
  function refresh() {
    let totals;
    try {totals=calculateTotals(input);summary.replaceChildren(...[
      ['Sân',totals.courtTotal],[`Cầu (${totals.shuttleQuantity} quả)`,totals.shuttleTotal],['Trà',totals.teaTotal],['Tổng cộng',totals.total]
    ].map(([label,amount])=>{const row=el('div');row.append(el('span',null,label),el('strong',null,formatMoney(amount)));return row;}));}
    catch(e){summary.textContent=e.message;}
    const current=state();
    const text=error || (busy?'Đang lưu, chờ Firebase xác nhận…':remote?'Dữ liệu đã được sửa từ thiết bị khác. Bạn có thể tải bản mới.':
      current==='loading'?'Đang tải chi phí…':current==='stale'?'Danh sách đã thay đổi — Cần tính lại.':current==='dirty'?'Có thay đổi chưa lưu.':
      current==='calculated'?`Đã tính và lưu · Tổng thu ${formatMoney(saved.result.total)}`:saved?'Đã lưu bản nháp · Chưa tính tiền.':'Chưa có chi phí đã lưu.');
    message.textContent=text;message.classList.toggle('is-error',Boolean(error));
    fields.disabled=busy;
    saveButton.disabled=busy||!loaded||!peopleReady;
    calculateButton.disabled=saveButton.disabled||!participants.length;
    loadNew.hidden=!remote;loadNew.disabled=busy;
    retry.hidden=!error||loaded;retry.disabled=busy;
    onAllocationsChange({status:current,allocations:current==='calculated'?saved.result.allocations:[]});
  }
  function changed() { dirty=true;error='';refresh(); }
  function renderCosts() {
    costs.replaceChildren(numberField('Tiền sân (đ)',input.courtFee,value=>{input.courtFee=value;changed();}));
    const shuttleList=el('div','shuttle-list');
    input.shuttles.forEach((line,index)=>{
      const row=el('div','shuttle-row');
      const label=el('label','cost-field','Tên loại cầu '+(index+1)),name=el('input');
      name.type='text';name.value=line.label;name.maxLength=60;name.addEventListener('input',()=>{line.label=name.value;changed();});label.append(name);
      const quantity=numberField(`Số lượng cầu ${index+1}`,line.quantity,value=>{line.quantity=value;updateLine();changed();});
      const price=numberField(`Giá cầu ${index+1} (đ)`,line.unitPrice,value=>{line.unitPrice=value;updateLine();changed();},{nullable:true});
      const total=el('output','line-total');
      const updateLine=()=>{const value=line.quantity===0?0:line.unitPrice===null?NaN:line.quantity*line.unitPrice;total.textContent=Number.isSafeInteger(value)&&value>=0?formatMoney(value):'Chưa đủ dữ liệu';};updateLine();
      const remove=button(`Bỏ loại cầu ${index+1}`,()=>{input.shuttles.splice(index,1);changed();renderCosts();costs.querySelector('.add-shuttle').focus();},'button remove-shuttle');
      row.append(label,quantity,price,total,remove);shuttleList.append(row);
    });
    const add=button('+ Thêm loại cầu',()=>{
      input.shuttles.push({id:crypto.randomUUID(),label:`Cầu loại ${input.shuttles.length+1}`,quantity:0,unitPrice:null});
      changed();renderCosts();costs.querySelector('.shuttle-row:last-child input').focus();
    },'button button-light add-shuttle');
    const tea=el('div','tea-row');
    tea.append(numberField('Số bình trà',input.tea.quantity,value=>{input.tea.quantity=value;changed();}),
      numberField('Giá mỗi bình (đ)',input.tea.unitPrice,value=>{input.tea.unitPrice=value;changed();},{nullable:true}));
    costs.append(el('h3',null,'Cầu theo từng đơn giá'),shuttleList,add,el('h3',null,'Trà đá'),tea);
  }
  function renderHours() {
    hours.replaceChildren();
    if(!participants.length) hours.append(el('p','panel-note','Chưa có người check-in. Bạn vẫn có thể lưu chi phí nháp.'));
    for(const person of participants) {
      const row=input.hours.find(h=>h.id===person.id && h.version===person.version);
      const card=el('div','hours-card');card.dataset.personId=person.id;
      const portrait=el('div','hours-portrait'),value=el('span','hours-value',`${row.halfHours/2}h`);
      portrait.append(createAvatarButton(person.avatar,person.name,56),value);
      const adjust=(delta)=>{row.halfHours=Math.max(0,Math.min(48,row.halfHours+delta));value.textContent=`${row.halfHours/2}h`;update();changed();};
      const minus=button('−',()=>adjust(-1)),plus=button('+',()=>adjust(1));
      minus.setAttribute('aria-label',`Giảm giờ của ${person.name}`);plus.setAttribute('aria-label',`Tăng giờ của ${person.name}`);
      const update=()=>{minus.disabled=row.halfHours===0;plus.disabled=row.halfHours===48;};update();
      const actions=el('div','hours-actions');actions.append(minus,plus);
      card.append(portrait,el('span','hours-name',person.name),actions);hours.append(card);
    }
  }
  function render(){renderCosts();renderHours();refresh();}
  function apply(document) {
    saved=document;revision=document?.revision??0;dirty=false;
    input=document?.input?structuredClone(document.input):createBillingInput(participants);
    if(peopleReady)input=reconcileHours(input,participants);
    stale=Boolean(document && document.sourceFingerprint!==rosterFingerprint(participants));
    if(document){panel.hidden=false;toggle.setAttribute('aria-expanded','true');}
  }
  async function save(calculate) {
    if(busy||!loaded||!peopleReady) return;
    error='';
    try {
      calculateTotals(input);
      // Validate hours even for drafts, but allow an empty roster or zero total hours in a draft.
      for(const h of input.hours) if(!Number.isInteger(h.halfHours)||h.halfHours<0||h.halfHours>48) throw new Error('Giờ chơi phải từ 0 đến 24 giờ.');
      if(calculate) calculateBill(input,participants);
    } catch(e){error=dataError(e);refresh();return;}
    busy=true;refresh();
    const expected=revision,sourceFingerprint=rosterFingerprint(participants),snapshot=structuredClone(participants),data=structuredClone(input);
    try {
      if(!navigator.onLine) throw new Error('Bạn đang ngoại tuyến. Dữ liệu chưa lưu.');
      const fresh=buildParticipants(await checkins.readDayCheckins(date));
      if(sourceFingerprint!==rosterFingerprint(fresh) || sourceFingerprint!==rosterFingerprint(participants)) throw new Error('Danh sách đã thay đổi. Hãy chờ đồng bộ rồi tính lại.');
      const payload={schemaVersion:1,input:data,status:calculate?'calculated':'draft',participants:snapshot,sourceFingerprint,
        result:calculate?calculateBill(data,snapshot):null};
      const next=await service.saveBilling(date,payload,expected);
      const newer=remote && remote.revision>next ? remote : null;
      apply({...payload,revision:next});remote=newer;
      if(newer) error='Dữ liệu đã được sửa từ thiết bị khác. Hãy tải bản mới.';
    }catch(e){error=dataError(e);}
    finally{busy=false;render();}
  }
  async function start() {
    if(active)return;active=true;const token=++generation;error='';refresh();
    try {
      [service,checkins]=await Promise.all([import('./billing-service.js'),import('./checkin-service.js')]);
      if(!active||token!==generation)return;
      unsubscribe=service.watchBilling(date,result=>{
        if(!active||token!==generation||result.fromCache)return;
        loaded=true;
        const data=result.data;
        if(busy || dirty) {if((data?.revision??0)!==revision)remote=data;refresh();return;}
        remote=null;apply(data);error='';render();
      },e=>{if(active&&token===generation){error=dataError(e);loaded=false;refresh();}});
    }catch(e){if(active&&token===generation){error=dataError(e);refresh();}}
  }
  function stop(){active=false;++generation;unsubscribe?.();unsubscribe=undefined;}
  function setParticipants(next,{ready}) {
    const changedRoster=rosterFingerprint(next)!==rosterFingerprint(participants);
    participants=next;peopleReady=ready;
    if(changedRoster){input=reconcileHours(input,participants);stale=Boolean(saved && saved.sourceFingerprint!==rosterFingerprint(participants));renderHours();}
    refresh();
  }
  render();
  return {start,stop,setParticipants};
}
