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

	Game.Spec = function(w, h, len) {
		this.w = w;
		this.h = h;
		this.len = len;
		this.states = {...Game.states};
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

		this.counts = {};

		this.moves = null;
		this.results = [];
	}

	Game.Board.prototype.init = function(spec) {
		this.spec = spec;

		for (let x = 0; x < spec.w; x++) {
			this.heights[x] = spec.h-1;
		}

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

		if (state) this.counts[state.name]++;
		if (prev ) this.counts[prev .name]--;

		return prev ?? Game.states.empty;
	}

	Game.Board.prototype.isPositionTaken = function(x, y) {
		return this.getCell(x, y) !== Game.states.empty;
	}


	Game.Board.prototype.scan = function(x0, y0, v, cb) {
		const board = this;
		return this.spec.scan(x0, y0, v, (i, x, y) => {
			const curr = this.getCell(x, y);
			return cb(i, x, y, curr);
		});
	}

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

			if (count >= Game.config.countToWin) {
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
				if (i >= Game.config.countToWin)
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

			if (count >= Game.config.countToWin) {
				result.status = 'win';
				this.results.push(result);
				return result;
			}
		}

		return null;
	}

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

			board2.setCell(move.x, move.y, player);
			board2.movesRemaining--;
		}

		for (const move of moves) {
			const x = move.x;
			const y = move.y;

			board2.findDead(x, y);

			board2.checkWin(x, y);
		}

		board2.moves = moves;

		// Check to see if the game is over.
		board2.checkDrawn()

		// Only consider switching player if game isn't over.
		if (!board2.results.length) {
			if (board2.movesRemaining <= 0) {
				// Change player and reset number of moves
				board2.movesRemaining = Game.config.movesPerTurn;
				board2.player = board2.player.next;
			}
		}

		return board2;
	}
})(Game);

Game.do = (function() {
	/**
	 * Print the contents of our Game.board state to the html page.
	 * Update displayed current player
	 * TODO: Rename to e.g. showBoard
	 */
	function setBoard(board) {
		Game.board = board;

		// Update displayed board
		for (let y = 0; y < board.spec.h; y++) {
			for (let x = 0; x < board.spec.w; x++) {
				const row = document.querySelector('tr:nth-child(' + (1 + y) + ')');
				const cell = row.querySelector('td:nth-child(' + (2 + x) + ')');
				const button = cell.firstElementChild;
				const disc = board.getCell(x, y);
				for (const name in Game.states) {
					if (disc.name === name)
						button.classList.add(name);
					else
						button.classList.remove(name);
				}
			}
		}

		// Update the players in the UI.
		const currentPlayerNameEl = document.querySelector('#current-player');
		const otherPlayerNameEl = document.querySelector('#other-player');

		const currentPlayer = board.player;
		const otherPlayer = currentPlayer.next;

		currentPlayerNameEl.classList.remove(otherPlayer.name);
		currentPlayerNameEl.classList.add(currentPlayer.name);
		currentPlayerNameEl.textContent = currentPlayer.user_name;

		otherPlayerNameEl.classList.remove(currentPlayer.name);
		otherPlayerNameEl.classList.add(otherPlayer.name);
		otherPlayerNameEl.textContent = otherPlayer.user_name;

		// Update top controls
		const controlsWrapperEl = document.querySelector('.top-text');
		const movesRemainingEl = document.querySelector('#moves-remaining');

		const prefixEl = document.querySelector('#prefix');
		const undoEl = document.querySelector('#undo');
		const playAgainBtnEl = document.querySelector('#play-again-btn');

		const results = board.results;
		const result_status = results[0]?.status;

		currentPlayerNameEl.style.display = result_status == 'draw' ? 'none' : '';
		currentPlayerNameEl.contentEditable = !result_status;
		movesRemainingEl.textContent = board.movesRemaining + " " + (board.movesRemaining == 1 ? "move" : "moves") + " remaining";
		undoEl.disabled = !Game.board.parent;
		playAgainBtnEl.disabled = !result_status;

		if (result_status) {
			controlsWrapperEl.classList.add('game-over');
			if (result_status == 'win') {
				prefixEl.textContent = Game.config.winMsg;
			} else if (result_status == 'draw') {
				prefixEl.textContent = Game.config.drawMsg;
			}
		} else {
			prefixEl.textContent = Game.config.currentMsg;
			controlsWrapperEl.classList.remove('game-over');
		}

		return board;
	}

	function move(moves) {
		// Drop piece to the bottom of the column.
		// Add the piece to the board.

		const next = Game.board.move(moves, Game.board.player);
		if (!next) {
			console.log(`Illegal move: ${moves[0].x}, ${moves[0].y}`);
			return false;
		}

		Game.do.setBoard(next);

		if (Game.board.results) {
			return Game.board.results;
		}

		return true;
	}

	function takeback() {
		return Game.board.parent && Game.do.setBoard(Game.board.parent);
	}

	return {
		setBoard,
		move,
		takeback,
	};
})();
