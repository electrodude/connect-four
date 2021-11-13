(function () {
	// Manage focus rings on the playing board
	const styleEl = document.querySelector('#a11y-styles');
	document.addEventListener('mousedown', () => styleEl.innerHTML = '');
	document.addEventListener('keydown', () => styleEl.innerHTML = '.board button:focus{border:5px solid #999}');

	// Add arrow-key navigation to the playing board
	document.onkeydown = function(e) {
		e = e || window.event;

		const arrowKeyCodes = [37, 38, 39, 40];
		const isKeypressArrowKey = (arrowKeyCodes.indexOf(e.keyCode) >= 0);
		const isBoardButtonActive = (document.activeElement.tagName == 'BUTTON');
		const isContentEditableActive = (document.activeElement.isContentEditable)

		if (!isKeypressArrowKey || isContentEditableActive) {
			return;
		}

		if (!isBoardButtonActive) {
			// Focus on the first board location (top-left).
			document.querySelector('#board button').focus();
		} else {
			const activeCell = document.activeElement.parentElement;
			const activeRow = activeCell.parentElement;
			const activeRowCells = [...activeRow.children];
			const activeCellIndex = activeRowCells.indexOf(activeCell);

			if (e.keyCode === 38) {
				const rowBefore = activeRow.previousElementSibling;
				if (rowBefore) rowBefore.children[activeCellIndex].firstElementChild.focus();
			}
			else if (e.keyCode === 40) {
				const rowAfter = activeRow.nextElementSibling;
				if (rowAfter) rowAfter.children[activeCellIndex].firstElementChild.focus();
			}
			else if (e.keyCode === 37) {
				const cellBefore = activeCell.previousElementSibling;
				if (cellBefore) cellBefore.firstElementChild.focus();
			}
			else if (e.keyCode === 39) {
				const cellAfter = activeCell.nextElementSibling;
				if (cellAfter) cellAfter.firstElementChild.focus();
			}
		};
	}
})();
