<script lang="ts">
	import { onMount } from 'svelte';
	import type { BoardConfig } from './types';
	import * as THREE from 'three';

	export let boardConfig: BoardConfig;

	let canvas: HTMLCanvasElement;

	// Throttled animation loop
	function animateThrottled(
		renderer: THREE.WebGLRenderer,
		scene: THREE.Scene,
		camera: THREE.PerspectiveCamera
	): void {
		let lastRenderTime = 0;
		const renderInterval = 1000 / 30; // Cap to 30 FPS, adjust if needed

		const animate = (currentTime: number) => {
			if (currentTime - lastRenderTime >= renderInterval) {
				renderer.render(scene, camera);
				lastRenderTime = currentTime;
			}
			requestAnimationFrame(animate);
		};

		requestAnimationFrame(animate);
	}

	function addLights(
		scene: THREE.Scene,
		config?: { ambientColor: number; directionalColor: number; directionalIntensity: number }
	): void {
		const ambientLight = new THREE.AmbientLight(config?.ambientColor ?? 0x404040);
		scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(
			config?.directionalColor ?? 0xffffff,
			config?.directionalIntensity ?? 0.5
		);
		directionalLight.position.set(0, 1, 0).normalize();
		scene.add(directionalLight);
	}

	function createScene(): THREE.Scene {
		return new THREE.Scene();
	}

	function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
		const renderer = new THREE.WebGLRenderer({ canvas });
		renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		return renderer;
	}

	function createCamera(
		canvas: HTMLCanvasElement,
		config?: {
			position: [number, number, number];
			lookAt: [number, number, number];
			fov?: number;
			near?: number;
			far?: number;
		}
	): THREE.PerspectiveCamera {
		const camera = new THREE.PerspectiveCamera(
			config?.fov ?? 75,
			canvas.clientWidth / canvas.clientHeight,
			config?.near ?? 0.1,
			config?.far ?? 1000
		);

		const position = config?.position ?? [0, 10, 0];
		const lookAt = config?.lookAt ?? [0, 0, 0];

		camera.position.set(...position);
		camera.lookAt(...lookAt);
		return camera;
	}

	// Pure function to create the checkerboard with configurable materials
	function createCheckerboard(config: BoardConfig): THREE.Group {
		const { size, squareSize, colors, materialConfig } = config;
		const { x: rows, y: columns } = size;
		const board = new THREE.Group();

		for (let x = 0; x < rows; x++) {
			for (let z = 0; z < columns; z++) {
				const color = (x + z) % 2 === 0 ? colors.light : colors.dark;
				const geometry = new THREE.PlaneGeometry(squareSize, squareSize);
				const material = new THREE.MeshBasicMaterial({
					color,
					side: THREE.DoubleSide,
					opacity: materialConfig?.opacity ?? 1, // Optional opacity
					transparent: materialConfig?.opacity !== undefined, // Enable transparency if opacity < 1
					wireframe: materialConfig?.wireframe ?? false // Optional wireframe
				});
				const square = new THREE.Mesh(geometry, material);

				// Rotate the squares to lay flat on the XZ plane
				square.rotation.x = -Math.PI / 2;

				// Position the squares
				square.position.set(x - rows / 2 + squareSize / 2, 0, z - columns / 2 + squareSize / 2);

				// Add each square to the board
				board.add(square);
			}
		}

		return board;
	}

	// Pure function to handle resizing
	function handleResize(
		camera: THREE.PerspectiveCamera,
		renderer: THREE.WebGLRenderer
	): () => void {
		return () => {
			camera.aspect = canvas.clientWidth / canvas.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		};
	}

	// Pure function to initialize and animate the scene
	function initScene(
		canvas: HTMLCanvasElement,
		boardConfig: BoardConfig
	): { scene: THREE.Scene; renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera } {
		const scene = createScene();
		const camera = createCamera(canvas, boardConfig.cameraConfig);
		const renderer = createRenderer(canvas);

		// Create and add the checkerboard to the scene
		const checkerboard = createCheckerboard(boardConfig);
		scene.add(checkerboard);

		// Add lights to the scene
		addLights(scene, boardConfig.lightConfig);

		// Render loop
		const animate = () => {
			requestAnimationFrame(animate);
			renderer.render(scene, camera);
		};
		animate();

		return { scene, renderer, camera };
	}

	// Set up Three.js scene in Svelte's lifecycle hook
	onMount(() => {
		// Initialize scene, renderer, and camera
		const { renderer, camera } = initScene(canvas, boardConfig);

		// Handle window resize
		const resizeHandler = handleResize(camera, renderer);
		window.addEventListener('resize', resizeHandler);

		// Cleanup on component destroy
		return () => {
			window.removeEventListener('resize', resizeHandler);
		};
	});
</script>

<canvas bind:this={canvas} style="border: 1px solid #000; width: 100%; height: 100%;"></canvas>
