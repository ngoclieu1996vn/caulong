import { rosterFingerprint } from './participants.js';

export function shuffle(items,random=Math.random) {
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
export function drawNext(remaining,random=Math.random) {
  if(!remaining.length) throw new Error('Đã quay hết người.');
  const index=Math.floor(random()*remaining.length);
  return {selected:remaining[index],remaining:remaining.filter((_,i)=>i!==index)};
}
function team(members,index) {
  return {id:`team-${index+1}`,members,kind:members.length===1?'single':members.every(p=>p.gender) && members[0].gender!==members[1].gender?'mixed':'same-gender'};
}
export function teamsFromOrder(participants,drawOrder) {
  if(drawOrder.length!==participants.length || new Set(drawOrder).size!==participants.length) throw new Error('Thứ tự bốc chưa đủ hoặc bị trùng người.');
  const map=new Map(participants.map(p=>[p.id,p])),teams=[];
  for(let i=0;i<drawOrder.length;i+=2){
    const members=drawOrder.slice(i,i+2).map(id=>map.get(id));
    if(members.some(p=>!p))throw new Error('Người được chọn không còn trong danh sách.');
    teams.push(team(members,teams.length));
  }
  return teams;
}
export function createMixedTeams(participants,random=Math.random) {
  if(participants.some(p=>!['Nam','Nữ'].includes(p.gender)))throw new Error('Vui lòng bổ sung giới tính trước khi chia đội.');
  const men=shuffle(participants.filter(p=>p.gender==='Nam'),random),women=shuffle(participants.filter(p=>p.gender==='Nữ'),random),teams=[];
  const pairs=Math.min(men.length,women.length);
  for(let i=0;i<pairs;i++)teams.push(team([men[i],women[i]],teams.length));
  const rest=shuffle([...men.slice(pairs),...women.slice(pairs)],random);
  for(let i=0;i<rest.length;i+=2)teams.push(team(rest.slice(i,i+2),teams.length));
  return teams;
}
export function createMatchups(teams,random=Math.random) {
  const ordered=shuffle(teams,random),matchups=[];
  for(let i=0;i+1<ordered.length;i+=2)matchups.push({id:`match-${matchups.length+1}`,teamIds:[ordered[i].id,ordered[i+1].id]});
  return {teams:ordered,matchups,waitingTeamIds:ordered.length%2?[ordered.at(-1).id]:[]};
}
export function resolveGameParticipants(participants,overrides) {
  return participants.map(p=>({...p,gender:p.gender || overrides.find(o=>o.id===p.id&&o.version===p.version)?.gender || null}));
}
export function isGameCurrent(document,participants) {
  return Boolean(document && document.sourceFingerprint===rosterFingerprint(participants,{includeGender:true}));
}
export function wheelTargetAngle(previous,count,index) {
  const desired=(360-(index+0.5)*360/count)%360;
  const offset=((desired-previous%360)+360)%360;
  return previous+360*5+offset;
}
