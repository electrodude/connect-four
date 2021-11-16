// Game configuration
Game.config = {
	startingPlayer: Game.states.black, // Choose black or red.
	currentMsg: "Current player is: ",
	//winMsg: "The winner is: ",
	winMsg: "The loser is: ",
	drawMsg: "The game is a draw.",

	countToWin: 4,

	startingMoves: 1,
	movesPerTurn: 2,

	boardLength: 7,
	boardHeight: 6,

	ai_depth: 6,
	ai_time: 10e3, // ms
};
