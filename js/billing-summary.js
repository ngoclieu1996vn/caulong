import {el} from './ui-elements.js';
import {calculateTotals,formatMoney} from './billing.js';

const shapes={
  shuttle:['M6 3h12l-3 12H9L6 3Z','M10 3l1 12m3-12-1 12M8 8h8M9 15v3a3 3 0 0 0 6 0v-3'],
  tea:['M5 10h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5v-6ZM7 10l2-3h5l2 3M10 4h3M17 12h2a3 3 0 0 1 0 6h-3M5 12H2l3 5'],
  people:['M8 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-2a6 6 0 0 1 12 0v2M16 5a4 4 0 0 1 0 8M17 15a5 5 0 0 1 5 5v1'],
  clock:['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 6v6l4 2']
};
function icon(kind){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [name,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(name,value);
  for(const d of shapes[kind]){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path);}
  return svg;
}
export function renderBillingSummary(root,saved){
  if(!root)return;
  root.replaceChildren();root.hidden=!saved?.input;
  if(root.hidden)return;
  const totals=calculateTotals(saved.input),hours=(saved.input.hours??[]).map(h=>h.halfHours/2);
  const number=value=>new Intl.NumberFormat('vi-VN').format(value);
  const min=hours.length?Math.min(...hours):0,max=hours.length?Math.max(...hours):0;
  const duration=min===max?number(max):`${number(min)}–${number(max)}`;
  const stats=el('div','day-summary-stats');
  for(const [kind,value,label] of [
    ['shuttle',`× ${totals.shuttleQuantity}`,`${totals.shuttleQuantity} quả cầu`],
    ['tea',`× ${saved.input.tea.quantity}`,`${saved.input.tea.quantity} bình trà`],
    ['people',`× ${saved.participants.length}`,`${saved.participants.length} người`],
    ['clock',`${duration}h`,`${duration} giờ`]
  ]){
    const item=el('span','day-summary-stat');item.setAttribute('aria-label',label);item.title=label;
    item.append(icon(kind),el('span',null,value));stats.append(item);
  }
  const money=el('p','day-summary-money');
  money.append(el('span',null,`Tiền sân ${formatMoney(totals.courtTotal)}`),el('strong',null,`Tổng chi ${formatMoney(totals.total)}`));
  if(saved.status==='calculated' && saved.result?.roundingUnit===1000){
    const result=saved.result;
    money.append(el('strong',null,`Tổng thu ${formatMoney(result.collectedTotal)}`),
      el('span',null,`${result.roundingDifference<0?'Thiếu':'Dư'} do làm tròn ${formatMoney(Math.abs(result.roundingDifference))}`));
  }
  root.append(stats,money);
}
