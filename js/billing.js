import { rosterFingerprint } from './participants.js';

const integer = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} phải là số nguyên không âm, trong giới hạn an toàn.`);
  return value;
};
const safe = value => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Tổng tiền vượt giới hạn an toàn.');
  return Number(value);
};
export function createBillingInput(participants) {
  return { courtFee:220000, shuttles:[{id:'shuttle-1',label:'Cầu loại 1',unitPrice:27000,quantity:0}], tea:{quantity:0,unitPrice:20000},
    hours:participants.map(p=>({id:p.id,version:p.version,halfHours:4})) };
}
export function reconcileHours(input, participants) {
  return {...input,hours:participants.map(p=>({id:p.id,version:p.version,
    halfHours:input.hours.find(h=>h.id===p.id && h.version===p.version)?.halfHours ?? 4}))};
}
function lineTotal(line, label) {
  integer(line.quantity,`Số lượng ${label}`);
  if (line.unitPrice === null && line.quantity === 0) return 0;
  integer(line.unitPrice,`Đơn giá ${label}`);
  return safe(BigInt(line.quantity)*BigInt(line.unitPrice));
}
export function calculateTotals(input) {
  const courtTotal=integer(input.courtFee,'Tiền sân');
  if (!Array.isArray(input.shuttles)) throw new Error('Danh sách cầu không hợp lệ.');
  const shuttleTotal=safe(input.shuttles.reduce((sum,line)=>sum+BigInt(lineTotal(line,'cầu')),0n));
  const shuttleQuantity=safe(input.shuttles.reduce((sum,line)=>sum+BigInt(line.quantity),0n));
  const teaTotal=lineTotal(input.tea,'trà');
  return {courtTotal,shuttleTotal,shuttleQuantity,teaTotal,total:safe(BigInt(courtTotal)+BigInt(shuttleTotal)+BigInt(teaTotal))};
}
// Largest remainder allocation: every đồng is assigned once, independently for each expense pool.
function allocate(total, people, weights) {
  const denominator=weights.reduce((s,w)=>s+BigInt(w),0n);
  if (!denominator) return people.map(()=>0);
  const shares=people.map((p,i)=>({id:p.id,index:i,amount:BigInt(total)*BigInt(weights[i])/denominator,
    remainder:BigInt(total)*BigInt(weights[i])%denominator}));
  let remaining=BigInt(total)-shares.reduce((sum,p)=>sum+p.amount,0n);
  const ranked=[...shares].sort((a,b)=>a.remainder!==b.remainder ? (a.remainder>b.remainder?-1:1) : a.id<b.id?-1:a.id>b.id?1:0);
  for (const part of ranked) { if (!remaining) break; part.amount++; remaining--; }
  return shares.map(p=>Number(p.amount));
}
export function calculateBill(input,participants) {
  const totals=calculateTotals(input);
  if (!participants.length) throw new Error('Cần ít nhất một người check-in để tính tiền.');
  if (new Set(participants.map(p=>p.id)).size!==participants.length) throw new Error('Danh sách check-in bị trùng ID.');
  const hours=participants.map(p=>{
    const row=input.hours.find(h=>h.id===p.id && h.version===p.version);
    const value=integer(row?.halfHours,'Số nửa giờ');
    if (value>48) throw new Error('Giờ chơi phải từ 0 đến 24 giờ.');
    return value;
  });
  if (totals.courtTotal>0 && !hours.some(Boolean)) throw new Error('Tổng giờ phải lớn hơn 0 khi có tiền sân.');
  const court=allocate(totals.courtTotal,participants,hours);
  const shared=allocate(totals.shuttleTotal+totals.teaTotal,participants,participants.map(()=>1));
  return {...totals,allocations:participants.map((p,i)=>({id:p.id,version:p.version,halfHours:hours[i],
    courtAmount:court[i],sharedAmount:shared[i],amount:court[i]+shared[i]}))};
}
export function isBillingCurrent(document,participants) {
  return Boolean(document?.status==='calculated' && document.result && document.sourceFingerprint===rosterFingerprint(participants));
}
export const formatMoney = amount => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(amount);
