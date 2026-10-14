import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseVndInput,formatVndInput} from '../js/money-input.js';
test('VND inputs accept digits and formatted currency without changing the integer amount',()=>{
  for(const value of ['27000','27.000','27.000 đ','27.000 ₫','27 000 VND'])assert.equal(parseVndInput(value),27000);
  assert.equal(formatVndInput(220000),'220.000');assert.equal(formatVndInput(0),'0');
  assert.equal(parseVndInput('',{nullable:true}),null);
  for(const value of ['', '-100', '1,5', '1.5', '27.50', '1.000.50', 'abc', '1e5', '9007199254740992'])assert.ok(Number.isNaN(parseVndInput(value)),value);
});
