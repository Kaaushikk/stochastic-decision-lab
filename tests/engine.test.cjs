const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
function position(pieces,roll=2,turn=0){const s=E.reset(42);s.pieces=pieces;s.roll=roll;s.turn=turn;return s;}
test('cowrie probabilities sum to one and fair four-shell outcomes have correct counts',()=>{
  const counts={1:0,2:0,3:0,4:0,8:0};
  for(let mask=0;mask<16;mask++){const mouths=mask.toString(2).replace(/0/g,'').length;counts[mouths||8]++;}
  for(const o of E.OUTCOMES) assert.equal(o.p,counts[o.value]/16);
  assert.equal(E.OUTCOMES.reduce((n,o)=>n+o.p,0),1);
});
test('entry, exact finish, overshoot and illegal actions',()=>{
  let s=E.withRoll(E.reset(1),1);assert.equal(E.legalActions(s).length,4);
  const entered=E.step(s,0);assert.equal(entered.pieces[0][0],0);assert.equal(s.pieces[0][0],-1);
  s=position([[47,46,48,48],[-1,-1,-1,-1]],2);
  assert.deepEqual(E.legalActions(s).map(a=>a.piece),[1]);
  assert.throws(()=>E.step(s,0),/Illegal/);assert.throws(()=>E.step(E.reset(2),0),/Illegal/);
  assert.equal(E.step(s,1).pieces[0][1],48);
  assert.throws(()=>E.withRoll(E.reset(1),5),/Invalid/);
});
test('unsafe captures reset all opposing pieces and grant a bonus',()=>{
  const dest=E.key(E.coordinate(0,2));
  const opposing=E.TRACK.findIndex((_,i)=>E.key(E.coordinate(1,i))===dest);
  const s=position([[0,-1,-1,-1],[opposing,opposing,-1,-1]]);
  const next=E.step(s,0);assert.deepEqual(next.pieces[1],[-1,-1,-1,-1]);assert.deepEqual(next.captures,[2,0]);assert.equal(next.turn,0);
});
test('safe squares protect opposing and stacked pieces',()=>{
  const dest=E.key(E.coordinate(0,6)),opposing=E.TRACK.findIndex((_,i)=>E.key(E.coordinate(1,i))===dest);
  const next=E.step(position([[4,-1,-1,-1],[opposing,-1,-1,-1]]),0);
  assert.equal(next.pieces[1][0],opposing);assert.equal(next.captures[0],0);assert.equal(next.turn,1);
});
test('4/8 bonus rolls and no-move passes obey the same rule',()=>{
  assert.equal(E.withRoll(E.reset(1),4).turn,0);
  assert.equal(E.withRoll(E.reset(1),2).turn,1);
  assert.equal(E.step(E.withRoll(E.reset(1),8),0).turn,0);
});
test('finishing the last piece produces a terminal state and prevents more rolls',()=>{
  const next=E.step(position([[47,48,48,48],[0,-1,-1,-1]],1),0);
  assert.equal(next.terminal,0);assert.deepEqual(E.legalActions(next),[]);assert.throws(()=>E.roll(next));assert.equal(E.validate(next),true);
});
test('seeded rolls are deterministic and input state is immutable',()=>{
  const sequences=[];
  for(let run=0;run<2;run++){let s=E.reset('same-seed');const rolls=[];for(let i=0;i<40;i++){const snapshot=JSON.stringify(s);const n=E.roll(s);assert.equal(JSON.stringify(s),snapshot);rolls.push(n.lastRoll);s=n.roll!==null ? E.step(n,E.legalActions(n)[0]) : n;}sequences.push(rolls);}
  assert.deepEqual(sequences[0],sequences[1]);
});
test('capture risk counts each possible roll only once even with stacked attackers',()=>{
  const target=E.key(E.coordinate(0,2)),attack=E.TRACK.findIndex((_,i)=>E.key(E.coordinate(1,i))===target)-1;
  const s=position([[2,-1,-1,-1],[attack,attack,-1,-1]]);
  assert.equal(E.threatProbability(s,0,0),4/16);
});
test('geometry covers 48 unique squares plus center and is symmetric',()=>{
  assert.equal(new Set(E.TRACK.map(E.key)).size,48);
  for(let p=0;p<48;p++){const a=E.coordinate(0,p),b=E.coordinate(1,p);assert.deepEqual(b,[6-a[0],6-a[1]]);}
});
