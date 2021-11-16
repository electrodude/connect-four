// Top-level glue code

// Engine interface
Game.engine_state = new Var('engine_state');
const engine_state = Game.engine_state;
const engine_msg = new Var('engine_msg');
engine_state.update('stopped');
var engine = null;
function init_engine() {
	if (engine)
		return;

	try {
		engine = new Worker('js/engine.js');
		engine.onmessage = function(e) {
			const data = e.data;
			switch (data.type) {
				case 'idle':
					console.log('Engine idle');
					engine_state.update('idle');
					break;

				case 'status':
					engine_msg.update(data.msg);
					break;

				case 'result':
					const moves = data.data;
					console.log('Engine result:', moves);

					if (engine_state.value != 'busy')
						console.error(`Invalid transition: ${engine_state} -> idle`);
					engine_state.update('idle');

					if (moves)
						Game.do.move(moves);

					break;

				default:
					console.error('Unknown message from engine', data);
					break;
			}
		}
		engine.error = function(e) {
			console.error('Engine error:', e.message);
			// TODO: Notify user
		}
		engine.messageerror = function(e) {
			console.error('Engine messageerror:', e.message);
			// TODO: Notify user
		}

		engine.postMessage({type: 'reset'});

		engine_state.update('starting');

		console.info('Engine starting.');
	} catch (e) {
		alert('Failed to initialize engine.');
		console.error(e);
	}
}

function kill_engine() {
	if (engine) {
		engine.terminate();
		console.info('Engine terminated.');
	}
	engine = null;
	engine_state.update('stopped');
}

init_engine();


// 
Game.do = (function(Game) {
	Game.board = new Var('board');
	/**
	 * Print the contents of our Game.board state to the html page.
	 * Update displayed current player
	 * TODO: Rename to e.g. showBoard
	 */
	Game.board.on(function(board) {
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
		undoEl.disabled = !board.parent || vars.engine_state.value == 'busy';
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

		const curr = Game.board.value;
		const next = curr.move(moves, curr.player);
		if (!next) {
			console.log(`Illegal move: ${moves[0].x}, ${moves[0].y}`);
			return false;
		}

		console.log("Wins:", next.wins);

		Game.board.update(next);

		if (next.results.length) {
			return next.results;
		}

		if (document.querySelector(`#engine_${next.player?.name}`)?.checked) {
			Game.do.move_ai();
		}

		return true;
	}

	function move_ai() {
		const curr = Game.board.value;
		const data = curr.dump();
		data.ai_depth = Game.config.ai_depth;
		data.ai_time = Game.config.ai_time;
		engine.postMessage({type: 'eval', data: data});
		engine_state.update('busy');
	}

	function takeback() {
		const curr = Game.board.value;
		return curr.parent && Game.board.update(curr.parent);
	}

	return {
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
			const board = Game.board.value;
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
				engine_state.on(value => btn.disabled = value == 'busy');
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

		Game.board.update(board_init);

		engine.postMessage({type: 'reset'});
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

	const statusEl = document.querySelector('#engine-status');
	engine_msg.on(msg => statusEl.innerText = msg);

	engine_state.on(value => [engineEl.disabled, engineEl.innerText] = (function(){
		switch (value) {
			case 'busy'    : return [false, 'Interrupt Engine'];
			case 'idle'    : return [false, 'Computer Move'   ];
			case 'starting': return [true , 'Engine Starting' ];
			case 'stopped' : return [true , 'Engine Stopped'  ];
			default        : return [true , '(Invalid state!)'];
		}})());
	engine_state.on(value => engineEl.disabled = value != 'idle' && value != 'busy');
	engine_state.on(value => undoEl.disabled = !Game.board.value?.parent || value == 'busy');

	undoEl.addEventListener('click', () => Game.do.takeback());
	engineEl.addEventListener('click', function() {
		switch (engine_state.value) {
			case 'idle': // busy
				Game.do.move_ai();
				break;
			case 'busy': // interrupt
				kill_engine();
				init_engine();
				break
			default:
		}
	});
	playAgainBtnEl.addEventListener('click', resetGame);
	currentPlayerNameEl.addEventListener("keydown", handleNameChange);
	otherPlayerNameEl.addEventListener("keydown", handleNameChange);

	// Initialize game
	resetGame();

});
