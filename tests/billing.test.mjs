import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBillingInput, reconcileHours, calculateTotals, calculateBill, isBillingCurrent } from '../js/billing.js';
import { rosterFingerprint } from '../js/participants.js';
const people = ['a','b','c','d'].map(id => ({id,version:'1',name:id}));
const input = () => createBillingInput(people);
test('defaults and multiple shuttle prices produce exact weighted bill', () => {
  const data = input();
  assert.equal(data.courtFee, 220000);
  assert.deepEqual(data.shuttles.map(s=>[s.unitPrice,s.quantity]), [[27000,0],[25000,0]]);
  data.shuttles[0].quantity=2; data.shuttles[1].quantity=1;
  data.tea={quantity:1,unitPrice:20000};
  data.hours[2].halfHours=2; data.hours[3].halfHours=2;
  const result=calculateBill(data,people);
  assert.equal(result.total,319000);
  assert.equal(calculateTotals(data).shuttleQuantity,3);
  assert.deepEqual(result.allocations.map(p=>p.amount),[98083,98083,61417,61417]);
  assert.equal(result.allocations.reduce((s,p)=>s+p.amount,0),319000);
});
test('integer remainders stable by ID and zero hours still share extras',()=>{
  const data=input(); data.courtFee=1;
  assert.equal(calculateBill(data,[...people].reverse()).allocations.find(p=>p.id==='a').amount,1);
  data.courtFee=200; data.hours[0].halfHours=0; data.tea={quantity:1,unitPrice:4};
  assert.equal(calculateBill(data,people).allocations[0].amount,1);
  data.hours.forEach(p=>p.halfHours=0);
  assert.throws(()=>calculateBill(data,people),/giờ/);
  data.courtFee=0;
  assert.deepEqual(calculateBill(data,people).allocations.map(p=>p.amount),[1,1,1,1]);
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
