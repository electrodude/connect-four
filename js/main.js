// Setup the main game logic.

window.addEventListener('DOMContentLoaded', function() {
	/// Create board
	function createBoard(w, h) {
		function on_cell_click(e, x, y) {
			const results = Game.board.results;
			if (results.length && results[0].status)
				return;

			// Capture player names, since we're abusing `span [contenteditable="true"]`s as inputs
			Game.board.player     .user_name = currentPlayerNameEl.textContent;
			Game.board.player.next.user_name = otherPlayerNameEl  .textContent;

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

		document.querySelector('#board').appendChild(tbody);
	}

	createBoard(Game.config.boardLength, Game.config.boardHeight);

	/// Define functions
	// Reset game
	function resetGame() {
		console.log('New Game');

		const spec = new Game.Spec(Game.config.boardLength, Game.config.boardHeight, Game.config.countToWin);

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
	const playAgainEl = document.querySelector('#play-again');
	const playAgainBtnEl = document.querySelector('#play-again-btn');
	const gameBoardEl = document.querySelector('#board');

	undoEl.addEventListener('click', () => Game.do.takeback());
	playAgainBtnEl.addEventListener('click', resetGame);
	currentPlayerNameEl.addEventListener("keydown", handleNameChange);
	otherPlayerNameEl.addEventListener("keydown", handleNameChange);

	// Initialize game
	resetGame();

});
