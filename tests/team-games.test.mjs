import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shuffle,drawNext,teamsFromOrder,createMixedTeams,createMatchups,resolveGameParticipants,isGameCurrent,wheelTargetAngle} from '../js/team-games.js';
import {rosterFingerprint} from '../js/participants.js';
const people=(genders)=>genders.map((gender,i)=>({id:String(i),version:'1',name:'An',gender}));
const random=()=>0.37;
test('draws consume every ID once and consecutive winners make teams, odd player kept',()=>{
  const source=people(['Nam','Nữ','Nam','Nữ','Nam']),original=structuredClone(source);
  let remaining=source,order=[];
  while(remaining.length){const draw=drawNext(remaining,random);order.push(draw.selected.id);remaining=draw.remaining;}
  assert.equal(new Set(order).size,5);assert.deepEqual(source,original);
  const teams=teamsFromOrder(source,order),matches=createMatchups(teams,random);
  assert.deepEqual(teams.map(t=>t.members.length).sort(),[1,2,2]);
  assert.equal(matches.matchups.length,1);assert.equal(matches.waitingTeamIds.length,1);
});
test('mixed teams maximize male-female pairing and preserve leftover participants',()=>{
  for(const [genders,mixed,same,single] of [
    [['Nam','Nam','Nam','Nữ','Nữ'],2,0,1],
    [['Nam','Nam','Nam','Nam','Nam','Nữ'],1,2,0],
    [['Nam','Nam','Nữ','Nữ'],2,0,0],
    [['Nữ'],0,0,1], [[],0,0,0],
  ]){
    const source=people(genders),teams=createMixedTeams(source,random);
    assert.equal(teams.filter(t=>t.kind==='mixed').length,mixed);
    assert.equal(teams.filter(t=>t.kind==='same-gender').length,same);
    assert.equal(teams.filter(t=>t.kind==='single').length,single);
    assert.equal(new Set(teams.flatMap(t=>t.members.map(p=>p.id))).size,genders.length);
    assert.deepEqual(source,people(genders));
  }
  assert.throws(()=>createMixedTeams(people([null]),random),/giới tính/);
  assert.equal(teamsFromOrder(people([null]),['0']).length,1);
});
test('shuffle immutable, legacy overrides versioned and source fingerprints remain current',()=>{
  const source=people([null,'Nam']);
  assert.deepEqual(shuffle(source,random).map(p=>p.id).sort(),['0','1']);
  const override=[{id:'0',version:'1',gender:'Nữ'}];
  assert.equal(resolveGameParticipants(source,override)[0].gender,'Nữ');
  assert.equal(resolveGameParticipants([{...source[0],version:'2'}],override)[0].gender,null);
  const document={sourceFingerprint:rosterFingerprint(source,{includeGender:true})};
  assert.equal(isGameCurrent(document,[...source].reverse()),true);
  assert.equal(isGameCurrent(document,source.map(p=>({...p,avatar:'new'}))),true);
  assert.equal(isGameCurrent(document,source.map(p=>({...p,version:'2'}))),false);
  assert.equal(isGameCurrent(document,source.map(p=>({...p,gender:'Nữ'}))),false);
});
test('wheel pointer lands in the selected sector after full rotations',()=>{
  for(let count=1;count<=9;count++)for(let index=0;index<count;index++){
    const target=wheelTargetAngle(1234,count,index);
    assert.ok(target>1234+360*4);
    const pointer=(((-target%360)+360)%360)/(360/count);
    assert.ok(Math.abs(pointer-(index+0.5))<1e-8);
  }
});
