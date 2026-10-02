(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AshtaEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = "spiral-7-v1";
  const TRACK = [[6,3],[6,4],[6,5],[6,6],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,5],[0,4],[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[6,1],[6,2],[5,3],[5,2],[5,1],[4,1],[3,1],[2,1],[1,1],[1,2],[1,3],[1,4],[1,5],[2,5],[3,5],[4,5],[5,5],[5,4],[4,3],[4,4],[3,4],[2,4],[2,3],[2,2],[3,2],[4,2]];
  const HOME = TRACK.length;
  const SAFE = new Set(["6,3","3,6","0,3","3,0","1,1","1,5","5,1","5,5"]);
  const OUTCOMES = [{value:1,p:4/16},{value:2,p:6/16},{value:3,p:4/16},{value:4,p:1/16},{value:8,p:1/16}];
  const key = (coord) => coord.join(",");
  function coordinate(player, progress) {
    if (progress === -1) return null;
    if (progress === HOME) return [3,3];
    if (!Number.isInteger(progress) || progress < 0 || progress >= HOME) throw new Error("Invalid piece progress");
    const [r,c] = TRACK[progress];
    return player === 0 ? [r,c] : [6-r,6-c];
  }
  function safe(player, progress) {
    const coord = coordinate(player, progress);
    return progress === HOME || Boolean(coord && SAFE.has(key(coord)));
  }
  function seedNumber(seed) {
    if (Number.isInteger(seed)) return seed >>> 0;
    let hash = 2166136261;
    for (const c of String(seed)) hash = Math.imul(hash ^ c.charCodeAt(0),16777619);
    return hash >>> 0;
  }
  function randomNext(seed) {
    const next = (seed + 0x6D2B79F5) >>> 0;
    let x = Math.imul(next ^ (next >>> 15), next | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return {seed:next,value:((x ^ (x >>> 14)) >>> 0) / 4294967296};
  }
  function rng(seed) {
    let current = seedNumber(seed);
    return () => { const next = randomNext(current); current = next.seed; return next.value; };
  }
  function clone(state) {
    return {...state, pieces:state.pieces.map(p=>p.slice()), entry:state.entry.slice(), captures:state.captures.slice(), shells:state.shells && state.shells.slice()};
  }
  function winner(pieces) {
    return pieces[0].every(p=>p===HOME) ? 0 : pieces[1].every(p=>p===HOME) ? 1 : null;
  }
  function reset(seed=2023, options={}) {
    const entry = options.entry || [1,8];
    if (!Array.isArray(entry) || !entry.length || entry.some(v=>!OUTCOMES.some(o=>o.value===v))) throw new Error("Invalid entry rule");
    return {version:VERSION,pieces:[[-1,-1,-1,-1],[-1,-1,-1,-1]],turn:0,roll:null,lastRoll:null,shells:null,entry:entry.slice(),rng:seedNumber(seed),seed:seedNumber(seed),turns:0,captures:[0,0],terminal:null};
  }
  function validate(state) {
    if (state.version!==VERSION || ![0,1].includes(state.turn)) throw new Error("Invalid environment state");
    if (!Array.isArray(state.pieces) || state.pieces.length!==2 || state.pieces.some(p=>p.length!==4 || p.some(v=>!Number.isInteger(v) || v < -1 || v > HOME))) throw new Error("Invalid pieces");
    if (state.roll!==null && !OUTCOMES.some(o=>o.value===state.roll)) throw new Error("Invalid roll");
    if (winner(state.pieces)!==state.terminal) throw new Error("Inconsistent terminal state");
    return true;
  }
  function legalActions(state) {
    if (state.terminal!==null || state.roll===null) return [];
    const player = state.turn;
    return state.pieces[player].flatMap((from,piece)=>{
      if (from===HOME || (from===-1 && !state.entry.includes(state.roll))) return [];
      const to = from===-1 ? 0 : from+state.roll;
      if (to>HOME) return [];
      const coord = coordinate(player,to);
      const captured = safe(player,to) ? [] : state.pieces[1-player].flatMap((p,i)=>p>=0 && p<HOME && key(coordinate(1-player,p))===key(coord) ? [i] : []);
      return [{piece,player,from,to,type:from===-1 ? "enter" : to===HOME ? "home" : "move",coord,captured}];
    });
  }
  function endTurn(state, capture=false) {
    const next = clone(state);
    next.terminal = winner(next.pieces);
    if (next.terminal===null && !capture && ![4,8].includes(next.roll)) next.turn = 1-next.turn;
    next.turns += 1;
    next.roll = null;
    return next;
  }
  function step(state, action) {
    const piece = typeof action==="number" ? action : action && action.piece;
    const legal = legalActions(state).find(a=>a.piece===piece);
    if (!legal) throw new Error("Illegal action: roll first and choose a legal piece");
    const next = clone(state);
    next.pieces[state.turn][piece] = legal.to;
    legal.captured.forEach(i=>{ next.pieces[1-state.turn][i]=-1; });
    next.captures[state.turn] += legal.captured.length;
    return endTurn(next,legal.captured.length>0);
  }
  function withRoll(state,value) {
    if (state.terminal!==null || state.roll!==null) throw new Error("Cannot roll in this phase");
    if (!OUTCOMES.some(o=>o.value===value)) throw new Error("Invalid cowrie outcome");
    const next = clone(state);
    next.roll=value;
    next.lastRoll=value;
    next.shells=null;
    return legalActions(next).length ? next : endTurn(next);
  }
  function roll(state) {
    if (state.terminal!==null || state.roll!==null) throw new Error("Cannot roll in this phase");
    let current = state.rng;
    const shells = Array.from({length:4},()=>{const n=randomNext(current);current=n.seed;return n.value<0.5;});
    const mouths = shells.filter(Boolean).length;
    const next=withRoll(state,mouths || 8);
    next.rng=current;
    next.shells=shells;
    return next;
  }
  function threatProbability(state,player,piece) {
    const progress=state.pieces[player][piece];
    if (progress<0 || safe(player,progress)) return 0;
    const target=key(coordinate(player,progress));
    return OUTCOMES.reduce((risk,outcome)=>{
      const threatened=state.pieces[1-player].some(from=>from>=0 && from<HOME && from+outcome.value<HOME && key(coordinate(1-player,from+outcome.value))===target);
      return risk+(threatened ? outcome.p : 0);
    },0);
  }
  function mobility(state,player) {
    return OUTCOMES.reduce((sum,o)=>sum + o.p * legalActions({...state,turn:player,roll:o.value,terminal:null}).length,0)/4;
  }
  function describe(action) {return `${action.player===0 ? "Y" : "A"}${action.piece+1} ${action.type}${action.captured.length ? ` / capture ${action.captured.length}` : ""}`;}
  return {VERSION,TRACK,HOME,SAFE,OUTCOMES,key,coordinate,safe,seedNumber,randomNext,rng,clone,reset,validate,winner,legalActions,step,withRoll,roll,threatProbability,mobility,describe};
});
