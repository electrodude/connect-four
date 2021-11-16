importScripts('util.js');
importScripts('functions.js');

const engine_msg = new Var('engine_msg');
engine_msg.on(msg => postMessage({type: 'status', msg}));

onmessage = function(e) {
	const data = e.data;
	switch (data.type) {
		case 'reset':
			console.log('Engine reset');
			postMessage({type: 'idle'});
			break;

		case 'eval':
			console.log('Engine eval');
			const board = Game.load_board(data.data);
			let result = null;
			try {
				const max_depth = (board.counts[Game.states.empty.name] - board.movesRemaining) / board.spec.moves_per_ply + 1;
				const moves = board.evaluate_position(data.data.ai_depth, max_depth, data.data.ai_time);
				result = moves;
			} catch (e) {
				console.error(e);
			}
			postMessage({type: 'result', data: result});
			break;

		default:
			console.error('Unknown message to engine:', data);
			break;
	}
}

engine_msg.update('Engine idle');
