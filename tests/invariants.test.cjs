const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine.js'),P=require('../policies.js'),V=require('../evaluation.js');
test('seeded self-play preserves state invariants across five policies and both entry rules',()=>{
  for(const entry of [[1,8],[4,8]])for(let seed=0;seed<5;seed++) {
    let s=E.reset(seed,{entry});
    for(let turn=0;turn<200 && s.terminal===null;turn++) {
      assert(E.validate(s));s=E.roll(s);assert(E.validate(s));
      if(s.roll!==null){const name=Object.keys(P.NAMES)[turn%5];const trace=P.selectAction(s,name,{budget:2,horizon:3,depth:2});s=E.step(s,trace.action);}
      assert(E.validate(s));assert.equal(s.roll,null);assert.equal(s.turns,turn+1);
    }
  }
});
test('rotated player perspectives produce the same features and decision utility',()=>{
  const a=V.scenarios()[0].state,b=E.clone(a);b.pieces.reverse();b.turn=1;
  for(const id of Object.keys(P.NAMES)){const options={seed:42,budget:5,horizon:4,depth:2};const x=P.selectAction(a,id,options),y=P.selectAction(b,id,options);assert.equal(x.action.piece,y.action.piece);assert.deepEqual(x.ranked.map(r=>r.score),y.ranked.map(r=>r.score));assert.deepEqual(x.ranked.map(r=>r.features),y.ranked.map(r=>r.features));}
});
test('both entry variants retain legal benchmark positions',()=>{
  for(const s of V.scenarios(2023,[4,8])){assert(E.validate(s.state));assert(E.legalActions(s.state).length>0);if(s.expectation==='entry-available')assert(E.legalActions(s.state).some(a=>a.type==='enter'));}
});
test('turn limit and search configuration reject invalid inputs',async()=>{
  await assert.rejects(V.playGame(V.policySpec('random'),V.policySpec('risk'),1,{maxTurns:NaN}),/turn limit/);
  assert.throws(()=>P.config({depth:2.5}));assert.throws(()=>P.config({weights:{risk:Infinity}}));
});
