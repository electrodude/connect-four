// Top-level glue code

Game.do = (function(Game) {
	Game.board = new Var('board');
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
		undoEl.disabled = !board.parent;
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
	})

	function move(moves) {
		// Drop piece to the bottom of the column.
		// Add the piece to the board.

		const curr = Game.board;
		const next = curr.move(moves, curr.player);
		if (!next) {
			console.log(`Illegal move: ${moves[0].x}, ${moves[0].y}`);
			return false;
		}

		console.log("Wins:", next.wins);

		Game.do.setBoard(next);

		if (next.results.length) {
			return next.results;
		}

		if (document.querySelector(`#engine_${next.player?.name}`)?.checked) {
			Game.do.move_ai();
		}

		return true;
	}

	function move_ai() {
		const curr = Game.board;
		const max_depth = (curr.counts[Game.states.empty.name] - curr.movesRemaining) / curr.spec.len + 1;
		const moves = Game.board.evaluate_position(Game.config.ai_depth, max_depth, Game.config.ai_time);
		if (!moves) {
			return;
		}
		Game.do.move(moves);
	}

	function takeback() {
		const curr = Game.board;
		return curr.parent && Game.do.setBoard(curr.parent);
	}

	return {
		setBoard,
		move,
		move_ai,
		takeback,
	};
})(Game);

window.addEventListener('DOMContentLoaded', function() {
	/// Create board
	function createBoard(node, w, h, len) {
		const spec = new Game.Spec(w, h, len, Game.config.movesPerTurn);

		function on_cell_click(e, x, y) {
			const board = Game.board;
			const results = board.results;
			if (results.length && results[0].status)
				return;

			// Capture player names, since we're abusing `span [contenteditable="true"]`s as inputs
			board.player     .user_name = currentPlayerNameEl.textContent;
			board.player.next.user_name = otherPlayerNameEl  .textContent;

			Game.do.move([{x, y}]);
		};

		const tbody = document.createElement('tbody');

		for (let y = 0; y < h; y++) {
			const row = document.createElement('tr');
			row.classList.add('board-row');
			// Row labels
			{
				const cell = document.createElement('td');
				cell.classList.add('board-label-y');
				//cell.innerText = y;
				cell.innerText = h-y; // Flipped!
				row.appendChild(cell);
			}
			for (let x = 0; x < w; x++) {
				const cell = document.createElement('td');
				cell.classList.add('board-cell');
				const btn = document.createElement('button');
				btn.addEventListener('click', (e) => on_cell_click(e, x, y));
				cell.appendChild(btn);
				row.appendChild(cell);
			}
			tbody.appendChild(row);
		}

		// Column labels
		const labels_x = document.createElement('tr');
		const origin = document.createElement('td');
		labels_x.appendChild(origin);
		for (let x = 0; x < w; x++) {
			const cell = document.createElement('td');
			cell.classList.add('board-label-x');
			cell.innerText = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(x);
			labels_x.appendChild(cell);
		}
		tbody.appendChild(labels_x);

		const table = document.createElement('table');
		table.classList.add('board');
		table.appendChild(tbody);
		table.id = node.id;
		node.replaceWith(table);

		return spec;
	}

	const spec = createBoard(document.querySelector('#board'), Game.config.boardLength, Game.config.boardHeight, Game.config.countToWin);

	/// Define functions
	// Reset game
	function resetGame() {
		console.log('New Game');

		const board_init = new Game.Board().init(spec);

		board_init.player = Game.config.startingPlayer;
		board_init.movesRemaining = Game.config.startingMoves;

		Game.do.setBoard(board_init);
	}

	// Handle edge-cases in name changes
	function handleNameChange(event) {
		// Prevent the default "newline" behavior when hitting "Enter"
		if (event.keyCode === 13) {
			event.preventDefault();
			document.body.focus();
		}
	}


	/// Install hooks
	const currentPlayerNameEl = document.querySelector('#current-player');
	const otherPlayerNameEl = document.querySelector('#other-player');
	const undoEl = document.querySelector('#undo');
	const engineEl = document.querySelector('#engine');
	const playAgainEl = document.querySelector('#play-again');
	const playAgainBtnEl = document.querySelector('#play-again-btn');
	const gameBoardEl = document.querySelector('#board');

	undoEl.addEventListener('click', () => Game.do.takeback());
	engineEl.addEventListener('click', () => Game.do.move_ai());
	playAgainBtnEl.addEventListener('click', resetGame);
	currentPlayerNameEl.addEventListener("keydown", handleNameChange);
	otherPlayerNameEl.addEventListener("keydown", handleNameChange);

	// Initialize game
	resetGame();

});
