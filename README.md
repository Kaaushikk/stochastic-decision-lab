# Stochastic Decision Lab

A stochastic game AI and reproducible evaluation framework, using an Ashta Chamma-style game to compare decisions under chance and adversarial play. Five classical AI policies share one seeded game environment. The interface separates Play, Experiments and Results.

## Run

Requires Node.js 18+ for the experiment scripts and local server. Core gameplay has no package dependencies, build step or installation requirement.

```sh
npm start
```

Open the local URL printed by the server (normally `http://127.0.0.1:4173`). Directly opening `index.html` also supports gameplay, browser experiments, saved results and downloads. Server-hosted experiments run in a background worker; direct-file experiments yield between chunks on the main thread. The report script regenerates a browser-readable result bundle for direct-file mode.

## Implemented

- An immutable, UI-independent environment with seeded cowrie rolls, legal moves, captures, safe squares, bonus turns, exact finishing and illegal-action rejection.
- Random, weighted heuristic, probability-aware, expectiminimax and Monte Carlo rollout policies behind one `selectAction` interface.
- Actual simulated trajectories with terminal/cutoff utility, configurable budgets and sample standard errors.
- Fifty distinct legal benchmark positions, targeted rule checks and a bounded depth-three reference comparison.
- Automated round-robin tournaments with swapped starting positions, multiple seeds and explicit unfinished-game accounting.
- Feature removal ablations, search-depth comparisons and six rollout budgets from 10 through 1,000.
- Candidate rankings, heuristic feature contributions, latency, node counts, rollout diagnostics, decision replay and JSON/CSV exports.
- Animated shells and piece movement, turn feedback, responsive layouts, and cancellation of stale AI callbacks when restarting.
- Saved measured outputs, a regenerated report and automated engine/policy/evaluation tests.

## Reproduce Experiments

```sh
npm test
npm run experiments
npm run report
```

The default command runs the benchmark, 40-game round robin, 24-game feature ablation, 12-game depth study, and 24-game rollout-budget study: 100 games total. It writes `results/*.json` and matching summary CSVs. Simulation-heavy budgets can take several minutes. `npm run report` regenerates `results/report.html` from these saved outputs. The dashboard's Load Saved Runs button imports them for charts and export.

Individual runs:

```sh
node scripts/experiments.cjs benchmark
node scripts/experiments.cjs tournament
node scripts/experiments.cjs ablation
node scripts/experiments.cjs depth
node scripts/experiments.cjs budget
node scripts/experiments.cjs scenarios
```

Default settings are in `experiments/config.json`. Change the seed list, games per side, turn limit, weights, search depth, node budget, rollout count and simulation horizon there. To run the larger disjoint seed set after freezing settings:

```sh
node scripts/experiments.cjs tournament --config=experiments/held-out.json
```

That configuration runs 1,000 games. It is provided for later evaluation; the included results are from the small default configuration. Copy configurations and output folders before changing experimental settings so previous measurements remain available.

## Research Questions

1. How do random, heuristic, probability-aware, tree-search and rollout policies compare under the same rules and chance seeds?
2. How do depth and rollout budget change decisions, win rates, and computation cost?
3. What happens when individual heuristic features are removed without retuning?
4. How sensitive are results to chance seeds and starting side?
5. What can decision traces reveal about capture, safety, progress and cutoff bias?

## API

```js
const E = require('./engine.js');
const P = require('./policies.js');
let state = E.reset(2023, { entry: [1, 8] });
state = E.roll(state);
if (state.roll !== null) {
  const decision = P.selectAction(state, 'expectiminimax', { depth: 2 });
  state = E.step(state, decision.action);
}
```

`roll === null` means a chance event is needed. `terminal` is `null`, `0`, or `1`. A roll with no legal action resolves its pass automatically. `withRoll(state, outcome)` is the deterministic chance transition used by search. `step` derives captures from the current legal action and never trusts caller-supplied destination/capture fields.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Rules and evaluation methodology](docs/METHODOLOGY.md)
- [Measured experiment report](results/report.html)
- [Default configuration](experiments/config.json)
- [Larger held-out configuration](experiments/held-out.json)

## Validation

The Node test suite covers rule transitions, seeded reproduction, probability accounting, state immutability, policy compliance, hand-verifiable MAX/MIN/CHANCE values, rollout counts/reproduction, valid scenario categories, feature removal, paired tournament aggregation, cancellation and CSV escaping.

Optional browser integration checks use Playwright and an installed Chrome browser:

```sh
# Run the local server first. Install Playwright separately for this optional check.
node scripts/ui-check.cjs
```

Set `ASHTA_PLAYWRIGHT` to an absolute Playwright package directory when it is not on Node's module path. Set `ASHTA_BROWSER=msedge` to use Edge. Screenshots and test downloads go into ignored `qa/`. The check exercises gameplay, shell faces, AI decisions, scenario inspection, worker experiments, cancellation, persistence, exports, mobile layouts and direct-file mode.

## Interpretation and Limits

This uses a documented custom 7 x 7 spiral variant, not every regional Ashta Chamma rule. Shells are modeled as fair and independent. The benchmark is curated; agreement with bounded search is not accuracy against a proven optimal policy. Search and rollouts use heuristic cutoff values. More samples reduce sampling error but cannot guarantee a stronger strategy when the rollout policy or horizon is biased.

The included tournament is small. Win rates include unfinished games, and game-level confidence intervals are descriptive because paired games share seeds. Latency varies by device. All saved values come from actual runs; larger evaluation is needed before making superiority claims.

This is classical game AI and simulation, with no trained ML or reinforcement-learning agent. MCTS and learned evaluation remain extensions. The current reconstruction does not establish when features were implemented in the original undergraduate project; describe historical work and later development separately.

## Algorithm References

- [Berkeley CS188: expectimax and mixed adversarial/chance layers](https://inst.eecs.berkeley.edu/~cs188/textbook/games/expectimax.html)
- [Artificial Intelligence A Modern Approach: game playing](https://aima.cs.berkeley.edu/4th-ed/slides-pdf/chapter06.pdf)

These explain the algorithm families. The current implementation and game variant are project-specific, and experimental results are generated locally.
