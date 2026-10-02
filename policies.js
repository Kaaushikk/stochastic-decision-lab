(function(root,factory){
  if(typeof module==="object" && module.exports) module.exports=factory(require("./engine.js"));
  else root.AshtaPolicies=factory(root.AshtaEngine);
})(typeof globalThis!=="undefined" ? globalThis : this,function(E){
  "use strict";
  const NAMES={random:"Random",heuristic:"Weighted heuristic",risk:"Probability-aware",expectiminimax:"Expectiminimax",montecarlo:"Monte Carlo rollouts"};
  const DEFAULT_WEIGHTS={progress:24,capture:90,safety:12,completion:180,entry:18,risk:-70,mobility:10,bonus:8};
  const DEFAULT_CONFIG={depth:2,budget:50,horizon:24,maxNodes:20000,weights:DEFAULT_WEIGHTS};
  const now=()=>typeof performance!=="undefined" ? performance.now() : Date.now();
  function config(options={}) {
    const result={...DEFAULT_CONFIG,...options,weights:{...DEFAULT_WEIGHTS,...options.weights}};
    for(const [name,min,max] of [["depth",1,4],["budget",1,1000],["horizon",1,200],["maxNodes",1,200000]]) {
      if(!Number.isInteger(result[name]) || result[name]<min || result[name]>max) throw new Error(`Invalid ${name}: expected ${min}..${max}`);
    }
    if(Object.values(result.weights).some(v=>!Number.isFinite(v))) throw new Error("Weights must be finite");
    return result;
  }
  function features(state,action) {
    const next=E.step(state,action);
    return {
      progress:(action.to-Math.max(0,action.from))/E.HOME,
      capture:action.captured.reduce((v,i)=>v+1+state.pieces[1-action.player][i]/E.HOME,0),
      safety:action.to<E.HOME && E.safe(action.player,action.to) ? 1 : 0,
      completion:action.to===E.HOME ? 1 : 0,
      entry:action.from===-1 ? 1 : 0,
      risk:next.terminal!==null ? 0 : E.threatProbability(next,action.player,action.piece),
      mobility:E.mobility(next,action.player)-E.mobility(state,action.player),
      bonus:next.terminal===null && next.turn===action.player ? 1 : 0,
    };
  }
  function contributions(f,weights,mode="risk") {
    return Object.fromEntries(Object.entries(f).map(([name,value])=>[name,(mode==="heuristic" && name==="risk") ? 0 : value*weights[name] || 0]));
  }
  const sum=(values)=>Object.values(values).reduce((a,b)=>a+b,0);
  function stateValue(state,player,weights) {
    if(state.terminal!==null) return state.terminal===player ? 1 : -1;
    const value=(p)=>state.pieces[p].reduce((total,position,i)=>{
      if(position===-1) return total;
      return total+weights.entry+weights.progress*position/E.HOME+(position===E.HOME ? weights.completion : weights.safety*Number(E.safe(p,position)))+weights.risk*E.threatProbability(state,p,i);
    },0)+weights.mobility*E.mobility(state,p);
    return Math.tanh((value(player)-value(1-player))/300);
  }
  // Chance transitions do not consume search depth unless the roll forces a pass.
  function search(state,player,depth,weights,stats,limit,used=0) {
    stats.nodes++;
    stats.effectiveDepth=Math.max(stats.effectiveDepth,used);
    if(state.terminal!==null || depth<=0 || stats.nodes>=limit) {
      if(stats.nodes>=limit) stats.truncated=true;
      return stateValue(state,player,weights);
    }
    if(state.roll===null) return E.OUTCOMES.reduce((total,o)=>{
      const next=E.withRoll(state,o.value);
      const pass=next.roll===null;
      return total+o.p*search(next,player,depth-Number(pass),weights,stats,limit,used+Number(pass));
    },0);
    const actions=E.legalActions(state);
    const values=actions.map(a=>search(E.step(state,a),player,depth-1,weights,stats,limit,used+1));
    return state.turn===player ? Math.max(...values) : Math.min(...values);
  }
  function fastAction(state,weights) {
    let best=null,bestScore=-Infinity;
    for(const action of E.legalActions(state)) {
      const next=E.step(state,action);
      const f={progress:(action.to-Math.max(0,action.from))/E.HOME,capture:action.captured.reduce((n,i)=>n+1+state.pieces[1-state.turn][i]/E.HOME,0),safety:action.to<E.HOME && E.safe(action.player,action.to) ? 1 : 0,completion:action.to===E.HOME ? 1 : 0,entry:action.from===-1 ? 1 : 0,risk:next.terminal!==null ? 0 : E.threatProbability(next,action.player,action.piece),bonus:next.terminal===null && next.turn===state.turn ? 1 : 0};
      const score=sum(contributions(f,weights));
      if(score>bestScore) {best=action;bestScore=score;}
    }
    return best;
  }
  function simulate(state,player,options,seed) {
    let next=E.clone(state);
    next.rng=E.seedNumber(seed);
    let decisions=0;
    for(let turn=0;turn<options.horizon && next.terminal===null;turn++) {
      if(next.roll===null) next=E.roll(next);
      if(next.roll!==null && next.terminal===null) {
        next=E.step(next,fastAction(next,options.weights));
        decisions++;
      }
    }
    return {value:stateValue(next,player,options.weights),terminal:next.terminal!==null,decisions};
  }
  function selectAction(state,policy="heuristic",options={}) {
    if(!NAMES[policy]) throw new Error("Unknown policy");
    const actions=E.legalActions(state);
    if(!actions.length) throw new Error("No legal actions");
    const opts=config(options),start=now(),random=E.rng(options.seed ?? `${state.seed}:${state.turns}:${state.turn}:${policy}`);
    let nodes=0,rollouts=0,effectiveDepth=0,truncated=false,terminalRollouts=0;
    const ranked=actions.map(action=>{
      const f=features(state,action),parts=contributions(f,opts.weights,policy);
      let score=sum(parts),stderr=null,completed=0,samples=0;
      if(policy==="random") score=random();
      if(policy==="expectiminimax") {
        const stats={nodes:0,effectiveDepth:1,truncated:false};
        score=search(E.step(state,action),state.turn,opts.depth-1,opts.weights,stats,opts.maxNodes,1);
        nodes+=stats.nodes;effectiveDepth=Math.max(effectiveDepth,stats.effectiveDepth);truncated ||= stats.truncated;
      }
      if(policy==="montecarlo") {
        let total=0,squares=0;
        const next=E.step(state,action);
        for(let i=0;i<opts.budget;i++) {
          const result=simulate(next,state.turn,opts,Math.floor(random()*4294967296));
          total+=result.value;squares+=result.value*result.value;completed+=Number(result.terminal);nodes+=result.decisions;
        }
        score=total/opts.budget;
        stderr=opts.budget>1 ? Math.sqrt(Math.max(0,(squares-total*total/opts.budget)/(opts.budget-1))/opts.budget) : null;
        samples=opts.budget;rollouts+=samples;terminalRollouts+=completed;
      }
      return {action,score,features:f,contributions:parts,stderr,samples,completed};
    }).sort((a,b)=>b.score-a.score || a.action.piece-b.action.piece);
    return {policy,action:ranked[0].action,ranked,config:opts,seed:options.seed ?? `${state.seed}:${state.turns}:${state.turn}:${policy}`,stats:{nodes,rollouts,effectiveDepth,truncated,terminalRollouts,latencyMs:now()-start}};
  }
  return {NAMES,DEFAULT_WEIGHTS,DEFAULT_CONFIG,config,features,contributions,stateValue,search,simulate,selectAction};
});
