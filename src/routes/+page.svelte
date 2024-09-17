<script lang="ts">
	import Checkers from '$lib/components/checkers/Checkers.svelte';
	import type { Piece, BoardConfig } from '$lib/components/checkers/types';

	// const pieces: Piece[] = [
	// 	// Red pieces (Player 1) - usually placed at the top (rows 0, 1, 2)
	// 	{ id: 'checker1', position: { x: 0, y: 0 }, color: 0xff0000, type: 'checker' },
	// 	{ id: 'checker2', position: { x: 2, y: 0 }, color: 0xff0000, type: 'checker' },
	// 	{ id: 'checker3', position: { x: 4, y: 0 }, color: 0xff0000, type: 'checker' },
	// 	{ id: 'checker4', position: { x: 6, y: 0 }, color: 0xff0000, type: 'checker' },
	// 	{ id: 'checker5', position: { x: 1, y: 1 }, color: 0xff0000, type: 'checker' },
	// 	{ id: 'checker6', position: { x: 3, y: 1 }, color: 0xff0000, type: 'checker' },
	// 	{ id: 'checker7', position: { x: 5, y: 1 }, color: 0xff0000, type: 'checker' },
	// 	{ id: 'checker8', position: { x: 7, y: 1 }, color: 0xff0000, type: 'checker' },
	// 	{ id: 'checker9', position: { x: 0, y: 2 }, color: 0xff0000, type: 'checker' },
	// 	{ id: 'checker10', position: { x: 2, y: 2 }, color: 0xff0000, type: 'checker' },
	// 	{ id: 'checker11', position: { x: 4, y: 2 }, color: 0xff0000, type: 'checker' },
	// 	{ id: 'checker12', position: { x: 6, y: 2 }, color: 0xff0000, type: 'checker' },

	// 	// Blue pieces (Player 2) - usually placed at the bottom (rows 5, 6, 7)
	// 	{ id: 'checker13', position: { x: 1, y: 5 }, color: 0x0000ff, type: 'checker' },
	// 	{ id: 'checker14', position: { x: 3, y: 5 }, color: 0x0000ff, type: 'checker' },
	// 	{ id: 'checker15', position: { x: 5, y: 5 }, color: 0x0000ff, type: 'checker' },
	// 	{ id: 'checker16', position: { x: 7, y: 5 }, color: 0x0000ff, type: 'checker' },
	// 	{ id: 'checker17', position: { x: 0, y: 6 }, color: 0x0000ff, type: 'checker' },
	// 	{ id: 'checker18', position: { x: 2, y: 6 }, color: 0x0000ff, type: 'checker' },
	// 	{ id: 'checker19', position: { x: 4, y: 6 }, color: 0x0000ff, type: 'checker' },
	// 	{ id: 'checker20', position: { x: 6, y: 6 }, color: 0x0000ff, type: 'checker' },
	// 	{ id: 'checker21', position: { x: 1, y: 7 }, color: 0x0000ff, type: 'checker' },
	// 	{ id: 'checker22', position: { x: 3, y: 7 }, color: 0x0000ff, type: 'checker' },
	// 	{ id: 'checker23', position: { x: 5, y: 7 }, color: 0x0000ff, type: 'checker' },
	// 	{ id: 'checker24', position: { x: 7, y: 7 }, color: 0x0000ff, type: 'checker' }
	// ];
	const pieces: Piece[] = [
		// Red piece (Player 1) - positioned to capture two blue pieces and land in the king row
		{ id: 'checker1', position: { x: 1, y: 3 }, color: 0xff0000, type: 'checker' }, // Red piece

		// Blue pieces (Player 2) - placed to be captured by the red piece
		{ id: 'checker2', position: { x: 2, y: 4 }, color: 0x0000ff, type: 'checker' }, // First blue piece to be captured
		{ id: 'checker3', position: { x: 4, y: 6 }, color: 0x0000ff, type: 'checker' }, // Second blue piece to be captured
		{ id: 'checker4', position: { x: 6, y: 6 }, color: 0x0000ff, type: 'checker' }, // Second blue piece to be captured
		{ id: 'checker5', position: { x: 2, y: 6 }, color: 0x0000ff, type: 'checker' } // Second blue piece to be captured
	];

	const boardConfig: BoardConfig = {
		size: { x: 8, y: 8 },
		squareSize: 1,
		colors: {
			light: 0xffffff,
			dark: 0x000000
		},
		cameraConfig: {
			position: [0, 15, 0],
			lookAt: [0, 0, 0],
			fov: 70,
			near: 0.1,
			far: 1000
		},
		lightConfig: {
			ambientColor: 0x404040,
			directionalColor: 0xffffff,
			directionalIntensity: 0.8
		},
		materialConfig: {
			opacity: 1,
			wireframe: false
		},
		pieces // Add the pieces to the board
	};
</script>

<main>
	<Checkers {boardConfig} />
</main>
