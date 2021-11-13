// Setup the main game logic.

(function () {
	const prefixEl = document.querySelector('#prefix');
	const primaryTextEl = document.querySelector('.primary');
	const secondaryTextEl = document.querySelector('.secondary');
	const currentPlayerNameEl = document.querySelector('#current-player');
	const otherPlayerNameEl = document.querySelector('#other-player');
	const playAgainEl = document.querySelector('#play-again');
	const playAgainBtnEl = document.querySelector('#play-again-btn');
	const gameBoardEl = document.querySelector('#board');

	playAgainBtnEl.addEventListener('click', () => location.reload());
	gameBoardEl.addEventListener('click', placeGamePiece);
	currentPlayerNameEl.addEventListener("keydown", Game.do.handleNameChange);
	otherPlayerNameEl.addEventListener("keydown", Game.do.handleNameChange);
	Game.do.showPlayer();

	function placeGamePiece(e) {
		if (e.target.tagName !== 'BUTTON') return;

		const targetCell = e.target.parentElement;
		const targetRow = targetCell.parentElement;
		const targetRowCells = [...targetRow.children];
		const gameBoardRowsEls = [...document.querySelectorAll('#board tr')];

		// Detect the x and y position of the button clicked.
		const y_pos_clicked = gameBoardRowsEls.indexOf(targetRow);
		const x_pos = targetRowCells.indexOf(targetCell);

		// Drop piece to the bottom of the column.
		const y_pos = Game.do.dropToBottom(x_pos, y_pos_clicked);

		if (Game.check.isPositionTaken(x_pos, y_pos)) {
			alert(Game.config.takenMsg);
			return;
		}

		// Add the piece to the board.
		Game.do.addDiscToBoard(x_pos, y_pos);
		Game.do.printBoard();

		// Check to see if we have a winner.
		if (Game.check.isVerticalWin() || Game.check.isHorizontalWin() || Game.check.isDiagonalWin()) {
			gameBoardEl.removeEventListener('click', placeGamePiece);
			prefixEl.textContent = Game.config.winMsg;
			currentPlayerNameEl.contentEditable = false;
			secondaryTextEl.remove();
			playAgainEl.classList.add('show');
			return;
		} else if (Game.check.isGameADraw()) {
			gameBoardEl.removeEventListener('click', placeGamePiece);
			primaryTextEl.textContent = Game.config.drawMsg;
			secondaryTextEl.remove();
			playAgainEl.classList.add('show');
			return;
		}

		// Change player.
		Game.do.changePlayer();
	};

})();
