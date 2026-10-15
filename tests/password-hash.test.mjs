import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {passwordMd5} from '../js/password-hash.js';
test('MD5 uses lowercase hex and UTF-8 bytes compatible with Firebase configuration',()=>{
  assert.equal(passwordMd5(''),'d41d8cd98f00b204e9800998ecf8427e');
  assert.equal(passwordMd5('abc'),'900150983cd24fb0d6963f7d28e17f72');
  for(const text of ['Mật khẩu thử','🫖 cầu lông','a'.repeat(1000),'\ud800'])assert.equal(passwordMd5(text),createHash('md5').update(text).digest('hex'));
});
