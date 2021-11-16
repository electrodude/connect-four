var Game = {};

(function(Game) {
	// Player
	Game.states = {};
	Game.Player = function(name, isPlayer) {
		this.name      = name;
		this.user_name = name;
		this.player    = isPlayer;
		this.next      = null;
		this.prev      = null;

		// Register state
		Game.states[name] = this;
	}

	Game.Player.prototype.setNext = function(next) {
		if (this.next) {
			throw `${this.name}.next already set!`;
		}
		if (next.prev) {
			throw `${next.name}.prev already set!`;
		}
		this.next = next;
		next.prev = this;
	}

	// Cell state definitions
	const empty = new Game.Player('empty', false);
	const dead  = new Game.Player('dead' , false);
	const red   = new Game.Player('red'  , true );
	const black = new Game.Player('black', true );

	red  .setNext(black);
	black.setNext(red  );


	Game.player_counts = function(all, value) {
		const counts = {};
		value = value ?? 0;
		for (const name in Game.states) {
			const state = Game.states[name];
			if (state.player || all)
				counts[name] = value;
		}
		return counts;
	}


	// Game spec
	const vectors = [
		{x: 1, y: 0},
		{x: 1, y: 1},
		{x: 0, y: 1},
		{x:-1, y: 1},
		// Negation of first four vectors
		{x:-1, y: 0},
		{x:-1, y:-1},
		{x: 0, y:-1},
		{x: 1, y:-1}
	];

	Game.Spec = function(w, h, len, moves_per_ply) {
		this.w = w;
		this.h = h;
		this.len = len;
		this.moves_per_ply = moves_per_ply;
		this.states = {...Game.states};

		// Initialize table mapping each cell => [relevant runs]
		const run_map = [];
		this.run_map = run_map;
		for (let i = 0; i < w*h; i++)
			run_map[i] = [];

		const runs = [];
		this.runs = runs;
		const len_1 = len-1;
		// Build table of all possible runs
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				for (let vi = 0; vi < 4; vi++) {
					const v = vectors[vi];

					// Skip runs that don't fit on the board.
					if (!this.in_range(x + v.x*len_1, y + v.y*len_1))
						continue;

					const run = [];
					const win = {run, id: runs.length};
					runs.push(win);

					run.push({x, y});
					run_map[y*w + x].push(win);
					this.scan(x, y, v, (i, x, y) => {
						run.push({x, y});
						//console.log(x, y, w, h, y*w + x);
						run_map[y*w + x].push(win);

						if (i >= len_1)
							return true;
					});
				}
			}
		}

		this.moves = [];
		for (let i = 0; i <= moves_per_ply; i++) {
			const partial = [];
			const maxdepth = i;
			const width = this.w;
			function* enumerate_moves(depth, start) {
				for (let x = start; x < width; x++) {
					partial[depth] = x;
					if (depth >= maxdepth - 1) {
						yield [...partial];
					} else {
						yield* enumerate_moves(depth + 1, x);
					}
				}
			}

			this.moves[i] = [...enumerate_moves(0, 0)];
		}

	}

	Game.Spec.prototype.in_range = function(x, y) {
		return x >= 0 && y >= 0 && x < this.w && y < this.h;
	}

	Game.Spec.prototype.scan = function(x0, y0, v, cb) {
		//console.log(`Scan from (${x0}, ${y0}) [${this.getCell(x0, y0).name}]: Δ(${v.x}, ${v.y})`);

		let x = x0;
		let y = y0;

		// Start at 1: the caller should have already done 0
		let i = 1;
		while (true) {
			x += v.x;
			y += v.y;

			if (cb(i, x, y))
				break;

			// Complain if cb doesn't catch scan going out of bounds.
			if (!this.in_range(x, y)) {
				console.error(`Scan went out of bounds! ${i}: (${x}, ${y}), Δ(${v.x}, ${v.y})`);
				break;
			}

			i++;
			if (i > 1000) {
				console.error(`Runaway scan! ${i}: (${x}, ${y}), Δ(${v.x}, ${v.y})`);
			}
		}

		return i;
	}


	// Game state
	Game.Board = function(parent) {
		this.parent = parent;

		this.spec           = parent?.spec;
		this.player         = parent?.player;
		this.movesRemaining = parent?.movesRemaining ?? 0;

		this.cells = [];
		this.heights = [];

		this.runs = [];
		this.wins = {};
		this.counts = {};

		this.moves = null;
		this.results = [];
	}

	Game.Board.prototype.init = function(spec) {
		this.spec = spec;

		for (let x = 0; x < spec.w; x++) {
			this.heights[x] = spec.h-1;
		}

		for (let i = 0; i < spec.runs.length; i++) {
			this.runs[i] = Game.player_counts(true);
		}
		this.wins   = Game.player_counts(true, spec.runs.length);
		this.counts = Game.player_counts(true);

		const cells = this.cells;

		for (let y = 0; y < spec.h; y++) {
			for (let x = 0; x < spec.w; x++) {
				this.setCell(x, y, Game.states.empty);
			}
		}

		return this;
	}
	Game.Board.prototype.clone = function() {
		const board2 = new Game.Board(this);

		board2.cells   = [...this.cells  ];
		board2.heights = [...this.heights];
		board2.runs    = [...this.runs   ];
		board2.wins    = {...this.wins   };
		board2.counts  = {...this.counts };

		return board2;
	}

	Game.Board.prototype.getCell = function(x, y) {
		if (!this.spec.in_range(x, y))
			return Game.states.dead;
		return this.cells[y*this.spec.w + x] ?? Game.states.empty;
	}

	Game.Board.prototype.setCell = function(x, y, state) {
		if (!this.spec.in_range(x, y))
			return false;

		const i = y*this.spec.w + x;
		const prev = this.cells[i];
		this.cells[i] = state;

		for (const run_spec of this.spec.run_map[i]) {
			const run_orig = this.runs[run_spec.id];
			const run = {...run_orig};

			if (state) run[state.name]++;
			if (prev ) run[prev .name]--;

			if (state?.player && run[state.name] >= this.spec.len) {
				// Add win
				this.results.push({status: 'win', run: run_spec.id, player: state});
			}
			if (prev?.player && run[prev.name] == this.spec.len-1) {
				// TODO: Correctly back out of win
				console.error(`NYI: Back out of win for ${prev.name}`, run_spec);
			}
			if (prev?.player && !run[prev.name]) {
				// Regain run for prev.next
				this.wins[prev.next.name]++;
			}
			if (state?.player && run[state.name] == 1) {
				// Lose run for state.next
				this.wins[state.next.name]--;
			}

			this.runs[run_spec.id] = run;
		}

		if (state) this.counts[state.name]++;
		if (prev ) this.counts[prev .name]--;

		return prev ?? Game.states.empty;
	}

	Game.Board.prototype.isPositionTaken = function(x, y) {
		return this.getCell(x, y) !== Game.states.empty;
	}


	Game.Board.prototype.evaluate_position = function(min_depth, max_depth, max_time) {

		const time_start = new Date().getTime();

		// Statistics
		let estimates = 0;
		let pvs = 0;
		const wins = Game.player_counts();
		let draws = 0;
		let cutoffs = 0;

		// Killer move table
		//const killer = {};

		function eval_static(board) {
			// Statically evaluate position from perspective of board.player

			const player = board.player;

			// Game over
			if (board.results.length) {
				let score = 0;
				for (const result of board.results) {
					if (result.status == 'win') {
						wins[result.player.name]++;
						if (result.player === player)
							score +=  1e6;
						else
							score += -1e6;
					} else if (result.status == 'draw') {
						draws++;
					}
				}
				return score;
			}

			// Mine vs. his
			//const score = board.counts[player.name] - board.counts[player.next.name];
			//const score = board.wins[player.name] - board.wins[player.next.name];

			let score = 0;
			const cells = board.spec.w*board.spec.h;
			for (let i = 0; i < cells; i++) {
				for (const run_spec of board.spec.run_map[i]) {
					const run = board.runs[run_spec.id];
					const len_curr = run[player     .name];
					const len_next = run[player.next.name];
					if (len_curr && !len_next) {
						score += len_curr*len_curr;
					} else if (len_next && !len_curr) {
						score -= len_next*len_next;
					}
				}
			}

			estimates++;

			return score;
		}

		let pv = [];
		function negamax(board, depth, depth_root, alpha, beta, on_pv) {
			// Deal with trivial cases first
			if (depth <= 0 || board.results.length) {
				const score_static = eval_static(board)
				return {eval_score: score_static};
			}

			// Enumerate legal moves and call static evaluator on each
			const moves = [];
			for (const move_x of board.spec.moves[board.movesRemaining]) {
				/*
				// Optimization to avoid copying the board on illegal moves
				if (move_x.length == 2) {
					if (move_x[0] != move_x[1]) {
						if (board.heights[move_x[0]] <= 1 || board.heights[move_x[1]] <= 1)
							continue;
					} else {
						if (board.heights[move_x[0]] <= 2)
							continue;
					}
				}
				*/
				const move = move_x.map(x => ({x}));

				const board_moved = board.move(move, board.player);

				// Skip illegal moves
				if (!board_moved)
					continue;

				if (board_moved.player == board.player)
					console.error(`Player of next and board move are both ${board_moved.player.name}`);

				let order_score = -eval_static(board_moved);

				const key = move.map(m => `${m.x},${m.y}`).join('+');

				/*
				if (!killer[key])
					killer[key] = {};

				const killer_ent = killer[key];

				if (killer_ent.score)
					order_score = killer_ent.score;
				*/

				const candidate = {move, key, /*killer_ent,*/ board_moved};

				if (on_pv && key == pv[depth_root]) {
					pvs++;
					order_score += 1000;
					candidate.pv = true;
				}

				candidate.order_score = order_score;

				moves.push(candidate);
			}

			// Sort move array best to worst (descending score)
			moves.sort((a, b) => b.order_score - a.order_score);

			// Recursive negamax with alpha-beta pruning
			let best_move = null;
			for (const candidate of moves) {
				const {move, /*killer_ent,*/ board_moved, pv} = candidate;

				const {next_move, eval_score} = negamax(board_moved, depth-1, depth_root+1, -beta, -alpha, pv);
				candidate.next_move = next_move;
				candidate.eval_score = eval_score;

				const next_score = -eval_score;

				// Fail high
				if (next_score >= beta) {
					// TODO: Killer moves
					//killer_ent.score = -next_score;
					//killer_ent.depth = depth-1;

					cutoffs++;
					alpha = beta;
					break;
				}
				// Pass low
				if (next_score > alpha) {
					best_move = candidate;
					alpha = next_score;
				}
			}

			//console.log(`Recursive eval: ${alpha}`);

			return {next_move: best_move, eval_score: alpha};
		}

		let result = null;

		try {
			for (let curr_depth = 3; (curr_depth <= min_depth || (new Date().getTime() - time_start) < max_time) && curr_depth <= max_depth; curr_depth++) {
				estimates = 0; pvs = 0; wins.black = 0; wins.red = 0; draws = 0; cutoffs = 0;
				result = negamax(this, curr_depth, 0, -Infinity, Infinity, true);
				const pv2 = [];
				for (let m = result.next_move; m; m = m.next_move)
					pv2.push(m.key);
				pv = pv2;
				console.log(`${this.player?.name} score: ${result?.eval_score}; ${estimates} estimates, ${pvs} pvs, ${wins.black} black wins, ${wins.red} red wins, ${draws} draws, ${cutoffs} cutoffs, ${(new Date().getTime() - time_start)/1000} s`);
				const msg = `Depth ${curr_depth}: PV ${pv.join(' ')}`;
				const statusEl = document.querySelector('#engine-status');
				statusEl.innerText = msg;
				console.log(msg);
			}
		} catch (e) {
			console.error(e);
		}

		const time_end = new Date().getTime();

		if (result && result.eval_score >= 1e6) {
			console.log(`Win guaranteed for ${this.player?.name}.`);
		} else if (result && result.eval_score <= -1e6) {
			console.log(`Loss inevitable for ${this.player?.name}.`);
		}

		console.log(`${this.player?.name} score: ${result?.eval_score}; ${estimates} estimates, ${pvs} pvs, ${wins.black} black wins, ${wins.red} red wins, ${draws} draws, ${cutoffs} cutoffs, ${(time_end - time_start)/1000} s`);
		//${Object.keys(killer).length} killer entries, 

		console.log(result);

		return result?.next_move?.move;
	}

	Game.Board.prototype.scan = function(x0, y0, v, cb) {
		const board = this;
		return this.spec.scan(x0, y0, v, (i, x, y) => {
			const curr = this.getCell(x, y);
			return cb(i, x, y, curr);
		});
	}

	/*
	Game.Board.prototype.checkDead = function(x, y) {
		const state0 = this.getCell(x, y);

		// A non-player cell can't die
		if (!state0.player)
			return false;

		for (let vi = 0; vi < 4; vi++) {
			const vp = vectors[vi  ];
			const vn = vectors[vi+4];

			let count = 1;

			for (const v of [vp, vn]) {
				this.scan(x, y, v, (i, x, y, curr) => {
					// Stop when we hit a dead cell
					if (curr === Game.states.dead)
						return true;
					// Stop when we hit a cell belonging to the other player
					if (curr.player && curr !== state0)
						return true;
					count++;
				});
			}

			if (count >= this.spec.len) {
				return false;
			}
		}

		this.setCell(x, y, Game.states.dead);

		return true;
	}

	Game.Board.prototype.findDead = function(x, y) {
		// Disc could be dropped into dead position
		this.checkDead(x, y)

		const state0 = this.getCell(x, y);
		for (let vi = 0; vi < 8; vi++) {
			const v = vectors[vi];

			this.scan(x, y, v, (i, x, y, curr) => {
				this.checkDead(x, y)
				// Stop when we hit a dead cell
				if (curr === Game.states.dead)
					return true;
				// TODO: Stop once we've covered enough cells for a win
				if (i >= this.spec.len)
					return true;
			});
		}
	}

	Game.Board.prototype.checkWin = function(x, y) {
		const state0 = this.getCell(x, y);

		// A non-player can't win
		if (!state0.player)
			return null;

		for (let vi = 0; vi < 4; vi++) {
			const vp = vectors[vi  ];
			const vn = vectors[vi+4];

			const result = {player: state0, origin: {x, y}, dir: vp};

			let count = 1;

			this.scan(x, y, vp, (i, x, y, curr) => {
				if (curr !== state0)
					return true;
				count++;
				result.start = {x, y};
			});

			this.scan(x, y, vn, (i, x, y, curr) => {
				if (curr !== state0)
					return true;
				count++;
				result.end = {x, y};
			});

			//console.log(x, y, v, count);

			if (count >= this.spec.len) {
				result.status = 'win';
				this.results.push(result);
				return result;
			}
		}

		return null;
	}
	*/

	Game.Board.prototype.checkDrawn = function() {
		if (this.results.length)
			return this.results;

		// TODO: But it isn't a draw if it's a win.
		if (!this.counts[Game.states.empty.name]) {
			//console.log('All cells are filled');

			const result = {status: 'draw'};
			this.results.push(result);
			return result;
		}

		return null;
	}

	// Determine whether a move is valid, and set or fix its y coordinate
	Game.Board.prototype.testMove = function(move) {
		const x = move.x;
		const y = this.heights[x];
		// Column full
		if (y < 0) {
			//console.error(`Column ${move.x} is full!`);
			return false;
		}
		// If a y was specified, it must be correct
		if (move.y != null && move.y > y) {
			//console.log(`Illegal move: (${move.x}, ${move.y}) already taken by ${this.getCell(move.x, move.y).name}`);
			return false;
		}

		this.heights[x]--;

		if (this.isPositionTaken(x, y)) {
			console.error(`Corrupt height table: (${x}, ${y}) already taken by ${this.getCell(move.x, move.y).name}`);
			return false;
		}

		move.y = y;

		return true;
	}

	Game.Board.prototype.move = function(moves, player) {
		if (this.results.length) {
			console.error(`Player ${player.name} tried moving even though game is already over!`);
			return null;
		}

		const board2 = this.clone();

		if (board2.player != player) {
			console.error(`Player ${player.name} tried moving during ${board2.player.name}'s turn!`);
			return null;
		}

		if (moves.length > board2.movesRemaining) {
			console.error(`Player ${player.name} tried making ${moves.length} moves when he only had ${board2.movesRemaining} left this turn!`);
			return null;
		}

		for (const move of moves) {
			if (!board2.testMove(move)) {
				// Illegal move.
				return null;
			}

			move.prev = board2.setCell(move.x, move.y, player);
			board2.movesRemaining--;
		}

		/*
		for (const move of moves) {
			const x = move.x;
			const y = move.y;

			board2.findDead(x, y);

			board2.checkWin(x, y);
		}
		*/

		board2.moves = moves;

		// Check to see if the game is over.
		board2.checkDrawn()

		// Only consider switching player if game isn't over.
		//if (!board2.results.length) {
			if (board2.movesRemaining <= 0) {
				// Change player and reset number of moves
				board2.movesRemaining = this.spec.moves_per_ply;
				board2.player = board2.player.next;
			}
		//}

		return board2;
	}

	// TODO
	Game.Board.prototype.unmove = function(moves) {
		if (this.movesRemaining == this.spec.moves_per_ply) {
			// Change player back, with zero moves remaining
			this.movesRemaining = 0;
			this.player = this.player.prev;
		}
		if (this.movesRemaining + moves.length > this.spec.moves_per_ply) {
			console.error(`Can't take back ${moves.length} moves, only ${this.spec.moves_per_ply - this.movesRemaining}!`);
		}

		for (const move of moves) {
			const was = this.setCell(move.x, move.y, move.prev);
			if (was !== this.player) {
				console.error(`Removed ${was?.name} cell for ${player?.name}!`);
			}
			this.movesRemaining++;
		}
	}
})(Game);
