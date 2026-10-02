const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js'),P=require('../policies.js'),V=require('../evaluation.js');
test('every policy selects legal moves, preserves its input, and supplies trace data',()=>{
  for(const id of Object.keys(P.NAMES)) {
    const s=V.scenarios(42)[0].state,snapshot=JSON.stringify(s),trace=P.selectAction(s,id,{seed:15,budget:5,horizon:4});
    assert(E.legalActions(s).some(a=>a.piece===trace.action.piece));assert.equal(JSON.stringify(s),snapshot);
    assert.equal(trace.ranked.length,E.legalActions(s).length);assert(Number.isFinite(trace.ranked[0].score));assert(trace.stats.latencyMs>=0);
  }
});
test('heuristic scores capture contributions and removes risk in baseline mode',()=>{
  const s=V.scenarios()[0].state,trace=P.selectAction(s,'heuristic');
  assert(trace.ranked[0].action.captured.length>0);assert.equal(trace.ranked[0].contributions.risk,0);
  assert.equal(Object.values(trace.ranked[0].contributions).reduce((a,b)=>a+b,0),trace.ranked[0].score);
});
test('MAX MIN and CHANCE search are correct on a hand-verifiable endgame',()=>{
  const s=E.reset(42);s.pieces=[[47,48,48,48],[47,48,48,48]];
  const stats=()=>({nodes:0,effectiveDepth:0,truncated:false});
  assert.equal(P.stateValue(s,0,P.DEFAULT_WEIGHTS),0);
  assert.equal(P.search(s,0,1,P.DEFAULT_WEIGHTS,stats(),20000),0.25);
  s.turn=1;assert.equal(P.search(s,0,1,P.DEFAULT_WEIGHTS,stats(),20000),-0.25);
  const rolled={...s,roll:1};assert.equal(P.search(rolled,0,1,P.DEFAULT_WEIGHTS,stats(),20000),-1);
  rolled.turn=0;assert.equal(P.search(rolled,0,1,P.DEFAULT_WEIGHTS,stats(),20000),1);
});
test('rollouts are reproducible, count actual trajectories and record cutoff outcomes',()=>{
  const state=V.scenarios()[0].state;
  const a=P.selectAction(state,'montecarlo',{seed:12,budget:7,horizon:3}),b=P.selectAction(state,'montecarlo',{seed:12,budget:7,horizon:3});
  assert.deepEqual(a.ranked,b.ranked);assert.equal(a.stats.rollouts,E.legalActions(state).length*7);assert(a.stats.nodes>0);
  assert(a.ranked.every(r=>r.stderr>=0 && r.completed<=r.samples));
});
test('search and rollouts recognize immediate wins and reject invalid budgets',()=>{
  const s=V.scenarios().find(s=>s.expectation==='must-win').state;
  for(const id of ['expectiminimax','montecarlo'])assert.equal(P.selectAction(s,id,{budget:3}).ranked[0].score,1);
  assert.throws(()=>P.selectAction(s,'montecarlo',{budget:0}));
});
test('all 50 scenarios are valid legal positions with verified targeted properties',()=>{
  const scenarios=V.scenarios();assert.equal(scenarios.length,50);
  assert.equal(new Set(scenarios.map(s=>JSON.stringify([s.state.pieces,s.state.turn,s.state.roll]))).size,50);
  for(const fixture of scenarios){assert(E.validate(fixture.state));const actions=E.legalActions(fixture.state);assert(actions.length>0);
    if(fixture.expectation==='capture-available')assert(actions.some(a=>a.captured.length>0));
    if(fixture.expectation==='capture-under-threat')assert(actions.some(a=>a.captured.length && P.features(fixture.state,a).risk>0));
    if(fixture.expectation==='safe-available')assert(actions.some(a=>E.safe(a.player,a.to)));
    if(fixture.expectation==='forced')assert.equal(actions.length,1);
    if(fixture.expectation==='must-win')assert.equal(E.step(fixture.state,fixture.expectedPiece).terminal,fixture.state.turn);
  }
});
