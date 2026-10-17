import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBillingInput, reconcileHours, calculateTotals, calculateBill, isBillingCurrent } from '../js/billing.js';
import { rosterFingerprint } from '../js/participants.js';
const people = ['a','b','c','d'].map(id => ({id,version:'1',name:id}));
const input = () => createBillingInput(people);
test('weighted shares round once to thousands and report the actual collected total', () => {
  const data = input();
  assert.equal(data.courtFee, 220000);
  assert.deepEqual(data.tea,{quantity:0,unitPrice:20000});
  assert.deepEqual(data.shuttles.map(s=>[s.unitPrice,s.quantity]), [[27000,0]]);
  data.shuttles[0].quantity=2;
  data.shuttles.push({id:'second',label:'Cầu khác',unitPrice:25000,quantity:1});
  data.tea={quantity:1,unitPrice:20000};
  data.hours[2].halfHours=2; data.hours[3].halfHours=2;
  const result=calculateBill(data,people);
  assert.equal(result.total,319000);
  assert.equal(calculateTotals(data).shuttleQuantity,3);
  assert.deepEqual(result.allocations.map(p=>p.amount),[98000,98000,61000,61000]);
  assert.equal(result.collectedTotal,318000);assert.equal(result.roundingDifference,-1000);
  assert.equal(result.allocations.reduce((s,p)=>s+p.amount,0),318000);
});
test('integer remainders stable by ID and zero hours still share extras',()=>{
  const data=input(); data.courtFee=1;
  assert.equal(calculateBill(data,[...people].reverse()).allocations.find(p=>p.id==='a').courtAmount,1);
  data.courtFee=200000; data.hours[0].halfHours=0; data.tea={quantity:1,unitPrice:4000};
  assert.equal(calculateBill(data,people).allocations[0].amount,1000);
  data.hours.forEach(p=>p.halfHours=0);
  assert.throws(()=>calculateBill(data,people),/giờ/);
  data.courtFee=0;
  assert.deepEqual(calculateBill(data,people).allocations.map(p=>p.amount),[1000,1000,1000,1000]);
});

test('six equal-hour players sharing 321000 all pay 54000 without remainder bias',()=>{
  const participants=Array.from({length:6},(_,i)=>({id:String(i),version:'1'})),data=createBillingInput(participants);
  data.shuttles[0].quantity=3;data.tea.quantity=1;
  for(const list of [participants,[...participants].reverse()]){
    const result=calculateBill(data,list);
    assert.deepEqual(result.allocations.map(p=>p.amount),[54000,54000,54000,54000,54000,54000]);
    assert.equal(result.total,321000);assert.equal(result.collectedTotal,324000);assert.equal(result.roundingDifference,3000);
  }
});

test('499 rounds down, 500 rounds up, and fractions below 500 never round up early',()=>{
  const participants=[people[0]],data=createBillingInput(participants);
  for(const [fee,expected] of [[61499,61000],[61500,62000],[61999,62000],[61000,61000],[0,0]]){
    data.courtFee=fee;assert.equal(calculateBill(data,participants).allocations[0].amount,expected);
  }
  const pair=people.slice(0,2),split=createBillingInput(pair);split.courtFee=122999;
  assert.deepEqual(calculateBill(split,pair).allocations.map(p=>p.amount),[61000,61000]);
});

test('rounded amounts and collected totals must stay within safe integer limits',()=>{
  for(const count of [1,8]){
    const participants=Array.from({length:count},(_,i)=>({id:String(i),version:'1'})),data=createBillingInput(participants);data.courtFee=Number.MAX_SAFE_INTEGER;
    assert.throws(()=>calculateBill(data,participants),/giới hạn/);
  }
});
test('client validates integers, missing prices, hours and safe totals',()=>{
  for(const value of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1]) {
    const data=input(); data.courtFee=value; assert.throws(()=>calculateTotals(data));
  }
  const data=input(); data.tea={quantity:1,unitPrice:null}; assert.throws(()=>calculateTotals(data));
  data.tea.unitPrice=0; assert.equal(calculateTotals(data).teaTotal,0);
  data.tea.quantity=0.5; assert.throws(()=>calculateTotals(data));
  data.tea={quantity:2,unitPrice:Number.MAX_SAFE_INTEGER}; assert.throws(()=>calculateTotals(data));
  for(const halfHours of [-1,0.5,49]) {const d=input();d.hours[0].halfHours=halfHours; assert.throws(()=>calculateBill(d,people));}
  assert.throws(()=>calculateBill(createBillingInput([]),[]),/check-in/);
  assert.equal(calculateTotals(createBillingInput([])).total,220000);
});
test('new and rechecked participants reset to two hours, old results stale',()=>{
  const data=input();data.hours[0].halfHours=1;
  const changed=people.map(p=>p.id==='b'?{...p,version:'2'}:p).concat({id:'e',version:'1'});
  const hours=reconcileHours(data,changed).hours;
  assert.deepEqual(hours.map(p=>p.halfHours),[1,4,4,4,4]);
  const document={status:'calculated',sourceFingerprint:rosterFingerprint(people),result:calculateBill(data,people)};
  assert.equal(isBillingCurrent(document,people),true);
  assert.equal(isBillingCurrent(document,changed),false);
  assert.equal(isBillingCurrent({...document,status:'draft'},people),false);
});
