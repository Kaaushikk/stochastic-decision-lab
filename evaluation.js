(function(root,factory){
  if(typeof module==="object" && module.exports) module.exports=factory(require("./engine.js"),require("./policies.js"));
  else root.AshtaEvaluation=factory(root.AshtaEngine,root.AshtaPolicies);
})(typeof globalThis!=="undefined" ? globalThis : this,function(E,P){
  "use strict";
  const now=()=>typeof performance!=="undefined" ? performance.now() : Date.now();
  const mean=a=>a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
  const variance=a=>a.length>1 ? a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1) : 0;
  const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
  function wilson(wins,n) {
    if(!n) return [0,1];
    const z=1.96,p=wins/n,den=1+z*z/n,center=(p+z*z/(2*n))/den;
    const half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
    return [Math.max(0,center-half),Math.min(1,center+half)];
  }
  function policySpec(id,options={}) {
    if(!P.NAMES[id]) throw new Error(`Unknown policy ${id}`);
    return {id,label:options.label || P.NAMES[id],config:P.config(options.config)};
  }
  function opponentAt(progress) {
    const target=E.key(E.coordinate(0,progress));
    return E.TRACK.findIndex((_,i)=>E.key(E.coordinate(1,i))===target);
  }
  function scenarios(seed=2023,entry=[1,8]) {
    const templates=[
      {label:"Immediate capture",pieces:[[0,9,-1,-1],[opponentAt(2),-1,-1,-1]],roll:2,expectation:"capture-available"},
      {label:"Capture with remaining attacker",pieces:[[0,9,-1,-1],[opponentAt(2),opponentAt(2)-1,-1,-1]],roll:2,expectation:"capture-under-threat"},
      {label:"Safe-square option",pieces:[[4,13,28,-1],[8,18,-1,-1]],roll:2,expectation:"safe-available"},
      {label:"Complete final piece",pieces:[[47,E.HOME,E.HOME,E.HOME],[10,20,-1,-1]],roll:1,expectation:"must-win",expectedPiece:0},
      {label:"Opponent near completion",pieces:[[8,18,-1,-1],[47,E.HOME,E.HOME,E.HOME]],roll:2,expectation:"opponent-near-home"},
      {label:"Forced action",pieces:[[0,-1,-1,-1],[10,-1,-1,-1]],roll:2,expectation:"forced",expectedPiece:0},
      {label:"Bonus roll",pieces:[[0,10,-1,-1],[8,18,-1,-1]],roll:4,expectation:"bonus-turn"},
      {label:"Entry versus progress",pieces:[[6,14,-1,-1],[8,18,-1,-1]],roll:1,expectation:"entry-available"},
      {label:"Exact finish and overshoot",pieces:[[47,46,45,44],[8,18,-1,-1]],roll:2,expectation:"overshoot-excluded"},
      {label:"Equivalent stacked pieces",pieces:[[10,10,-1,-1],[8,18,-1,-1]],roll:2,expectation:"equivalent-actions"},
    ];
    return templates.flatMap((template,t)=>Array.from({length:5},(_,variant)=>{
      const state=E.reset(`${seed}:scenario:${t}:${variant}`,{entry});
      state.pieces=template.pieces.map(a=>a.slice());
      if(t===3) state.pieces[1][0]+=variant;
      else if(t===4 || t===5) state.pieces[0][0]+=variant;
      else if(t===9) state.pieces[0][0]=state.pieces[0][1]=10+variant;
      else if(t===0 || t===1) state.pieces[0][1]+=variant;
      if(variant>=2 && t!==3 && t!==4) state.pieces[1][3]=5+variant*3;
      if(variant%2) {state.pieces.reverse();state.turn=1;}
      state.roll=t===7 ? entry[0] : template.roll;state.lastRoll=state.roll;E.validate(state);
      return {id:`s${t+1}-${variant+1}`,category:template.label,expectation:template.expectation,expectedPiece:template.expectedPiece,state};
    }));
  }
  async function benchmark(options={},hooks={}) {
    const specs=options.policies || Object.keys(P.NAMES).map(id=>policySpec(id,{config:options.policyConfig}));
    const fixtures=scenarios(options.seed ?? 2023,options.entry || [1,8]),records=[];
    for(let i=0;i<fixtures.length;i++) {
      if(hooks.cancelled && hooks.cancelled()) throw new Error("Experiment cancelled");
      const fixture=fixtures[i];
      const reference=P.selectAction(fixture.state,"expectiminimax",{...options.policyConfig,depth:3,seed:`${options.seed}:reference:${fixture.id}`});
      for(const spec of specs) {
        const trace=P.selectAction(fixture.state,spec.id,{...spec.config,seed:`${options.seed}:benchmark:${fixture.id}:${spec.label}`});
        records.push({scenario:fixture.id,category:fixture.category,expectation:fixture.expectation,policy:spec.label,policyId:spec.id,state:fixture.state,legalActions:E.legalActions(fixture.state),selected:trace.action.piece,expectedPiece:fixture.expectedPiece,passesExpected:fixture.expectedPiece===undefined ? null : trace.action.piece===fixture.expectedPiece,referenceAgreement:reference.action.piece===trace.action.piece,referenceTruncated:reference.stats.truncated,trace});
      }
      hooks.progress && hooks.progress({phase:"benchmark",done:i+1,total:fixtures.length});
      if(i%2===0) await pause();
    }
    return {environment:E.VERSION,seed:options.seed ?? 2023,kind:"benchmark",scenarioCount:fixtures.length,reference:{policy:"expectiminimax",depth:3,note:"Agreement measures consistency with this bounded reference, not optimality"},records,summary:specs.map(spec=>{
      const rows=records.filter(r=>r.policy===spec.label);
      return {policy:spec.label,agreement:mean(rows.map(r=>Number(r.referenceAgreement))),latencyMs:mean(rows.map(r=>r.trace.stats.latencyMs)),nodes:mean(rows.map(r=>r.trace.stats.nodes)),rollouts:mean(rows.map(r=>r.trace.stats.rollouts)),assertions:rows.filter(r=>r.passesExpected!==null).length,passed:rows.filter(r=>r.passesExpected===true).length};
    })};
  }
  async function playGame(left,right,seed,options={},hooks={}) {
    const specs=[left,right],maxTurns=options.maxTurns ?? 400;
    if(!Number.isInteger(maxTurns) || maxTurns<1 || maxTurns>1000000) throw new Error("Invalid turn limit");
    let state=E.reset(seed,{entry:options.entry || [1,8]});
    const decisions=[0,0],latencies=[[],[]],nodes=[0,0],rollouts=[0,0],branching=[[],[]],safeLandings=[0,0],truncated=[0,0];
    while(state.terminal===null && state.turns<maxTurns) {
      if(hooks.cancelled && hooks.cancelled()) throw new Error("Experiment cancelled");
      if(state.roll===null) state=E.roll(state);
      if(state.roll!==null) {
        const player=state.turn,spec=specs[player];
        const trace=P.selectAction(state,spec.id,{...spec.config,seed:`${seed}:policy:${player}:${state.turns}`});
        decisions[player]++;latencies[player].push(trace.stats.latencyMs);nodes[player]+=trace.stats.nodes;rollouts[player]+=trace.stats.rollouts;
        branching[player].push(trace.ranked.length);safeLandings[player]+=trace.ranked[0].features.safety;
        truncated[player]+=Number(trace.stats.truncated);
        state=E.step(state,trace.action);
      }
      if(state.turns%32===0) await pause();
    }
    return {seed:E.seedNumber(seed),seedInput:seed,environment:E.VERSION,policies:specs,entry:state.entry,maxTurns,winner:state.terminal,winnerPolicy:state.terminal===null ? null : specs[state.terminal].label,unfinished:state.terminal===null,turns:state.turns,captures:state.captures,completed:state.pieces.map(p=>p.filter(v=>v===E.HOME).length),decisions,latencyMs:latencies.map(mean),nodes,rollouts,branching:branching.map(mean),safeLandings,searchTruncations:truncated,finalState:state};
  }
  function summarize(games,specs) {
    return specs.map(spec=>{
      const rows=games.flatMap(g=>g.policies.flatMap((p,side)=>p.label===spec.label ? [{game:g,side}] : []));
      const n=rows.length,wins=rows.filter(r=>r.game.winner===r.side).length,unfinished=rows.filter(r=>r.game.unfinished).length;
      const perSeed=new Map();
      rows.forEach(r=>{const k=r.game.seedInput;const a=perSeed.get(k)||[];a.push(Number(r.game.winner===r.side));perSeed.set(k,a);});
      const seedRates=[...perSeed.values()].map(mean);
      const decisions=rows.reduce((s,r)=>s+r.game.decisions[r.side],0);
      return {policy:spec.label,games:n,wins,losses:n-wins-unfinished,unfinished,winRate:n ? wins/n : 0,winCI:wilson(wins,n),meanTurns:mean(rows.map(r=>r.game.turns)),decisionLatencyMs:decisions ? rows.reduce((s,r)=>s+r.game.latencyMs[r.side]*r.game.decisions[r.side],0)/decisions : 0,capturesPerGame:mean(rows.map(r=>r.game.captures[r.side])),completedPieces:mean(rows.map(r=>r.game.completed[r.side])),safeLandingRate:decisions ? rows.reduce((s,r)=>s+r.game.safeLandings[r.side],0)/decisions : 0,branching:decisions ? rows.reduce((s,r)=>s+r.game.branching[r.side]*r.game.decisions[r.side],0)/decisions : 0,nodesPerDecision:decisions ? rows.reduce((s,r)=>s+r.game.nodes[r.side],0)/decisions : 0,seedWinRateSD:Math.sqrt(variance(seedRates))};
    });
  }
  async function tournament(options={},hooks={}) {
    const specs=options.policies || Object.keys(P.NAMES).map(id=>policySpec(id,{config:options.policyConfig}));
    const seeds=options.seeds || [2023,2024],gamesPerSide=options.gamesPerSide ?? 1;
    if(specs.length<2 || new Set(specs.map(p=>p.label)).size!==specs.length || !seeds.length || !Number.isInteger(gamesPerSide) || gamesPerSide<1) throw new Error("Invalid tournament configuration");
    const total=specs.length*(specs.length-1)/2*seeds.length*gamesPerSide*2,games=[];
    const started=now();
    for(let a=0;a<specs.length;a++) for(let b=a+1;b<specs.length;b++) for(const seed of seeds) for(let replicate=0;replicate<gamesPerSide;replicate++) {
      // Both starting orders receive the same chance seed; policy randomness is separate.
      const gameSeed=`${seed}:${replicate}`;
      for(const pair of [[specs[a],specs[b]],[specs[b],specs[a]]]) {
        games.push(await playGame(pair[0],pair[1],gameSeed,options,hooks));
        hooks.progress && hooks.progress({phase:"tournament",done:games.length,total});
        await pause();
      }
    }
    return {environment:E.VERSION,kind:"tournament",configuration:{...options,policies:specs,seeds,gamesPerSide,maxTurns:options.maxTurns ?? 400},games,summary:summarize(games,specs),firstPlayerWinRate:games.filter(g=>g.winner===0).length/games.length,unfinished:games.filter(g=>g.unfinished).length,elapsedMs:now()-started,notes:"Win rates include unfinished games in the denominator. Wilson intervals are descriptive game-level intervals; swapped games share seeds. Seed variability is reported separately."};
  }
  function studyPolicies(kind,base={}) {
    if(kind==="ablation") return [policySpec("risk",{label:"Full probability-aware",config:base}),...["safety","capture","progress","mobility","risk"].map(feature=>policySpec("risk",{label:`Without ${feature}`,config:{...base,weights:{...base.weights,[feature]:0}}}))];
    if(kind==="depth") return [1,2,3].map(depth=>policySpec("expectiminimax",{label:`Depth ${depth}`,config:{...base,depth}}));
    if(kind==="budget") return [10,50,100,250,500,1000].map(budget=>policySpec("montecarlo",{label:`Budget ${budget}`,config:{...base,budget}}));
    throw new Error("Unknown study");
  }
  async function study(kind,options={},hooks={}) {
    const variants=studyPolicies(kind,options.policyConfig),baseline=policySpec("heuristic",{label:"Fixed heuristic opponent",config:options.policyConfig});
    const results=[];
    for(let i=0;i<variants.length;i++) {
      const result=await tournament({...options,policies:[variants[i],baseline]}, {...hooks,progress:p=>hooks.progress && hooks.progress({...p,phase:`${kind}: ${variants[i].label}`,variant:i+1,variants:variants.length})});
      results.push(result);
    }
    const scenarioAnalysis=kind==="depth" ? await benchmark({...options,policies:variants},hooks) : null;
    const summary=results.map((r,i)=>({...r.summary[0],...(scenarioAnalysis ? {referenceAgreement:scenarioAnalysis.summary[i].agreement,scenarioNodes:scenarioAnalysis.summary[i].nodes} : {})}));
    return {kind,environment:E.VERSION,configuration:options,variants,results,summary,...(scenarioAnalysis ? {scenarioAnalysis} : {})};
  }
  function csv(rows) {
    if(!rows.length) return "";
    const headers=Object.keys(rows[0]);
    const cell=v=>`"${String(typeof v==="object" ? JSON.stringify(v) : v ?? "").replace(/"/g,'""')}"`;
    return [headers.map(cell).join(","),...rows.map(r=>headers.map(k=>cell(r[k])).join(","))].join("\n");
  }
  return {mean,variance,wilson,policySpec,scenarios,benchmark,playGame,summarize,tournament,studyPolicies,study,csv};
});
