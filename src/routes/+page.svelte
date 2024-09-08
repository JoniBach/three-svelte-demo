<script lang="ts">
	import Checkers from '$lib/components/checkers/Checkers.svelte';
	import type { BoardConfig } from '$lib/components/checkers/types';

	const boardConfig: BoardConfig = {
		size: {
			x: 8,
			y: 8
		},
		squareSize: 1,
		colors: {
			light: 0xffffff, // White squares
			dark: 0x000000 // Black squares
		},
		cameraConfig: {
			position: [0, 15, 0], // Top-down view, higher for a wider view
			lookAt: [0, 0, 0], // Center of the board
			fov: 70, // Field of view (optional)
			near: 0.1, // Near clipping plane (optional)
			far: 1000 // Far clipping plane (optional)
		},
		lightConfig: {
			ambientColor: 0x404040, // Soft ambient light
			directionalColor: 0xffffff, // Directional light color
			directionalIntensity: 0.8 // Intensity of the directional light
		},
		materialConfig: {
			opacity: 1, // Optional transparency
			wireframe: false // Optional wireframe rendering
		}
	};
</script>

<main>
	<Checkers {boardConfig} />
</main>

<style>
	main {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
		margin: 0;
	}
</style>
