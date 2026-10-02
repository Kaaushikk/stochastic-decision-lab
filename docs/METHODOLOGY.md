# Evaluation Methodology

## Environment

The environment is a custom 7 x 7 spiral variant, version `spiral-7-v1`. It is a model of an Ashta Chamma-style game, not a claim that all regional rules are implemented. Each player owns four pieces. Piece progress is `-1` for reserve, `0..47` for track positions, and `48` for home. Player one uses the 180-degree rotation of player zero's route.

Four independent fair binary shells give probabilities `P(1)=4/16`, `P(2)=6/16`, `P(3)=4/16`, `P(4)=1/16`, and `P(8)=1/16`. This is a modeling assumption; real cowries may be biased. No capture is required to enter the inner track. Unsafe landing captures every opposing piece on the destination. Safe squares protect all pieces; stacking has no separate protection. Entry places a piece at progress zero and uses the whole roll. Exact finishing is required. A capture or a roll of four/eight grants another turn, including when a bonus roll has no legal action.

`reset(seed, {entry})`, `roll(state)`, `withRoll(state, outcome)`, `legalActions(state)`, and `step(state, action)` return new states. A state with `roll === null` needs a chance event; a state with a roll requires a decision. A no-action chance event resolves its pass immediately. The first player with all four pieces home wins. Experiments may stop at a configured turn limit; this is an unfinished game, not an inferred draw or win.

## Policies

- Random: seeded independent random priorities on legal actions; selecting their maximum is uniform over actions.
- Weighted heuristic: engineered action features with the risk contribution disabled. It does not perform tree search.
- Probability-aware: adds the probability that at least one surviving opponent piece could capture the moved piece on the next roll. Shared roll outcomes are counted once, not once per attacker. This is threat exposure, not the probability that an opponent actually chooses that capture.
- Expectiminimax: MAX for the root player, MIN for the opponent, and CHANCE for cowrie outcomes. Bonus turns retain the active player. Depth counts decisions or forced passes; the chance event before a decision does not independently consume depth. Depth one evaluates the root action's successor. Pending leaves use a bounded symmetric heuristic at the depth/node limit. Node limits are per root candidate and stop further expansion; remaining sibling cutoff evaluations can add to the reported node count.
- Monte Carlo: apply each candidate, then run `budget` seeded trajectories with a separate simulation RNG. Both simulated players use a deterministic greedy policy with progress, capture, safety, completion, entry, risk and bonus features; mobility is omitted in this fast rollout policy. Each trajectory ends at a terminal state or `horizon` resolved turns. Terminal utility is +1/-1; truncated trajectories use the same bounded state evaluation as search. The mean return ranks actions. Sample standard error is reported when at least two trajectories are available; it measures sampling uncertainty, not rollout/cutoff bias.

State evaluation sums entry, progress, safe occupancy, completion, capture exposure and mobility for each player, subtracts the opponent's total, and applies `tanh(difference / 300)`. Terminal utility overrides this evaluation. Action feature contributions explain heuristic policies only. Search and rollout features are descriptive and are not an additive explanation of their utility.

## Reproducibility

The chance generator is a deterministic 32-bit Mulberry32 generator. An experiment seed and replicate identify a game chance stream. Policy seeds include the game seed, player side and resolved-turn count. Search does not sample chance nodes. Monte Carlo uses independent simulation streams, so changing a policy's simulation budget never consumes the real game's chance stream.

The same seed/replicate is used for both starting orders of each policy pair. Pairing reduces some chance variation but does not make trajectories identical: captures and bonus turns change who receives each roll. Saved configurations include the environment version, entry rule, policy settings, seed list, turn limit, search depth, simulation horizon, and feature weights. Decisions and outcomes reproduce with the same code/configuration; wall-clock times do not.

## Controlled Benchmarks

There are 50 distinct valid positions in ten tactical categories, including captures, a capture under remaining threat, safe landing, forced action, exact finish, entry choices, equivalent pieces, bonus rolls, and an opponent near home. These are curated positions, including rotated variants. They pass state and category checks but are not a random representative sample of gameplay or accompanied by proofs of reachability.

Forced-action and immediate-win scenarios have explicit expected piece IDs. Other rows record features, legal choices and agreement with bounded depth-three expectiminimax. Reference agreement is not ground-truth accuracy or optimality, and a deeper reference can itself be limited by the evaluation function or node budget. Different policy scores have different units and must not be compared numerically across algorithms.

## Tournaments and Studies

The default exploratory configuration uses two seeds, one game per starting side, a 300-turn cap, depth two, and ten eight-turn rollouts per candidate. The round robin contains 40 games (ten policy pairs, two seeds, two sides). Each policy appears in 16 games. Feature, depth and budget studies compare each variant to a fixed weighted heuristic opponent.

The ablation study sets one feature weight to zero without retuning any others. Depth variants use depths 1, 2 and 3. Budget variants use 10, 50, 100, 250, 500 and 1000 trajectories per action. All retain the same seed list, side swaps, horizon and opponent. Features and evaluation assumptions can be biased; more computation is not guaranteed to overcome this bias.

Win rate is wins divided by all games, including unfinished games. Report unfinished count alongside losses. Wilson intervals are descriptive game-level 95% intervals; they do not model dependence between games sharing seeds. Standard deviation of mean seed win rates is shown separately. Latency is averaged per decision, not per game. Safe-square usage excludes completed pieces; completion is the mean number of pieces home. Starting-side win rate is stored with the tournament.

The saved default runs are small exploratory measurements. They cannot establish statistical superiority, generalization to other rule variants, or performance against human players. `experiments/held-out.json` defines a larger disjoint evaluation set (1,000 round-robin games); it is provided but not run by default. Freeze weights and settings before running that evaluation. Use separate seed/scenario sets for any later tuning and report how the tuning was performed.

## Scope

These policies implement classical AI, planning and simulation. They do not train a model or implement reinforcement learning. MCTS, a learned value function, automated weight tuning, calibrated physical cowrie probabilities, additional rule variants, and search-tree visualization remain optional extensions. Current artifacts are a reconstruction and expansion; their contents do not establish historical development dates.
