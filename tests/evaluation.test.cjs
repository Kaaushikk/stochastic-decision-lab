const test=require('node:test');
const assert=require('node:assert/strict');
const V=require('../evaluation.js');
test('tournaments swap sides, save configuration, and account for every outcome',async()=>{
  const policies=[V.policySpec('random'),V.policySpec('heuristic')];
  const result=await V.tournament({policies,seeds:[11,12],gamesPerSide:1,maxTurns:20});
  assert.equal(result.games.length,4);assert.equal(result.games[0].seed,result.games[1].seed);
  assert.equal(result.games[0].policies[0].id,result.games[1].policies[1].id);
  for(const row of result.summary){assert.equal(row.games,4);assert.equal(row.wins+row.losses+row.unfinished,row.games);assert(row.winCI[0]<=row.winRate && row.winCI[1]>=row.winRate);}
  const again=await V.tournament({policies,seeds:[11,12],gamesPerSide:1,maxTurns:20});
  assert.deepEqual(result.games.map(g=>g.finalState),again.games.map(g=>g.finalState));
});
test('cancellation exits instead of saving partial results as complete',async()=>{
  await assert.rejects(V.tournament({policies:[V.policySpec('random'),V.policySpec('heuristic')]},{cancelled:()=>true}),/cancelled/);
});
test('ablation studies actually remove individual feature weights',()=>{
  const policies=V.studyPolicies('ablation');assert.equal(policies.length,6);
  for(const policy of policies.slice(1))assert.equal(policy.config.weights[policy.label.replace('Without ','')],0);
});
test('CSV escapes commas quotes and line breaks; empty samples have honest intervals',()=>{
  assert.equal(V.csv([{name:'a,"b',value:2}]),'"name","value"\n"a,""b","2"');assert.deepEqual(V.wilson(0,0),[0,1]);
});
